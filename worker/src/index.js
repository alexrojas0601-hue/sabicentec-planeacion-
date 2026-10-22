import { calcularTodo, calcularDocente, alertas as calcAlertas, VERSION } from './indicadores.js';
import { sha256hex, aleatorio, hashClave, verificarClave, claveValida, claveTemporal, leerCookie, cookieSesion, cookieBorrar, SESION_HORAS, MAX_FALLOS, BLOQUEO_MIN } from './auth.js';
// API del Sistema de Planeación CENTEC (Cloudflare Worker + D1).
// ROLES (los asigna un administrador en la pestaña «Usuarios»):
//   admin     → todo, incluida la gestión de usuarios y permisos (coordinación académica, vicerrectoría,
//               secretaría académica y rectoría). Los primeros administradores salen del secreto ADMINS.
//   directivo → ve y registra todo el año escolar; no gestiona usuarios (equipo directivo, ~8 personas).
//   docente   → solo sus registros, en las combinaciones curso + área asignadas; si es director de grupo,
//               consulta (solo lectura) todo lo de su curso.
//   agente    → GitHub Actions con el secreto AGENTES_TOKEN: solo lectura para auditorías y cierres.
const J = (d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', ...h } });
const TIPOS = ['planeador','ejecucion','cuaderno','observacion','resultado','piar','transversal','lectura','informe','encuesta'];
// Cuadernos, observación de aula y encuesta estudiantil los registra solo un directivo: nadie se califica a sí mismo.
const TIPOS_DOCENTE = ['planeador','ejecucion','resultado','piar','transversal','lectura','informe'];
const PROHIBIDO = [/\b\d{8,11}\b/, /@[a-z0-9.-]+\.[a-z]{2,}/i, /\b3\d{9}\b/];
const parse = r => ({ ...r, payload: JSON.parse(r.payload) });
const sha256 = sha256hex;
const listaAdmins = env => (env.ADMINS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);

function perfilDe(u) {
  return { rol: u.rol, email: u.email, nombre: u.nombre, cargo: u.cargo || '', debe_cambiar: !!u.debe_cambiar,
    asignaciones: JSON.parse(u.asignaciones || '[]'), direccion: JSON.parse(u.direccion || '[]') };
}
async function perfil(req, env) {
  if (env.AGENTES_TOKEN && req.headers.get('x-agentes-token') === env.AGENTES_TOKEN) return { rol: 'agente', nombre: 'Agentes (GitHub)', email: 'agentes' };
  const sid = leerCookie(req, 'sid');
  if (!sid || sid.length !== 64) return null;
  const s = await env.DB.prepare(`SELECT u.* FROM sesiones s JOIN usuarios u ON u.email = s.email
    WHERE s.token_hash = ? AND s.expira > datetime('now') AND u.activo = 1`).bind(await sha256(sid)).first();
  return s ? perfilDe(s) : null;
}
const esAdmin = pf => pf?.rol === 'admin';
const esDir = pf => pf?.rol === 'admin' || pf?.rol === 'directivo';
const asignado = (pf, grado, area) => (pf.asignaciones || []).some(a => a.grado === grado && (a.area === area || a.area === '*'));
const dirige = (pf, grado) => (pf.direccion || []).includes(grado);
async function regsAnio(env, anio) { return (await env.DB.prepare('SELECT * FROM registros WHERE anio=? ORDER BY creado').bind(anio).all()).results.map(parse); }
async function bitacora(env, anio, accion, detalle, pf) {
  await env.DB.prepare('INSERT INTO bitacora(anio, accion, detalle, usuario) VALUES (?,?,?,?)').bind(anio, accion, detalle, pf.email).run();
}
async function abrirSesion(env, email) {
  const token = aleatorio(32);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM sesiones WHERE expira <= datetime('now')`),
    env.DB.prepare(`INSERT INTO sesiones(token_hash, email, expira) VALUES (?, ?, datetime('now', '+${SESION_HORAS} hours'))`).bind(await sha256(token), email),
    env.DB.prepare(`UPDATE usuarios SET fallos = 0, bloqueado_hasta = NULL, ultimo_ingreso = datetime('now') WHERE email = ?`).bind(email),
  ]);
  return token;
}

// Inicio y cierre de sesión (antes de exigir perfil)
async function rutasSesion(p, req, env) {
  if (p === '/api/login' && req.method === 'POST') {
    const { email: e, clave } = await req.json().catch(() => ({}));
    const email = String(e || '').trim().toLowerCase();
    const malo = J({ error: 'Correo o clave incorrectos.' }, 401);
    if (!email || !clave) return malo;
    let u = await env.DB.prepare('SELECT * FROM usuarios WHERE email = ?').bind(email).first();
    if (u?.bloqueado_hasta && u.bloqueado_hasta > new Date().toISOString().slice(0, 19).replace('T', ' '))
      return J({ error: `Cuenta bloqueada por intentos fallidos. Intente de nuevo en ${BLOQUEO_MIN} minutos o pida a coordinación que restablezca su clave.` }, 429);
    // Primer ingreso de un administrador definido en ADMINS, con la clave inicial (secreto CLAVE_INICIAL)
    if (!u?.clave_hash && listaAdmins(env).includes(email) && env.CLAVE_INICIAL && env.CLAVE_INICIAL.length >= 10 && clave === env.CLAVE_INICIAL) {
      await env.DB.prepare(`INSERT INTO usuarios(email, nombre, cargo, rol, asignaciones, direccion, activo, debe_cambiar)
        VALUES (?, ?, 'Administrador', 'admin', '[]', '[]', 1, 1)
        ON CONFLICT(email) DO UPDATE SET rol='admin', activo=1, debe_cambiar=1`).bind(email, email).run();
      return J({ ok: true, debe_cambiar: true }, 200, { 'set-cookie': cookieSesion(await abrirSesion(env, email)) });
    }
    if (!u || !u.activo || !(await verificarClave(clave, u.clave_hash, u.clave_sal))) {
      if (u) {
        const f = (u.fallos || 0) + 1;
        await env.DB.prepare(`UPDATE usuarios SET fallos = ?, bloqueado_hasta = CASE WHEN ? >= ${MAX_FALLOS} THEN datetime('now', '+${BLOQUEO_MIN} minutes') ELSE NULL END WHERE email = ?`).bind(f, f, email).run();
      }
      return malo;
    }
    return J({ ok: true, debe_cambiar: !!u.debe_cambiar }, 200, { 'set-cookie': cookieSesion(await abrirSesion(env, email)) });
  }
  if (p === '/api/logout' && req.method === 'POST') {
    const sid = leerCookie(req, 'sid');
    if (sid) await env.DB.prepare('DELETE FROM sesiones WHERE token_hash = ?').bind(await sha256(sid)).run();
    return J({ ok: true }, 200, { 'set-cookie': cookieBorrar });
  }
  return null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    const anioQ = () => Number(url.searchParams.get('anio') || new Date().getFullYear());
    try {
      if (p === '/api/health') return J({ ok: true, ts: new Date().toISOString() });
      if (p.startsWith('/descargas/')) { // documentos solo para usuarios con sesión
        const q = await perfil(req, env);
        if (!q || q.debe_cambiar) return new Response('Inicie sesión en planeacion.sabicentec.com para descargar.', { status: 403 });
        return env.ASSETS.fetch(req);
      }
      if (!p.startsWith('/api/')) return env.ASSETS.fetch(req);
      if (req.method === 'POST' && req.headers.get('origin') && new URL(req.headers.get('origin')).host !== url.host)
        return J({ error: 'Origen no permitido' }, 403);

      const rs = await rutasSesion(p, req, env); if (rs) return rs;
      const pf = await perfil(req, env);
      if (!pf) return J({ error: 'Inicie sesión.', login: true }, 401);
      if (p === '/api/yo') return J(pf);
      if (p === '/api/clave' && req.method === 'POST') {
        const { actual, nueva } = await req.json().catch(() => ({}));
        const u = await env.DB.prepare('SELECT * FROM usuarios WHERE email=?').bind(pf.email).first();
        if (!pf.debe_cambiar && !(await verificarClave(actual || '', u.clave_hash, u.clave_sal))) return J({ error: 'La clave actual no es correcta.' }, 400);
        if (!claveValida(nueva)) return J({ error: 'La clave nueva debe tener al menos 10 caracteres, con letras y números.' }, 400);
        const h = await hashClave(nueva);
        await env.DB.prepare('UPDATE usuarios SET clave_hash=?, clave_sal=?, debe_cambiar=0 WHERE email=?').bind(h.hash, h.sal, pf.email).run();
        await bitacora(env, new Date().getFullYear(), 'cambio_clave', '', pf);
        return J({ ok: true });
      }
      if (pf.debe_cambiar) return J({ error: 'Debe crear su clave personal antes de continuar.', debe_cambiar: true }, 403);
      const soloDir = () => esDir(pf) ? null : J({ error: 'Solo el equipo directivo puede hacer esto.' }, 403);
      const soloAdmin = () => esAdmin(pf) ? null : J({ error: 'Solo coordinación académica, vicerrectoría, secretaría académica o rectoría pueden gestionar usuarios.' }, 403);
      const lectura = () => (esDir(pf) || pf.rol === 'agente') ? null : J({ error: 'Sin permiso' }, 403);

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
        const no = soloAdmin(); if (no) return no;
        const anio = Number(p.split('/')[3]);
        await env.DB.prepare('UPDATE anios SET cerrado=1 WHERE anio=?').bind(anio).run();
        await bitacora(env, anio, 'cierre_anual', '', pf);
        return J({ ok: true, anio, cerrado: true });
      }

      // ---------- Registros ----------
      if (p === '/api/registros' && req.method === 'GET') {
        let regs = await regsAnio(env, anioQ());
        if (pf.rol === 'docente') regs = regs.filter(r => r.docente === pf.nombre || dirige(pf, r.grado));
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

      // ---------- Usuarios (solo administradores) ----------
      if (p === '/api/usuarios' && req.method === 'GET') {
        const no = soloAdmin(); if (no) return no;
        const r = (await env.DB.prepare('SELECT email, nombre, cargo, rol, asignaciones, direccion, activo, debe_cambiar, ultimo_ingreso FROM usuarios ORDER BY rol, nombre').all()).results;
        return J({ usuarios: r.map(u => ({ ...u, asignaciones: JSON.parse(u.asignaciones || '[]'), direccion: JSON.parse(u.direccion || '[]') })) });
      }
      if (p === '/api/usuarios' && req.method === 'POST') {
        const no = soloAdmin(); if (no) return no;
        const u = await req.json();
        const email = String(u.email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email) || !u.nombre) return J({ error: 'Correo y nombre son obligatorios' }, 400);
        const rol = ['admin', 'directivo', 'docente'].includes(u.rol) ? u.rol : 'docente';
        if (email === pf.email && rol !== 'admin') return J({ error: 'No puede quitarse a sí mismo el rol de administrador.' }, 400);
        const previo = await env.DB.prepare('SELECT email, clave_hash FROM usuarios WHERE email=?').bind(email).first();
        await env.DB.prepare(`INSERT INTO usuarios(email, nombre, cargo, rol, asignaciones, direccion, activo, debe_cambiar) VALUES (?,?,?,?,?,?,?,1)
          ON CONFLICT(email) DO UPDATE SET nombre=excluded.nombre, cargo=excluded.cargo, rol=excluded.rol, asignaciones=excluded.asignaciones, direccion=excluded.direccion, activo=excluded.activo`)
          .bind(email, u.nombre.trim(), u.cargo || '', rol, JSON.stringify(rol === 'docente' ? (u.asignaciones || []) : []), JSON.stringify(rol === 'docente' ? (u.direccion || []) : []), u.activo === 0 ? 0 : 1).run();
        if (u.activo === 0) await env.DB.prepare('DELETE FROM sesiones WHERE email=?').bind(email).run();
        let temporal = null;
        if (!previo?.clave_hash) { // cuenta nueva: clave temporal que el administrador entrega en persona
          temporal = claveTemporal(); const h = await hashClave(temporal);
          await env.DB.prepare('UPDATE usuarios SET clave_hash=?, clave_sal=?, debe_cambiar=1 WHERE email=?').bind(h.hash, h.sal, email).run();
        }
        await bitacora(env, new Date().getFullYear(), 'usuario', `${email} · ${rol} · ${u.activo === 0 ? 'inactivo' : 'activo'}`, pf);
        return J({ ok: true, clave_temporal: temporal });
      }
      if (p === '/api/usuarios/restablecer' && req.method === 'POST') {
        const no = soloAdmin(); if (no) return no;
        const { email } = await req.json();
        const u = await env.DB.prepare('SELECT email FROM usuarios WHERE email=?').bind(String(email || '').toLowerCase()).first();
        if (!u) return J({ error: 'Usuario no encontrado' }, 404);
        const temporal = claveTemporal(); const h = await hashClave(temporal);
        await env.DB.batch([
          env.DB.prepare('UPDATE usuarios SET clave_hash=?, clave_sal=?, debe_cambiar=1, fallos=0, bloqueado_hasta=NULL WHERE email=?').bind(h.hash, h.sal, u.email),
          env.DB.prepare('DELETE FROM sesiones WHERE email=?').bind(u.email),
        ]);
        await bitacora(env, new Date().getFullYear(), 'restablecer_clave', u.email, pf);
        return J({ ok: true, clave_temporal: temporal });
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
