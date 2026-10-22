// Genera el Kit de Auditoría y Seguimiento Académico CENTEC (Word) desde los datos del repositorio.
// Uso: node docs/generador/kit-auditoria.js <anio> <salida.docx>
const fs = require('fs');
const path = require('path');
const D = require('docx');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType,
  HeadingLevel, Header, Footer, ImageRun, PageNumber, BorderStyle, LevelFormat, PageBreak, TableOfContents, VerticalAlign } = D;

const ROOT = path.join(__dirname, '..', '..');
const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const ANIO = process.argv[2] || '2027';
const OUT = process.argv[3] || `Kit_Auditoria_Planeacion_${ANIO}.docx`;
const IND = J('data/indicadores.json'), NORM = J('data/normativa.json'), TR = J('data/transversales.json'), CAL = J('data/calendario-revision.json');
const LOGO = fs.readFileSync(path.join(__dirname, 'logo-centec.png'));

const NAVY = '1B2A6B', ORANGE = 'D9771E', GRAY = 'F1F3F7', LINE = 'B8C0CC';
const W = 9360; // ancho útil carta con márgenes de 1"
const FONT = 'Arial';

const p = (t, o = {}) => new Paragraph({ spacing: { after: 120, line: 276 }, ...o, children: (Array.isArray(t) ? t : [t]).map(x => typeof x === 'string' ? new TextRun({ text: x, font: FONT, size: 21 }) : x) });
const b = (t, o = {}) => new TextRun({ text: t, bold: true, font: FONT, size: 21, ...o });
const r = (t, o = {}) => new TextRun({ text: t, font: FONT, size: 21, ...o });
const h1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { before: 0, after: 200 }, children: [new TextRun({ text: t, font: FONT })] });
const h2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: t, font: FONT })] });
const bul = (t, lvl = 0) => new Paragraph({ numbering: { reference: 'vinetas', level: lvl }, spacing: { after: 60 }, children: (Array.isArray(t) ? t : [t]).map(x => typeof x === 'string' ? r(x) : x) });
const num = (t, ref = 'pasos') => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 60 }, children: (Array.isArray(t) ? t : [t]).map(x => typeof x === 'string' ? r(x) : x) });
const borde = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const bordes = { top: borde, bottom: borde, left: borde, right: borde };

function tabla(cols, filas, opts = {}) {
  const total = cols.reduce((s, c) => s + c.w, 0);
  const ws = cols.map(c => Math.round(c.w * W / total));
  ws[ws.length - 1] += W - ws.reduce((a, c) => a + c, 0);
  const celda = (txt, i, head, fill) => new TableCell({
    width: { size: ws[i], type: WidthType.DXA }, borders: bordes, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: NAVY } : fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
    children: String(txt ?? '').split('\n').map(l => new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: l, font: FONT, size: head ? 18 : 19, bold: head, color: head ? 'FFFFFF' : '1A1A1A' })] })),
  });
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: ws,
    rows: [new TableRow({ tableHeader: true, children: cols.map((c, i) => celda(c.t, i, true)) }),
      ...filas.map((f, k) => new TableRow({ children: f.map((x, i) => celda(x, i, false, opts.zebra && k % 2 ? GRAY : undefined)) }))],
  });
}
const firma = (roles) => tabla(roles.map(x => ({ t: x, w: 1 })), [roles.map(() => '\n\n\nNombre:\nFirma:\nFecha:')]);
const campos = (pares) => tabla([{ t: 'Campo', w: 1 }, { t: 'Registro', w: 2.4 }], pares.map(x => [x, '']));
const espacio = () => new Paragraph({ spacing: { after: 120 }, children: [] });
const nota = t => new Paragraph({ spacing: { before: 80, after: 160 }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FDF1E4' }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: ORANGE, space: 6 } }, children: [r(t, { size: 19 })] });

const header = new Header({ children: [
  new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [1300, 6260, 1800], rows: [new TableRow({ children: [
    new TableCell({ width: { size: 1300, type: WidthType.DXA }, borders: bordes, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: LOGO, transformation: { width: 46, height: 54 } })] })] }),
    new TableCell({ width: { size: 6260, type: WidthType.DXA }, borders: bordes, verticalAlign: VerticalAlign.CENTER, children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [b('CENTRO DE EDUCACIÓN EN TECNOLOGÍA — CENTEC CÓRDOBA', { size: 18, color: NAVY })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [r('Sistema de Gestión de Calidad y Control Interno', { size: 16 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [r('Proceso de Gestión Académica y Pedagógica', { size: 16 })] })] }),
    new TableCell({ width: { size: 1800, type: WidthType.DXA }, borders: bordes, verticalAlign: VerticalAlign.CENTER, children: [
      new Paragraph({ spacing: { after: 0 }, children: [r('Código: GA-KIT-01', { size: 15 })] }),
      new Paragraph({ spacing: { after: 0 }, children: [r(`Versión: ${IND.version} · ${ANIO}`, { size: 15 })] }),
      new Paragraph({ spacing: { after: 0 }, children: [r('Página ', { size: 15 }), new TextRun({ children: [PageNumber.CURRENT], size: 15, font: FONT })] })] }),
  ] })] }),
  new Paragraph({ spacing: { after: 0 }, children: [] }),
] });
const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 4, color: ORANGE, space: 4 } }, children: [r('Barrio Ciudad Córdoba, Comuna 15 · Santiago de Cali · Tel. 318 490 5115 · 318 482 8637', { size: 15, color: '555555' })] })] });

