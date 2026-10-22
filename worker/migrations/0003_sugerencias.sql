CREATE TABLE IF NOT EXISTS sugerencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  texto TEXT NOT NULL, pantalla TEXT, usuario TEXT, estado TEXT DEFAULT 'abierta'
);
