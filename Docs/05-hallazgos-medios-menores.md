# 05 — Hallazgos medios y menores (HAL-26 a HAL-38)

> **Criterio de esta sección.** Los hallazgos medios afectan un atributo de calidad, una defensa en profundidad o el cumplimiento, pero no permiten por sí solos un compromiso total. Los menores son defectos acotados de interfaz, consistencia o higiene técnica. Se documentan con el mismo rigor porque varios de ellos amplifican hallazgos críticos o impiden verificar su corrección.

**Distribución de la sección:** 4 medios (HAL-26 a HAL-29) y 9 menores (HAL-30 a HAL-38).

---

## <a id="hal-26"></a>HAL-26 — Errores de multer no controlados y desalineación entre la UI de carga y el límite real

| Campo | Valor |
|---|---|
| **Severidad** | **Media** |
| **Estado** | Abierto — confirmado por revisión estática y por la observación de CP-FUN-013 (EST + EJEC parcial) |
| **CWE** | CWE-754 (Improper Check for Unusual Conditions), CWE-209 (Generation of Error Message Containing Sensitive Information) |
| **OWASP Top 10 2021** | A04:2021 — Insecure Design; A05:2021 — Security Misconfiguration |
| **Ubicación** | `BACKEND/src/routes/documentos.js:10-28, 66, 111-117`; `FRONTEND/src/pages/examenes/ExamenDetalle.jsx:79-114, 376`; `FRONTEND/src/lib/api.jsx:46-82` |
| **Requisitos** | RF-4.3, RF-4.4; NFR-USAB-1; NFR-SEG-5 |
| **Casos relacionados** | CP-FUN-012, CP-FUN-013 (observación); se propone CP-NUEVO-10 |
| **Normativa** | ISO/IEC 25010 (usabilidad y fiabilidad); ISO/IEC 29119 |
| **Alias previo** | F10 (parte) |

### Estado actual

Multer se ejecuta **antes** del handler de la ruta:

```js
// BACKEND/src/routes/documentos.js:66
router.post("/", delayMiddleware(5000), upload.single("documento"), async (req, res) => {
  try {
    // ...
  } catch (err) {
    // Este catch NO captura los errores de multer: ocurren antes.
    res.status(500).json({
      error: "Error al subir documentos",
      glosa: err.message || err.toString(),
    });
  }
});
```

Cuando el archivo excede `10 * 1024 * 1024` o el `fileFilter` rechaza el MIME (`documentos.js:15-27`), multer lanza un `MulterError` o un `Error` antes de entrar al handler. No existe un middleware de error global en `app.js`; por lo tanto, Express responde con su manejador por defecto (HTML/texto, status 500) y no con el contrato JSON `{ error, glosa }` que el frontend espera.

Además, la UI afirma “máximo 10MB” (`ExamenDetalle.jsx:376`), pero `useDropzone` no declara `maxSize` ni `maxFiles` (`ExamenDetalle.jsx:106-114`). El navegador acepta el archivo, lo envía y el usuario solo ve un mensaje genérico:

```js
// FRONTEND/src/pages/examenes/ExamenDetalle.jsx:99-100
} catch {
  toast.error("Error al subir documento");
}
```

La observación de CP-FUN-013 en la Actividad 2.3.2 —archivo `.txt`— no mostró un mensaje específico, coherente con este comportamiento. El interceptor de `api.jsx:46-82` solo puede mostrar un toast estructurado si la respuesta trae `{ error, glosa }`; si llega HTML, cae en el mensaje genérico.

### Reproducción

1. Autenticarse como médico.
2. Subir un archivo `.txt` renombrado a `.pdf` o un archivo de 11 MB.
3. Observar que la respuesta no es JSON estructurado o que el mensaje en pantalla no explica la causa.
4. Revisar la consola del backend: el error de multer aparece sin correlación con la petición.

### Impacto

- El usuario no sabe si el archivo es demasiado grande, si el formato no está permitido o si hubo un fallo del servidor.
- Aumenta la carga de soporte y los reintentos.
- Un error 500 por una entrada inválida es semánticamente incorrecto: debería ser 400/413.
- Si `NODE_ENV=development`, el manejador por defecto de Express puede incluir el stack trace.
- La validación de cliente y servidor no comparten la misma regla, lo que genera una experiencia inconsistente.

### Causa raíz

1. Multer se usa como middleware sin un error handler dedicado.
2. El `catch` del handler se diseñó como si pudiera capturar errores de middleware.
3. No hay constantes compartidas entre frontend y backend para tamaño/MIME.
4. La UI no valida el tamaño antes de enviar.

### Recomendación

- Añadir un middleware de error global que distinga `MulterError`:
  - `LIMIT_FILE_SIZE` → **413** con `{ error: "Archivo demasiado grande", glosa: "Máximo 10 MB" }`.
  - `LIMIT_UNEXPECTED_FILE` → **400**.
  - Error de `fileFilter` → **400** con el formato permitido.
- Declarar `maxSize: 10 * 1024 * 1024` y `maxFiles: 1` en `useDropzone`.
- Mostrar el mensaje específico devuelto por el backend y el error local de dropzone.
- Compartir una constante de configuración (por ejemplo, `MAX_UPLOAD_BYTES`).
- No devolver `err.message` al cliente (ver HAL-31); registrar un `correlationId`.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `.txt` con MIME `text/plain` | 400 JSON con formatos permitidos |
| PDF de 11 MB | 413 JSON, mensaje “máximo 10 MB” |
| PDF válido de 1 MB | 201 |
| Dos archivos en un solo campo | 400 |
| UI con archivo > 10 MB | Rechazo local antes de enviar, mensaje visible |
| CP-FUN-013 | **Aprueba con mensaje específico** |

---

## <a id="hal-27"></a>HAL-27 — Datos clínicos y documentos sin cifrado en reposo; conexión a PostgreSQL sin TLS

| Campo | Valor |
|---|---|
| **Severidad** | **Media** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-311 (Missing Encryption of Sensitive Data), CWE-319 (Cleartext Transmission of Sensitive Information), CWE-312 |
| **OWASP Top 10 2021** | A02:2021 — Cryptographic Failures |
| **Ubicación** | `BACKEND/sql/init.sql:7, 28-51, 82`; `BACKEND/src/db.js:8`; `docker-compose.yml:13, 33`; `FRONTEND/nginx.conf:1-24` |
| **Requisitos** | NFR-SEG-1, NFR-SEG-3; RF-4.3 |
| **Casos relacionados** | CP-SEG-001, CP-SEG-008; se propone CP-NUEVO-11 |
| **Normativa** | Ley N.º 19.628; Ley N.º 21.719; Ley N.º 20.584; ISO/IEC 27001 A.8.24 |
| **Alias previo** | F13 (parcial, transporte); nuevo en reposo |

