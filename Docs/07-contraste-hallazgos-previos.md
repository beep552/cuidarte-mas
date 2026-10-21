# 07 — Contraste con los 13 hallazgos previos

> **Resultado global:** **13 de 13 confirmados**, **0 rechazados**. Cinco hallazgos se mantuvieron con ajustes de alcance, tres se elevaron de severidad y cinco se dividieron porque agrupaban causas o remediaciones distintas. El detalle de cada decisión se presenta a continuación.

---

## 1. Resumen del contraste

| Previo | Hallazgo previo (síntesis) | Veredicto | Hallazgo(s) final(es) | Severidad previa | Severidad final |
|---|---|---|---|---|---|
| **F01** | Contraseñas en texto plano | Confirmado | HAL-02 | Crítica | **Crítica** |
| **F02** | Búsqueda pública de ficha por RUT | Confirmado | HAL-01 | Crítica | **Crítica** |
| **F03** | `DELETE /usuarios` sin autenticación | Confirmado y ampliado | HAL-06 (+ HAL-17, HAL-33) | Crítica | **Crítica** |
| **F04** | CRUD de roles sin autenticación | Confirmado y elevado | HAL-07 | Menor (BUG-002) | **Crítica** |
| **F05** | Cualquier token puede crear un administrador | Confirmado | HAL-04 | Crítica | **Crítica** |
| **F06** | Vinculación automática de ficha por RUT | Confirmado y elevado | HAL-08 | Mayor | **Crítica** |
| **F07** | Autoascenso de médico a administrador | Confirmado y elevado | HAL-05 | Mayor | **Crítica** |
| **F08** | Auditoría manipulable / incompleta | Confirmado y dividido | HAL-16, HAL-17, HAL-28 | Mayor | **Mayor / Mayor / Media** |
| **F09** | Política de contraseñas y validación de RUT | Confirmado y dividido | HAL-12, HAL-13 | Mayor | **Mayor / Mayor** |
| **F10** | Validación MIME, multer y dropzone | Confirmado y dividido | HAL-18, HAL-26 | Mayor | **Mayor / Media** |
| **F11** | Fecha de nacimiento mostrada un día antes | Confirmado | HAL-36 | Menor | **Menor** |
| **F12** | Manejo de 401 / expiración de sesión | Confirmado y dividido | HAL-09, HAL-38 | Mayor | **Mayor / Menor** |
| **F13** | Secretos, JWT, TLS, CORS, helmet, token, Swagger y errores | Confirmado y dividido | HAL-03, HAL-09, HAL-10, HAL-11, HAL-27, HAL-30, HAL-31 | Crítica / Mayor | **1 Crítica + 3 Mayores + 1 Media + 2 Menores** |

**Reconciliación:** los 13 hallazgos previos se transformaron en **22 hallazgos finales** (HAL-01 a HAL-08, HAL-09 a HAL-13, HAL-16 a HAL-18, HAL-26, HAL-28, HAL-30, HAL-31, HAL-36, HAL-38). Los 16 hallazgos restantes de la revisión (HAL-14, HAL-15, HAL-19 a HAL-25, HAL-27, HAL-29, HAL-32 a HAL-35, HAL-37) son **nuevos** y no estaban cubiertos por la lista previa.

---

## 2. Contraste detallado

### F01 — Contraseñas en texto plano → HAL-02 (Crítica, confirmada)

**Qué se verificó**

- `auth.js:13-23`: el login compara `user.contrasena !== password`.
- `auth.js:109-112`: el registro inserta `password` directamente.
- `users.js:35-38` y `500-502`: creación y actualización administrativa insertan el valor recibido en `contrasena`.
- `dump-cuidarteplus.sql:288-290`: seeds `admin/admin`, `medico/medico`, `paciente/paciente`.
- `init.sql:7`: columna `contrasena TEXT`.

**Resultado:** confirmado sin cambios de severidad. La Actividad 2.3.2 (CP-SEG-008) ya había observado las contraseñas legibles en la base. Se agrega que el nombre `contrasena_hash` es engañoso: sugiere un hash que nunca se calcula.

