// Guardián de datos: impide subir datos personales de menores al repositorio (Ley 1581/2012).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const IGNORAR = new Set(['node_modules', '.git', '.wrangler']);
const EXT = new Set(['.json', '.md', '.js', '.mjs', '.html', '.csv', '.sql', '.txt', '.yml', '.toml']);
const REGLAS = [
  [/\b(TI|RC|CC|NUIP)[\s.:#-]*\d{6,11}\b/i, 'número de documento'],
  [/\b1\d{9}\b/, 'posible número de identificación (10 dígitos)'],
  [/\b3[0-2]\d[\s-]?\d{3}[\s-]?\d{4}\b/, 'teléfono celular'],
  [/\b(diagn[oó]stico|medicamento|levotiroxina|TDAH|autismo|TEA)\b\s*[:=]\s*\S+/i, 'dato de salud asociado'],
];
const SOLO_DATOS = new Set(['.json', '.csv', '.md', '.txt']); // el patrón de 10 dígitos no aplica a código (constantes numéricas)
const PERMITIDOS = [/318 ?490 ?5115/, /318 ?482 ?8637/]; // teléfonos institucionales
let fallas = 0;
function rec(d) {
  for (const f of readdirSync(d)) {
    if (IGNORAR.has(f)) continue;
    const p = join(d, f);
    if (statSync(p).isDirectory()) { rec(p); continue; }
    if (!EXT.has(extname(f)) || p.includes('escaneo-privacidad')) continue;
    readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
      if (PERMITIDOS.some(r => r.test(l))) return;
      for (const [rx, q] of REGLAS) if ((q.includes('10 dígitos') ? SOLO_DATOS.has(extname(f)) : true) && rx.test(l)) { fallas++; console.error(`✖ ${p}:${i + 1} → ${q}`); }
    });
  }
}
rec('.');
if (fallas) { console.error(`\n${fallas} posible(s) dato(s) personal(es). Use códigos seudónimos (P-AAAA-GG-NN).`); process.exit(1); }
console.log('✔ Privacidad: sin datos personales detectados');
