# Correcciones aplicadas al sistema Cuidarte+

Este documento describe las correcciones **aplicadas directamente en el
repositorio** para resolver los hallazgos del pentest (documentos
`03-hallazgos-criticos.md`, `04-hallazgos-mayores.md` y
`05-hallazgos-medios-menores.md`). Los cambios ya viven en el código de
`BACKEND/` y `FRONTEND/`; aquí está la matriz de trazabilidad de abajo y el
listado de hallazgos que **no son corregibles en código**
(`14-hallazgos-no-corregibles-en-codigo.md`).

## Índice de archivos modificados en el repo

| Grupo | Archivos |
|---|---|
| Backend — núcleo | `BACKEND/src/app.js`, `BACKEND/src/db.js` |
| Backend — middleware | `auth.js`, `rateLimit.js`, `validate.js`, `delay.js`, `errorHandler.js` (en `BACKEND/src/middleware/`) |
| Backend — rutas | `auth.js`, `users.js`, `roles.js`, `pacientes.js`, `examenes.js`, `documentos.js`, `audit.js`, `tipo-examen.js` (en `BACKEND/src/routes/`) |
| Backend — utilidades | `password.js`, `rut.js`, `auditoria.js` (en `BACKEND/src/utils/`) |
| Backend — validaciones | `auth.js`, `users.js`, `pacientes.js` (en `BACKEND/src/validations/`) |
| Backend — BD / despliegue | `sql/init.sql`, `sql/init-db.sh`, `sql/dump-cuidarteplus.sql`, `Dockerfile` |
| Frontend — sesión | `lib/api.jsx`, `context/AuthContext.jsx`, `components/RoleGuard.jsx` |
| Frontend — utilidades | `utils/passwordPolicy.js`, `utils/formatDateOnly.js`, `utils/roles.js` |
| Frontend — páginas | `pages/usuarios/UsuariosTabCreate.jsx`, `pages/usuarios/UsuariosTabList.jsx`, `pages/usuarios/UsuariosList.jsx`, `pages/pacientes/PacientesTabList.jsx`, `pages/pacientes/PacientesTabCreate.jsx`, `pages/pacientes/PacienteForm.jsx`, `pages/examenes/ExamenDetalle.jsx`, `pages/examenes/MisResultados.jsx`, `pages/auth/Register.jsx` |
| Frontend — validaciones | `validations/auth.js`, `validations/users.js` |
| Frontend — despliegue | `FRONTEND/Dockerfile` |
| Raíz del repo | `.gitignore`, `.env.example`, `docker-compose.yml`, `README.md` |

## Matriz hallazgo → corrección

### Críticos