// ---------------- CONTENIDO ----------------
const C = [];
// Portada
C.push(new Paragraph({ spacing: { before: 1600, after: 200 }, alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: LOGO, transformation: { width: 120, height: 142 } })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: 'KIT DE AUDITORÍA Y SEGUIMIENTO', font: FONT, size: 40, bold: true, color: NAVY })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: `DE LA PLANEACIÓN ACADÉMICA ${ANIO}`, font: FONT, size: 32, bold: true, color: ORANGE })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [r('Criterios, indicadores, instrumentos y actas para verificar que lo planeado se cumple, medir su avance real con mínimo sesgo y comparar año contra año (2027 → 2028 → …)', { size: 22, italics: true })] }));
C.push(tabla([{ t: 'Elemento', w: 1 }, { t: 'Contenido', w: 2.6 }], [
  ['Alcance', 'Transición a 11°, todas las áreas obligatorias y fundamentales, proyectos transversales, PIAR y plan lector.'],
  ['Usuarios', 'Rectoría, vicerrectoría, coordinación académica, coordinación de convivencia, docentes, docente de apoyo / psicología.'],
  ['Aplicativo', 'Sistema de Planeación CENTEC (GitHub + Cloudflare). Los instrumentos de este kit son los mismos formularios del aplicativo, para uso en papel cuando sea necesario.'],
  ['Versión de fórmulas', `v${IND.version}. Si cambia una fórmula o un peso, cambia la versión y el comparativo interanual lo señala.`],
  ['Aprobación', 'Consejo Académico — acta No. ____ del ____ de ________ de ______'],
]));

C.push(h1('Contenido'));
C.push(new TableOfContents('Contenido', { hyperlink: true, headingStyleRange: '1-2' }));

// 1. Propósito
C.push(h1('1. Propósito, principios y ciclo de mejora'));
C.push(p('Este kit responde a una pregunta: ¿lo que se planeó se está enseñando, se está aprendiendo y se puede demostrar? Para responderla sin depender de la opinión de una sola persona, el sistema combina diez fuentes de evidencia, reglas que impiden que lo administrativo compense lo esencial, y controles estadísticos contra el sesgo del observador.'));
C.push(h2('Principios'));
[['Triangulación. ', 'Ningún docente recibe un color con menos de 3 fuentes de evidencia independientes. Ninguna fuente sola decide un rojo.'],
 ['Evidencia fechada. ', 'Lo que no tiene fecha, enlace o firma no cuenta. En el aplicativo, la fecha la pone el servidor y cada registro lleva una huella SHA-256 que impide editarlo después.'],
 ['Azar auditable. ', 'Los cuadernos se sortean con una semilla registrada; las observaciones sin aviso se fijan por sorteo.'],
 ['Fiabilidad medida. ', 'Las observaciones con dos observadores calculan el kappa ponderado. Si es menor que 0,60, la observación se repite.'],
 ['Aprendizaje como resultado. ', 'Se mide la ganancia normalizada (pre/post) y no solo la nota final, para no castigar a quien recibe grupos con bajo nivel de entrada.'],
 ['Privacidad. ', 'Los datos de estudiantes con PIAR solo se registran con código seudónimo (Ley 1581 de 2012). Nombres y diagnósticos permanecen en el archivo físico restringido.'],
 ['Mejora año a año. ', 'Cada año se cierra y se congela. Sus resultados son la línea base de las metas del año siguiente.']].forEach(([a, t]) => C.push(bul([b(a), r(t)])));
