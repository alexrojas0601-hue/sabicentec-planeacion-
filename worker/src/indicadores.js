// Motor de indicadores CENTEC (compartido por Worker, scripts y app web).
// VERSIONADO: si cambias una fórmula, sube VERSION; el comparativo interanual detecta "serie rota".
export const VERSION = '1.0'; // 2027: primera serie

// Pesos del Índice de Cumplimiento Docente (ICD) — basados en evidencia (MET Project, Teach/Banco Mundial,
// EEF). Lo burocrático (puntualidad) pesa poco; la práctica observada y el aprendizaje pesan más.
export const PESOS = {
  puntualidad: 0.05,   // C1 planeadores entregados a tiempo (marca de tiempo del servidor)
  ejecucion:   0.10,   // C2 semanas con evidencia fechada / semanas planeadas
  cobertura:   0.10,   // C3 DBA con actividad y evaluación evidenciadas / DBA programados
  planeador:   0.10,   // C4 rúbrica R1 (8 criterios 0–3)
  cuadernos:   0.10,   // C5 rúbrica R2 (5 criterios 0–3) sobre muestra ALEATORIA y ciega
  observacion: 0.20,   // C6 Teach 1–5, ≥2 observadores, kappa válido, normalizado por observador
  aprendizaje: 0.15,   // C7 ganancia de Hake con contracción bayesiana (grupos pequeños)
  inclusion:   0.10,   // C8 ajustes PIAR evidenciados / comprometidos (Decreto 1421/2017)
  transversal: 0.05,   // C9 proyectos transversales con producto y evidencia fechada
  estudiantes: 0.05,   // C10 encuesta estudiantil anónima (7Cs adaptada), n ≥ 10
};
export const SEMAFORO = [
  { min: 85, nivel: 'Verde — cumple con excelencia', color: 'verde', accion: 'Reconocimiento y rol de mentor par' },
  { min: 70, nivel: 'Amarillo — cumple parcialmente', color: 'amarillo', accion: 'Plan de mejora con 2 metas observables; re-medición en 6 semanas' },
  { min: 0,  nivel: 'Rojo — no cumple', color: 'rojo', accion: 'Plan intensivo; observación cada 2 semanas' },
];
export const G_MEDIA_COLEGIO_DEFECTO = 0.30;
export const K_CONTRACCION = 10;
export const UMBRAL_TRIANGULACION = 25;
export const MIN_FUENTES = 3;   // nunca se califica a un docente con menos de 3 fuentes independientes
export const KAPPA_MIN = 0.60;

const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const e5 = en => (en[0].escala || 5);
const pct = (n, d) => d > 0 ? Math.max(0, Math.min(100, 100 * n / d)) : null;
const escala = (v, min, max) => v == null ? null : 100 * (v - min) / (max - min); // 1–4 o 1–5 → 0–100