| Hallazgo | Resumen | Corrección aplicada | Archivos |
|---|---|---|---|
| **HAL-01** | Ficha clínica expuesta sin autenticación mediante búsqueda por RUT | Todas las rutas de pacientes exigen `requireAuth`; la búsqueda por RUT está autenticada, con rate limit (30/min) y auditoría en cada consulta | `routes/pacientes.js`, `middleware/auth.js`, `middleware/rateLimit.js` |
| **HAL-02** | Contraseñas en texto plano | Hashing con `crypto.scryptSync` (N=32768, r=8, p=1, KEYLEN 64, formato `scrypt$N$r$p$salt$hash`); re-hasheo automático de contraseñas legacy al hacer login; dump con hashes demo: `admin/Cuidarte*2026adm`, `medico/Cuidarte*2026mdc`, `paciente/Cuidarte*2026pct` | `utils/password.js` (nuevo), `routes/auth.js`, `sql/init.sql`, `sql/dump-cuidarteplus.sql`, `README.md` |
| **HAL-03** | Secretos JWT/BD comprometidos y PostgreSQL expuesto | JWT rotado y movido a `.env` **desversionado** (`git rm --cached`); `docker-compose` saca el puerto público de Postgres (`expose`) y falla sin `POSTGRES_PASSWORD`/`JWT_SECRET` (`:?`); nueva POSTGRES_PASSWORD aleatoria; README sin secretos | `.gitignore`, `.env.example`, `docker-compose.yml`, `README.md` |
| **HAL-04** | Cualquier usuario puede crear un administrador | `POST /usuarios` ahora es admin-only y valida que el `rol_id` exista | `routes/users.js`, `middleware/auth.js` |
| **HAL-05** | Autoascenso de médico a admin en `PUT /usuarios/:id` | Cambio de rol solo para admin; prohíbe editar usuarios ajenos al propio rol, impedir cambiar el rol de uno mismo y degradar el último admin; bump de `token_version` (ver HAL-09) | `routes/users.js` |
| **HAL-06** | `DELETE /usuarios/:id` sin autenticación y con 500 | Delete requiere auth; pasa a **borrado lógico** (`activo=false` + bump `token_version`); errores controlados (404/400) sin 500 | `routes/users.js`, `sql/init.sql` |
| **HAL-07** | CRUD de roles sin auth y nombres mutables | CRUD admin-only; los 3 roles del sistema (`admin`, `medico`, `paciente`) no se renombran ni eliminan; alias `administrador` se normaliza en un único punto | `routes/roles.js`, `middleware/auth.js`, `sql/init-db.sh` |
| **HAL-08** | Auto-vinculación de ficha clínica por RUT | Registro sobre una ficha existente ya **no** se auto-vincula: devuelve **202** con solicitud pendiente; nuevo endpoint auditado `POST /pacientes/:id/vincular` para el admin | `routes/auth.js`, `routes/pacientes.js` |

### Mayores

