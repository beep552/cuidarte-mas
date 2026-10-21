# 11 — Inventario de revisión

> **Objetivo.** Documentar qué se revisó, con qué profundidad, qué rutas existen realmente y dónde se concentran los hallazgos. Este inventario permite reproducir la cobertura y detectar zonas no examinadas.

**Commit:** `e021d8f5a86c36072efa92852753070e73a3483e`  
**Fecha de corte:** 21 de octubre de 2026  
**Método:** lectura completa de los archivos de aplicación, inventario automatizado de rutas y contraste con la matriz de trazabilidad.

---

## 1. Resumen del inventario

| Categoría | Archivos | Líneas con contenido | Revisión |
|---|---:|---:|---|
| Backend JavaScript (`BACKEND/src/**/*.js`) | 18 | 2 363 | Completa, archivo por archivo |
| Backend OpenAPI (`BACKEND/src/openapi.json`) | 1 | — | Lectura dirigida a exposición y documentación |
| Frontend JavaScript/JSX (`FRONTEND/src/**/*.{js,jsx}`) | 38 | 7 754 | Completa en auth, guards, API y páginas críticas; dirigida en el resto |
| SQL y shell (`BACKEND/sql/*`) | 3 | 663 | Completa |
| Configuración y despliegue | 10 | — | Completa |
| Documentación del repositorio | 4 | — | Lectura dirigida |
| Archivos versionados totales | **91** | — | `git ls-files` |

**Distribución de hallazgos por severidad:** 8 críticos, 17 mayores, 4 medios y 9 menores. La lista completa está en [06 — Matriz de trazabilidad](06-matriz-trazabilidad.md).

---

## 2. Inventario del backend

### 2.1 Archivos JavaScript

| Archivo | Líneas | Responsabilidad | Hallazgos principales |
|---|---:|---|---|
| `BACKEND/src/app.js` | 42 | Arranque de Express, CORS, JSON, Morgan, montaje de rutas, Swagger y estáticos | HAL-10, HAL-11, HAL-23, HAL-30 |
| `BACKEND/src/db.js` | 7 | Pool de PostgreSQL y cadena de conexión con fallback | HAL-03, HAL-27 |
| `BACKEND/src/middleware/delay.js` | 12 | Retardo artificial configurable | HAL-29 |
| `BACKEND/src/middleware/validate.js` | 26 | Validación Yup sin reasignación del objeto saneado | HAL-14, HAL-21 |
| `BACKEND/src/routes/audit.js` | 102 | Registro y consulta de auditoría | HAL-16, HAL-17, HAL-28, HAL-31, HAL-32 |
| `BACKEND/src/routes/auth.js` | 153 | Login, registro, emisión de JWT, vinculación por RUT | HAL-02, HAL-08, HAL-09, HAL-12, HAL-13, HAL-15, HAL-19, HAL-31 |
| `BACKEND/src/routes/documentos.js` | 267 | Carga, listado, descarga y borrado de documentos | HAL-18, HAL-20, HAL-22, HAL-26, HAL-27, HAL-29, HAL-31 |
| `BACKEND/src/routes/examenes.js` | 385 | CRUD de exámenes médicos y consultas por paciente | HAL-15, HAL-29, HAL-31, HAL-32 |
| `BACKEND/src/routes/pacientes.js` | 378 | CRUD de pacientes y búsqueda pública por RUT | HAL-01, HAL-14, HAL-29, HAL-31, HAL-32 |
| `BACKEND/src/routes/roles.js` | 81 | CRUD de roles sin autenticación | HAL-07, HAL-17, HAL-31 |
| `BACKEND/src/routes/tipo-examen.js` | 37 | Catálogo de tipos de examen sin autenticación | OBS-02, HAL-31 |
| `BACKEND/src/routes/users.js` | 539 | CRUD de usuarios, asignación de roles y auditoría | HAL-04, HAL-05, HAL-06, HAL-17, HAL-21, HAL-31, HAL-33, HAL-34 |
| `BACKEND/src/utils/rut.js` | 11 | Normalización de RUT sin validación de dígito verificador | HAL-13 |
| `BACKEND/src/validations/auth.js` | 36 | Esquemas de login y registro | HAL-12, HAL-13 |
| `BACKEND/src/validations/empresa_usuarios.js` | 56 | Esquemas del modo empresa | Revisado; sin hallazgo directo |
| `BACKEND/src/validations/examenes.js` | 51 | Esquemas de examen | Revisado; incide en HAL-15 |
| `BACKEND/src/validations/pacientes.js` | 132 | Esquemas de paciente y actualización | HAL-13, HAL-14 |
| `BACKEND/src/validations/users.js` | 48 | Esquemas de creación y actualización de usuarios | HAL-04, HAL-05, HAL-12, HAL-21 |