C.push(h2('Ciclo PHVA del sistema'));
C.push(tabla([{ t: 'Fase', w: 0.8 }, { t: 'Qué se hace', w: 2.4 }, { t: 'Cuándo', w: 1.1 }, { t: 'Responsable', w: 1.2 }], [
  ['Planear', 'Revisión normativa, malla grado × área × período × semana, metas desde la línea base del año anterior', '15 oct – 30 nov del año previo', 'Rectoría, coordinación académica, agentes'],
  ['Hacer', 'Planeadores semanales, ejecución, proyectos, PIAR, plan lector', 'Todo el año', 'Docentes'],
  ['Verificar', 'Cálculo del ICD, observación, cuadernos, pre/post, encuestas, auditoría de período', 'Semanas 5 y 10 de cada período', 'Coordinación, agente auditor'],
  ['Actuar', 'Planes de mejora, ajustes a la planeación, lecciones aprendidas, cierre anual', 'Cierre de período y 1 de diciembre', 'Consejo académico'],
]));
C.push(h2('Calendario de revisión (qué, cuándo y quién)'));
C.push(tabla([{ t: 'Cuándo', w: 1.3 }, { t: 'Qué se revisa', w: 2.6 }, { t: 'Quién / herramienta', w: 1.4 }, { t: 'Modo', w: 0.8 }], CAL.ciclos.map(c => [c.cuando, c.que, c.quien + (c.skill ? ` (${c.skill})` : ''), c.auto ? 'Automático' : 'Humano + app']), { zebra: true }));

// 2. ICD
C.push(h1('2. Índice de Cumplimiento Docente (ICD)'));
C.push(p('El ICD resume, en una escala de 0 a 100, si el docente planeó, ejecutó, enseñó bien y logró aprendizaje. Se calcula por período y se lee como tendencia anual. Siempre se entrega al docente con el detalle de cada componente, nunca solo el número.'));
C.push(tabla([{ t: 'Cód.', w: 0.5 }, { t: 'Componente', w: 1.5 }, { t: 'Fórmula', w: 2.6 }, { t: 'Peso', w: 0.55 }, { t: 'Fuente / frecuencia', w: 1.6 }],
  IND.componentes.map(c => [c.codigo, c.nombre, c.formula, `${Math.round(c.peso * 100)} %`, `${c.fuente} · ${c.frecuencia}`]), { zebra: true }));
C.push(espacio());
C.push(p([b('Fórmula: '), r('ICD = Σ (peso × componente) / Σ pesos de los componentes con dato. Si un componente no tiene evidencia, no se rellena con cero ni con cien: se re-pondera con los disponibles y se muestra qué porcentaje del peso total tiene dato.')]));
C.push(h2('Reglas de bloqueo'));
IND.reglas_bloqueo.forEach(x => C.push(bul(x)));
C.push(h2('Semáforo y acción obligatoria'));
C.push(tabla([{ t: 'Color', w: 0.8 }, { t: 'ICD', w: 0.8 }, { t: 'Lectura', w: 1.6 }, { t: 'Acción', w: 2.6 }], [
  ['Verde', '≥ 85', 'Cumple con excelencia', 'Reconocimiento público; rol de mentor par; comparte una práctica en la jornada pedagógica'],
  ['Amarillo', '70 – 84', 'Cumple parcialmente', 'Plan de mejora con 2 metas observables; acompañamiento quincenal; nueva medición en 6 semanas'],
  ['Rojo', '< 70', 'No cumple', 'Plan intensivo; observación cada 2 semanas; revisión formal de desempeño con rectoría'],
  ['Gris', '—', 'Sin evidencia suficiente o observación pendiente', 'Completar fuentes en máximo 10 días hábiles; responsabilidad de coordinación'],
]));
C.push(h2('Controles contra el sesgo humano'));
[['Normalización por observador: ', 'si un observador califica sistemáticamente por encima o por debajo del promedio de todos, su diferencia se descuenta (requiere al menos 3 observaciones suyas).'],
 ['Kappa ponderado: ', 'κ = (pₒ − pₑ) / (1 − pₑ). Meta ≥ 0,61 (acuerdo sustancial). Con κ < 0,60 la observación no cuenta y se repite tras calibración.'],
 ['Contracción en la ganancia: ', 'g ajustada = n/(n+10) · g del docente + 10/(n+10) · g media del colegio. Evita que un grupo pequeño premie o castigue por azar.'],
 ['Revisión ciega de cuadernos: ', 'la hace un coordinador de otra área, con nombres tapados, sobre una muestra sorteada.'],
 ['Discrepancia entre fuentes: ', 'si dos fuentes difieren en más de 25 puntos, se programa una tercera observación sin aviso antes de asignar color.'],
 ['Observación sin aviso: ', 'al menos una al año, con fecha sorteada.']].forEach(([a, t]) => C.push(bul([b(a), r(t)])));

