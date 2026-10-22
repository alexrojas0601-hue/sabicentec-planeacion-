# Sistema de Planeación CENTEC

Planeación, seguimiento y auditoría académica de **CENTEC Córdoba** (Cali, Colombia · Transición a 11°), pensado para durar: 2027 es el año línea base y cada año siguiente (2028, 2029…) se compara automáticamente con los anteriores.

El sistema responde tres preguntas con evidencia y no con opiniones:

1. **¿Lo planeado cumple la norma vigente?** — un agente revisa cada mes al MEN, la Secretaría de Educación de Cali y el ICFES.
2. **¿Lo planeado se está ejecutando y enseñando bien?** — Índice de Cumplimiento Docente (ICD) con 10 fuentes de evidencia y controles contra el sesgo.
3. **¿Los estudiantes están aprendiendo más?** — ganancia de aprendizaje (pre/post) y comparación año contra año.

Y una cuarta, sobre el propio sistema: **¿el aplicativo mejora con cada ciclo?** — un agente de ingeniería convierte hallazgos y sugerencias en mejoras probadas.

---

## Qué hay en el repositorio

| Carpeta | Contenido |
|---|---|
| `web/` | Aplicativo (HTML + JS sin compilación). `web/src/app.html` es la fuente; `npm run web` genera `web/index.html`. |
| `worker/` | API en Cloudflare Workers + base de datos D1 (migraciones en `worker/migrations`). Cron diario de automatización. |
| `worker/src/indicadores.js` | Motor de indicadores único (lo usan la app, la API, los scripts y los agentes). |
| `.claude/agents/` | 12 agentes especializados. |
| `.claude/skills/` | 9 procedimientos repetibles (apertura, período, cierre, comparativo, normativa, cuadernos, observación, PIAR, mejora). |
| `.github/workflows/` | CI, despliegue y los ciclos automáticos de agentes. |
| `data/` | Registro normativo, indicadores versionados, transversales, calendario de revisión y una carpeta por año (`data/anios/2027/…`). |
| `docs/generador/` | Generadores del Kit de Auditoría (Word) y del Tablero de Indicadores (Excel). |
| `scripts/` | Pruebas, escáner de privacidad, validación, cálculo de indicadores y comparativo interanual. |

## El equipo de agentes

| Agente | Especialidad |
|---|---|
| orquestador-academico | Coordina ciclos anual, de período y de cierre |
| investigador-normativo | Normatividad colombiana vigente (MEN, SEM Cali, ICFES) |
| revisor-actualizador | Convierte hallazgos en cambios de malla, SIEE, proyectos |
| auditor-cumplimiento | Calcula ICD, semáforos y si los cambios funcionaron |
| pedagogo-curricular | Calidad de planeadores, ABP/STEAM, evaluación formativa |
| neuroeducador | Ciencia cognitiva: carga, recuperación, espaciado, atención, bienestar |
| neuropsicologo-inclusion | PIAR, DUA, ajustes razonables (Decreto 1421/2017) |
| especialista-steam | Proyectos y transversales con fases INSPIRA–DISEÑA–EXPLORA–CREA–EVALÚA |
| curador-plan-lector | Plan lector (≥ 6 libros/año en primaria, PDF de acceso legal) |
| psicometra-evaluacion | Pruebas pre/post, fiabilidad, comparación interanual |
| guardian-datos | Privacidad de menores (Ley 1581/2012) en cada cambio |
| ingeniero-mejora-continua | Mejora el propio aplicativo con cada actualización |

## Qué corre solo

| Cuándo | Qué | Dónde |
|---|---|---|
| Todos los días 6:00 a. m. | Fotografía de indicadores y alertas | Cron del Worker |
| Viernes | Aviso de planeadores pendientes | Cron del Worker |
| Lunes de semanas 5 y 10 | Auditoría de período con agentes | Worker → `agentes-periodo.yml` |
| Día 1 de cada mes | Revisión normativa | `agentes-normativa.yml` |
| Día 15 de cada mes y tras cada ciclo | Mejora continua del aplicativo | `agentes-mejora.yml` |
| 15 de octubre | Apertura del año siguiente | `agentes-anual.yml` |
| 1 de diciembre | Cierre anual + comparativo + lecciones | `agentes-anual.yml` |
| Cada push | Pruebas, privacidad y validación | `ci.yml` |
| Push a `main` | Despliegue a Cloudflare | `deploy.yml` |

Todo cambio que proponen los agentes llega como **Pull Request** para aprobación de coordinación o rectoría. Nada se aplica solo.

## Puesta en marcha (una sola vez, ~30 minutos)

1. **GitHub:** crear el repositorio privado `centec-planeacion` y subir esta carpeta.
2. **Cloudflare:**
   ```bash
   npm install
   npx wrangler login
   npx wrangler d1 create centec-planeacion      # copiar el database_id en wrangler.toml
   npm run deploy
   ```
3. **Proteger el acceso:** Cloudflare Zero Trust → Access → aplicación sobre el dominio del Worker, permitiendo solo correos `@centec.edu.co` (o la lista de directivos y docentes). Crear un *service token* para GitHub Actions.
4. **Secretos de GitHub** (Settings → Secrets → Actions): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`, `CF_ACCESS_ID`, `CF_ACCESS_SECRET`; variable `APP_URL` con la dirección del aplicativo. Instalar la app de Claude en el repositorio (`/install-github-app` desde Claude Code).
5. **Secretos del Worker:** `npx wrangler secret put GH_TOKEN` (token con permiso de issues y actions), `GH_REPO` (`usuario/centec-planeacion`) y, opcional, `ALERT_WEBHOOK` (Google Chat, Slack o pasarela de WhatsApp).
6. **Calendario:** cargar las fechas oficiales de los 4 períodos de 2027 cuando la Secretaría de Educación de Cali publique la resolución (POST `/api/calendario` o editar `data/anios/2027/calendario.json`).

## Uso local sin instalar nada

Abra `web/index.html` en el navegador: funciona en modo local con datos de ejemplo (docentes A–H ficticios). Bórrelos en *Años y datos* antes de cargar datos reales.

## Privacidad

Ningún nombre, documento, diagnóstico o teléfono de estudiantes entra al repositorio ni a la base de datos. PIAR se registra con código `P-AAAA-GG-NN`; la correspondencia la custodia psicología en archivo restringido. El CI bloquea cualquier commit con patrones de datos personales.

## Multi-año

- Cada fila de la base lleva `anio`. Un año cerrado es de solo lectura.
- Las fórmulas tienen versión (`VERSION` en `indicadores.js`). Si cambian, el comparativo marca "serie rota".
- Las metas de cada año se calculan desde la línea base del año anterior (skill `apertura-anual`).