| Hallazgo | Resumen | Corrección aplicada | Archivos |
|---|---|---|---|
| **HAL-09** | Sesión sin revocación ni logout real | Columna `token_version BIGINT` en `usuarios`, claim `ver` en el JWT, `POST /autenticacion/logout` que rota la versión, y el middleware compara token vs base de datos **en cada petición** (revocación inmediata al cambiar rol/contraseña o eliminar usuario) | `routes/auth.js`, `routes/users.js`, `middleware/auth.js`, `sql/init.sql`, `sql/dump-cuidarteplus.sql` |
| **HAL-10** | CORS abierto a cualquier origen | Allowlist de orígenes configurable por variable `CORS_ORIGINS`; rechazo de orígenes desconocidos | `app.js` |
| **HAL-11** | Sin TLS ni cabeceras de seguridad | **Parcial**: cabeceras `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy` y HSTS opt-in (`ENABLE_HSTS=1`). El TLS terminado real queda como decisión de infraestructura (ver `14-hallazgos-no-corregibles-en-codigo.md`) | `app.js` |
| **HAL-12** | Política de contraseñas débil (6 chars) | Política 12–128 chars, 3 de 4 categorías, sin contener el nombre de usuario, en backend y frontend | `utils/password.js`, `validations/*` (BE/FE), `utils/passwordPolicy.js` (FE), páginas de usuarios |
| **HAL-13** | RUT validado solo por formato | Validación del dígito verificador (módulo 11) centralizada | `utils/rut.js`, `validations/auth.js` y `validations/pacientes.js` (BE), `validations/*` (FE) |
| **HAL-14** | Mass assignment de `usuario_id` en pacientes | `usuario_id`/`paciente_id` no se aceptan del cliente al crear/editar pacientes; la vinculación va por el endpoint admin del HAL-08 | `routes/pacientes.js` |
| **HAL-15** | Operaciones multi-paso sin transacciones | `BEGIN`/`COMMIT`/`ROLLBACK` en registro, creación de usuarios, examen+documento y vinculación; rollback garantizado en `finally` | `routes/auth.js`, `routes/users.js`, `routes/examenes.js`, `routes/pacientes.js` |
| **HAL-16** | Auditoría forjable e incompleta | `POST /auditoria` deshabilitado (404); `GET /auditoria` admin-only con paginación; escritura solo desde servidor con actor real, IP y user-agent | `routes/audit.js`, `utils/auditoria.js` |
| **HAL-17** | `usuario_id BIGINT` recibe texto | Helper central inserta `usuario_id` numérico válido o NULL; se añade snapshot `actor_nombre` para conservar la atribución | `utils/auditoria.js`, `sql/init.sql` |
| **HAL-18** | Archivos validados solo por MIME declarado | Verificación de magic bytes (`%PDF-`, `FF D8 FF`, `89 50 4E 47`) además del MIME; límite 10 MB | `routes/documentos.js`, UI con límites previos en el dropzone |
| **HAL-19** | Sin rate limiting / fuerza bruta viable | Rate limit de login por usuario+IP con bloqueo progresivo y `SIMULATE_DELAY_MS` en **0** por defecto (el retardo fijo de 5 s es configurable y opcional) | `middleware/rateLimit.js` (nuevo), `middleware/delay.js`, `routes/auth.js` |
| **HAL-20** | Comparación BIGINT(string) vs number → 403 del paciente sobre sus documentos | Parser de BIGINT a `Number` en `pg` + conversiones explícitas `Number()` antes de comparar IDs de documentos | `db.js`, `routes/documentos.js` |
| **HAL-21** | `updateUserSchema` omite `rol_id`; `validate` no reasigna | `rol_id` nullable en el schema; el middleware reasigna `req[source]` con `stripUnknown` para que solo lleguen campos validados | `middleware/validate.js`, `validations/users.js` |
| **HAL-22** | No se verifica coherencia examen↔paciente del documento | `paciente_id` se deriva del examen **en el servidor**; el cliente ya no lo envía | `routes/documentos.js`, `pages/examenes/ExamenDetalle.jsx` |
| **HAL-23** | Build Docker falla por `COPY uploads/` | `COPY uploads/` eliminado del Dockerfile; el backend crea el directorio al arrancar y Compose lo monta como volumen | `BACKEND/Dockerfile` |
| **HAL-24** | `init-db.sh` reporta éxito con inicialización parcial | `set -euo pipefail`, `ON_ERROR_STOP=1` y verificaciones de conteo (≥8 tablas, ≥3 usuarios/roles) | `sql/init-db.sh`, `sql/init.sql` |
| **HAL-25** | Node EOL y dependencias vulnerables | **Parcial**: base actualizada a `node:22` (LTS). La revisión de dependencias (npm audit / SCA en CI) queda como tarea operativa | `BACKEND/Dockerfile`, `FRONTEND/Dockerfile` |

### Medios y menores