**Total:** 18 archivos, 2 363 líneas con contenido. Los 18 pasaron `node --check` sin errores de sintaxis (ver documento 10, S2). La ausencia de errores de sintaxis no implica corrección lógica ni seguridad.

> **Convención de conteo.** La columna “Líneas” cuenta líneas no vacías. Las referencias `archivo:línea` de todo el informe usan la numeración física del archivo, de modo que una cita puede apuntar a una línea en blanco intermedia sin que ello altere el conteo.

### 2.2 SQL y inicialización

| Archivo | Líneas | Contenido revisado | Hallazgos |
|---|---:|---|---|
| `BACKEND/sql/init.sql` | 107 | Tablas, tipos, claves, `ON DELETE`, índices y seeds de roles/tipos | HAL-02, HAL-07, HAL-17, HAL-27, HAL-28, HAL-36 |
| `BACKEND/sql/dump-cuidarteplus.sql` | 527 | Esquema y datos de ejemplo, incluidos usuarios y contraseñas | HAL-02, HAL-06, HAL-17 |
| `BACKEND/sql/init-db.sh` | 29 | Procesamiento del dump y carga con `psql` | HAL-24 |

Observaciones del esquema:

- `usuarios.contrasena` es `TEXT` sin restricción de formato ni hash (`init.sql:7`).
- `auditoria.usuario_id` es `BIGINT` y referencia a `usuarios(id)` con `ON DELETE SET NULL` (`init.sql:88-93`).
- `pacientes.usuario_id` usa `ON DELETE SET NULL` (`init.sql:52`), por lo que borrar un usuario deja la ficha huérfana.
- `roles.nombre` es `UNIQUE`, pero la autorización se basa en su valor textual, no en un identificador estable.
- No hay trigger, política de retención ni permiso que impida `UPDATE`/`DELETE` sobre `auditoria`.
- `documentos_examen.documento` es `BYTEA`; no hay cifrado a nivel de columna ni de disco.

### 2.3 Endpoints auxiliares

| Método y ruta | Ubicación | Función | Observación |
|---|---|---|---|
| `GET /` | `app.js:45-47` | Health check | Público por diseño; no expone datos |
| `GET /openapi.json` | `app.js:39-41` | Especificación OpenAPI | Público; HAL-30 |
| `GET /docs` | `app.js:38` | Swagger UI | Público; HAL-30 |
| `GET /files/documentos/*` | `app.js:43` | Servido estático del directorio de uploads | Público; requiere revisión de autorización por archivo |

El servido estático es especialmente sensible: aunque la carga esté restringida, cualquier archivo presente en `BACKEND/uploads/documentos` queda accesible si se conoce o adivina el nombre. No se encontró un control de acceso por paciente en esa ruta.

---

## 3. Inventario de rutas Express

Se identificaron **32 rutas** declaradas con `router.<método>` en 8 archivos, más 4 endpoints auxiliares en `app.js`.

### 3.1 Clasificación por control de acceso

| Categoría | Cantidad | Rutas |
|---|---:|---|
| **Públicas (sin token)** | 11 | Login, registro, búsqueda por RUT, CRUD de roles (5), catálogo de tipos (2), `DELETE /usuarios/:id` |
| **Token sin rol** | 2 | `POST /usuarios`, `POST /auditoria` |
| **Token + administrador** | 5 | `GET /usuarios`, `GET /auditoria`, `DELETE /pacientes/:id`, `DELETE /examenes/:id`, `DELETE /documentos/:id` |
| **Token + rol/propiedad** | 14 | Resto de las rutas de lectura/actualización |
| **Total** | **32** | — |

> **Lectura crítica.** “Token + rol” no significa “correctamente autorizado”. Varias rutas obtienen el rol de la base, pero confían en el nombre mutable o no verifican la propiedad del recurso. El detalle está en la columna “Observación”.

### 3.2 Tabla completa

