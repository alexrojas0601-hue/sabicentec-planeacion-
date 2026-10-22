import test from 'node:test';
import assert from 'node:assert/strict';
import * as I from '../worker/src/indicadores.js';

test('pesos suman 1', () => assert.ok(Math.abs(Object.values(I.PESOS).reduce((a, b) => a + b) - 1) < 1e-9));
test('Hake', () => { assert.equal(I.hake(40, 70), 0.5); assert.equal(I.hake(100, 100), null); });
test('kappa perfecto = 1', () => assert.equal(I.kappaPonderado([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], 5), 1));
test('sorteo reproducible', () => assert.deepEqual(I.sortear('s', 30, 6), I.sortear('s', 30, 6)));
test('sorteo sin repetidos', () => { const m = I.sortear('x', 25, 5); assert.equal(new Set(m).size, 5); });
test('menos de 3 fuentes => sin ICD', () => {
  const r = I.calcularDocente([{ tipo: 'planeador', docente: 'D1', periodo: 1, payload: { a_tiempo: true, rubrica: [3, 3], dba_total: 4, dba_cubiertos: 4 } }], 'D1');
  assert.equal(r.icd, null);
});
test('ejecución < 60 % => rojo', () => {
  const regs = [
    { tipo: 'planeador', docente: 'D', periodo: 1, payload: { a_tiempo: true, rubrica: [3, 3, 3], dba_total: 5, dba_cubiertos: 5 } },
    { tipo: 'ejecucion', docente: 'D', periodo: 1, payload: { semanas_planeadas: 10, semanas_ejecutadas: 5 } },
    { tipo: 'cuaderno', docente: 'D', periodo: 1, payload: { puntajes: [3, 3, 3] } },
  ];
  const r = I.calcularDocente(regs, 'D');
  assert.ok(r.icd < 70); assert.equal(r.semaforo.color, 'rojo');
});
test('observación con kappa bajo se descarta', () => {
  const regs = [
    { tipo: 'planeador', docente: 'D', periodo: 1, payload: { a_tiempo: true, rubrica: [2], dba_total: 1, dba_cubiertos: 1 } },
    { tipo: 'ejecucion', docente: 'D', periodo: 1, payload: { semanas_planeadas: 10, semanas_ejecutadas: 10 } },
    { tipo: 'observacion', docente: 'D', periodo: 1, payload: { obs1: { observador: 'A', puntajes: [5, 5, 5, 5, 5, 5, 5, 5, 5] }, obs2: { observador: 'B', puntajes: [1, 2, 1, 3, 1, 2, 1, 1, 2] } } },
  ];
  const r = I.calcularDocente(regs, 'D');
  assert.equal(r.observaciones_descartadas, 1); assert.equal(r.componentes.observacion, null);
});
