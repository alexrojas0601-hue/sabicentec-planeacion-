---
name: apertura-anual
description: Abre un nuevo año de planeación (2027, 2028…) a partir del cierre del año anterior. Úsala en octubre-noviembre del año previo.
---
1. Crea data/anios/AAAA/ copiando la estructura de data/plantilla-anio/ (nunca copies registros del año anterior).
2. Lee data/anios/(AAAA-1)/cierre/lecciones.json y convierte cada lección "mantener/ajustar/eliminar" en una tarea del nuevo año (issue con etiqueta apertura-AAAA).
3. Ejecuta el agente investigador-normativo y la skill revision-normativa; carga el calendario académico de la Secretaría de Educación de Cali del año (fechas de períodos, semanas de desarrollo institucional, receso).
4. Ajusta metas en data/anios/AAAA/metas.json: cada meta = línea base del año anterior + mejora esperada (no metas sin línea base).
5. Pide a revisor-actualizador generar la malla grado×área×período×semana y a pedagogo/neuroeducador/neuropsicologo/steam/plan-lector revisarla.
6. auditor-cumplimiento corre la "prueba de coherencia" (100 % DBA, horas Resolución 1730/2004, transversales trazados, PEI con Leyes 2491 y 2503 de 2025). Si pasa, PR "Planeación AAAA v1".