| # | Método y ruta | Archivo:línea | Autenticación | Autorización | Observación |
|---:|---|---|---|---|---|
| 1 | `POST /autenticacion/login` | `auth.js:10` | Pública | — | Sin rate limit ni auditoría de fallos (HAL-19, HAL-16) |
| 2 | `POST /autenticacion/registro` | `auth.js:71` | Pública | — | Vincula ficha por RUT sin verificar identidad (HAL-08) |
| 3 | `POST /usuarios` | `users.js:23` | Token | Solo exige que el token exista | Cualquier usuario puede crear admin con `rol_id: 1` (HAL-04) |
| 4 | `GET /usuarios` | `users.js:74` | Token | Admin | No devuelve el rol; sin paginación (HAL-34, HAL-32) |
| 5 | `GET /usuarios/:id` | `users.js:140` | Token | Propio, admin o médico; en modo empresa, miembro de la empresa | Sin control de propiedad en el modo empresa |
| 6 | `PUT /usuarios/:id` | `users.js:246` | Token | Admin o el propio usuario; médico puede cambiar roles | Autoascenso de médico (HAL-05); esquema omite `rol_id` (HAL-21) |
| 7 | `DELETE /usuarios/:id` | `users.js:571` | **Pública** | **Ninguna** | Borra antes de autenticar; 500 por tipo de auditoría (HAL-06, HAL-17) |
| 8 | `POST /pacientes` | `pacientes.js:48` | Token | Médico o admin | Acepta `usuario_id` del cliente (HAL-14) |
| 9 | `GET /pacientes` | `pacientes.js:145` | Token | Médico o admin | `SELECT *` sin paginación; retardo de 5 s (HAL-32, HAL-29) |
| 10 | `GET /pacientes/:id` | `pacientes.js:173` | Token | Rol válido; paciente solo el propio | Control de propiedad correcto en esta ruta |
| 11 | `GET /pacientes/buscar/rut/:rut` | `pacientes.js:249` | **Pública** | **Ninguna** | Devuelve la ficha completa (HAL-01) |
| 12 | `PUT /pacientes/:id` | `pacientes.js:276` | Token | Rol válido; paciente solo el propio | `usuario_id` modificable (HAL-14) |
| 13 | `DELETE /pacientes/:id` | `pacientes.js:387` | Token | Admin | Borrado físico; sin papelera ni retención |
| 14 | `POST /examenes` | `examenes.js:46` | Token | Médico o admin | Escrituras múltiples sin transacción (HAL-15); retardo (HAL-29) |
| 15 | `GET /examenes` | `examenes.js:99` | Token | Médico, admin o paciente | Paciente filtrado; sin paginación (HAL-32) |
| 16 | `GET /examenes/:id` | `examenes.js:179` | Token | Rol válido; paciente solo el propio | Verifica `paciente_id` en la consulta |
| 17 | `GET /examenes/paciente/:paciente_id` | `examenes.js:262` | Token | Rol válido; paciente solo el propio | Verifica propiedad antes de consultar |
| 18 | `PUT /examenes/:id` | `examenes.js:330` | Token | Médico o admin | Sin verificación de propiedad clínica del médico |
| 19 | `DELETE /examenes/:id` | `examenes.js:396` | Token | Admin | Borrado físico en cascada de documentos |
| 20 | `POST /documentos` | `documentos.js:66` | Token + médico/admin | `requireRole` se ejecuta **después** de multer | MIME declarado por el cliente; sin transacción (HAL-18, HAL-22, HAL-26) |
| 21 | `GET /documentos/examen/:examen_id` | `documentos.js:121` | Token | Rol válido; paciente solo el propio | Comparación `string !== number` produce 403 (HAL-20) |
| 22 | `GET /documentos/:id` | `documentos.js:184` | Token | Rol válido; paciente solo el propio | Mismo defecto de tipos (HAL-20) |
| 23 | `DELETE /documentos/:id` | `documentos.js:263` | Token | Admin | Borrado físico sin retención |
| 24 | `POST /auditoria` | `audit.js:19` | Token | Cualquier token | El cliente elige la acción; registro forjable (HAL-16) |
| 25 | `GET /auditoria` | `audit.js:46` | Token | Admin; en modo empresa, miembro de la empresa | Sin paginación; empresa ve toda la auditoría de la empresa (HAL-32) |
| 26 | `POST /roles` | `roles.js:18` | **Pública** | **Ninguna** | Crea roles arbitrarios (HAL-07) |
| 27 | `GET /roles` | `roles.js:36` | **Pública** | **Ninguna** | Enumera roles (HAL-07) |
| 28 | `GET /roles/:id` | `roles.js:46` | **Pública** | **Ninguna** | Enumera un rol (HAL-07) |
| 29 | `PUT /roles/:id` | `roles.js:57` | **Pública** | **Ninguna** | Renombrar roles; liberar `admin` y reasignarlo a `paciente` (HAL-07) |
| 30 | `DELETE /roles/:id` | `roles.js:76` | **Pública** | **Ninguna** | Borra roles y asignaciones en cascada (HAL-07) |
| 31 | `GET /tipo-examen` | `tipo-examen.js:6` | **Pública** | **Ninguna** | Catálogo sin token (OBS-02) |
| 32 | `GET /tipo-examen/:id` | `tipo-examen.js:22` | **Pública** | **Ninguna** | Catálogo sin token (OBS-02) |

