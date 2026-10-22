-- Modelo multi-año: TODA fila lleva anio. Un año cerrado (anios.cerrado=1) no admite escrituras.
CREATE TABLE IF NOT EXISTS anios (
  anio INTEGER PRIMARY KEY,
  cerrado INTEGER NOT NULL DEFAULT 0,
  version_indicadores TEXT NOT NULL DEFAULT '1.0',
  metas TEXT,            -- JSON
  creado TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS registros (
  id TEXT PRIMARY KEY,
  anio INTEGER NOT NULL REFERENCES anios(anio),
  periodo INTEGER NOT NULL CHECK (periodo BETWEEN 1 AND 4),
  tipo TEXT NOT NULL CHECK (tipo IN ('planeador','ejecucion','cuaderno','observacion','resultado','piar','transversal','lectura','informe','encuesta')),
  docente TEXT NOT NULL,
  grado TEXT,
  area TEXT,
  semana INTEGER,
  payload TEXT NOT NULL,       -- JSON con puntajes y evidencias
  evidencia_url TEXT,
  hash TEXT,                   -- SHA-256 del payload: integridad
  creado TEXT NOT NULL DEFAULT (datetime('now')),
  creado_por TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_reg ON registros(anio, periodo, docente, tipo);
CREATE TABLE IF NOT EXISTS bitacora (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anio INTEGER NOT NULL,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  accion TEXT NOT NULL, detalle TEXT, usuario TEXT
);
CREATE TABLE IF NOT EXISTS lecciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anio INTEGER NOT NULL,
  indicador TEXT NOT NULL, resultado REAL, meta REAL,
  causa_raiz TEXT, decision TEXT CHECK (decision IN ('mantener','ajustar','eliminar','escalar')),
  responsable TEXT
);
INSERT OR IGNORE INTO anios(anio) VALUES (2027);