// R1
C.push(h1('3. Instrumento R1 — Rúbrica de calidad del planeador'));
C.push(p('Se aplica a una muestra quincenal de planeadores por docente (al menos 2 por período). Escala: 0 ausente · 1 inicial · 2 adecuado · 3 sólido. Puntaje C4 = suma / 24 × 100.'));
C.push(campos(['Docente', 'Grado / área', 'Período / semana', 'Revisor (coordinador)', 'Fecha de revisión', 'Enlace del planeador en el aplicativo']));
C.push(espacio());
C.push(tabla([{ t: 'Criterio', w: 1.6 }, { t: '0 – 1', w: 1.4 }, { t: '2', w: 1.4 }, { t: '3 (sólido)', w: 1.6 }, { t: 'Pts', w: 0.4 }], [
  ['1. Objetivo y criterios de éxito', 'No hay objetivo o es una lista de temas', 'Objetivo claro, sin criterios de éxito', 'Objetivo en lenguaje del estudiante + criterios de éxito visibles', ''],
  ['2. DBA / estándar', 'No se cita o no corresponde al grado', 'Se cita el DBA, sin evidencia de aprendizaje', 'DBA del grado con evidencia de aprendizaje y su forma de evaluarla', ''],
  ['3. Proyecto y fases', 'Actividades sueltas', 'Proyecto con algunas fases', 'INSPIRA–DISEÑA–EXPLORA–CREA–EVALÚA con producto público y aplicación cotidiana', ''],
  ['4. Recuperación y espaciado', 'Solo se presenta tema nuevo', 'Repaso ocasional', 'Inicio con 3–5 preguntas de semanas anteriores; repaso programado de semanas N-2 y N-4', ''],
  ['5. Verificación de comprensión', 'Pregunta "¿entendieron?"', 'Preguntas a voluntarios', 'Respuesta de todo el grupo (pizarras, tarjetas, muestreo aleatorio) y ajuste previsto', ''],
  ['6. Evaluación formativa', 'Solo nota final', 'Retroalimentación general', 'Retroalimentación con acción y momento para corregir', ''],
  ['7. DUA', 'Una sola forma de presentar y demostrar', 'Dos formas en uno de los dos', '≥ 2 formas de presentar y ≥ 2 de demostrar', ''],
  ['8. PIAR, transversal y lectura', 'No se mencionan', 'Se mencionan sin acción', 'Ajustes PIAR por código, proyecto transversal y lectura del plan lector con actividad concreta', ''],
]));
C.push(nota('Resta: si la única estrategia de estudio es releer, subrayar o copiar (baja utilidad según Dunlosky et al., 2013), el criterio 4 no puede superar 1.'));
C.push(p([b('Total: ____ / 24   ·   C4 = ____ %')]));

// R2
C.push(h1('4. Instrumento R2 — Protocolo de revisión de cuadernos'));
C.push(h2('Procedimiento de muestreo'));
['Frecuencia mensual, por curso y área.', 'Tamaño: 5 cuadernos, o el 20 % si el grupo tiene más de 25 estudiantes.', 'En el aplicativo: Registrar evidencia → Cuadernos → Sortear. La semilla (fecha|grado|área) queda registrada; cualquier auditor reproduce la misma muestra.', 'Estratificación recomendada: incluir siempre al menos un estudiante con PIAR (por código).', 'Revisa un coordinador de otra área, con el nombre del docente tapado.'].forEach(x => C.push(num(x)));
C.push(campos(['Grado / área', 'Semilla del sorteo', 'Números de lista sorteados', 'Revisor', 'Fecha']));
C.push(espacio());
C.push(tabla([{ t: 'Criterio (0 a 3)', w: 2.4 }, { t: 'C1', w: 0.4 }, { t: 'C2', w: 0.4 }, { t: 'C3', w: 0.4 }, { t: 'C4', w: 0.4 }, { t: 'C5', w: 0.4 }, { t: 'Prom.', w: 0.5 }], [
  ['1. Fechas corresponden a las semanas planeadas', '', '', '', '', '', ''],
  ['2. Evidencia de práctica de recuperación o espaciada', '', '', '', '', '', ''],
  ['3. Retroalimentación con acción y corrección del estudiante', '', '', '', '', '', ''],
  ['4. Producto de la fase del proyecto correspondiente', '', '', '', '', '', ''],
  ['5. Ajuste DUA / PIAR visible (si aplica)', '', '', '', '', '', ''],
]));
C.push(p([b('C5 = promedio general / 3 × 100 = ____ %')]));