### 3.3 Observaciones transversales del inventario

1. **No existe un middleware global de autenticación.** Cada archivo implementa su propio `getUserFromAuthHeader` y su propio `requireRole`; siete copias usan el fallback `"inseguro"`.
2. **La autorización se repite en cada handler.** Es fácil omitirla, como ocurre en `roles.js` y en `DELETE /usuarios/:id`.
3. **El rol se consulta por nombre.** Cambiar `roles.nombre` cambia la política de acceso de todo el sistema.
4. **No hay un modelo de propiedad clínica.** El sistema distingue “paciente” de “médico/admin”, pero no verifica que un médico tenga relación con el paciente.
5. **Las rutas de escritura no usan transacciones.** Varias insertan/actualizan/auditan en pasos separados.
6. **Los endpoints auxiliares no tienen autenticación.** Swagger y los archivos estáticos quedan fuera del control de acceso.

---

## 4. Inventario del frontend

### 4.1 Archivos y propósito

| Archivo | Líneas | Propósito | Hallazgos / uso |
|---|---:|---|---|
| `FRONTEND/src/App.jsx` | 65 | Rutas y composición de guards | HAL-35 |
| `FRONTEND/src/main.jsx` | 20 | Punto de entrada | Sin hallazgo directo |
| `FRONTEND/src/theme.js` | 33 | Tema MUI | Sin hallazgo directo |
| `FRONTEND/src/components/Layout.jsx` | 666 | Navegación, menú y estructura | HAL-35 (visibilidad por rol) |
| `FRONTEND/src/components/PageHeader.jsx` | 9 | Encabezado reutilizable | Sin hallazgo directo |
| `FRONTEND/src/components/RoleGuard.jsx` | 33 | `RequireAuth`, `RequireAdmin`, `RequireMedico`, `RequireAdminOrOwnUser` | HAL-35, HAL-38 |
| `FRONTEND/src/context/AuthContext.jsx` | 69 | Estado de sesión, login, logout, rol | HAL-09, HAL-38 |
| `FRONTEND/src/context/authContextInstance.js` | 2 | Contexto | Sin hallazgo directo |
| `FRONTEND/src/hooks/useAuth.js` | 5 | Hook de acceso al contexto | Sin hallazgo directo |
| `FRONTEND/src/lib/api.jsx` | 73 | Cliente Axios, token e interceptor de errores | HAL-09, HAL-31, HAL-38 |
| `FRONTEND/src/lib/utils.js` | 246 | Utilidades de formato y fechas | HAL-36 (patrón de fechas) |
| `FRONTEND/src/pages/Home.jsx` | 651 | Panel principal | Sin hallazgo directo |
| `FRONTEND/src/pages/auditoria/AuditoriaList.jsx` | 178 | Listado de auditoría | HAL-32 (sin paginación) |
| `FRONTEND/src/pages/auth/Login.jsx` | 261 | Inicio de sesión | HAL-12, HAL-19 |
| `FRONTEND/src/pages/auth/Register.jsx` | 180 | Registro público | HAL-08, HAL-12, HAL-13 |
| `FRONTEND/src/pages/examenes/ExamenDetalle.jsx` | 378 | Detalle, documentos y carga | HAL-18, HAL-26 |
| `FRONTEND/src/pages/examenes/ExamenesList.jsx` | 127 | Listado de exámenes | HAL-32 |
| `FRONTEND/src/pages/examenes/ExamenesTabList.jsx` | 274 | Tabla de exámenes | HAL-32 |
| `FRONTEND/src/pages/examenes/ExamenForm.jsx` | 590 | Creación/edición de examen | HAL-15, HAL-29 |
| `FRONTEND/src/pages/examenes/MisResultados.jsx` | 188 | Resultados del paciente | HAL-20 (consumo de documentos) |
| `FRONTEND/src/pages/pacientes/PacienteForm.jsx` | 59 | Formulario base | HAL-13 |
| `FRONTEND/src/pages/pacientes/PacientesList.jsx` | 114 | Listado de pacientes | HAL-32 |
| `FRONTEND/src/pages/pacientes/PacientesTabCreate.jsx` | 503 | Alta de paciente | HAL-13, HAL-14 |
| `FRONTEND/src/pages/pacientes/PacientesTabList.jsx` | 266 | Tabla y diálogo de borrado | HAL-36, HAL-37 |
| `FRONTEND/src/pages/usuarios/UsuarioForm.jsx` | 835 | Formulario de usuario y rol | HAL-21, HAL-34 |
| `FRONTEND/src/pages/usuarios/UsuariosList.jsx` | 82 | Listado de usuarios | HAL-34 |
| `FRONTEND/src/pages/usuarios/UsuariosTabCreate.jsx` | 237 | Alta de usuario | HAL-04, HAL-12 |
| `FRONTEND/src/pages/usuarios/UsuariosTabList.jsx` | 289 | Tabla, rol y borrado | HAL-33, HAL-34, HAL-35 |
| `FRONTEND/src/pages/informacion/AcercaDe.jsx` | 322 | Información institucional | Sin hallazgo directo |
| `FRONTEND/src/pages/informacion/Ayuda.jsx` | 219 | Ayuda | Sin hallazgo directo |
| `FRONTEND/src/pages/informacion/PoliticaPrivacidad.jsx` | 234 | Política de privacidad | Revisada para consistencia normativa |
| `FRONTEND/src/pages/informacion/TerminosUso.jsx` | 234 | Términos de uso | Revisada para consistencia normativa |
| `FRONTEND/src/validations/auth.js` | 56 | Validación de login/registro | HAL-12, HAL-13 |
| `FRONTEND/src/validations/clients.js` | 104 | Validaciones de clientes | Sin hallazgo directo |
| `FRONTEND/src/validations/contracts.js` | 24 | Validaciones de contratos | Sin hallazgo directo |
| `FRONTEND/src/validations/empresas.js` | 21 | Validaciones de empresa | Sin hallazgo directo |
| `FRONTEND/src/validations/pacientes.js` | 89 | Validación de paciente | HAL-13 |
| `FRONTEND/src/validations/users.js` | 18 | Validación de usuario | HAL-12 |

