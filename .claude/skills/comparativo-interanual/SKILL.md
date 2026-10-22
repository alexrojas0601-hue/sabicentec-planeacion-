---
name: comparativo-interanual
description: Compara año contra año (2027 vs 2028 vs …) los mismos indicadores con la misma fórmula y escala.
---
Reglas: solo se comparan indicadores cuya fórmula no cambió (versión en data/indicadores.json). Si cambió, se reporta como "serie rota" y se recalcula el año anterior con la fórmula nueva cuando haya datos crudos.
Salida por indicador: valor por año, variación absoluta, variación %, tendencia (↑ ↓ =), y si la diferencia supera el umbral mínimo de mejora (5 puntos en índices 0–100; 0,10 en ganancia de Hake).
Contrasta además: cambios aplicados (bitácora) ↔ indicadores que se movieron, para saber qué decisión realmente funcionó.
El aplicativo muestra esto en la pestaña "Año vs año".