// R3
C.push(h1('5. Instrumento R3 — Observación de aula (Teach)'));
C.push(p('Basado en Teach del Banco Mundial (gratuito, en español, validado en Latinoamérica; versión Teach ECE para Transición). Dos segmentos de 15 minutos por clase. Cada elemento se califica de 1 a 5. Mínimo 3 observaciones al año por docente, al menos 2 observadores distintos y 1 sin aviso.'));
C.push(campos(['Docente / grado / área', 'Fecha y hora', '¿Con aviso o sin aviso (sorteada)?', 'Observador 1', 'Observador 2 (califica por separado, sin hablar)', 'Fase del proyecto planeada para esta semana', 'Fase observada']));
C.push(espacio());
C.push(tabla([{ t: 'Área', w: 1 }, { t: 'Elemento', w: 2 }, { t: 'Conducta observable', w: 2.6 }, { t: 'Obs. 1', w: 0.5 }, { t: 'Obs. 2', w: 0.5 }], [
  ['Cultura de aula', '1. Ambiente de apoyo', 'Trato respetuoso, usa nombres, no hay humillación', '', ''],
  ['', '2. Expectativas positivas de comportamiento', 'Normas claras, refuerzo de conductas esperadas', '', ''],
  ['Instrucción', '3. Facilitación de la lección', 'Objetivo explícito, explicación con ejemplos resueltos, conexión con lo previo', '', ''],
  ['', '4. Verificación de comprensión', 'Pregunta a todos y ajusta si ≥ 30 % falla', '', ''],
  ['', '5. Retroalimentación', 'Explica el porqué del error; no se limita a "bien" o "mal"', '', ''],
  ['', '6. Pensamiento crítico', 'Preguntas abiertas; los estudiantes explican, argumentan, analizan', '', ''],
  ['Habilidades socioemocionales', '7. Autonomía', 'Los estudiantes eligen, proponen y asumen roles', '', ''],
  ['', '8. Perseverancia', 'Se valora el esfuerzo y se anima a no rendirse', '', ''],
  ['', '9. Habilidades sociales y colaborativas', 'Trabajo en equipo con roles y responsabilidad individual', '', ''],
]));
C.push(espacio());
C.push(campos(['Tiempo en aprendizaje (3 instantáneas, %)', 'Verificación propia CENTEC: objetivo y DBA visibles (sí/no)', 'Verificación propia CENTEC: ajustes PIAR aplicados (sí/no/no aplica)', 'κ ponderado (lo calcula el aplicativo)', 'Fortaleza observada (conducta concreta)', 'Aspecto a mejorar (conducta concreta)']));
C.push(nota('Calibración trimestral: todos los observadores califican los mismos 3 videos. Se exige acuerdo adyacente (±1) ≥ 80 % y κ ≥ 0,60 para quedar habilitado.'));

// R4
C.push(h1('6. Instrumento R4 — Prueba de entrada y salida (ganancia de aprendizaje)'));
['Al inicio de cada período se aplica una prueba diagnóstica corta alineada a los DBA del período (puede salir del banco de exámenes finales).', 'Al cierre se aplica el mismo instrumento o una forma paralela con igual dificultad.', 'Se registran puntajes 0–100 por número de lista (nunca nombres) en el aplicativo: Registrar evidencia → Pre/Post.', 'El aplicativo calcula g = (post − pre) / (100 − pre) por estudiante, excluye pre > 90 y aplica contracción.', 'Lectura: g < 0,30 baja · 0,30 – 0,70 media · > 0,70 alta. En el ICD: g ≤ 0,10 = 0 y g ≥ 0,50 = 100.'].forEach(x => C.push(num(x, 'pasos2')));
C.push(tabla([{ t: 'N.° lista', w: 0.6 }, { t: 'Pre', w: 0.6 }, { t: 'Post', w: 0.6 }, { t: 'g', w: 0.6 }, { t: 'N.° lista', w: 0.6 }, { t: 'Pre', w: 0.6 }, { t: 'Post', w: 0.6 }, { t: 'g', w: 0.6 }],
  Array.from({ length: 15 }, (_, i) => [String(i + 1), '', '', '', String(i + 16), '', '', ''])));

