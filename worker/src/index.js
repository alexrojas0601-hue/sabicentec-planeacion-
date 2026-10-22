import { calcularTodo, calcularDocente, alertas as calcAlertas, VERSION } from './indicadores.js';
// API del Sistema de Planeación CENTEC (Cloudflare Worker + D1).
// IDENTIDAD: Cloudflare Access va delante de todo el dominio y entrega el correo verificado del usuario.
// ROLES:
//   directivo → acceso total. Se define SOLO con el secreto ADMINS (correos separados por coma):
//               rectoría, vicerrectoría, coordinación académica, Paula Andrea Rojas Cairasco, Daniela Rojas Cairasco.
//   docente   → solo sus propios registros, en los grados y áreas que coordinación le asignó (tabla usuarios).
//   agente    → GitHub Actions con el secreto AGENTES_TOKEN: solo lectura para auditorías y cierres.
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });
const TIPOS = ['planeador','ejecucion','cuaderno','observacion','resultado','piar','transversal','lectura','informe','encuesta'];
// Lo que un docente puede registrar de sí mismo. Cuadernos, observación de aula y encuesta estudiantil
// los registra solo un directivo: nadie se califica a sí mismo (control de sesgo).
const TIPOS_DOCENTE = ['planeador','ejecucion','resultado','piar','transversal','lectura','informe'];
const PROHIBIDO = [/\b\d{8,11}\b/, /@[a-z0-9.-]+\.[a-z]{2,}/i, /\b3\d{9}\b/];
const parse = r => ({ ...r, payload: JSON.parse(r.payload) });