### Estado actual

- `usuarios.contrasena` es `TEXT` y guarda la contraseña en claro (`init.sql:7`), lo que además constituye HAL-02.
- Los datos clínicos y de contacto se guardan como `TEXT` sin cifrado: RUT, dirección, teléfono, alergias, enfermedades crónicas, observaciones médicas (`init.sql:28-51`).
- Los documentos se guardan como `BYTEA` sin cifrar (`init.sql:82`).
- La conexión se crea con una URL sin `sslmode` (`db.js:8`); `pg` negocia sin exigir TLS.
- El volumen `postgres_data` (`docker-compose.yml:13`) reside en disco del host sin cifrado declarado.
- El backend se conecta como `postgres` (`docker-compose.yml:33`), usuario propietario del esquema.
- No hay `pgcrypto`, KMS, cifrado de columna, cifrado de aplicación ni política de respaldos cifrados.

> **Relación con HAL-03.** HAL-03 cubre la exposición de credenciales y el puerto publicado; HAL-27 cubre la falta de cifrado de los datos en reposo y del canal backend→base. Son causas y remediaciones distintas: rotar secretos no cifra las fichas.

### Reproducción

1. Levantar el stack con un volumen limpio.
2. Insertar un paciente con datos clínicos.
3. Detener los contenedores y montar el volumen en un equipo de prueba.
4. Leer los archivos de datos de PostgreSQL o un `pg_dump`: los valores aparecen legibles.
5. Inspeccionar la conexión: `SHOW ssl;` en la sesión del backend devuelve `off`; `pg_stat_ssl` no registra TLS.

### Impacto

- Robo de disco, backup, snapshot o volumen → exposición masiva de datos de salud.
- Un `pg_dump` filtrado contiene todo en claro.
- Tráfico backend→base observable si se comparte red o si el puerto se publica (HAL-03).
- Incumplimiento de las medidas de seguridad y confidencialidad exigidas a los datos sensibles.

### Causa raíz

1. El proyecto se diseñó como demo local, sin modelo de cifrado.
2. No se clasificaron los datos ni se definió qué requiere cifrado en reposo.
3. PostgreSQL se usa con la configuración por defecto, sin TLS ni roles separados.
4. No hay gestión de claves ni política de respaldos.

### Recomendación

- Exigir TLS en la conexión: `sslmode=verify-full` con CA y certificado de cliente si aplica; rechazar conexiones sin TLS.
- Cifrado de disco/volumen y de backups; claves en KMS o gestor de secretos, con rotación.
- Cifrado de columna para datos clínicos sensibles (`pgcrypto`) o cifrado a nivel de aplicación (*envelope encryption*) para campos y documentos.
- Separar el usuario de aplicación del propietario del esquema; privilegios mínimos.
- Documentar la retención y el borrado seguro.
- Evaluar tokenización del RUT y minimización de datos.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `SHOW ssl;` en la conexión del backend | `on` |
| Conexión sin TLS | Rechazada |
| Lectura directa de un campo clínico en el volumen | Ilegible sin clave |
| `pg_dump` | Campos sensibles cifrados o dump cifrado |
| Backup restaurado | Requiere clave y queda auditado |
| CP-NUEVO-11 | **Aprueba** |

---

## <a id="hal-28"></a>HAL-28 — Auditoría sin inmutabilidad, retención ni protección contra update/delete

| Campo | Valor |
|---|---|
| **Severidad** | **Media** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-778 (Insufficient Logging), CWE-693 (Protection Mechanism Failure), CWE-285 |
| **OWASP Top 10 2021** | A09:2021 — Security Logging and Monitoring Failures |
| **Ubicación** | `BACKEND/sql/init.sql:88-93`; `BACKEND/src/routes/audit.js:19-110`; `BACKEND/src/routes/users.js:580-587`; `docker-compose.yml:33` |
| **Requisitos** | RF-5.1; NFR-SEG-6 |
| **Casos relacionados** | CP-FUN-016; se propone CP-NUEVO-12 |
| **Normativa** | Ley N.º 20.584; Ley N.º 21.663; ISO/IEC 27001 A.8.15, A.8.16 |
| **Alias previo** | F08 (parte) |

### Estado actual

La tabla de auditoría no tiene controles de inmutabilidad:

```sql
-- BACKEND/sql/init.sql:88-93
CREATE TABLE auditoria (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  accion TEXT NOT NULL,
  fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

- No hay triggers, reglas ni permisos que impidan `UPDATE` o `DELETE`.
- La aplicación se conecta como `postgres`, propietario del esquema (`docker-compose.yml:33`), por lo que puede borrar sus propios registros.
- `ON DELETE SET NULL` elimina la atribución del actor cuando se borra un usuario (HAL-06/HAL-33).
- No hay hash chain, firma, secuencia verificable ni almacenamiento WORM.
- No hay política de retención, purga, archivado ni *legal hold*.
- `POST /auditoria` permite insertar acciones arbitrarias (HAL-16) y no se registran intentos fallidos.
- No hay alertas, correlación ni integración con SIEM.

### Reproducción

1. Iniciar sesión como administrador.
2. Insertar un registro de prueba (`POST /auditoria`).
3. Conectarse a la base y ejecutar `UPDATE auditoria SET accion='x' WHERE id=...;` y `DELETE FROM auditoria WHERE id=...;`.
4. Observar que ambas operaciones se ejecutan sin error y sin rastro.
5. Borrar un usuario y verificar que sus registros quedan con `usuario_id = NULL`.

### Impacto

- Un atacante con acceso a la aplicación o a la base puede borrar o alterar la evidencia.
- No se puede demostrar no repudiación ni reconstruir un incidente.
- No se puede cumplir una retención legal ni responder a una solicitud de investigación.
- La atribución se pierde al eliminar usuarios.

### Causa raíz

1. Se trató la auditoría como una tabla operativa más, no como evidencia.
2. No se separaron los privilegios del usuario de aplicación y del propietario.
3. No se definió un modelo de retención ni de integridad.
4. No hay requisitos de auditoría traducidos a controles técnicos.

### Recomendación

- Crear un rol de base con solo `INSERT`/`SELECT` sobre `auditoria`; revocar `UPDATE`/`DELETE`.
- Añadir triggers que rechacen modificaciones y borrados, salvo un procedimiento de archivado controlado.
- Encadenar hashes (`prev_hash`, `hash`) o firmar lotes; verificar periódicamente.
- Enviar los eventos a un almacenamiento append-only/SIEM con retención independiente.
- Definir retención por tipo de evento y *legal hold*; documentar la purga.
- Conservar el actor mediante snapshot (`usuario_nombre`, `usuario_rol`) antes del borrado, no solo la FK.
- Alertar sobre eventos críticos y accesos anómalos.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `UPDATE`/`DELETE` con el usuario de la app | Permiso denegado |
| Borrado de usuario | Registros de auditoría conservan actor y atributos |
| Alteración directa con superusuario | Hash inválido detectable |
| Retención | Job de archivo/purga conforme a la política |
| CP-NUEVO-12 | **Aprueba** |

---

## <a id="hal-29"></a>HAL-29 — Retardo artificial de 5 segundos en endpoints críticos

| Campo | Valor |
|---|---|
| **Severidad** | **Media** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-1050 (Excessive Platform Resource Consumption), CWE-400 |
| **OWASP Top 10 2021** | A04:2021 — Insecure Design |
| **Ubicación** | `BACKEND/src/middleware/delay.js:5-11`; `BACKEND/src/routes/documentos.js:66`; `BACKEND/src/routes/examenes.js:46, 99, 330`; `BACKEND/src/routes/pacientes.js:145` |
| **Requisitos** | NFR-PERF-1; RF-3, RF-4 |
| **Casos relacionados** | CP-FUN-001, CP-FUN-011, CP-SEG-001; se propone CP-NUEVO-13 |
| **Normativa** | ISO/IEC 25010 (eficiencia de desempeño); ISO/IEC 29119 |
| **Alias previo** | Nuevo |

### Estado actual

```js
// BACKEND/src/middleware/delay.js:5-11
const delayMiddleware = (ms = 5000) => {
  return (req, res, next) => {
    setTimeout(() => {
      next();
    }, ms);
  };
};
```

Se aplica incondicionalmente a:

- `GET /pacientes` (`pacientes.js:145`).
- `GET /examenes`, `POST /examenes`, `PUT /examenes/:id` (`examenes.js:46, 99, 330`).
- `POST /documentos` (`documentos.js:66`).

No depende de `NODE_ENV`, no se puede desactivar por variable de entorno y no se documenta como modo de simulación. En producción, cada listado o carga espera cinco segundos antes de autenticar y consultar.

### Reproducción

```bash
curl -w "time_total=%{time_total}\n" -o /dev/null -s \
  -H "Authorization: Bearer <TOKEN_MEDICO>" \
  http://localhost:4444/pacientes
```

Resultado esperado: `time_total` cercano a 5 segundos, incluso con pocos registros y sin carga.

### Impacto

- Incumple NFR-PERF-1 y la expectativa de una API interactiva.
- La UI parece colgada; el usuario reintenta y duplica operaciones (por ejemplo, exámenes).
- Aumenta el tiempo de las suites de prueba y puede provocar timeouts en CI.
- Bajo concurrencia, las conexiones y workers quedan ocupados esperando, lo que facilita una denegación de servicio lenta.
- Enmascara problemas reales de rendimiento: no se puede medir la latencia verdadera.

### Causa raíz

1. Se dejó un middleware de simulación de red en el código productivo.
2. No hay separación entre configuración de prueba y de producción.
3. No existen presupuestos de rendimiento ni pruebas de latencia en CI.

### Recomendación

- Eliminar el middleware de las rutas productivas.
- Si se necesita para demos, activarlo solo con `SIMULATE_DELAY_MS` y por defecto `0`, o bajo `NODE_ENV=test`.
- Simular latencia en pruebas con herramientas de red (Toxiproxy, `tc`, DevTools), no en el código.
- Definir SLO/p95 y pruebas de carga (k6/Artillery).
- Añadir un test que falle si el p95 supera el umbral.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `GET /pacientes` con 10 registros | p95 < 500 ms en local |
| `POST /documentos` con PDF de 1 MB | < 2 s |
| `SIMULATE_DELAY_MS` sin definir | Sin retardo |
| Prueba de carga 50 usuarios | Sin timeouts, latencia estable |
| CP-NUEVO-13 | **Aprueba** |

---

## <a id="hal-30"></a>HAL-30 — Swagger UI y `/openapi.json` públicos

| Campo | Valor |
|---|---|
| **Severidad** | **Menor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-200 (Exposure of Sensitive Information), CWE-1059 |
| **OWASP Top 10 2021** | A05:2021 — Security Misconfiguration |
| **Ubicación** | `BACKEND/src/app.js:37-41`; `BACKEND/src/openapi.json` |
| **Requisitos** | NFR-SEG-4, NFR-SEG-5 |
| **Casos relacionados** | CP-SEG-003; se propone CP-NUEVO-14 |
| **Normativa** | ISO/IEC 27001 A.8.9 |
| **Alias previo** | F13 (parte) |

### Estado actual

```js
// BACKEND/src/app.js:37-41
const openapi = require("./openapi.json");
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));
app.get("/openapi.json", (req, res) => {
  res.json(openapi);
});
```

No hay autenticación, restricción por entorno ni allowlist de IP. La especificación expone rutas, parámetros, esquemas, códigos de respuesta y ejemplos de payload. No se identificaron secretos embebidos en `openapi.json`, por lo que el impacto es de reconocimiento y no de compromiso directo.

### Reproducción

```bash
curl -i http://localhost:4444/openapi.json
```

Sin token, se obtiene el documento completo; `http://localhost:4444/docs` muestra la interfaz interactiva.

### Impacto

- Facilita el reconocimiento de endpoints y parámetros a un atacante.
- Expone rutas administrativas y de auditoría que no deberían ser descubribles.
- Puede inducir a probar operaciones destructivas desde la propia UI de Swagger.

### Causa raíz

Documentación de desarrollo publicada sin política de exposición.

### Recomendación

- Deshabilitar `/docs` y `/openapi.json` en producción o exigir rol administrador.
- Servir la especificación solo en entornos de desarrollo/prueba.
- Revisar que los ejemplos no contengan datos reales ni secretos.
- Mantener la especificación en el repositorio, pero no publicarla en el runtime productivo.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `GET /openapi.json` sin token en producción | 401/404 |
| `GET /docs` sin token en producción | 401/404 |
| Entorno de desarrollo | Disponible solo para el equipo |
| CP-NUEVO-14 | **Aprueba** |