// R5 PIAR
C.push(h1('7. Instrumento R5 — Seguimiento de PIAR y ajustes razonables'));
C.push(p('Decreto 1421 de 2017. Se diligencia por período y por código seudónimo P-AAAA-GG-NN (año, grado, consecutivo). La tabla de correspondencia código–estudiante la custodia psicología en archivo restringido.'));
C.push(tabla([{ t: 'Código', w: 1 }, { t: 'Área', w: 1 }, { t: 'Ajuste razonable comprometido', w: 2 }, { t: 'Evidencia (planeador / cuaderno / aula)', w: 1.8 }, { t: '¿Verificado?', w: 0.7 }],
  Array.from({ length: 8 }, () => ['P-____-__-__', '', '', '', 'Sí / No'])));
C.push(espacio());
C.push(campos(['Fecha de valoración pedagógica', 'Acta de acuerdo con la familia (fecha)', 'Revisión anual del PIAR (fecha)', 'C8 = ajustes verificados / comprometidos × 100']));
C.push(nota('Meta institucional: ≥ 90 % de ajustes verificados. Por debajo de 80 % el docente no puede superar amarillo en el ICD.'));

// R6 Transversales
C.push(h1('8. Instrumento R6 — Trazabilidad de proyectos transversales'));
C.push(p('Cada proyecto obligatorio debe quedar asignado a grado, período, semana y área responsable, con evidencia fechada de cada fase.'));
C.push(tabla([{ t: 'Proyecto', w: 2 }, { t: 'Base normativa', w: 1.6 }, { t: 'Grado/período', w: 0.9 }, { t: 'I', w: 0.3 }, { t: 'D', w: 0.3 }, { t: 'E', w: 0.3 }, { t: 'C', w: 0.3 }, { t: 'Ev', w: 0.35 }],
  TR.proyectos.map(x => [x.nombre, x.base, '', '', '', '', '', '']), { zebra: true }));
C.push(p([r('I = INSPIRA · D = DISEÑA · E = EXPLORA · C = CREA · Ev = EVALÚA. Marque con la fecha de la evidencia. C9 = fases evidenciadas / 5 × 100.', { size: 18, italics: true })]));

// R7 Encuesta
C.push(h1('9. Instrumento R7 — Encuesta estudiantil (7Cs adaptada)'));
C.push(p('Anónima, en el aplicativo o en papel, dos veces al año (abril y septiembre), sin el docente presente. Transición a 2°: caritas de 3 puntos leídas por un adulto distinto al docente. Desde 3°: escala de 1 (nunca) a 5 (siempre). Solo se reporta con 10 o más respuestas.'));
C.push(tabla([{ t: '#', w: 0.3 }, { t: 'Ítem', w: 3.2 }, { t: 'Dimensión', w: 1.2 }, { t: '1', w: 0.3 }, { t: '2', w: 0.3 }, { t: '3', w: 0.3 }, { t: '4', w: 0.3 }, { t: '5', w: 0.3 }], [
  ['1', 'Mi profe se preocupa por cómo me siento.', 'Cuidado'], ['2', 'Las clases me dan ganas de aprender.', 'Captar interés'], ['3', 'Mi profe quiere saber mis ideas.', 'Conversar'],
  ['4', 'Cuando no entiendo, mi profe lo explica de otra forma.', 'Clarificar'], ['5', 'Al final de la clase repasamos lo que aprendimos.', 'Consolidar'], ['6', 'Mi profe no me deja rendirme cuando algo es difícil.', 'Desafiar'],
  ['7', 'En clase nos respetamos y trabajamos sin desorden.', 'Control del aula'], ['8', 'Me hacen preguntas de clases pasadas.', 'Recuperación'], ['9', 'Sé qué tengo que hacer para mejorar mi trabajo.', 'Retroalimentación'],
  ['10', 'En los proyectos cada uno tiene un rol.', 'Colaboración']].map(x => [...x, '', '', '', '', ''])));
C.push(nota('Control de calidad: alfa de Cronbach ≥ 0,70 por aplicación. Se adapta del modelo Tripod 7Cs (Ferguson, Harvard), que en el proyecto MET fue la medida más estable y predijo ganancias de aprendizaje.'));

// Informe docente
C.push(h1('10. Formato — Informe del docente por período'));
C.push(p('Lo entrega cada docente en la semana 10 del período. Cada afirmación debe acompañarse del enlace a la evidencia en el aplicativo; lo que no tenga evidencia no se tiene en cuenta.'));
C.push(campos(['Docente', 'Grados y áreas a cargo', 'Período', 'Semanas planeadas / ejecutadas', 'DBA programados / evidenciados', 'Proyecto(s) del período y producto final (enlace)', 'Lecturas del plan lector trabajadas', 'Ajustes PIAR aplicados (por código)', 'Ganancia de aprendizaje por grupo (g)', 'Lo que funcionó (con evidencia)', 'Lo que no funcionó y por qué', 'Compromiso para el próximo período (observable y medible)']));
C.push(espacio());
C.push(firma(['Docente', 'Coordinación académica']));

