---
name: cierre-anual
description: Cierra un año de planeación, congela sus datos y produce el insumo de mejora para el año siguiente.
---
1. Congela data/anios/AAAA/ (tag git `cierre-AAAA`). Un año cerrado nunca se edita.
2. Genera data/anios/AAAA/resumen.json con los indicadores anuales (misma estructura todos los años: ver data/indicadores.json).
3. Ejecuta comparativo-interanual contra AAAA-1 (y AAAA-2 si existe).
4. Construye data/anios/AAAA/cierre/lecciones.json: por indicador → resultado, meta, brecha, causa raíz (5 porqués), decisión (mantener / ajustar / eliminar / escalar), responsable.
5. Registro de prácticas que funcionaron (con evidencia de mejora) y que no.
6. Informe de cierre para rectoría y consejo académico (docs/informes/AAAA-cierre.md).
