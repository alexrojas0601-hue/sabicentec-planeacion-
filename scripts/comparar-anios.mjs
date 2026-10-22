// Comparativo interanual automático: lee data/anios/*/resumen.json y produce tabla markdown.
import { readdirSync, existsSync, readFileSync } from 'node:fs';
const anios = readdirSync('data/anios').filter(a => /^\d{4}$/.test(a) && existsSync(`data/anios/${a}/resumen.json`)).sort();
const R = anios.map(a => ({ a, d: JSON.parse(readFileSync(`data/anios/${a}/resumen.json`, 'utf8')) }));
const comps = ['puntualidad', 'ejecucion', 'cobertura', 'planeador', 'cuadernos', 'observacion', 'aprendizaje', 'inclusion', 'transversal', 'estudiantes'];
const prom = (d, k) => { const v = d.filas.map(f => f.componentes[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b) / v.length : null; };
const f1 = x => x == null ? '—' : x.toFixed(1);
let md = `# Comparativo interanual CENTEC\n\nGenerado: ${new Date().toISOString().slice(0, 10)}\n\n| Indicador | ${anios.join(' | ')} | Variación último año | Tendencia |\n|---|${anios.map(() => '---').join('|')}|---|---|\n`;
const filas = [['ICD institucional', d => d.institucional], ...comps.map(k => [k, d => prom(d, k)])];
for (const [n, fn] of filas) {
  const v = R.map(r => fn(r.d));
  const dv = v.length > 1 && v.at(-1) != null && v.at(-2) != null ? v.at(-1) - v.at(-2) : null;
  const t = dv == null ? '—' : dv >= 5 ? '↑ mejora' : dv <= -5 ? '↓ retroceso' : '= estable';
  md += `| ${n} | ${v.map(f1).join(' | ')} | ${f1(dv)} | ${t} |\n`;
}
const vers = [...new Set(R.map(r => r.d.version))];
if (vers.length > 1) md += `\n> ⚠ Serie rota: versiones de fórmula distintas (${vers.join(', ')}). Recalcular años anteriores con la versión vigente.\n`;
console.log(md);
