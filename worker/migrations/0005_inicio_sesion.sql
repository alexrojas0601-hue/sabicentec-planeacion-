-- Inicio de sesión propio y tres roles (admin, directivo, docente). La tabla usuarios se recrea para ampliar el CHECK de rol.
CREATE TABLE usuarios_nueva (
  email TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  cargo TEXT,
  rol TEXT NOT NULL DEFAULT 'docente' CHECK (rol IN ('admin','directivo','docente')),
  asignaciones TEXT NOT NULL DEFAULT '[]',   -- [{"grado":"5°","area":"Matemáticas"}]; area "*" = todas las del curso
  direccion TEXT NOT NULL DEFAULT '[]',      -- cursos de los que es director de grupo (consulta de todo el curso)
  activo INTEGER NOT NULL DEFAULT 1,
  clave_hash TEXT, clave_sal TEXT,
  debe_cambiar INTEGER NOT NULL DEFAULT 1,
  fallos INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta TEXT,
  ultimo_ingreso TEXT,
  creado TEXT DEFAULT (datetime('now'))
);
INSERT INTO usuarios_nueva(email, nombre, cargo, rol, asignaciones, activo, creado)
  SELECT email, nombre, cargo, 'docente', asignaciones, activo, creado FROM usuarios;
DROP TABLE usuarios;
ALTER TABLE usuarios_nueva RENAME TO usuarios;
CREATE TABLE IF NOT EXISTS sesiones (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expira TEXT NOT NULL,
  creada TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_ses_email ON sesiones(email);
