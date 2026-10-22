---
name: mejora-aplicativo
description: Ciclo de mejora continua del aplicativo: recoge sugerencias, hallazgos y lecciones, y los convierte en Pull Requests probados. Corre automáticamente el día 15 de cada mes y tras cada auditoría o cierre.
---
1. Lista issues abiertos con etiqueta `mejora` y los informes nuevos de docs/informes/.
2. Agrupa por tema y prioriza (legal > exactitud > automatización > usabilidad).
3. Por cada tema, el agente ingeniero-mejora-continua implementa, prueba y abre PR.
4. El agente auditor-cumplimiento define cómo se medirá el efecto (indicador, línea base, fecha).
5. Tras el despliegue, registra en CHANGELOG.md la versión publicada; en la siguiente auditoría de período se verifica el efecto y se cierra el issue con la evidencia.
6. Las sugerencias rechazadas se cierran con la razón, para que no se repitan.