// Acta de seguimiento
C.push(h1('11. Formato — Acta de seguimiento y auditoría de período'));
C.push(campos(['Acta No.', 'Fecha, hora y lugar', 'Período y semana (5 o 10)', 'Asistentes', 'Fuente de datos (exportación del aplicativo, fecha)']));
C.push(h2('Resultados'));
C.push(tabla([{ t: 'Indicador', w: 2 }, { t: 'Meta', w: 0.8 }, { t: 'Resultado', w: 0.8 }, { t: 'Estado', w: 0.8 }, { t: 'Observación', w: 2 }], [
  ['ICD institucional', '', '', '', ''], ['% docentes en verde / amarillo / rojo', '', '', '', ''], ['Ejecución de semanas planeadas', '', '', '', ''], ['Cobertura de DBA', '', '', '', ''],
  ['κ promedio de observadores', '≥ 0,60', '', '', ''], ['Ganancia de aprendizaje institucional (g)', '', '', '', ''], ['Ajustes PIAR verificados', '≥ 90 %', '', '', ''],
  ['Proyectos transversales con evidencia', '', '', '', ''], ['Libros leídos por estudiante (acumulado)', '≥ 6 primaria', '', '', '']]));
C.push(h2('Hallazgos y acciones'));
C.push(tabla([{ t: 'Hallazgo', w: 2 }, { t: 'Evidencia', w: 1.5 }, { t: 'Severidad', w: 0.7 }, { t: 'Acción correctiva', w: 1.8 }, { t: 'Responsable / fecha', w: 1.1 }], Array.from({ length: 6 }, () => ['', '', '', '', ''])));
C.push(espacio());
C.push(firma(['Rectoría', 'Coordinación académica', 'Secretaría (relatoría)']));

// Plan de mejora
C.push(h1('12. Formato — Plan de mejora individual'));
C.push(campos(['Docente', 'Período en que se origina', 'ICD y color', 'Componentes por debajo de 70']));
C.push(espacio());
C.push(tabla([{ t: 'Meta observable', w: 2 }, { t: 'Práctica de apoyo', w: 1.6 }, { t: 'Acompañamiento', w: 1.4 }, { t: 'Indicador y valor esperado', w: 1.4 }, { t: 'Fecha de re-medición', w: 1 }], [
  ['Ej.: iniciar cada clase con 4 preguntas de recuperación', 'Práctica de recuperación (Adesope 2017)', 'Observación quincenal + modelado por mentor par', 'R1 criterio 4 = 3; R2 criterio 2 ≥ 2', '6 semanas'], ['', '', '', '', ''], ['', '', '', '', '']]));
C.push(espacio());
C.push(firma(['Docente', 'Mentor par', 'Coordinación académica']));

// Matriz normativa
C.push(h1('13. Matriz de cumplimiento normativo'));
C.push(p(`Registro mantenido por el agente investigador-normativo (revisión mensual automática y verificación completa en octubre). Actualizado: ${NORM.actualizado || '—'}. Verificar siempre la fuente oficial antes de una decisión.`));
C.push(tabla([{ t: 'Norma', w: 1.2 }, { t: 'Qué obliga en la planeación', w: 2.2 }, { t: 'Evidencia para auditoría', w: 1.8 }, { t: 'Cumple (S/N/P)', w: 0.6 }],
  NORM.normas.map(n => [n.norma + (n.estado && n.estado !== 'vigente' ? ` (${n.estado})` : ''), n.obliga, n.evidencia, '']), { zebra: true }));
if (NORM.novedades?.length) { C.push(h2('Novedades y puntos por verificar')); NORM.novedades.forEach(x => C.push(bul(x))); }

// Cierre anual
C.push(h1('14. Cierre anual, lecciones aprendidas y comparativo interanual'));
C.push(p('El 1 de diciembre el sistema cierra el año automáticamente: congela los datos, genera el resumen con las mismas fórmulas de todos los años y lo compara con los años anteriores. Este formato registra las decisiones que alimentan la planeación del año siguiente.'));
C.push(tabla([{ t: 'Indicador', w: 1.6 }, { t: `${Number(ANIO) - 1}`, w: 0.6 }, { t: ANIO, w: 0.6 }, { t: 'Δ', w: 0.5 }, { t: 'Causa raíz (5 porqués)', w: 1.8 }, { t: 'Decisión', w: 0.9 }, { t: 'Responsable', w: 0.9 }],
  ['ICD institucional', ...IND.componentes.map(c => c.nombre), 'Libros por estudiante', 'Resultados Saber'].map(x => [x, '', '', '', '', 'Mantener / Ajustar / Eliminar / Escalar', ''])));