---

## <a id="hal-31"></a>HAL-31 — Mensajes de error con detalles internos de PostgreSQL y del servidor

| Campo | Valor |
|---|---|
| **Severidad** | **Menor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-209 (Generation of Error Message Containing Sensitive Information) |
| **OWASP Top 10 2021** | A05:2021 — Security Misconfiguration; A09:2021 — Security Logging and Monitoring Failures |
| **Ubicación** | `BACKEND/src/routes/auth.js:63-68, 153-164`; `users.js:69, 135, 241, 278, 432, 566, 594`; `pacientes.js:139, 167, 243, 270, 381, 419`; `examenes.js:93, 173, 256, 324, 390, 428`; `documentos.js:115, 178, 257, 295`; `roles.js:32, 42, 53, 72, 90`; `audit.js:41, 107`; `tipo-examen.js:16, 37` |
| **Requisitos** | NFR-SEG-5, NFR-SEG-6 |
| **Casos relacionados** | CP-SEG-003, CP-FUN-015; se propone CP-NUEVO-15 |
| **Normativa** | ISO/IEC 27001 A.8.28; OWASP ASVS V7 |
| **Alias previo** | F13 (parte) |

### Estado actual

El patrón se repite en prácticamente todas las rutas:

```js
// BACKEND/src/routes/auth.js:63-68
} catch (err) {
  console.error(err);
  res
    .status(500)
    .json({ error: "Error en login", glosa: err.message || err.toString() });
}
```

`err.message` de `pg` puede incluir:

- Nombre de tabla, columna y constraint (`duplicate key value violates unique constraint "usuarios_nombre_usuario_key"`).
- Valor de la clave duplicada, que puede ser un RUT, correo o nombre de usuario.
- Tipo de dato esperado (`invalid input syntax for type bigint`), como ocurre en HAL-17.
- Fragmentos de la consulta en algunos errores.

También se devuelve `err.toString()` cuando no hay `message`, y se imprime el error completo en la consola (`console.error`), sin correlación ni redacción.

### Reproducción

1. Enviar `POST /usuarios` con un `rol_id` inexistente (HAL-15): la respuesta 500 incluye el nombre de la FK.
2. Enviar `DELETE /usuarios/3` con token (HAL-17): la respuesta incluye `invalid input syntax for type bigint`.
3. Repetir un registro con un correo existente: el mensaje puede revelar el constraint y el valor.

### Impacto

- Ayuda a un atacante a reconstruir el esquema y a ajustar payloads.
- Puede filtrar datos personales en el propio mensaje de error.
- Dificulta la experiencia y revela tecnología/versión.
- Aumenta el riesgo de que información interna quede en logs de terceros o en capturas de soporte.

### Causa raíz

Se priorizó la depuración rápida sobre un contrato de errores seguro; no hay un mapper central de excepciones.

### Recomendación

- Responder con `{ error, glosa, correlationId }` genéricos; nunca `err.message`.
- Registrar el error completo solo en el servidor, con `correlationId`, nivel y contexto.
- Mapear errores conocidos: `23505` → 409, `23503` → 400, `22P02` → 400, `LIMIT_FILE_SIZE` → 413.
- Redactar datos personales en logs.
- Añadir pruebas que verifiquen que la respuesta no contiene nombres de tablas, SQL ni valores sensibles.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `rol_id` inexistente | 400/409 con mensaje genérico |
| `DELETE` con token | 200, sin mensaje de PostgreSQL |
| Correo duplicado | 409 “dato ya registrado”, sin valor |
| Respuesta 500 | Incluye `correlationId`, no stack ni SQL |
| CP-NUEVO-15 | **Aprueba** |

---

## <a id="hal-32"></a>HAL-32 — Listados sin paginación ni minimización de campos

| Campo | Valor |
|---|---|
| **Severidad** | **Menor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-770 (Allocation of Resources Without Limits), CWE-359 (Exposure of Private Personal Information) |
| **OWASP Top 10 2021** | A01:2021 — Broken Access Control; A04:2021 — Insecure Design |
| **Ubicación** | `BACKEND/src/routes/pacientes.js:155-160`; `examenes.js:128-168`; `users.js:124-128`; `audit.js:92-97`; `FRONTEND/src/pages/pacientes/PacientesTabList.jsx:161-180` |
| **Requisitos** | RF-4.1, RF-5.1; NFR-PERF-1; NFR-SEG-4 |
| **Casos relacionados** | CP-FUN-008, CP-FUN-010, CP-FUN-016; se propone CP-NUEVO-16 |
| **Normativa** | Ley N.º 19.628 (minimización y finalidad); ISO/IEC 25010 |
| **Alias previo** | Nuevo |

### Estado actual

- `GET /pacientes` devuelve `p.*` y `u.nombre_usuario` sin `LIMIT`/`OFFSET` (`pacientes.js:155-160`).
- `GET /examenes` devuelve `em.*` y datos del paciente sin paginación (`examenes.js:128-168`).
- `GET /usuarios` devuelve todos los usuarios sin rol ni paginación (`users.js:124-128`).
- `GET /auditoria` devuelve todos los registros (`audit.js:92-97`).
- La tabla del frontend pagina en el cliente (`MaterialReactTable`), pero la API ya envió el conjunto completo al navegador.

### Reproducción

1. Crear 1.000 pacientes sintéticos.
2. `GET /pacientes` con token de médico: la respuesta contiene las 1.000 filas y todos los campos clínicos.
3. Abrir DevTools → Network: el payload completo está disponible en el navegador, aunque la tabla muestre 10 filas.
4. `GET /auditoria` con token de admin: respuesta completa, sin cursor.

### Impacto

- Consumo de memoria, red y tiempo de respuesta proporcional al tamaño de la base.
- Exposición innecesaria de datos en el cliente y en cachés intermedias.
- Dificulta el cumplimiento del principio de minimización.
- Un usuario con acceso legítimo puede descargar todo el padrón con una sola petición.
- La UI se vuelve lenta y difícil de usar.

### Causa raíz

No se definió un contrato de listados paginados ni una proyección de campos por rol; la paginación se delegó al componente de tabla.

### Recomendación

