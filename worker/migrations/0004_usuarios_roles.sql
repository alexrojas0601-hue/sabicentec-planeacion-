-- Usuarios docentes y sus asignaciones (grado + área). Los directivos se definen con el secreto ADMINS.
CREATE TABLE IF NOT EXISTS usuarios (
  email TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,           -- debe coincidir con el nombre con que se registran sus evidencias
  cargo TEXT,
  rol TEXT NOT NULL DEFAULT 'docente' CHECK (rol IN ('docente')),
  asignaciones TEXT NOT NULL DEFAULT '[]',  -- JSON: [{"grado":"5°","area":"Matemáticas"}]; area "*" = todas las del grado
  activo INTEGER NOT NULL DEFAULT 1,
  creado TEXT DEFAULT (datetime('now'))
);
