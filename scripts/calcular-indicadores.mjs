// Uso: node scripts/calcular-indicadores.mjs 2027 [periodo]
import { readFileSync } from 'node:fs';
import { calcularTodo, alertas } from '../worker/src/indicadores.js';
const [anio, per] = process.argv.slice(2);
const exp = JSON.parse(readFileSync(`data/anios/${anio}/registros/export.json`, 'utf8'));
const res = calcularTodo(exp.registros, per ? Number(per) : null);
console.log(JSON.stringify({ anio: Number(anio), generado: new Date().toISOString(), ...res, alertas: alertas(exp.registros, anio) }, null, 2));