**Total:** 38 archivos JS/JSX, 7 754 líneas con contenido.

### 4.2 Cobertura de revisión del frontend

| Nivel | Archivos | Qué se verificó |
|---|---|---|
| **Profunda** | `AuthContext`, `api`, `RoleGuard`, `App`, `Login`, `Register`, `PacientesTabList`, `PacientesTabCreate`, `UsuariosTabList`, `UsuarioForm`, `ExamenDetalle`, validaciones de auth/usuarios/pacientes | Flujo de token, guards, roles, validación, mensajes, fechas, diálogos destructivos, uploads |
| **Dirigida** | Listados, formularios de examen, `Layout`, `MisResultados`, `AuditoriaList`, `utils` | Uso de API, paginación, formato, visibilidad por rol |
| **Superficial** | Páginas informativas (`AcercaDe`, `Ayuda`, `Política`, `Términos`), tema, assets | Consistencia de textos y exposición de datos; no son vectores directos |

No se revisaron `node_modules`, `dist`, imágenes ni binarios. Tampoco se auditó el código de las dependencias; solo se usó `npm audit` para identificar avisos conocidos.

---

## 5. Configuración y despliegue

| Archivo | Qué se revisó | Hallazgos |
|---|---|---|
| `docker-compose.yml` | Puertos, variables, volúmenes, dependencias, healthcheck | HAL-03, HAL-11, HAL-23, HAL-27 |
| `BACKEND/Dockerfile` | Imagen base, `COPY`, usuario, puerto, comando | HAL-23, HAL-25 |
| `FRONTEND/Dockerfile` | Build en dos etapas, `ARG VITE_API_URL`, nginx | HAL-11, HAL-25 |
| `FRONTEND/nginx.conf` | `listen 80`, SPA, caché, gzip | HAL-11 |
| `.env` | `JWT_SECRET`, puertos, nombre de proyecto | HAL-03 |
| `BACKEND/.env` | `DATABASE_URL`, `JWT_SECRET` | HAL-03 |
| `FRONTEND/.env` | `VITE_API_URL` en HTTP | HAL-11 |
| `.gitignore` | Solo excluye `node_modules`; no excluye `.env` | HAL-03 |
| `BACKEND/.dockerignore` | Contexto de build | HAL-23 |
| `package.json` raíz | Scripts de instalación/arranque | Revisado; sin hallazgo directo |

