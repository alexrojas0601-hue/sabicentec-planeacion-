# Registro de cambios

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico.
Toda mejora cita su origen (issue, auditoría, lección de cierre o norma) y cómo se medirá su efecto.

## Sin publicar

## [1.3.0] — 2026-10-22
### Cambiado
- Inicio de sesión propio (correo + clave) en lugar de Cloudflare Access, que es gratis solo hasta 50 usuarios (el colegio tiene ~78).
### Agregado
- Tres roles: administrador, directivo y docente. Director de grupo con consulta de todo su curso (pestaña «Mi curso»).
- Claves temporales para cuentas nuevas y restablecimiento; cambio obligatorio en el primer ingreso; bloqueo por intentos fallidos.

## [1.2.0] — 2026-10-21
### Agregado
- Control de acceso por roles. Directivos con acceso total (rectoría, vicerrectoría, coordinación académica, Paula Andrea Rojas Cairasco, Daniela Rojas Cairasco) definidos solo por el secreto ADMINS. Cada docente ve y registra únicamente lo suyo, en los grados y áreas asignados. Cuadernos, observación y encuesta solo los registran directivos.
- Pestaña «Usuarios» para dar de alta docentes y sus asignaciones. Selector «Ver como» en la vista previa.
- Token de solo lectura para los agentes (AGENTES_TOKEN).

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