**Ajuste:** ninguno en severidad; se amplía el alcance a los seeds y a la actualización administrativa.

---

### F02 — Búsqueda pública de ficha por RUT → HAL-01 (Crítica, confirmada)

**Qué se verificó**

- `pacientes.js:249-273`: la ruta no invoca `getUserFromAuthHeader` ni `requireRole`.
- Devuelve `p.*` y `u.nombre_usuario`.
- El RUT solo se normaliza quitando puntos (`utils/rut.js:5-8`), por lo que es enumerable.
- El 404 vs. 200 permite confirmar la existencia de una persona.

**Resultado:** confirmado. Es el hallazgo de mayor impacto directo sobre la confidencialidad: no requiere cuenta ni interacción de la víctima.

**Ajuste:** se mantiene Crítica. Se propone CP-NUEVO-01 para cubrir acceso anónimo y acceso de un paciente a ficha ajena.

---

### F03 — `DELETE /usuarios` sin autenticación → HAL-06 (Crítica, confirmada y ampliada)

**Qué se verificó**

- `users.js:571-597`: el `DELETE` se ejecuta antes de `getUserFromAuthHeader`.
- Sin token: 200 y usuario eliminado.
- Con token: el `nombreUsuario` (texto) se inserta en `auditoria.usuario_id BIGINT`, PostgreSQL lanza `22P02`, y la respuesta es 500 **después** de borrar.
- `pacientes.usuario_id` es `ON DELETE SET NULL`: se pierde el vínculo clínico.
- No hay borrado lógico ni protección del último administrador.

**Resultado:** confirmado. Se añaden dos dimensiones que la propuesta previa no detallaba: el fallo de tipos de auditoría (HAL-17) y la posibilidad de dejar el sistema sin administración (HAL-33).

**Ajuste:** se mantiene Crítica. Se recomienda tratar HAL-06, HAL-17 y HAL-33 en conjunto, pero con criterios de cierre separados.

---

### F04 — CRUD de roles sin autenticación → HAL-07 (Crítica, elevada)

**Qué se verificó**

- `roles.js:18-92`: `POST`, `GET`, `PUT` y `DELETE` no tienen autenticación.
- La autorización se basa en el **nombre** del rol: `users.js:113,453-455`; `pacientes.js:37`; `documentos.js:55`; `audit.js:80`.
- `PUT /roles/3` con `{"nombre":"admin"}` falla por la restricción `UNIQUE` sobre `roles.nombre`; la cadena viable es `PUT /roles/1` con `{"nombre":"admin_renombrado"}` y luego `PUT /roles/3` con `{"nombre":"admin"}`. También funciona `PUT /roles/3` con `{"nombre":"administrador"}`, alias que `users.js` acepta como admin.
- `DELETE /roles/1` borra el rol `admin` y, por `ON DELETE CASCADE`, las asignaciones; el sistema queda sin administración.
- `POST /roles` permite nombres arbitrarios y confusos (`Admin`, `root`); la restricción `UNIQUE` solo impide duplicar exactamente `admin`.

**Resultado:** confirmado. La propuesta previa lo trataba como un defecto menor de catálogos públicos (BUG-002). Esa clasificación subestimaba el hecho de que **el nombre del rol es el mecanismo de autorización**: modificarlo equivale a reescribir la política de acceso.

**Ajuste:** **elevado de Menor a Crítica.** Justificación: dos peticiones no autenticadas (o una sola usando el alias `administrador`) permiten que todos los pacientes se conviertan en administradores; una sola petición (`DELETE /roles/1`) deja el sistema sin administración. No es un catálogo informativo; es un plano de control.

---

### F05 — Cualquier token puede crear un administrador → HAL-04 (Crítica, confirmada)

**Qué se verificó**

- `users.js:23-72`: solo comprueba que `getUserFromAuthHeader(req)` devuelva algo; no exige rol admin.
- `createUserSchema` acepta cualquier entero positivo como `rol_id` (`validations/users.js:18-22`).
- El `INSERT` en `usuario_roles` usa el `rol_id` enviado por el cliente.