**Puertos observados:** frontend `3333`, backend `4444`, PostgreSQL `15442`; internamente backend `4000`, PostgreSQL `5432`, nginx `80`. El backend también escucha `3000` si se ejecuta sin `PORT`, pero Compose lo sobreescribe con `4000`.

---

## 6. Dependencias

| Proyecto | Dependencias directas | Dev | Total audit | Críticas | Altas | Moderadas | Bajas |
|---|---:|---:|---:|---:|---:|---:|---:|
| Backend | 9 | 1 | 13 | 1 | 9 | 3 | 0 |
| Frontend | 17 | 13 | 29 | 0 | 22 | 6 | 1 |

Los paquetes más relevantes para el riesgo se detallan en [HAL-25](04-hallazgos-mayores.md#hal-25). Los lockfiles están versionados, lo que permite reproducir la instalación, pero también fija versiones vulnerables.

---

## 7. Cobertura y brechas

### 7.1 Lo cubierto

- Las 32 rutas Express y los 4 endpoints auxiliares.
- Los 8 archivos de rutas, 5 de validaciones, 2 de middleware, 2 de arranque/conexión y 1 utilidad.
- Las 38 piezas de frontend, con profundidad variable.
- El esquema, los seeds y el script de inicialización.
- La configuración de Docker, nginx y variables de entorno.
- Las dependencias declaradas y sus avisos.

### 7.2 Brechas declaradas

| Brecha | Motivo | Cómo se mitiga |
|---|---|---|
| No se ejecutó la aplicación en esta evaluación | Alcance estático | Recetas del documento 10 y ejecución previa 2.3.2 |
| No se hizo build Docker | Falta de entorno y de `BACKEND/uploads` | Workaround documentado; HAL-23 |
| No se probó con datos reales | Ética y legalidad | Datos sintéticos y seeds |
| No se auditó infraestructura | Fuera del alcance | Recomendación en documento 08 |
| No se revisó el ERS completo | No disponible | Trazabilidad con RF/NFR/RB citados en EP1 |
| No se hicieron pruebas de carga | Tiempo y herramientas | CP-NUEVO-13 y plan del documento 12 |
| No se revisaron binarios ni assets | Irrelevante para los hallazgos | Declarado como fuera de alcance |

### 7.3 Zonas con mayor concentración de riesgo

1. **`users.js`:** concentra 8 hallazgos, incluidos 3 críticos (HAL-04, HAL-05, HAL-06).
2. **`roles.js`:** 5 rutas públicas que permiten reescribir la política de acceso (HAL-07).
3. **`documentos.js`:** combina upload, autorización, tipos y datos clínicos (HAL-18, HAL-20, HAL-22, HAL-26).
4. **`auth.js`:** concentra credenciales, registro, JWT y vinculación de identidad (HAL-02, HAL-08, HAL-09).
5. **Configuración:** secretos y puertos (HAL-03, HAL-27) afectan a todo el sistema.

---

## 8. Conclusión del inventario

El inventario confirma que la revisión cubrió **todo el código de aplicación versionado** y la configuración relevante. No es una muestra: se leyeron los 18 archivos del backend, las 38 piezas del frontend, el esquema y el despliegue. Las brechas restantes son de **ejecución dinámica e infraestructura**, no de cobertura de código.

La concentración de rutas públicas y de controles de autorización duplicados explica por qué los hallazgos críticos no son incidentes aislados: son consecuencia de una arquitectura sin un middleware único de autenticación y sin un modelo de autorización basado en identificadores estables.

---

*Volver al [índice](README.md) · Ver [10 — Evidencias y reproducción](10-evidencias-y-reproduccion.md) · Continuar con [12 — Plan de pruebas EP3](12-plan-de-pruebas-ep3.md).*