- Implementar paginación por cursor o `page/limit` con máximo (por ejemplo, 100).
- Devolver `{ data, page, limit, total }` o un cursor.
- Proyectar solo los campos necesarios según el rol.
- Añadir índices para los `ORDER BY` y filtros.
- Paginación server-side en el frontend.
- Limitar la exportación masiva a un flujo auditado.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `GET /pacientes?page=1&limit=20` | 20 filas + metadatos |
| `limit=1000` | 400 o recorte a 100 |
| Paciente consulta listados | Solo sus datos |
| `GET /auditoria` | Paginado y filtrable |
| CP-NUEVO-16 | **Aprueba** |

---

## <a id="hal-33"></a>HAL-33 — Un administrador puede eliminarse a sí mismo o eliminar al último administrador

| Campo | Valor |
|---|---|
| **Severidad** | **Menor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-269 (Improper Privilege Management), CWE-693 |
| **OWASP Top 10 2021** | A01:2021 — Broken Access Control |
| **Ubicación** | `BACKEND/src/routes/users.js:571-597`; `FRONTEND/src/pages/usuarios/UsuariosTabList.jsx:139-159` |
| **Requisitos** | RB-2; NFR-DIS |
| **Casos relacionados** | CP-FUN-015, CP-SEG-004; se propone CP-NUEVO-17 |
| **Normativa** | ISO/IEC 27001 A.5.15, A.8.2 |
| **Alias previo** | F03 (consecuencia adicional) |

### Estado actual

El endpoint `DELETE /usuarios/:id` no verifica:

- Que el actor no sea el mismo usuario que se elimina.
- Que el usuario eliminado no sea el último administrador.
- Que exista un administrador de respaldo.
- Que la eliminación sea lógica y reversible.

El frontend muestra el botón de eliminar al propio administrador (`UsuariosTabList.jsx:139-159`) y el diálogo no advierte que se trata de la propia cuenta.

> **Relación con HAL-06.** Mientras HAL-06 siga abierto, cualquier persona puede borrar usuarios sin autenticación y este hallazgo queda subsumido. HAL-33 se mantiene porque, **aun después de corregir HAL-06**, el sistema puede quedar sin administración por una acción legítima mal protegida.

### Reproducción

1. Iniciar sesión como único administrador.
2. `DELETE /usuarios/1` con su propio token.
3. La respuesta es 200 (o 500 por HAL-17), pero el usuario fue eliminado.
4. Intentar iniciar sesión: no hay administrador; nadie puede gestionar roles.

### Impacto

- Bloqueo administrativo del sistema (denegación de servicio).
- Pérdida del vínculo con fichas (`ON DELETE SET NULL`).
- Imposibilidad de recuperar la cuenta sin acceso a la base.
- Pérdida de trazabilidad si la auditoría falla.

### Causa raíz

No se modeló el ciclo de vida del administrador ni se protegió el último privilegio; se usó borrado físico.

### Recomendación

- Prohibir la autoeliminación.
- Impedir eliminar al último administrador activo.
- Usar borrado lógico (`activo`, `deleted_at`) y anonimización.
- Exigir doble confirmación y justificación para eliminar administradores.
- Transferir la propiedad de fichas y registros antes de desactivar.
- Auditar el cambio con actor y motivo.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| Admin se elimina a sí mismo | 400/403 |
| Admin elimina al último admin | 400/403 |
| Admin elimina a otro admin (existen 2) | 200, borrado lógico |
| Fichas del usuario eliminado | Reasignadas o anonimizadas |
| CP-NUEVO-17 | **Aprueba** |

---

## <a id="hal-34"></a>HAL-34 — `GET /usuarios` no devuelve el rol; la UI muestra “N/A”

| Campo | Valor |
|---|---|
| **Severidad** | **Menor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-1059 (Incomplete Documentation/Contract), CWE-20 |
| **OWASP Top 10 2021** | A04:2021 — Insecure Design |
| **Ubicación** | `BACKEND/src/routes/users.js:124-128`; `FRONTEND/src/pages/usuarios/UsuariosTabList.jsx:80-88` |
| **Requisitos** | RF-5.1; NFR-USAB-1; RB-1 |
| **Casos relacionados** | CP-FUN-015; se propone CP-NUEVO-18 |
| **Normativa** | ISO/IEC 25010 (usabilidad); ISO/IEC 29119 |
| **Alias previo** | Nuevo |

### Estado actual

```js
// BACKEND/src/routes/users.js:124-128
const result = await pool.query(
  `SELECT u.id, u.nombre_usuario, u.correo, u.created_at 
   FROM usuarios u
   ORDER BY u.id DESC`
);
```

La consulta no une `usuario_roles` ni `roles`. El frontend intenta leer `rol` o `rol_nombre`:

```jsx
// FRONTEND/src/pages/usuarios/UsuariosTabList.jsx:84-88
<Cell: { row.original.rol || row.original.rol_nombre || "N/A" }
```

Por eso todos los usuarios aparecen con “N/A” en la columna Rol. El administrador no puede verificar visualmente qué privilegios tiene cada cuenta antes de editarla o eliminarla.

### Reproducción

1. Iniciar sesión como admin.
2. Abrir la lista de usuarios.
3. Observar que la columna Rol muestra “N/A” para todos.
4. Comparar con `GET /usuarios/:id`, que sí devuelve `rol_nombre`.

### Impacto

- El administrador opera a ciegas sobre los privilegios.
- Aumenta el riesgo de eliminar o degradar al usuario equivocado.
- La UI contradice el modelo de datos y genera desconfianza.
- Dificulta la demostración de control de acceso en una auditoría.

### Causa raíz

El contrato del listado se definió antes de incorporar roles y no se actualizó; el frontend asumió un campo que el backend nunca envía.

### Recomendación

- Incluir el rol en el listado mediante `LEFT JOIN usuario_roles` + `roles` y agregación (`array_agg` o `STRING_AGG`).
- Devolver `roles: [{ id, nombre }]` o `rol_principal`.
- Mostrar el rol en la tabla y permitir filtrar por rol.
- Añadir una prueba de contrato entre backend y frontend.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `GET /usuarios` | Cada usuario incluye su rol |
| Tabla de usuarios | Muestra admin/médico/paciente, nunca “N/A” |
| Usuario con múltiples roles | Se muestran todos o el principal |
| CP-NUEVO-18 | **Aprueba** |

---

## <a id="hal-35"></a>HAL-35 — `RequireAdmin` no reconoce el rol `"administrador"` que la gestión de usuarios del backend sí acepta