**Resultado:** confirmado. Un paciente autenticado puede crear un usuario con `rol_id: 1` y luego iniciar sesión como administrador. La única condición es tener una cuenta válida, que el propio sistema permite crear por registro público.

**Ajuste:** se mantiene Crítica. Se relaciona con HAL-15 (usuario huérfano si el rol no existe) y HAL-21 (validación incompleta).

---

### F06 — Vinculación automática de ficha por RUT → HAL-08 (Crítica, elevada)

**Qué se verificó**

- `auth.js:77-94`: si existe un paciente con el RUT y no tiene `usuario_id`, se guarda como `pacienteExistente`.
- `auth.js:127-141`: se actualiza `pacientes.usuario_id` con el nuevo usuario, sin OTP, documento, consentimiento ni notificación.
- El RUT es semipúblico y, además, enumerable por HAL-01.
- El titular legítimo queda bloqueado: si intenta registrarse después, recibe “RUT ya registrado”.

**Resultado:** confirmado. La propuesta previa lo clasificaba como Mayor (vinculación indebida). La revisión muestra que el efecto es una **toma de control de la ficha clínica**: el atacante accede a diagnósticos, tratamientos, documentos y datos de contacto, y puede modificarlos.

**Ajuste:** **elevado de Mayor a Crítica.** Justificación: es una suplantación de identidad con acceso a datos de salud, no solo un error de vinculación. Se propone CP-NUEVO-03.

---

### F07 — Autoascenso de médico a administrador → HAL-05 (Crítica, elevada)

**Qué se verificó**

- `users.js:452-455`: `isAdminOrMedico` incluye a `medico`.
- `users.js:483-531`: si `rol_id` está presente y el actor es admin **o médico**, se borran todos sus roles y se inserta el nuevo.
- No se impide que el médico se edite a sí mismo.
- `updateUserSchema` no declara `rol_id`, pero `validate` no reasigna el objeto validado (`validate.js:5`), por lo que el campo llega al handler si se envía junto con otro válido.

**Resultado:** confirmado. Un médico con token válido puede enviar `{"correo":"...","rol_id":1}` y convertirse en administrador.

**Ajuste:** **elevado de Mayor a Crítica.** Justificación: es un escalamiento vertical completo con una cuenta legítima de médico, sin necesidad de explotar otra vulnerabilidad. Se relaciona con HAL-21 como habilitador técnico.

---

### F08 — Auditoría manipulable / incompleta → HAL-16, HAL-17 y HAL-28 (dividido)

**Qué se verificó**

La propuesta previa agrupaba tres problemas con causas y remediaciones distintas:

1. **Forjabilidad y falta de eventos (HAL-16, Mayor):** `POST /auditoria` permite a cualquier usuario autenticado insertar una acción arbitraria (`audit.js:19-44`); no se auditan logins fallidos; faltan IP, user-agent, resultado y recurso.
2. **Error de tipo (HAL-17, Mayor):** varias rutas insertan `nombreUsuario` (texto) en `auditoria.usuario_id BIGINT` (`users.js:580-587`; `roles.js:23-27,63-67,81-85`), lo que produce 500 después de la operación.
3. **Inmutabilidad y retención (HAL-28, Media):** la tabla no tiene protección contra `UPDATE`/`DELETE`, la aplicación se conecta como propietaria y `ON DELETE SET NULL` borra la atribución.

**Resultado:** confirmado y dividido. Las tres partes son ciertas, pero corregir una no corrige las otras: tipar el ID no impide forjar registros; eliminar el endpoint no vuelve la tabla inmutable; añadir triggers no audita logins fallidos.

**Ajuste:** **dividido en tres hallazgos** con severidades Mayor, Mayor y Media. Se propone CP-NUEVO-06 y CP-NUEVO-12.

---

### F09 — Política de contraseñas y validación de RUT → HAL-12 y HAL-13 (dividido)

**Qué se verificó**