| Hallazgo | Resumen | Corrección aplicada | Archivos |
|---|---|---|---|
| **HAL-26** | Errores de multer sin controlar; UI desalineada con los límites | Manejador global de errores que mapea errores de multer (413/400) y códigos de PostgreSQL (23505→409, 23503→400, 22P02→400) sin exponer `err.message`, con correlationId; el dropzone aplica `maxSize` 10 MB y `maxFiles: 1`, y muestra el mensaje específico del backend | `middleware/errorHandler.js`, `pages/examenes/ExamenDetalle.jsx` |
| **HAL-28** | Auditoría sin inmutabilidad | **Parcial**: trigger `auditoria_append_only_guard` (BEFORE UPDATE OR DELETE) en `init.sql`; la retención y el envío a SIEM quedan en infraestructura | `sql/init.sql`, `sql/init-db.sh` |
| **HAL-29** | Retardo artificial fijo de 5 s | El delay ya no es fijo: `SIMULATE_DELAY_MS` con valor por defecto 0 | `middleware/delay.js` |
| **HAL-30** | Swagger UI y `/openapi.json` públicos en producción | Swagger/solo-docs se montan si `NODE_ENV !== "production"` | `app.js` |
| **HAL-31** | Mensajes con detalles internos de PostgreSQL/servidor | `errorHandler` único que traduce códigos a mensajes neutros y registra el detalle interno solo en el log del servidor | `middleware/errorHandler.js` |
| **HAL-32** | Listados sin paginación ni minimización | Paginación (`limit`/`offset` acotados) y mínimos campos en usuarios, pacientes y auditoría | `routes/users.js`, `routes/pacientes.js`, `routes/audit.js` |
| **HAL-33** | Un admin puede eliminarse a sí mismo o al último admin | Prohibido eliminar la propia cuenta y eliminar al último admin; el borrado es lógico | `routes/users.js` |
| **HAL-34** | `GET /usuarios` no devuelve el rol (UI "N/A") | La respuesta incluye `rol_nombre` y la UI lo consume | `routes/users.js`, `pages/usuarios/UsuariosTabList.jsx` |
| **HAL-35** | `RequireAdmin` no reconoce el alias `administrador` | Normalización central del rol (esquema→`admin`/`medico`/`paciente`) en el middleware; la UI usa `esRolAdmin` | `middleware/auth.js`, `components/RoleGuard.jsx`, `pages/usuarios/UsuariosTabList.jsx` |
| **HAL-36** | Fecha de nacimiento desplazada un día por interpretación UTC | Utilidad `formatDateOnly` que muestra la fecha como fecha pura (sin desfase de zona) | `utils/formatDateOnly.js` (nuevo), `pages/pacientes/PacientesTabList.jsx` |
| **HAL-37** | Diálogo de baja de paciente muestra `undefined` | El diálogo recibe nombre completo y RUT explícitos por parámetro | `pages/pacientes/PacientesTabList.jsx` |
| **HAL-38** | Axios no maneja 401 ni expiración de sesión | Interceptor: en 401 finaliza la sesión (logout server-side), redirige **una vez** a `/login?expired=1`; en 403 mantiene la sesión; la expiración se evalúa al montar la app | `lib/api.jsx`, `context/AuthContext.jsx` |

### También incluidos (hardening transversal)

- **Config fail-closed**: `app.js` y `db.js` se niegan a arrancar sin `JWT_SECRET` (≥32 caracteres y máx. colección de valores conocidos/inseguros) o `DATABASE_URL`; `NODE_ENV`/`CORS_ORIGINS` documentados en `.env.example`.
- **Descarga segura de documentos**: `nosniff` y cabeceras de contenido al servir archivos (`routes/documentos.js`); ya no hay `express.static` sobre `/files`.
- **Frontend**: normalización de rol en el contexto de autenticación, logout real contra el backend y validaciones compartidas (`validations/`).

## Cómo revisar

1. Diff por archivo: `git diff` sobre el repositorio muestra todos los cambios aplicados.
2. Criterios de retest por hallazgo: cada documento de hallazgos (`03`/`04`/`05`) incluye su criterio de verificación; se sugiere ejecutarlos contra `docker compose up`.
3. Credenciales de prueba (sembradas por `init.sql`/dump): ver la sección de credenciales demo del `README.md`.

## Verificaciones ejecutadas sobre esta entrega

- `node --check` (análisis de sintaxis) sobre **todos** los archivos `.js` de `BACKEND/src` — sin errores.
- `eslint` del frontend (`npm install` + `npm run lint`): **0 errores**. Quedan 2 *warnings* de `react-hooks/exhaustive-deps` (`MisResultados.jsx` y `PacienteForm.jsx`) heredados del código original, no bloqueantes; en `PacientesTabList.jsx` las dependencias del `useMemo` ya se completaron.
- Como parte de los ajustes de lint se eliminaron variables/imports muertos y se movió `esRolAdmin` a `utils/roles.js` (declararla junto a los componentes rompía `react-refresh/only-export-components`); estos ajustes forman parte del código del repo.
- Búsqueda de restos: no quedan referencias al middleware de auth antiguo, valores de secreto por defecto (`|| "inseguro"`) ni `console.log` en rutas.