| Campo | Valor |
|---|---|
| **Severidad** | **Menor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-863 (Incorrect Authorization), CWE-1059 |
| **OWASP Top 10 2021** | A01:2021 — Broken Access Control |
| **Ubicación** | `FRONTEND/src/components/RoleGuard.jsx:11-15, 25-39`; `BACKEND/src/routes/users.js:113`; `FRONTEND/src/pages/usuarios/UsuariosTabList.jsx:108-117` |
| **Requisitos** | RB-1; NFR-USAB-1 |
| **Casos relacionados** | CP-SEG-004, CP-USA-002; se propone CP-NUEVO-19 |
| **Normativa** | ISO/IEC 25010 (usabilidad); ISO/IEC 27001 A.8.2 |
| **Alias previo** | Nuevo |

### Estado actual

La gestión de usuarios del backend acepta dos nombres para el mismo rol:

```js
// BACKEND/src/routes/users.js:113
isAdmin = userRoles.includes("admin") || userRoles.includes("administrador");
```

Pero el guard del frontend solo acepta `"admin"`:

```jsx
// FRONTEND/src/components/RoleGuard.jsx:11-15
export function RequireAdmin({ children }) {
  const { role } = useAuth()
  if (role !== 'admin') return <div>No autorizado (solo administrador).</div>
  return children
}
```

`RequireMedico` también rechaza `"administrador"` (`RoleGuard.jsx:17-23`) y `RequireAdminOrOwnUser` solo permite `"admin"` (`RoleGuard.jsx:25-39`). En cambio, la tabla de usuarios sí considera ambos (`UsuariosTabList.jsx:109`), lo que demuestra la inconsistencia.

### Reproducción

1. Crear un rol `administrador` (o renombrar `admin` a `administrador`).
2. Asignarlo a un usuario e iniciar sesión.
3. El backend autoriza (`GET /usuarios` responde 200), pero el frontend muestra “No autorizado”.
4. El usuario no puede acceder a las pantallas administrativas aunque su token tenga el rol.

### Impacto

- Bloqueo de administradores legítimos.
- Presión operativa para “arreglarlo” renombrando roles, lo que agrava HAL-07.
- Inconsistencia entre frontend y backend que dificulta las pruebas de autorización.
- Mala experiencia y pérdida de confianza en el sistema.

### Causa raíz

Se usó el nombre visible del rol como identificador de seguridad y se duplicó la lógica en cada guard, sin una normalización única.

### Recomendación

- Migrar a códigos inmutables (`ADMIN`, `MEDICO`, `PACIENTE`) y usarlos en backend y frontend.
- Mientras se migra, centralizar una función `isAdmin(role)` que acepte ambos nombres.
- Usar el arreglo `roles` del token, no solo `rolNombre`.
- Eliminar las comparaciones duplicadas en componentes.
- Añadir pruebas de acceso para ambos nombres.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| Rol `administrador` accede a `/usuarios` | Permitido |
| Rol `admin` accede | Permitido |
| Rol `paciente` accede | Denegado |
| Guard y backend | Misma decisión |
| CP-NUEVO-19 | **Aprueba** |

---

## <a id="hal-36"></a>HAL-36 — La fecha de nacimiento se muestra un día antes por interpretación UTC

| Campo | Valor |
|---|---|
| **Severidad** | **Menor** |
| **Estado** | Abierto — confirmado por revisión estática (EST); requiere validación con zona horaria |
| **CWE** | CWE-704 (Incorrect Type Conversion), CWE-1104 |
| **OWASP Top 10 2021** | No aplica directamente; calidad de dato |
| **Ubicación** | `FRONTEND/src/pages/pacientes/PacientesTabList.jsx:106-113`; `BACKEND/sql/init.sql:32`; `FRONTEND/Dockerfile:2` |
| **Requisitos** | RF-4.1, RF-4.2; NFR-USAB-1 |
| **Casos relacionados** | CP-FUN-008, CP-FUN-010; se propone CP-NUEVO-20 |
| **Normativa** | ISO/IEC 25010 (corrección funcional); Ley N.º 20.584 (fidelidad de la ficha) |
| **Alias previo** | F11 |

### Estado actual

`fecha_nacimiento` es `DATE` en PostgreSQL (`init.sql:32`). El driver `pg` la convierte a un objeto `Date` en la zona horaria del servidor (habitualmente UTC en el contenedor) y Express la serializa como ISO con `Z`, por ejemplo `2000-01-01T00:00:00.000Z`.

El frontend la interpreta como instante UTC y la formatea en la zona local:

```jsx
// FRONTEND/src/pages/pacientes/PacientesTabList.jsx:110-113
const fecha = row.original.fecha_nacimiento;
return fecha ? new Date(fecha).toLocaleDateString("es-CL") : "-";
```

En Chile (UTC-3/-4), `2000-01-01T00:00:00.000Z` corresponde al **31 de diciembre de 1999 a las 21:00**, por lo que la tabla muestra `31-12-1999`. El mismo patrón puede afectar otras fechas si se formatean con `new Date(...)`.

> **Condición de reproducción.** El defecto se manifiesta cuando la zona del servidor y la del navegador difieren. En Docker, el backend suele ejecutarse en UTC y el navegador del paciente en `America/Santiago`; es el escenario normal de despliegue, no un caso exótico.

### Reproducción

1. Crear un paciente con `fecha_nacimiento = '2000-01-01'`.
2. Configurar el backend en UTC (`TZ=UTC`, valor por defecto del contenedor).
3. Abrir la lista de pacientes desde un navegador en `America/Santiago`.
4. Observar `31-12-1999`.
5. Verificar la respuesta de la API: `"fecha_nacimiento":"2000-01-01T00:00:00.000Z"`.

### Impacto

- La edad calculada puede ser incorrecta en el día del cumpleaños.
- Un dato de identidad clínica se muestra mal y puede inducir a error en la atención.
- Afecta la confianza en la ficha y en los informes.
- Puede propagarse a exportaciones, notificaciones o integraciones.

### Causa raíz

Se trató una fecha sin hora como si fuera un instante UTC; no hay una función única de formateo de fechas `date-only`.

### Recomendación