// Ganancia normalizada de Hake (0–1); se lleva a 0–100 con 0.7 = 100 (ganancia "alta").
export function hake(pre, post) {
  if (pre == null || post == null || pre >= 100) return null;
  return (post - pre) / (100 - pre);
}
// Kappa de Cohen para dos observadores sobre las mismas categorías (enteros).
export function kappa(a, b) {
  if (!a || !b || a.length !== b.length || !a.length) return null;
  const cats = [...new Set([...a, ...b])];
  const n = a.length;
  const po = a.filter((x, i) => x === b[i]).length / n;
  const pe = cats.reduce((s, c) => s + (a.filter(x => x === c).length / n) * (b.filter(x => x === c).length / n), 0);
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}
// Kappa ponderado lineal (más justo para escalas ordinales 1–4)
export function kappaPonderado(a, b, k = 4) {
  if (!a || !b || a.length !== b.length || !a.length) return null;
  const n = a.length, w = (i, j) => 1 - Math.abs(i - j) / (k - 1);
  let po = 0; for (let i = 0; i < n; i++) po += w(a[i], b[i]); po /= n;
  let pe = 0;
  for (let i = 1; i <= k; i++) for (let j = 1; j <= k; j++)
    pe += w(i, j) * (a.filter(x => x === i).length / n) * (b.filter(x => x === j).length / n);
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}
// Sorteo reproducible (mulberry32) para muestreo de cuadernos
export function sortear(semillaTexto, total, k) {
  let h = 1779033703 ^ semillaTexto.length;
  for (let i = 0; i < semillaTexto.length; i++) { h = Math.imul(h ^ semillaTexto.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  let s = h >>> 0;
  const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pool = Array.from({ length: total }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, Math.min(k, total)).sort((a, b) => a - b);
}
export function tamanoMuestra(n) { return Math.max(5, Math.ceil(n * 0.2)); }

// Normalización por observador: corrige indulgencia/severidad sistemática.
function sesgoObservadores(regs) {
  const porObs = {};
  for (const r of regs.filter(r => r.tipo === 'observacion')) {
    for (const o of [r.payload.obs1, r.payload.obs2].filter(Boolean)) {
      (porObs[o.observador] ||= []).push(avg(o.puntajes));
    }
  }
  const global = avg(Object.values(porObs).flat());
  const ajuste = {};
  for (const [k, v] of Object.entries(porObs)) ajuste[k] = v.length >= 3 ? avg(v) - global : 0;
  return ajuste;
}

// Calcula los 9 componentes + ICD para un docente en un período (o año si periodo=null)
export function calcularDocente(regs, docente, periodo = null) {
  const R = regs.filter(r => r.docente === docente && (periodo == null || r.periodo === periodo));
  const por = t => R.filter(r => r.tipo === t).map(r => r.payload);
  const ajusteObs = sesgoObservadores(regs);
  const c = {};
  const pl = por('planeador');
  c.puntualidad = pl.length ? pct(pl.filter(p => p.a_tiempo).length, pl.length) : null;
  c.planeador = pl.length ? escala(avg(pl.map(p => avg(p.rubrica || []))), 0, 3) : null;
  const dbaT = pl.reduce((s, p) => s + (p.dba_total || 0), 0);
  c.cobertura = dbaT ? pct(pl.reduce((s, p) => s + (p.dba_cubiertos || 0), 0), dbaT) : null;
  const ej = por('ejecucion');
  c.ejecucion = ej.length ? pct(ej.reduce((s, e) => s + e.semanas_ejecutadas, 0), ej.reduce((s, e) => s + e.semanas_planeadas, 0)) : null;
  const cu = por('cuaderno');
  c.cuadernos = cu.length ? escala(avg(cu.flatMap(x => x.puntajes || [])), 0, 3) : null;
  const ob = por('observacion');
  const kappas = [];
  const vals = [];
  for (const o of ob) {
    const ps = [o.obs1, o.obs2].filter(Boolean);
    if (o.obs1 && o.obs2) {
      const k = kappaPonderado(o.obs1.puntajes, o.obs2.puntajes, 5);
      kappas.push(k);
      if (k < KAPPA_MIN) continue; // observación no fiable: no cuenta
    }
    vals.push(avg(ps.map(x => avg(x.puntajes) - (ajusteObs[x.observador] || 0))));
  }
  c.observacion = vals.length ? Math.max(0, Math.min(100, escala(avg(vals), 1, 5))) : null;
  const observadores = new Set(ob.flatMap(o => [o.obs1, o.obs2].filter(Boolean).map(x => x.observador)));
  // Ganancia: promedio por estudiante (excluye pre > 90, efecto techo) + contracción hacia la media del colegio
  const res = por('resultado');
  const gs = res.flatMap(r => (r.estudiantes || [{ pre: r.pre, post: r.post }]).filter(e => e.pre <= 90).map(e => hake(e.pre, e.post))).filter(x => x != null);
  if (gs.length) {
    const n = gs.length, gm = (regs.gMediaColegio ?? G_MEDIA_COLEGIO_DEFECTO);
    const gAj = (n / (n + K_CONTRACCION)) * avg(gs) + (K_CONTRACCION / (n + K_CONTRACCION)) * gm;
    c.aprendizaje = Math.max(0, Math.min(100, 100 * (gAj - 0.10) / 0.40)); // g ≤ 0,10 → 0 ; g ≥ 0,50 → 100
  } else c.aprendizaje = null;
  const pi = por('piar');
  c.inclusion = pi.length ? pct(pi.reduce((s, p) => s + p.ajustes_evidenciados, 0), pi.reduce((s, p) => s + p.ajustes_planeados, 0)) : null;
  const tr = por('transversal');
  c.transversal = tr.length ? pct(tr.reduce((s, t) => s + t.fases_evidenciadas, 0), tr.length * 5) : null;

  const en = por('encuesta').filter(e => (e.n || 0) >= 10);
  c.estudiantes = en.length ? escala(avg(en.map(e => e.promedio)), 1, e5(en)) : null;

  const disponibles = Object.entries(c).filter(([, v]) => v != null);
  const fuentes = new Set(R.map(r => r.tipo)).size;
  let icd = null;
  if (fuentes >= MIN_FUENTES && disponibles.length) {
    const w = disponibles.reduce((s, [k]) => s + PESOS[k], 0);
    icd = disponibles.reduce((s, [k, v]) => s + PESOS[k] * v, 0) / w; // re-pondera sin inventar ceros
  }
  // Reglas de bloqueo: lo administrativo no compensa lo esencial
  const reglas = [];
  let tope = 100;
  if (c.ejecucion != null && c.ejecucion < 60) { tope = Math.min(tope, 69.9); reglas.push('Ejecución < 60 %: rojo automático (la planeación no se está ejecutando)'); }
  if (c.inclusion != null && c.inclusion < 80) { tope = Math.min(tope, 84.9); reglas.push('PIAR < 80 %: máximo amarillo'); }
  if (c.observacion != null && c.observacion < 50 && observadores.size >= 2) { tope = Math.min(tope, 84.9); reglas.push('Observación < 50 con 2 observadores: máximo amarillo'); }
  if (icd != null) icd = Math.min(icd, tope);
  // Ningún rojo con observaciones no fiables
  const kappaBaja = kappas.some(k => k < KAPPA_MIN);
  if (icd != null && icd < 70 && kappaBaja && reglas.length === 0) reglas.push('Rojo suspendido: repetir observación (kappa < 0,60)');
  // Triangulación: fuentes que difieren > 25 puntos → revisión antes de asignar color
  const tri = ['observacion', 'cuadernos', 'aprendizaje', 'estudiantes'].map(k => c[k]).filter(v => v != null);
  const discrepancia = tri.length >= 2 && (Math.max(...tri) - Math.min(...tri)) > UMBRAL_TRIANGULACION;
  if (discrepancia) reglas.push('Fuentes difieren > 25 puntos: tercera observación sin aviso y nueva revisión de cuadernos antes del color definitivo');
  const sem = icd == null ? { nivel: 'Sin datos suficientes (< 3 fuentes)', color: 'gris' }
            : (kappaBaja && icd < 70 && !reglas.some(r => r.startsWith('Ejecución'))) ? { nivel: 'Pendiente — repetir observación', color: 'gris' }
            : SEMAFORO.find(s => icd >= s.min);
  return {
    docente, periodo, componentes: c, icd: icd == null ? null : Math.round(icd * 10) / 10,
    semaforo: sem, fuentes, cobertura_pesos: Math.round(100 * disponibles.reduce((s, [k]) => s + PESOS[k], 0)),
    kappa_promedio: kappas.length ? Math.round(avg(kappas) * 100) / 100 : null,
    observaciones_descartadas: kappas.filter(k => k < KAPPA_MIN).length,
    observadores: observadores.size, reglas, discrepancia,
  };
}
export function calcularTodo(regs, periodo = null) {
  const docentes = [...new Set(regs.map(r => r.docente))].sort();
  const filas = docentes.map(d => calcularDocente(regs, d, periodo));
  const icds = filas.map(f => f.icd).filter(x => x != null);
  return { version: VERSION, periodo, filas, institucional: icds.length ? Math.round(avg(icds) * 10) / 10 : null };
}
// Alertas automáticas (las usa el cron diario)
export function alertas(regs, anio, hoy = new Date()) {
  const out = [];
  for (const f of calcularTodo(regs).filas) {
    if (f.icd != null && f.icd < 70) out.push({ nivel: 'alta', docente: f.docente, msg: `ICD ${f.icd} (Rojo): plan de mejora intensivo` });
    if (f.fuentes < MIN_FUENTES) out.push({ nivel: 'media', docente: f.docente, msg: `Solo ${f.fuentes} fuentes de evidencia; faltan registros` });
    if (f.observaciones_descartadas) out.push({ nivel: 'media', docente: f.docente, msg: `${f.observaciones_descartadas} observación(es) con kappa < ${KAPPA_MIN}: repetir con calibración` });
    if (f.componentes.inclusion != null && f.componentes.inclusion < 90) out.push({ nivel: 'alta', docente: f.docente, msg: `Ajustes PIAR evidenciados ${Math.round(f.componentes.inclusion)} % (< 90 %)` });
    if (f.discrepancia) out.push({ nivel: 'media', docente: f.docente, msg: 'Discrepancia > 25 puntos entre fuentes: triangular' });
    if (f.observadores < 2 && f.componentes.observacion != null) out.push({ nivel: 'baja', docente: f.docente, msg: 'Falta observación por un segundo observador' });
  }
  return out;
}
