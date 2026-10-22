// Construye web/index.html (Cloudflare) y dist/artifact.html (vista previa) desde web/src/app.html.
// Inserta el motor de indicadores y los datos de referencia; así la app funciona incluso sin API.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
const motor = readFileSync('worker/src/indicadores.js', 'utf8');
const nombres = [...motor.matchAll(/export (?:const|function) (\w+)/g)].map(m => m[1]);
const motorInline = motor.replace(/^export /gm, '') + `\nconst I = { ${nombres.join(', ')} };\n`;
const leer = f => JSON.parse(readFileSync(f, 'utf8'));
const agentes = readdirSync('.claude/agents').map(f => {
  const t = readFileSync('.claude/agents/' + f, 'utf8');
  const g = k => (t.match(new RegExp(`^${k}: (.*)$`, 'm')) || [])[1] || '';
  const d = g('description');
  return { nombre: g('name'), rol: d.split('. ')[0] + '.', cuando: d.split('. ').slice(1).join('. ') };
});
const anioActual = readdirSync('data/anios').filter(a => /^\d{4}$/.test(a)).sort().at(-1);
const INFO = {
  'Tablero_Indicadores_CENTEC.xlsx': { titulo: 'Tablero de Indicadores (Excel)', desc: 'Dashboard de lectura fácil con gráficos, registro por docente y período, ICD con fórmulas vivas, comparativo año vs año y lecciones aprendidas.', tipo: 'Excel' },
};
const descargas = existsSync('web/descargas') ? readdirSync('web/descargas').filter(f => !f.startsWith('.')).map(f => {
  const st = statSync('web/descargas/' + f);
  const kit = f.startsWith('Kit_Auditoria') ? { titulo: 'Kit de Auditoría y Seguimiento ' + (f.match(/\d{4}/) || [''])[0] + ' (Word)', desc: 'Membrete CENTEC: ICD, rúbricas del planeador y cuadernos, observación de aula, pre/post, PIAR, transversales, encuesta, informe docente, acta, plan de mejora, matriz normativa y cierre anual.', tipo: 'Word' } : null;
  return { archivo: f, kb: Math.round(st.size / 1024), fecha: st.mtime.toISOString().slice(0, 10), ...(INFO[f] || kit || { titulo: f, desc: '', tipo: f.split('.').pop().toUpperCase() }) };
}) : [];
const DATOS = { descargas,
  normativa: leer('data/normativa.json'), indicadores: leer('data/indicadores.json'),
  transversales: leer('data/transversales.json'), calendario: leer('data/calendario-revision.json'),
  metas: existsSync(`data/anios/${anioActual}/metas.json`) ? leer(`data/anios/${anioActual}/metas.json`).metas : {}, agentes,
};
const src = readFileSync('web/src/app.html', 'utf8')
  .replace('/*@@MOTOR@@*/', motorInline)
  .replace('/*@@DATOS@@*/{}', JSON.stringify(DATOS));
mkdirSync('dist', { recursive: true });
writeFileSync('dist/artifact.html', src);
writeFileSync('web/index.html', `<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>\n</head><body>\n${src}\n</body></html>\n`);
console.log('✔ web/index.html y dist/artifact.html generados;', agentes.length, 'agentes;', DATOS.normativa.normas.length, 'normas');