- Formatear fechas `DATE` como cadena `YYYY-MM-DD` sin pasar por `new Date` (o usar `Date.UTC` y `timeZone: "UTC"`).
- Hacer que la API devuelva `fecha_nacimiento` como `YYYY-MM-DD`.
- Crear un utilitario `formatDateOnly` compartido y usarlo en todas las pantallas.
- Añadir pruebas con zonas `America/Santiago`, `UTC` y `Asia/Tokyo`.
- Revisar `created_at` (timestamp con hora) por separado: ahí sí corresponde convertir a local.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| Nacido 2000-01-01 en Chile | Muestra `01-01-2000` |
| Navegador en UTC | Muestra `01-01-2000` |
| Navegador en Tokio | Muestra `01-01-2000` |
| Cálculo de edad | Correcto en el cumpleaños |
| CP-NUEVO-20 | **Aprueba** |

---

## <a id="hal-37"></a>HAL-37 — El diálogo de eliminación de paciente muestra `undefined`

| Campo | Valor |
|---|---|
| **Severidad** | **Menor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-1059 (Incomplete Contract), CWE-476 (NULL Pointer Dereference) |
| **OWASP Top 10 2021** | No aplica; calidad de interfaz |
| **Ubicación** | `FRONTEND/src/pages/pacientes/PacientesTabList.jsx:141-143, 251-257` |
| **Requisitos** | RF-4.1; NFR-USAB-1 |
| **Casos relacionados** | CP-FUN-009, CP-USA-003; se propone CP-NUEVO-21 |
| **Normativa** | ISO/IEC 25010 (usabilidad); WCAG 2.1 |
| **Alias previo** | Nuevo |

### Estado actual

El botón de eliminar pasa `row.original.nombre`, un campo que no existe en el modelo de pacientes:

```jsx
// FRONTEND/src/pages/pacientes/PacientesTabList.jsx:141-143
onClick={() => handleDeleteClick(row.original.id, row.original.nombre)}
```

El diálogo lo renderiza directamente:

```jsx
// FRONTEND/src/pages/pacientes/PacientesTabList.jsx:255-257
¿Estás seguro de que deseas eliminar al paciente{" "}
<strong>{pacienteToDelete?.nombrePaciente}</strong>?
```

Como `nombre` es `undefined`, el diálogo muestra “eliminar al paciente **undefined**”. El nombre real está en `primer_nombre`, `apellido_paterno` y `apellido_materno`.

### Reproducción

1. Iniciar sesión como admin.
2. Abrir Pacientes.
3. Pulsar el ícono de eliminar de cualquier fila.
4. Observar el diálogo: “¿Estás seguro de que deseas eliminar al paciente **undefined**?”.

### Impacto

- Confirmación destructiva ambigua: el usuario no sabe a quién está eliminando.
- Riesgo de eliminar la ficha equivocada.
- Mala impresión y pérdida de confianza.
- Falla de accesibilidad: el texto anunciado por lectores de pantalla es incorrecto.

### Causa raíz

Se asumió un campo `nombre` inexistente; no hay tipos ni pruebas de contrato para el diálogo.

### Recomendación

- Construir el nombre completo con `primer_nombre`, `apellido_paterno` y `apellido_materno`.
- Usar un tipo/interface que garantice los campos.
- Añadir `data-testid` y una prueba que verifique el texto del diálogo.
- Mostrar también RUT o fecha de nacimiento para desambiguar homónimos.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| Abrir diálogo de eliminación | Muestra nombre completo y RUT |
| Paciente sin apellido materno | Nombre bien formado, sin `undefined` |
| Cancelar | No elimina |
| CP-NUEVO-21 | **Aprueba** |

---

## <a id="hal-38"></a>HAL-38 — Axios no maneja 401 ni expiración de sesión; el usuario queda en un estado inconsistente

| Campo | Valor |
|---|---|
| **Severidad** | **Menor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-613 (Insufficient Session Expiration), CWE-391 |
| **OWASP Top 10 2021** | A07:2021 — Identification and Authentication Failures |
| **Ubicación** | `FRONTEND/src/lib/api.jsx:46-82`; `FRONTEND/src/context/AuthContext.jsx:7-13, 65-71`; `FRONTEND/src/components/RoleGuard.jsx:4-9` |
| **Requisitos** | RF-1.2; NFR-SEG-9; NFR-USAB-1 |
| **Casos relacionados** | CP-SEG-007; se propone CP-NUEVO-22 |
| **Normativa** | ISO/IEC 27001 A.8.5; OWASP ASVS V3 |
| **Alias previo** | F12 (parte) |

### Estado actual

El interceptor de respuesta solo muestra un toast:

```js
// FRONTEND/src/lib/api.jsx:46-82
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { data } = error.response
      if (data && data.error && data.glosa) {
        toast.error(data.error, { description: data.glosa, duration: 5000 })
      }
      // ...
    }
    return Promise.reject(error)
  }
)
```

No hay tratamiento específico para `401`:

- No se elimina `token` ni `user` de `localStorage`.
- No se redirige a `/login`.
- No se notifica al `AuthContext`.
- No se distingue `401` (sesión inválida) de `403` (sin permiso).
- No hay refresh token ni reintento controlado.

`AuthContext` solo inicializa desde `localStorage` (`AuthContext.jsx:7-13`) y `RequireAuth` comprueba que exista un token (`RoleGuard.jsx:4-9`), no que sea válido. Tras la expiración (2 horas), la aplicación sigue mostrando al usuario como autenticado, pero cada petición falla con un toast.

### Reproducción

1. Iniciar sesión y copiar el token.
2. Esperar a que expire (o modificar `localStorage` con un token inválido).
3. Navegar a cualquier pantalla protegida.
4. Observar que la UI sigue mostrando el layout autenticado y que cada petición genera “No autorizado”.
5. El botón “Salir” es la única forma de limpiar el estado.

### Impacto

- El usuario no entiende por qué nada funciona.
- Se realizan peticiones repetidas con un token inválido.
- La aplicación puede quedar en un estado visual que no corresponde a la sesión real.
- Si se añadieran cookies o refresh, la falta de manejo central podría producir bucles.
- Afecta la percepción de seguridad y la usabilidad.

### Causa raíz

El manejo de errores se diseñó solo para mostrar mensajes, no para gobernar el ciclo de sesión; no hay un evento global de “sesión expirada”.

### Recomendación

- En el interceptor, si `status === 401`, limpiar token/user y redirigir a `/login?expired=1` (evitando bucles).
- Distinguir `403` (mostrar “sin permiso”) de `401` (sesión).
- Implementar refresh token rotativo o reautenticación controlada.
- Validar la expiración al iniciar la app (`jwtDecode(token).exp`).
- Añadir una prueba E2E con token expirado.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| Token expirado en una petición | Limpieza de sesión y redirección única |
| 403 por rol | Mensaje “sin permiso”, sin logout |
| Múltiples 401 simultáneos | Un solo redirect, sin bucle |
| Recarga tras expirar | Pantalla de login |
| CP-NUEVO-22 | **Aprueba** |