async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
// Identidad verificada: solo se acepta el correo que viene dentro del token firmado por Cloudflare Access
// (cabecera Cf-Access-Jwt-Assertion), comprobando firma RS256, audiencia (ACCESS_AUD) y vencimiento.
// Si ACCESS_TEAM o ACCESS_AUD no están configurados, nadie entra (falla cerrado).
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
let CERTS = { keys: null, t: 0 };
async function correo(req, env) {
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD) return '';
  const jwt = req.headers.get('Cf-Access-Jwt-Assertion') || '';
  const [h, p, sig] = jwt.split('.');
  if (!h || !p || !sig) return '';
  try {
    const head = JSON.parse(new TextDecoder().decode(b64u(h)));
    const body = JSON.parse(new TextDecoder().decode(b64u(p)));
    if (Date.now() - CERTS.t > 3600e3 || !CERTS.keys) {
      const r = await fetch(`https://${env.ACCESS_TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`);
      CERTS = { keys: (await r.json()).keys, t: Date.now() };
    }
    const jwk = CERTS.keys.find(k => k.kid === head.kid);
    if (!jwk) return '';
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(sig), new TextEncoder().encode(`${h}.${p}`));
    const aud = [].concat(body.aud || []);
    if (!ok || !aud.includes(env.ACCESS_AUD) || body.exp * 1000 < Date.now()) return '';
    return String(body.email || '').trim().toLowerCase();
  } catch (e) { return ''; }
}
async function perfil(req, env) {
  if (env.AGENTES_TOKEN && req.headers.get('x-agentes-token') === env.AGENTES_TOKEN) return { rol: 'agente', nombre: 'Agentes (GitHub)', email: 'agentes' };
  const email = await correo(req, env);
  if (!email) return null;
  const admins = (env.ADMINS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (admins.includes(email)) {
    const u = await env.DB.prepare('SELECT nombre, cargo FROM usuarios WHERE email=?').bind(email).first();
    return { rol: 'directivo', email, nombre: u?.nombre || email, cargo: u?.cargo || 'Directivo' };
  }
  const u = await env.DB.prepare('SELECT * FROM usuarios WHERE email=? AND activo=1').bind(email).first();
  if (!u || u.rol !== 'docente') return null;
  return { rol: 'docente', email, nombre: u.nombre, cargo: u.cargo || 'Docente', asignaciones: JSON.parse(u.asignaciones || '[]') };
}
const esDir = pf => pf?.rol === 'directivo';
const asignado = (pf, grado, area) => (pf.asignaciones || []).some(a => a.grado === grado && (a.area === area || a.area === '*'));
async function regsAnio(env, anio) { return (await env.DB.prepare('SELECT * FROM registros WHERE anio=? ORDER BY creado').bind(anio).all()).results.map(parse); }
async function bitacora(env, anio, accion, detalle, pf) {
  await env.DB.prepare('INSERT INTO bitacora(anio, accion, detalle, usuario) VALUES (?,?,?,?)').bind(anio, accion, detalle, pf.email).run();
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    const anioQ = () => Number(url.searchParams.get('anio') || new Date().getFullYear());
    try {
      if (p === '/api/health') return J({ ok: true, ts: new Date().toISOString() });
      if (p.startsWith('/descargas/')) { // documentos solo para usuarios autorizados
        if (!(await perfil(req, env))) return new Response('Inicie sesión con un correo autorizado de CENTEC para descargar.', { status: 403 });
        return env.ASSETS.fetch(req);
      }
      if (!p.startsWith('/api/')) return env.ASSETS.fetch(req);

      const pf = await perfil(req, env);
      if (!pf) return J({ error: 'Su correo no está autorizado en el Sistema de Planeación. Pida acceso a coordinación académica.' }, 403);
      const soloDir = () => esDir(pf) ? null : J({ error: 'Solo los directivos autorizados (rectoría, vicerrectoría, coordinación académica) pueden hacer esto.' }, 403);
      const lectura = () => (esDir(pf) || pf.rol === 'agente') ? null : J({ error: 'Sin permiso' }, 403);

      if (p === '/api/yo') return J(pf);

      // ---------- Años ----------
      if (p === '/api/anios' && req.method === 'GET') return J((await env.DB.prepare('SELECT * FROM anios ORDER BY anio').all()).results);
      if (p === '/api/anios' && req.method === 'POST') {
        const no = soloDir(); if (no) return no;
        const { anio, metas } = await req.json();
        await env.DB.prepare('INSERT OR IGNORE INTO anios(anio, metas) VALUES (?, ?)').bind(anio, JSON.stringify(metas || {})).run();
        await bitacora(env, anio, 'apertura_anio', '', pf);
        return J({ ok: true });
      }
      if (p.startsWith('/api/anios/') && p.endsWith('/cerrar') && req.method === 'POST') {
        const no = soloDir(); if (no) return no;
        const anio = Number(p.split('/')[3]);
        await env.DB.prepare('UPDATE anios SET cerrado=1 WHERE anio=?').bind(anio).run();
        await bitacora(env, anio, 'cierre_anual', '', pf);
        return J({ ok: true, anio, cerrado: true });
      }

      // ---------- Registros ----------
      if (p === '/api/registros' && req.method === 'GET') {
        let regs = await regsAnio(env, anioQ());
        if (pf.rol === 'docente') regs = regs.filter(r => r.docente === pf.nombre);
        else { const no = lectura(); if (no) return no; }
        return J(regs);
      }
      if (p === '/api/registros' && req.method === 'POST') {
        if (pf.rol === 'agente') return J({ error: 'Los agentes no registran evidencias' }, 403);
        const items = [].concat(await req.json());
        const out = [];
        for (const it of items) {
          if (!TIPOS.includes(it.tipo)) return J({ error: 'Tipo inválido: ' + it.tipo }, 400);
          if (pf.rol === 'docente') {
            if (!TIPOS_DOCENTE.includes(it.tipo)) return J({ error: 'Cuadernos, observación de aula y encuesta los registra coordinación académica.' }, 403);
            it.docente = pf.nombre; // un docente solo registra a su nombre
            if (!asignado(pf, it.grado, it.area)) return J({ error: `No tiene asignado ${it.area} en ${it.grado}. Pida el ajuste a coordinación.` }, 403);
          }
          const a = await env.DB.prepare('SELECT cerrado FROM anios WHERE anio=?').bind(it.anio).first();
          if (!a) return J({ error: 'Año no abierto: ' + it.anio }, 400);
          if (a.cerrado) return J({ error: 'El año ' + it.anio + ' está cerrado (solo lectura)' }, 409);
          if (it.id) { // no se puede sobrescribir lo de otro
            const prev = await env.DB.prepare('SELECT docente FROM registros WHERE id=?').bind(it.id).first();
            if (prev && pf.rol === 'docente' && prev.docente !== pf.nombre) return J({ error: 'Sin permiso sobre ese registro' }, 403);
          }
          const payload = JSON.stringify(it.payload || {});
          if (it.tipo === 'piar' && PROHIBIDO.some(rx => rx.test(payload))) return J({ error: 'PIAR: use solo código seudónimo, sin documentos, teléfonos ni correos' }, 422);
          const id = it.id || crypto.randomUUID();
          const hash = await sha256(payload);
          await env.DB.prepare(`INSERT OR REPLACE INTO registros(id, anio, periodo, tipo, docente, grado, area, semana, payload, evidencia_url, hash, creado_por)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, it.anio, it.periodo, it.tipo, it.docente, it.grado || null, it.area || null,
            it.semana || null, payload, it.evidencia_url || null, hash, pf.email).run();
          out.push({ id, hash });
        }
        await bitacora(env, items[0]?.anio || 0, 'registro', `${items.length} registro(s)`, pf);
        return J({ ok: true, guardados: out });
      }

      // ---------- Indicadores ----------
      if (p === '/api/indicadores') {
        const per = url.searchParams.get('periodo');
        const regs = await regsAnio(env, anioQ()); // se calcula con TODOS (normalización de observadores) y se filtra la salida
        if (pf.rol === 'docente') return J({ version: VERSION, filas: [calcularDocente(regs, pf.nombre, per ? Number(per) : null)] });
        const no = lectura(); if (no) return no;
        return J(calcularTodo(regs, per ? Number(per) : null));
      }
      if (p === '/api/alertas') {
        const r = (await env.DB.prepare('SELECT * FROM alertas WHERE anio=? AND resuelta=0 ORDER BY id DESC LIMIT 200').bind(anioQ()).all()).results;
        return J(pf.rol === 'docente' ? r.filter(a => a.docente === pf.nombre) : r);
      }
      if (p === '/api/historico') {
        const no = lectura(); if (no) return no;
        const r = await env.DB.prepare(`SELECT s.anio, s.datos FROM snapshots s
          JOIN (SELECT anio, MAX(fecha) f FROM snapshots GROUP BY anio) m ON m.anio=s.anio AND m.f=s.fecha ORDER BY s.anio`).all();
        return J(r.results.map(x => ({ anio: x.anio, ...JSON.parse(x.datos) })));
      }
      if (p === '/api/export') {
        const no = lectura(); if (no) return no;
        const anio = anioQ();
        const [an, reg, lec] = await Promise.all([
          env.DB.prepare('SELECT * FROM anios WHERE anio=?').bind(anio).first(), regsAnio(env, anio),
          env.DB.prepare('SELECT * FROM lecciones WHERE anio=?').bind(anio).all(),
        ]);
        return J({ anio: an, registros: reg, lecciones: lec.results });
      }
      if (p === '/api/lecciones' && req.method === 'POST') {
        const no = soloDir(); if (no) return no;
        const l = await req.json();
        await env.DB.prepare('INSERT INTO lecciones(anio, indicador, resultado, meta, causa_raiz, decision, responsable) VALUES (?,?,?,?,?,?,?)')
          .bind(l.anio, l.indicador, l.resultado, l.meta, l.causa_raiz, l.decision, l.responsable).run();
        return J({ ok: true });
      }
      if (p === '/api/calendario' && req.method === 'POST') {
        const no = soloDir(); if (no) return no;
        const { anio, periodos } = await req.json();
        await env.DB.batch(periodos.map(x => env.DB.prepare('INSERT OR REPLACE INTO calendario VALUES (?,?,?,?,?)').bind(anio, x.periodo, x.inicio, x.fin, x.semanas)));
        return J({ ok: true });
      }

      // ---------- Usuarios (solo directivos) ----------
      if (p === '/api/usuarios' && req.method === 'GET') {
        const no = soloDir(); if (no) return no;
        const r = (await env.DB.prepare('SELECT email, nombre, cargo, rol, asignaciones, activo FROM usuarios ORDER BY nombre').all()).results;
        const admins = (env.ADMINS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
        return J({ directivos: admins, usuarios: r.map(u => ({ ...u, asignaciones: JSON.parse(u.asignaciones || '[]') })) });
      }
      if (p === '/api/usuarios' && req.method === 'POST') {
        const no = soloDir(); if (no) return no;
        const u = await req.json();
        const email = String(u.email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email) || !u.nombre) return J({ error: 'Correo y nombre son obligatorios' }, 400);
        await env.DB.prepare(`INSERT INTO usuarios(email, nombre, cargo, rol, asignaciones, activo) VALUES (?,?,?,?,?,?)
          ON CONFLICT(email) DO UPDATE SET nombre=excluded.nombre, cargo=excluded.cargo, asignaciones=excluded.asignaciones, activo=excluded.activo`)
          .bind(email, u.nombre.trim(), u.cargo || 'Docente', 'docente', JSON.stringify(u.asignaciones || []), u.activo === 0 ? 0 : 1).run();
        await bitacora(env, new Date().getFullYear(), 'usuario', `${email} (${u.activo === 0 ? 'desactivado' : 'activo'})`, pf);
        return J({ ok: true });
      }

      // ---------- Sugerencias (todos) ----------
      if (p === '/api/sugerencias' && req.method === 'POST') {
        const { texto, pantalla } = await req.json();
        if (!texto || texto.length < 10) return J({ error: 'Describa la mejora en al menos 10 caracteres' }, 400);
        if (PROHIBIDO.some(rx => rx.test(texto))) return J({ error: 'No incluya documentos, teléfonos ni correos de estudiantes' }, 422);
        await env.DB.prepare('INSERT INTO sugerencias(texto, pantalla, usuario) VALUES (?,?,?)').bind(texto, pantalla || '', pf.email).run();
        if (env.GH_TOKEN && env.GH_REPO) {
          await fetch(`https://api.github.com/repos/${env.GH_REPO}/issues`, { method: 'POST',
            headers: { authorization: `Bearer ${env.GH_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'centec-planeacion' },
            body: JSON.stringify({ title: 'Sugerencia: ' + texto.slice(0, 70), body: `${texto}\n\nPantalla: ${pantalla || '—'}\nRol: ${pf.rol}\nEnviada desde el aplicativo.`, labels: ['mejora'] }) });
        }
        return J({ ok: true });
      }
      return J({ error: 'no encontrado' }, 404);
    } catch (e) {
      return J({ error: String(e.message || e) }, 500);
    }
  },

  // ===== AUTOMATIZACIÓN: Cron Triggers (ver [triggers] en wrangler.toml) =====
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tareaProgramada(event.cron, env));
  },
};

async function periodoActual(env, anio, hoy) {
  const r = await env.DB.prepare('SELECT * FROM calendario WHERE anio=? AND inicio<=? AND fin>=?').bind(anio, hoy, hoy).first();
  return r ? r.periodo : null;
}
async function avisar(env, texto) {
  if (env.ALERT_WEBHOOK) await fetch(env.ALERT_WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: texto }) });
}
async function dispararAgentes(env, tipo, datos) {
  // Lanza los GitHub Actions de agentes (repository_dispatch) — requiere GH_TOKEN y GH_REPO como secretos del Worker.
  if (!env.GH_TOKEN || !env.GH_REPO) return;
  await fetch(`https://api.github.com/repos/${env.GH_REPO}/dispatches`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.GH_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'centec-planeacion' },
    body: JSON.stringify({ event_type: tipo, client_payload: datos }),
  });
}
async function tareaProgramada(cron, env) {
  const ahora = new Date(Date.now() - 5 * 3600e3); // hora Colombia
  const hoy = ahora.toISOString().slice(0, 10);
  const anio = ahora.getUTCFullYear();
  const r = await env.DB.prepare('SELECT * FROM registros WHERE anio=?').bind(anio).all();
  const regs = r.results.map(x => ({ ...x, payload: JSON.parse(x.payload) }));
  const per = await periodoActual(env, anio, hoy);
  // 1) Fotografía diaria de indicadores (base del histórico y del comparativo año vs año)
  const datos = calcularTodo(regs);
  await env.DB.prepare('INSERT OR REPLACE INTO snapshots VALUES (?,?,?,?)').bind(anio, hoy, per, JSON.stringify(datos)).run();
  // 2) Alertas automáticas
  const nuevas = calcAlertas(regs, anio);
  if (nuevas.length) {
    await env.DB.batch(nuevas.map(a => env.DB.prepare('INSERT INTO alertas(anio, nivel, docente, mensaje) VALUES (?,?,?,?)').bind(anio, a.nivel, a.docente, a.msg)));
  }
  // 3) Viernes: planeadores de la próxima semana pendientes
  if (ahora.getUTCDay() === 5 && per) {
    const docentes = [...new Set(regs.map(x => x.docente))];
    const conPlan = new Set(regs.filter(x => x.tipo === 'planeador' && x.periodo === per).map(x => x.docente));
    const sin = docentes.filter(d => !conPlan.has(d));
    if (sin.length) await avisar(env, `CENTEC: ${sin.length} docente(s) sin planeador registrado en el período ${per}: ${sin.join(', ')}`);
  }
  // 4) Hitos: semanas 5 y 10 de cada período → lanzar auditoría de período con agentes
  if (per) {
    const c = await env.DB.prepare('SELECT inicio FROM calendario WHERE anio=? AND periodo=?').bind(anio, per).first();
    const semana = Math.floor((Date.parse(hoy) - Date.parse(c.inicio)) / (7 * 864e5)) + 1;
    if ((semana === 5 || semana === 10) && ahora.getUTCDay() === 1) {
      await dispararAgentes(env, 'revision-periodo', { anio, periodo: per, semana });
      await avisar(env, `CENTEC: inicia revisión automática semana ${semana} del período ${per}.`);
    }
  }
  const altas = nuevas.filter(a => a.nivel === 'alta').length;
  if (altas && ahora.getUTCDay() === 1) await avisar(env, `CENTEC: ${altas} alerta(s) de prioridad alta. Ver /api/alertas`);
}
