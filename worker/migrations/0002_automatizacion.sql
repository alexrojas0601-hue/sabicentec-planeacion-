CREATE TABLE IF NOT EXISTS snapshots (
  anio INTEGER NOT NULL, fecha TEXT NOT NULL, periodo INTEGER,
  datos TEXT NOT NULL,            -- JSON de calcularTodo()
  PRIMARY KEY (anio, fecha)
);
CREATE TABLE IF NOT EXISTS alertas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anio INTEGER NOT NULL, fecha TEXT NOT NULL DEFAULT (datetime('now')),
  nivel TEXT, docente TEXT, mensaje TEXT, resuelta INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS calendario (
  anio INTEGER NOT NULL, periodo INTEGER NOT NULL,
  inicio TEXT NOT NULL, fin TEXT NOT NULL, semanas INTEGER NOT NULL,
  PRIMARY KEY (anio, periodo)
);
