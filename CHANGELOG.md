# Registro de cambios

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico.
Toda mejora cita su origen (issue, auditoría, lección de cierre o norma) y cómo se medirá su efecto.

## Sin publicar

## [1.1.0] — 2026-10-21
### Agregado
- Hoja «Dashboard» en el Tablero de Indicadores (Excel): nota del colegio en lenguaje sencillo, docentes por color, gráficos coloreados por estado, fortalezas y debilidades, comparativo año a año y guía de lectura.
- Pestaña «Documentos» en el aplicativo: el Kit de Auditoría y el Tablero se regeneran en cada despliegue y se descargan desde la app.

## [1.0.0] — 2026-10-21
### Agregado
- Aplicativo web (Cloudflare Worker + D1) multi-año: tablero ICD, registro de evidencias, comparativo año vs año, normativa, agentes, años y datos.
- Motor de indicadores v1.0 (10 componentes, reglas de bloqueo, kappa ponderado, Hake con contracción, normalización por observador, sorteo auditable).
- 12 agentes especializados y 9 skills; automatización con cron del Worker y GitHub Actions (normativa mensual, auditoría semanas 5 y 10, apertura 15-oct, cierre 1-dic, mejora continua día 15).
- Kit de Auditoría (Word) y Tablero de Indicadores (Excel) generados desde los datos del repositorio.