---

## 6. Observaciones complementarias (OBS-01 a OBS-12)

Las siguientes observaciones **no se contabilizan como hallazgos** porque no alcanzan el umbral de severidad, dependen de una hipótesis no verificada o ya están cubiertas por un hallazgo principal. Se registran para el plan de mejora y para evitar que se pierdan en la revisión.

| ID | Observación | Ubicación | Motivo de no clasificación |
|---|---|---|---|
| **OBS-01** | No hay pruebas automatizadas ni pipeline de CI. El backend solo tiene scripts `start` y `dev`; el frontend tiene `lint` pero no tests. | `BACKEND/package.json:6-9`; `FRONTEND/package.json:6-11` | Es una brecha de proceso, no una vulnerabilidad explotable; se aborda en el plan de pruebas (documento 12). |
| **OBS-02** | El catálogo `/tipo-examen` es público. | `BACKEND/src/routes/tipo-examen.js:5-23` | La información es de baja sensibilidad; CP-SEG-009 lo incluye y se integra en HAL-07 por la ausencia de autenticación en catálogos. |
| **OBS-03** | `express.static("/files/documentos")` es público y sin autorización. | `BACKEND/src/app.js:43` | Hoy los archivos se guardan en `BYTEA` y el directorio suele estar vacío; el riesgo es latente si se cambia a almacenamiento en disco. |
| **OBS-04** | No existe cambio de contraseña, recuperación ni verificación de correo. | `BACKEND/src/routes/auth.js:10-166` | Es una carencia funcional de ciclo de vida; no permite por sí sola un acceso no autorizado, pero impide rotar credenciales comprometidas. |
| **OBS-05** | `morgan("dev")` escribe logs en stdout sin estructura, redacción ni retención. | `BACKEND/src/app.js:23` | No se observaron datos sensibles en el formato actual, pero no hay control de logs; se relaciona con HAL-16/HAL-28. |
| **OBS-06** | Backend y frontend no tienen `healthcheck` en Compose; solo PostgreSQL. | `docker-compose.yml:16-20, 25-62` | Afecta la operación y la reproducibilidad; HAL-23/HAL-24 ya cubren el fallo de build/inicialización. |
| **OBS-07** | La rama `empresaId` de auditoría consulta tablas que no existen en el esquema (`empresa_usuarios`). | `BACKEND/src/routes/audit.js:59-68`; `BACKEND/sql/init.sql` | Es código muerto/inconsistente; si se forjara un token con `empresaId` (HAL-03), podría producir 500, pero el compromiso ya está cubierto. |
| **OBS-08** | Los mensajes de registro permiten enumerar usuarios y RUT. | `BACKEND/src/routes/auth.js:88-105` | La enumeración es de bajo impacto y facilita HAL-08; se corrige con mensajes genéricos y rate limiting. |
| **OBS-09** | El registro no tiene rate limiting ni CAPTCHA; permite creación masiva de cuentas. | `BACKEND/src/routes/auth.js:71-166` | Es abuso de recursos; HAL-19 cubre la fuerza bruta en login, pero no el registro. Se incluye en el plan de 30 días. |
| **OBS-10** | La UI usa el rol `"editor"` en la lógica de edición, rol que no existe en el esquema. | `FRONTEND/src/pages/usuarios/UsuariosTabList.jsx:113-117` | Inconsistencia de UI; los médicos no ven el botón de editar su propio usuario aunque el backend lo permita. |
| **OBS-11** | Existen dos fuentes de esquema (`init.sql` y `dump-cuidarteplus.sql`) y Compose usa el dump; no hay migraciones versionadas. | `BACKEND/sql/init.sql`; `BACKEND/sql/dump-cuidarteplus.sql`; `docker-compose.yml:14-15` | Riesgo de deriva y de probar contra un esquema distinto; HAL-24 cubre la inicialización parcial. |
| **OBS-12** | Los contenedores se ejecutan como `root` y sin endurecimiento (sin `USER`, `read_only`, `cap_drop`). | `BACKEND/Dockerfile:1-24`; `FRONTEND/Dockerfile:1-47` | Es defensa en profundidad; no otorga acceso por sí solo, pero amplifica el impacto de una RCE. |

---

## 7. Resumen de la sección

| ID | Severidad | Hallazgo | CWE principal | Caso |
|---|---|---|---|---|
| HAL-26 | Media | Multer sin error handler / UI desalineada | CWE-754 | CP-FUN-013 + CP-NUEVO-10 |
| HAL-27 | Media | Sin cifrado en reposo ni TLS a la BD | CWE-311/319 | CP-NUEVO-11 |
| HAL-28 | Media | Auditoría mutable y sin retención | CWE-778 | CP-NUEVO-12 |
| HAL-29 | Media | Retardo artificial de 5 s | CWE-1050 | CP-NUEVO-13 |
| HAL-30 | Menor | Swagger y OpenAPI públicos | CWE-200 | CP-NUEVO-14 |
| HAL-31 | Menor | `err.message` en respuestas | CWE-209 | CP-NUEVO-15 |
| HAL-32 | Menor | Listados sin paginación/minimización | CWE-770 | CP-NUEVO-16 |
| HAL-33 | Menor | Autoeliminación / último admin | CWE-269 | CP-NUEVO-17 |
| HAL-34 | Menor | `GET /usuarios` sin rol → “N/A” | CWE-1059 | CP-NUEVO-18 |
| HAL-35 | Menor | `RequireAdmin` no acepta “administrador” | CWE-863 | CP-NUEVO-19 |
| HAL-36 | Menor | Fecha de nacimiento un día antes | CWE-704 | CP-NUEVO-20 |
| HAL-37 | Menor | Diálogo de borrado muestra `undefined` | CWE-1059 | CP-NUEVO-21 |
| HAL-38 | Menor | Axios no maneja 401/expiración | CWE-613 | CP-NUEVO-22 |

**Conteo de la sección:** 4 medios + 9 menores = **13 hallazgos**, que sumados a los 8 críticos y 17 mayores dan **38 hallazgos**.

*Volver al [índice](README.md) · Continuar con [06 — Matriz de trazabilidad](06-matriz-trazabilidad.md).*