- **Contraseñas (HAL-12):** backend y frontend exigen mínimo 6 caracteres, sin complejidad, lista de filtradas ni bloqueo de datos personales (`validations/auth.js:21-24`; `validations/users.js:9-12`; equivalentes en frontend). El ERS exige 12 caracteres con mayúscula, minúscula, número y símbolo.
- **RUT (HAL-13):** `normalizeRut` solo elimina puntos y la validación es una regex de formato (`utils/rut.js:5-8`; `validations/auth.js:30-33`; `validations/pacientes.js:5-8,96-100`). No se calcula el dígito verificador (módulo 11).

**Resultado:** confirmado y dividido. Son dos controles distintos, con requisitos y pruebas distintas (CP-FUN-003/004 para contraseñas; CP-FUN-007 para RUT).

**Ajuste:** **dividido en dos hallazgos Mayores.** Se recomienda actualizar CP-FUN-003/004 a la política de 12 caracteres y añadir casos de DV válido/inválido.

---

### F10 — Validación MIME, multer y dropzone → HAL-18 y HAL-26 (dividido)

**Qué se verificó**

- **MIME (HAL-18, Mayor):** `documentos.js:10-28` valida solo `file.mimetype`, un valor controlado por el cliente. No hay *magic bytes*, antivirus, re-encodeo ni coherencia con la extensión. Un HTML con `type=application/pdf` se acepta.
- **Errores y UI (HAL-26, Media):** multer se ejecuta antes del handler; sus errores no son capturados por el `catch` y Express responde con su manejador por defecto. La UI no declara `maxSize`; el mensaje es genérico. CP-FUN-013 ya observó que un `.txt` no mostraba un mensaje específico.

**Resultado:** confirmado y dividido. La validación binaria es un control de seguridad; el manejo de errores es un control de calidad/UX. Tienen remediationes distintas.

**Ajuste:** **dividido en HAL-18 (Mayor) y HAL-26 (Media).** Se propone CP-NUEVO-10.

---

### F11 — Fecha de nacimiento un día antes → HAL-36 (Menor, confirmado con condición)

**Qué se verificó**

- `init.sql:32`: `fecha_nacimiento DATE`.
- `PacientesTabList.jsx:110-113`: `new Date(fecha).toLocaleDateString("es-CL")`.
- El backend serializa la fecha como ISO UTC; un navegador en `America/Santiago` la interpreta como el día anterior.
- La condición es que la zona del servidor (UTC en Docker) y la del navegador (Chile) difieran; es el escenario normal de despliegue.

**Resultado:** confirmado. No se observó en la ejecución previa porque probablemente el entorno de prueba y el navegador compartían zona horaria, o porque el caso no comparó el valor mostrado con el valor almacenado.

**Ajuste:** se mantiene Menor. Se propone CP-NUEVO-20 con tres zonas horarias.

---

### F12 — Manejo de 401 / expiración de sesión → HAL-09 y HAL-38 (dividido)

**Qué se verificó**

- **Backend/sesión (HAL-09, Mayor):** JWT de 2 horas sin `jti`, revocación, refresh ni invalidación por cambio de contraseña/rol; el logout del frontend solo borra `localStorage`; el token se guarda en `localStorage`.
- **Frontend/401 (HAL-38, Menor):** el interceptor de Axios solo muestra un toast; no limpia la sesión ni redirige; `RequireAuth` solo comprueba que exista un token, no que sea válido.

**Resultado:** confirmado y dividido. El diseño de sesión y el manejo de la UI son dos capas distintas; se pueden corregir por separado.

**Ajuste:** **dividido en HAL-09 (Mayor) y HAL-38 (Menor).** Se propone CP-NUEVO-04 y CP-NUEVO-22.

---

### F13 — Secretos, JWT, TLS, CORS, helmet, token, Swagger y errores → siete hallazgos (dividido)

**Qué se verificó**

La propuesta previa mezclaba configuraciones de distinta naturaleza y severidad:

| Componente de F13 | Verificación | Hallazgo final | Severidad |
|---|---|---|---|
| Secretos JWT/DB versionados y puerto PostgreSQL publicado | `.env:1`; `BACKEND/.env:2-3`; `README.md:30,46`; `docker-compose.yml:7,10-11,33,35`; `db.js:4-6`; fallback `"inseguro"` en 7 rutas | **HAL-03** | **Crítica** |
| Token/sesión sin revocación y en `localStorage` | `auth.js:44-55`; `AuthContext.jsx:7-9,41,59,65-71` | **HAL-09** | **Mayor** |
| CORS abierto | `app.js:21` (`app.use(cors())`) | **HAL-10** | **Mayor** |
| Sin TLS ni cabeceras (helmet/CSP/HSTS) | `app.js:19-23,50`; `nginx.conf:1-24`; `docker-compose.yml:37-38,56-57`; sin `helmet` | **HAL-11** | **Mayor** |
| Datos sin cifrado en reposo / conexión sin TLS | `init.sql:7,28-51,82`; `db.js:8`; volumen del compose | **HAL-27** | **Media** |
| Swagger/OpenAPI públicos | `app.js:37-41`; `openapi.json` | **HAL-30** | **Menor** |
| `err.message` en respuestas | 40+ ocurrencias en rutas | **HAL-31** | **Menor** |

**Resultado:** confirmado y dividido. La parte de secretos es crítica por sí sola: con el secreto publicado se pueden forjar tokens de administrador y con `postgres/postgres` se accede a la base publicada. Las demás son mayores, medias o menores según su impacto.

**Ajuste:** **dividido en siete hallazgos.** Se recomienda corregir HAL-03 en el primer día y el resto en el plan de 30 días (documento 08).

---

## 3. Hipótesis revisadas y no confirmadas

Se evaluaron las siguientes hipótesis adicionales. **No se incluyeron como hallazgos** porque el código no las sostiene o porque dependen de una condición no verificada. Se documentan para demostrar que el contraste fue exhaustivo y para evitar que se repitan en futuras auditorías.

| Hipótesis | Resultado | Evidencia / justificación |
|---|---|---|
| **SQL injection** en login, búsqueda por RUT, filtros o actualizaciones | **No confirmada** | Todas las consultas usan placeholders `$1..$n`. Las únicas interpolaciones dinámicas son nombres de columnas provenientes de una allowlist fija (`pacientes.js:334-350`) y `ORDER BY` estáticos. No se concatena entrada de usuario. |
| **XSS directo** en React | **No confirmada** | No se encontró `dangerouslySetInnerHTML`, `innerHTML`, `eval` ni `new Function`. React escapa por defecto. Un archivo HTML subido podría ser XSS **si** se sirviera inline y sin `nosniff`; hoy se descarga como adjunto y se almacena en `BYTEA`, por lo que se registra como riesgo latente en HAL-18, no como XSS confirmado. |
| **CSRF** clásico | **No confirmada** | La autenticación viaja en `Authorization: Bearer`, no en cookies; el navegador no la adjunta automáticamente en peticiones cross-site. Si en el futuro se migra a cookies, será necesario añadir `SameSite` y token anti-CSRF. |
| **Path traversal** en carga/descarga de documentos | **No confirmada** | `multer.memoryStorage()` guarda el archivo en memoria y luego en `BYTEA`; no se escribe en disco con el nombre del cliente. La descarga usa el `id` y el contenido de la base. `express.static` sirve un directorio fijo, no una ruta controlada por el usuario. |
| **Command injection** | **No confirmada** | No hay `child_process`, `exec`, `spawn`, `execSync` ni shells invocadas desde el backend. |
| **SSRF** | **No confirmada** | El backend no realiza peticiones HTTP salientes a URLs controladas por el usuario. |
| **JWT `alg: none` o algorithm confusion** | **No confirmada como tal** | `jsonwebtoken.verify(token, JWT_SECRET)` con un secreto HMAC rechaza `none` y no acepta claves públicas como secreto. El problema real es que el secreto está publicado (HAL-03), lo que permite firmar tokens válidos; no es una confusión de algoritmo. |
| **Deserialización insegura** | **No confirmada** | Solo se parsea JSON con `express.json()`; no hay YAML, `pickle`, `unserialize` ni objetos ejecutables. |
| **IDOR en `GET /pacientes/:id`** | **No confirmada** | El paciente se compara con `pacienteId.toString() !== req.params.id` (`pacientes.js:205-225`). El acceso indebido existe por la ruta pública de RUT (HAL-01) y por la vinculación (HAL-08), no por este endpoint. |
| **IDOR en `GET /examenes/:id`** | **No confirmada** | El paciente se filtra por `em.paciente_id = $2` (`examenes.js:223-241`). |
| **Acceso anónimo a `GET /examenes/paciente/:id`** | **No confirmada** | Si no hay `authUser`, responde 401 (`examenes.js:296-301`); si es paciente, compara el `paciente_id`. |
| **CORS con credenciales** | **No confirmada** | `cors()` sin `credentials: true`. El riesgo real es la ausencia de allowlist (HAL-10), no la fuga de cookies. |
| **Swagger con secretos embebidos** | **No confirmada** | `openapi.json` describe rutas y esquemas; no se encontraron secretos ni tokens en el archivo. El riesgo es de reconocimiento (HAL-30). |
| **Path traversal en `express.static`** | **No confirmada** | Express normaliza y restringe el acceso al directorio configurado; además, el directorio no recibe archivos del usuario en el flujo actual. |
| **Fuerza bruta solo por falta de CAPTCHA** | **Parcial** | El problema principal es la ausencia de rate limiting y bloqueo (HAL-19); el CAPTCHA es una mitigación adicional, no la causa raíz. |
| **Enumeración de usuarios como hallazgo independiente** | **No confirmada como hallazgo** | Los mensajes permiten inferir si un usuario/RUT existe (OBS-08), pero el impacto es bajo y está subsumido en HAL-08/HAL-19. |

