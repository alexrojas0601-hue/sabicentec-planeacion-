import { calcularTodo, alertas as calcAlertas, VERSION } from './indicadores.js';
// API del Sistema de Planeación CENTEC (Cloudflare Worker + D1).
// Protección recomendada: Cloudflare Access delante de todo el dominio.
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });
const TIPOS = ['planeador','ejecucion','cuaderno','observacion','resultado','piar','transversal','lectura','informe','encuesta'];
// Patrones que nunca deben entrar (datos personales de menores, Ley 1581/2012)
const PROHIBIDO = [/\b\d{8,11}\b/, /@[a-z0-9.-]+\.[a-z]{2,}/i, /\b3\d{9}\b/];

async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function usuario(req) { return req.headers.get('Cf-Access-Authenticated-User-Email') || 'anonimo'; }
function puedeEscribir(req, env) {
  const u = usuario(req);
  if (u === 'anonimo') return false;
  const eds = (env.EDITORES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return eds.length === 0 || eds.includes(u.toLowerCase()) || u.toLowerCase().endsWith('@centec.edu.co');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      if (p === '/api/health') return J({ ok: true, ts: new Date().toISOString() });

      if (p === '/api/anios' && req.method === 'GET') {
        const r = await env.DB.prepare('SELECT * FROM anios ORDER BY anio').all();
        return J(r.results);
      }
      if (p === '/api/anios' && req.method === 'POST') {
        if (!puedeEscribir(req, env)) return J({ error: 'sin permiso' }, 403);
        const { anio, metas } = await req.json();
        await env.DB.prepare('INSERT OR IGNORE INTO anios(anio, metas) VALUES (?, ?)').bind(anio, JSON.stringify(metas || {})).run();
        return J({ ok: true });
      }
      if (p.startsWith('/api/anios/') && p.endsWith('/cerrar') && req.method === 'POST') {
        if (!puedeEscribir(req, env)) return J({ error: 'sin permiso' }, 403);
        const anio = Number(p.split('/')[3]);
        await env.DB.batch([
          env.DB.prepare('UPDATE anios SET cerrado=1 WHERE anio=?').bind(anio),
          env.DB.prepare('INSERT INTO bitacora(anio, accion, usuario) VALUES (?, "cierre_anual", ?)').bind(anio, usuario(req)),
        ]);
        return J({ ok: true, anio, cerrado: true });
      }

      if (p === '/api/registros' && req.method === 'GET') {
        const anio = Number(url.searchParams.get('anio') || new Date().getFullYear());
        const per = url.searchParams.get('periodo');
        const q = per ? env.DB.prepare('SELECT * FROM registros WHERE anio=? AND periodo=? ORDER BY creado').bind(anio, Number(per))
                      : env.DB.prepare('SELECT * FROM registros WHERE anio=? ORDER BY creado').bind(anio);
        const r = await q.all();
        return J(r.results.map(x => ({ ...x, payload: JSON.parse(x.payload) })));
      }
      if (p === '/api/registros' && req.method === 'POST') {
        if (!puedeEscribir(req, env)) return J({ error: 'sin permiso' }, 403);
        const items = [].concat(await req.json());
        const out = [];
        for (const it of items) {
          if (!TIPOS.includes(it.tipo)) return J({ error: 'tipo inválido: ' + it.tipo }, 400);
          const a = await env.DB.prepare('SELECT cerrado FROM anios WHERE anio=?').bind(it.anio).first();
          if (!a) return J({ error: 'año no abierto: ' + it.anio }, 400);
          if (a.cerrado) return J({ error: 'año cerrado: ' + it.anio + ' (solo lectura)' }, 409);
          const payload = JSON.stringify(it.payload || {});
          if (it.tipo === 'piar' && PROHIBIDO.some(rx => rx.test(payload))) return J({ error: 'PIAR: use solo código seudónimo, sin documentos, teléfonos ni correos' }, 422);
          const id = it.id || crypto.randomUUID();
          const hash = await sha256(payload);
          await env.DB.prepare(`INSERT OR REPLACE INTO registros(id, anio, periodo, tipo, docente, grado, area, semana, payload, evidencia_url, hash, creado_por)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, it.anio, it.periodo, it.tipo, it.docente, it.grado || null, it.area || null,
            it.semana || null, payload, it.evidencia_url || null, hash, usuario(req)).run();
          out.push({ id, hash });
        }
        await env.DB.prepare('INSERT INTO bitacora(anio, accion, detalle, usuario) VALUES (?, "registro", ?, ?)')
          .bind(items[0]?.anio || 0, `${items.length} registros`, usuario(req)).run();
        return J({ ok: true, guardados: out });
      }

      if (p === '/api/export') {
        const anio = Number(url.searchParams.get('anio') || new Date().getFullYear());
        const [an, reg, lec] = await Promise.all([
          env.DB.prepare('SELECT * FROM anios WHERE anio=?').bind(anio).first(),
          env.DB.prepare('SELECT * FROM registros WHERE anio=?').bind(anio).all(),
          env.DB.prepare('SELECT * FROM lecciones WHERE anio=?').bind(anio).all(),
        ]);
        return J({ anio: an, registros: reg.results.map(x => ({ ...x, payload: JSON.parse(x.payload) })), lecciones: lec.results });
      }
      if (p === '/api/lecciones' && req.method === 'POST') {
        if (!puedeEscribir(req, env)) return J({ error: 'sin permiso' }, 403);
        const l = await req.json();
        await env.DB.prepare('INSERT INTO lecciones(anio, indicador, resultado, meta, causa_raiz, decision, responsable) VALUES (?,?,?,?,?,?,?)')
          .bind(l.anio, l.indicador, l.resultado, l.meta, l.causa_raiz, l.decision, l.responsable).run();
        return J({ ok: true });
      }
      if (p === '/api/indicadores') {
        const anio = Number(url.searchParams.get('anio') || new Date().getFullYear());
        const per = url.searchParams.get('periodo');
        const r = await env.DB.prepare('SELECT * FROM registros WHERE anio=?').bind(anio).all();
        const regs = r.results.map(x => ({ ...x, payload: JSON.parse(x.payload) }));
        return J(calcularTodo(regs, per ? Number(per) : null));
      }
      if (p === '/api/alertas') {
        const anio = Number(url.searchParams.get('anio') || new Date().getFullYear());
        const r = await env.DB.prepare('SELECT * FROM alertas WHERE anio=? AND resuelta=0 ORDER BY id DESC LIMIT 200').bind(anio).all();
        return J(r.results);
      }
      if (p === '/api/historico') { // comparativo interanual automático
        const r = await env.DB.prepare(`SELECT s.anio, s.datos FROM snapshots s
          JOIN (SELECT anio, MAX(fecha) f FROM snapshots GROUP BY anio) m ON m.anio=s.anio AND m.f=s.fecha ORDER BY s.anio`).all();
        return J(r.results.map(x => ({ anio: x.anio, ...JSON.parse(x.datos) })));
      }
      if (p === '/api/calendario' && req.method === 'POST') {
        if (!puedeEscribir(req, env)) return J({ error: 'sin permiso' }, 403);
        const { anio, periodos } = await req.json();
        await env.DB.batch(periodos.map(x => env.DB.prepare('INSERT OR REPLACE INTO calendario VALUES (?,?,?,?,?)').bind(anio, x.periodo, x.inicio, x.fin, x.semanas)));
        return J({ ok: true });
      }
      if (p === '/api/sugerencias' && req.method === 'POST') {
        // Cualquier usuario autenticado puede sugerir; se convierte en issue "mejora" que procesa el agente ingeniero-mejora-continua
        const { texto, pantalla } = await req.json();
        if (!texto || texto.length < 10) return J({ error: 'Describa la mejora en al menos 10 caracteres' }, 400);
        if (PROHIBIDO.some(rx => rx.test(texto))) return J({ error: 'No incluya documentos, teléfonos ni correos de estudiantes' }, 422);
        await env.DB.prepare('INSERT INTO sugerencias(texto, pantalla, usuario) VALUES (?,?,?)').bind(texto, pantalla || '', usuario(req)).run();
        if (env.GH_TOKEN && env.GH_REPO) {
          await fetch(`https://api.github.com/repos/${env.GH_REPO}/issues`, { method: 'POST',
            headers: { authorization: `Bearer ${env.GH_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'centec-planeacion' },
            body: JSON.stringify({ title: 'Sugerencia: ' + texto.slice(0, 70), body: `${texto}\n\nPantalla: ${pantalla || '—'}\nEnviada desde el aplicativo.`, labels: ['mejora'] }) });
        }
        return J({ ok: true });
      }
      if (p.startsWith('/api/')) return J({ error: 'no encontrado' }, 404);
      return env.ASSETS.fetch(req);
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