C.push(nota('Regla de lectura: una variación de 5 puntos o más (o 0,10 en ganancia g) se considera cambio real. Si la versión de fórmulas cambió entre años, la serie está rota y se recalcula el año anterior con datos crudos.'));
C.push(h2('Prácticas que demostraron mejora (mantener y escalar)'));
C.push(tabla([{ t: 'Práctica', w: 2 }, { t: 'Dónde se aplicó', w: 1.4 }, { t: 'Indicador que mejoró y cuánto', w: 2 }, { t: 'Escalar a', w: 1.2 }], Array.from({ length: 4 }, () => ['', '', '', ''])));
C.push(espacio());
C.push(firma(['Rectoría', 'Consejo académico', 'Coordinación académica']));

// Anexo
C.push(h1('Anexo A. Prácticas de alta evidencia y neuromitos'));
C.push(tabla([{ t: 'Práctica', w: 1.5 }, { t: 'Evidencia', w: 1.8 }, { t: 'Cómo se ve en clase o en el cuaderno', w: 2.6 }], [
  ['Práctica de recuperación', 'Adesope et al. 2017: g ≈ 0,61; Dunlosky 2013: alta utilidad', 'Quices sin nota al inicio; respuestas de memoria corregidas por el estudiante'],
  ['Práctica espaciada e intercalada', 'Dunlosky 2013; Brunmair y Richter 2019', 'El mismo tema reaparece con fechas separadas; guías con ejercicios mezclados'],
  ['Retroalimentación formativa', 'Wisniewski et al. 2020: d ≈ 0,48; EEF +6 meses', 'Comentario con acción y evidencia de corrección'],
  ['Metacognición y autorregulación', 'EEF +7 meses', 'Pensar en voz alta; bitácora y autoevaluación con criterios'],
  ['Instrucción explícita (Rosenshine)', 'Rosenshine 2012', 'Yo hago, hacemos, haces; objetivo visible; ejemplos resueltos'],
  ['Ciencia de la lectura (Transición a 3°)', 'National Reading Panel 2000; EEF fonética +5', 'Secuencia fonética diaria; palabras correctas por minuto mensuales'],
  ['Aprendizaje colaborativo estructurado', 'EEF +5', 'Roles definidos y producto individual además del grupal'],
  ['Funciones ejecutivas', 'Diamond y Lee 2011', 'Rutinas visuales, agenda del proyecto, juegos de pare/siga'],
  ['Movimiento, sueño y clima emocional', 'Donnelly 2016; Durlak 2011', 'Pausa activa de 3–5 minutos cada 30–40 en primaria; guía de sueño para familias'],
  ['DUA 3.0', 'CAST 2024; Decreto 1421 de 2017', '2 formas de presentar y 2 de demostrar desde el diseño'],
], { zebra: true }));
C.push(h2('Neuromitos que no deben aparecer en planeadores ni capacitaciones'));
['Estilos de aprendizaje visual-auditivo-kinestésico como base para enseñar (Pashler et al. 2008).', 'Personas de "hemisferio izquierdo o derecho".', '"Solo usamos el 10 % del cerebro".', 'Brain Gym o ejercicios para "integrar hemisferios".', 'Periodos críticos rígidos: la plasticidad dura toda la vida.', 'Efecto Mozart; el azúcar como causa de hiperactividad.'].forEach(x => C.push(bul(x)));
C.push(nota('Indicador de formación docente: cuestionario de neuromitos de Dekker et al. (2012) al inicio y al final del año; meta ≥ 80 % de respuestas correctas.'));

const doc = new Document({
  creator: 'CENTEC Córdoba', title: `Kit de Auditoría y Seguimiento de la Planeación ${ANIO}`,
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 30, bold: true, color: NAVY, font: FONT }, paragraph: { spacing: { before: 0, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, color: ORANGE, font: FONT }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: 'vinetas', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }, { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 900, hanging: 270 } } } }] },
    { reference: 'pasos', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
    { reference: 'pasos2', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
  ] },
  features: { updateFields: true },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1200, left: 1440, right: 1440, header: 500 } } }, headers: { default: header }, footers: { default: footer }, children: C }],
});
Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUT, buf); console.log('✔', OUT); });
