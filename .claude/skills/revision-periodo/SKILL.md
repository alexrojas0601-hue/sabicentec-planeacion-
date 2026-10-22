---
name: revision-periodo
description: Revisión de seguimiento en semanas 5 y 10 de cada período y cierre de período. Calcula ICD y semáforos.
---
1. Exporta registros del aplicativo (botón Exportar JSON o GET /api/export?anio=AAAA&periodo=N) a data/anios/AAAA/registros/.
2. Corre `node scripts/calcular-indicadores.mjs AAAA N`.
3. Verifica que cada docente tenga ≥ 3 fuentes (planeador, cuadernos, observación, resultados). Faltantes = "sin dato", nunca cero automático ni 100 automático.
4. Revisa kappa de observaciones; repite las < 0,60.
5. Genera informe con el agente auditor-cumplimiento y acta (docs/instrumentos – Acta de seguimiento).
6. Retroalimentación individual al docente en ≤ 5 días hábiles, con plan de mejora y fecha de re-verificación.
