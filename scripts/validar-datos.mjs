import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
let err = 0;
function rec(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) rec(p); else if (f.endsWith('.json')) { try { JSON.parse(readFileSync(p, 'utf8')); } catch (e) { err++; console.error('JSON inválido', p, e.message); } } } }
rec('data');
const n = JSON.parse(readFileSync('data/normativa.json', 'utf8'));
for (const x of n.normas) {
  if (!x.url || !x.ultima_verificacion) { err++; console.error('Norma sin URL o fecha de verificación:', x.id); }
  const dias = (Date.now() - Date.parse(x.ultima_verificacion)) / 864e5;
  if (dias > 400) console.warn('⚠ Norma sin verificar hace más de un año:', x.id);
}
if (err) process.exit(1);
console.log('✔ Datos válidos;', n.normas.length, 'normas en el registro');