---

## 4. Cambios respecto de la Actividad 2.4.2

| Aspecto | Actividad 2.4.2 | Esta revisión | Motivo |
|---|---|---|---|
| Dictamen | NO CERTIFICADO | **NO CERTIFICADO** | Se confirma y se profundiza. |
| Defecto crítico | BUG-001 (contraseñas en claro) | 8 críticos | Se identificaron vías adicionales de escalamiento y exposición. |
| Roles sin auth | BUG-002 (Menor) | HAL-07 (Crítica) | El nombre del rol es el mecanismo de autorización; renombrarlo escala privilegios. |
| Fuerza bruta | BUG-003 (Mayor) | HAL-19 (Mayor) | Se confirma; se añade ausencia de auditoría de fallos. |
| Caso pendiente | CP-SEG-006 | Sigue pendiente + CP-NUEVO-01/03/07 | La suite previa no cubre los nuevos vectores. |
| Cobertura | 31/32 ejecutados; 28 aprobados | 38 hallazgos trazados + 22 casos nuevos | Se amplía la matriz y se identifican brechas. |
| Enfoque | Ejecución funcional/seguridad | Estático + dependencias + contraste | EP3 exige análisis estático y auditoría técnica. |

---

## 5. Conclusión del contraste

Los 13 hallazgos previos eran correctos en su núcleo, pero la clasificación original **subestimó el impacto de los roles** (F04), **de la vinculación por RUT** (F06) y **del autoascenso médico** (F07). También mezcló en un mismo ítem controles con causas distintas (F08, F09, F10, F12, F13), lo que habría dificultado la asignación de responsables y el retest.

La revisión no rechazó ningún hallazgo previo. Los aspectos no confirmados —SQL injection, XSS directo, CSRF, path traversal, command injection, SSRF, algorithm confusion— se documentan con su justificación técnica para evitar que se reporten como falsos positivos y para demostrar que la ausencia de esos controles no explica los incidentes reales: el problema de Cuidarte+ es de **autorización, identidad y configuración**, no de inyección.

*Volver al [índice](README.md) · Continuar con [08 — Plan de acción y retest](08-plan-de-accion-recomendado.md).*
