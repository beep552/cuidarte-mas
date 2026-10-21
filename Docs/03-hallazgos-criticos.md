# 03 — Hallazgos críticos (HAL-01 a HAL-08)

> **Criterio de esta sección.** Un hallazgo es crítico cuando permite acceso no autorizado a datos clínicos, suplantación de identidad, escalamiento a administrador o compromiso de credenciales/base de datos. Los ocho hallazgos siguientes justifican por sí solos el dictamen **NO CERTIFICADO**.

---

## <a id="hal-01"></a>HAL-01 — Ficha clínica completa expuesta sin autenticación mediante búsqueda por RUT

| Campo | Valor |
|---|---|
| **Severidad** | **Crítica** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-306 (Missing Authentication for Critical Function), CWE-200 (Exposure of Sensitive Information) |
| **OWASP Top 10 2021** | A01:2021 — Broken Access Control |
| **Ubicación** | `BACKEND/src/routes/pacientes.js:249-273` |
| **Requisitos** | RF-4.1, RF-4.2; RB-1; NFR-SEG-4, NFR-SEG-8 |
| **Casos relacionados** | CP-SEG-003 (API sin token), CP-SEG-006 (acceso a datos ajenos); se propone CP-NUEVO-01 |
| **Normativa** | Ley N.º 19.628; Ley N.º 21.719; Ley N.º 20.584 |
| **Alias previo** | F02 |

### Estado actual

La ruta `GET /pacientes/buscar/rut/:rut` fue declarada “público para pacientes”, pero **no invoca ningún mecanismo de autenticación ni de autorización**. No llama a `getUserFromAuthHeader`, no usa `requireRole` y no verifica que el solicitante sea el titular de la ficha, un médico o un administrador. La consulta devuelve `p.*` (todas las columnas de `pacientes`) más `u.nombre_usuario`, es decir, la ficha clínica completa.

El RUT se normaliza solo eliminando puntos (`normalizeRut`), por lo que el identificador es predecible y enumerable. La respuesta diferencia “no encontrado” (404) de “encontrado” (200), lo que permite confirmar la existencia de una persona en el sistema.

### Código relevante

```js
// BACKEND/src/routes/pacientes.js:248-265
// Buscar paciente por RUT (público para pacientes)
router.get("/buscar/rut/:rut", async (req, res) => {
  try {
    const { rut } = req.params;
    const normalizedRut = normalizeRut(rut);

    const result = await pool.query(
      `SELECT p.*, u.nombre_usuario
       FROM pacientes p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.rut = $1`,
      [normalizedRut]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "No encontrado" });

    res.json(result.rows[0]);
  } catch (err) {
    // ...
  }
});
```

### Reproducción

1. Levantar el stack en un entorno aislado (ver HAL-23 si el build falla).
2. No enviar cabecera `Authorization`.
3. Ejecutar:

```bash
curl -i http://localhost:4444/pacientes/buscar/rut/11111111-1
```

4. Observar `HTTP/1.1 200 OK` y un JSON con `rut`, `primer_nombre`, `apellido_paterno`, `fecha_nacimiento`, `sexo`, `direccion`, `telefono`, `email`, `contacto_emergencia_*`, `tipo_prevision`, `grupo_sanguineo`, `alergias`, `enfermedades_cronicas`, `discapacidades`, `observaciones_medicas_generales`, `usuario_id`, `nombre_usuario`.
5. Repetir con RUT consecutivos o conocidos para enumerar fichas.

### Impacto

- **Confidencialidad:** exposición de datos de salud y datos personales sensibles sin consentimiento ni vínculo terapéutico.
- **Seguridad:** un atacante puede construir un padrón de pacientes, seleccionar víctimas y combinarlo con phishing, fraude o discriminación.
- **Cumplimiento:** la ficha clínica es reservada (Ley 20.584); su acceso debe estar limitado al paciente y al personal autorizado. La Ley 19.628/21.719 exige base de licitud, finalidad y medidas de seguridad.
- **Trazabilidad:** el acceso no genera registro de auditoría, por lo que no se puede saber quién consultó la ficha.

### Causa raíz

1. Se confundió “público para pacientes” con “sin autenticación”.
2. No existe un middleware único de autorización por recurso.
3. El RUT se usa como identificador directo y como dato de búsqueda, sin rate limiting ni auditoría.
4. La consulta devuelve todas las columnas en lugar de un subconjunto mínimo.

### Recomendación

- Exigir autenticación y autorización: el paciente solo puede consultar su propia ficha; médico y administrador según RB-1/RB-3.
- Eliminar la búsqueda por RUT como endpoint público; si se necesita para el flujo de registro, devolver solo un booleano mínimo (“RUT registrado”) sin datos clínicos.
- Usar identificadores opacos (UUID) para el acceso a fichas.
- Aplicar rate limiting y auditoría de cada consulta.
- Devolver solo los campos necesarios según el rol.
- Añadir pruebas automatizadas de acceso anónimo, paciente ajeno y médico autorizado.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `GET /pacientes/buscar/rut/11111111-1` sin token | 401, sin datos |
| Paciente A consulta RUT de B | 403, sin datos |
| Paciente A consulta su propio RUT | 200, solo sus datos |
| Médico consulta RUT de un paciente | 200, según RB-3, con auditoría |
| 100 consultas en 1 minuto | 429 o bloqueo, no enumeración libre |

---

## <a id="hal-02"></a>HAL-02 — Contraseñas almacenadas y comparadas en texto plano

| Campo | Valor |
|---|---|
| **Severidad** | **Crítica** |
| **Estado** | Abierto — confirmado por revisión estática y por ejecución previa (EST + EJEC) |
| **CWE** | CWE-256 (Plaintext Storage of a Password), CWE-916 (Use of Password Hash With Insufficient Computational Effort), CWE-759 |
| **OWASP Top 10 2021** | A02:2021 — Cryptographic Failures; A07:2021 — Identification and Authentication Failures |
| **Ubicación** | `BACKEND/src/routes/auth.js:13-23, 109-112`; `BACKEND/src/routes/users.js:35-38, 500-502`; `BACKEND/sql/dump-cuidarteplus.sql:288-290`; `BACKEND/sql/init.sql:7` |
| **Requisitos** | RF-1.1, RF-2.1; NFR-SEG-1, NFR-SEG-8 |
| **Casos relacionados** | CP-SEG-008 (falla), CP-FUN-001, CP-FUN-002, CP-FUN-015 |
| **Normativa** | Ley N.º 19.628; Ley N.º 21.719; ISO/IEC 27001 A.8.24 |
| **Alias previo** | F01 / **BUG-001** |

### Estado actual

La columna `usuarios.contrasena` es `TEXT` y almacena la contraseña tal como la ingresa el usuario. El login compara con `!==`:

```js
// BACKEND/src/routes/auth.js:13-23
const result = await pool.query(
  "SELECT id, nombre_usuario, contrasena, correo FROM usuarios WHERE nombre_usuario = $1",
  [nombre_usuario]
);
// ...
const user = result.rows[0];
if (user.contrasena !== password) {
  return res.status(401).json({ error: "Credenciales inválidas" });
}
```

El registro inserta `password` directamente:

```js
// BACKEND/src/routes/auth.js:109-112
const userResult = await pool.query(
  "INSERT INTO usuarios (nombre_usuario, contrasena, correo) VALUES ($1, $2, $3) RETURNING ...",
  [nombre_usuario, password, correo]
);
```

La creación administrativa recibe un campo llamado `contrasena_hash`, pero **no hashea**: lo inserta en `contrasena`. La actualización ocurre en `users.js:500-502`. El dump publica `admin/admin`, `medico/medico` y `paciente/paciente` en `dump-cuidarteplus.sql:288-290`.

No existe dependencia de `bcrypt`, `argon2`, `scrypt` ni `crypto` para hashing en `BACKEND/package.json`. La verificación `npm audit` no aplica aquí: el problema es de diseño, no de versión.

### Reproducción

**Vía base de datos (evidencia de CP-SEG-008):**

```bash
psql "postgres://postgres:postgres@localhost:15442/cuidarteplus" \
  -c "SELECT nombre_usuario, contrasena FROM usuarios;"
```

Resultado observado en la ejecución previa: `admin | admin`, `medico | medico`, `paciente | paciente`.

**Vía aplicación:**

1. Registrar un usuario con contraseña `Clave123`.
2. Consultar la tabla `usuarios`: la columna `contrasena` contiene `Clave123`.
3. Iniciar sesión con `admin/admin` (seed del dump).

### Impacto

- **Compromiso de credenciales:** cualquier lectura de la base (HAL-03), backup, log o volcado expone todas las contraseñas.
- **Reutilización:** los usuarios suelen reutilizar contraseñas; el daño se extiende a otros sistemas.
- **Account takeover:** un atacante con acceso a la base no necesita crackear nada.
- **Cumplimiento:** las contraseñas son datos personales y credenciales de acceso; su almacenamiento en claro incumple el principio de seguridad y el deber de confidencialidad.

### Causa raíz

1. No se implementó hashing desde el diseño.
2. El nombre `contrasena_hash` sugiere un hash que nunca se calcula; es una falsa señal de seguridad.
3. Los seeds usan contraseñas triviales para facilitar las pruebas, sin separar el entorno de demo del de producción.
4. No hay migración ni política de rotación.

### Recomendación

- Usar **Argon2id** (preferido) o bcrypt con costo adecuado; nunca SHA-256 simple.
- Migrar las contraseñas existentes: en el próximo login, verificar la contraseña actual y re-hashear; para las cuentas semilla, forzar cambio.
- Añadir `password_hash`, `password_algo`, `password_updated_at` y un proceso de rehash.
- No registrar contraseñas en logs ni en respuestas.
- Invalidar sesiones tras cambio de contraseña.
- Implementar política de contraseñas (HAL-12), rate limiting (HAL-19) y MFA para roles privilegiados.

### Criterio de aceptación / retest

| Verificación | Resultado esperado |
|---|---|
| `SELECT contrasena FROM usuarios` | Valores con formato `$argon2id$...` o `$2b$...`, nunca texto legible |
| Login con contraseña correcta | 200 y token |
| Login con contraseña incorrecta | 401 genérico |
| Comparación en código | `await argon2.verify(hash, password)`, no `!==` |
| CP-SEG-008 | **Aprueba** |

---

## <a id="hal-03"></a>HAL-03 — Secretos JWT y de base de datos comprometidos; PostgreSQL expuesto

| Campo | Valor |
|---|---|
| **Severidad** | **Crítica** |
| **Estado** | Abierto — confirmado por revisión estática y por ejecución previa de acceso a la BD (EST + EJEC) |
| **CWE** | CWE-798 (Hard-coded Credentials), CWE-259 (Use of Hard-coded Password), CWE-522 (Insufficiently Protected Credentials) |
| **OWASP Top 10 2021** | A05:2021 — Security Misconfiguration; A02:2021 — Cryptographic Failures |
| **Ubicación** | `.env:1`; `BACKEND/.env:2-3`; `README.md:30,46`; `docker-compose.yml:7,10-11,33,35`; `BACKEND/src/db.js:4-6`; fallback en 7 rutas |
| **Requisitos** | RF-1.1; NFR-SEG-1, NFR-SEG-3, NFR-SEG-8, NFR-SEG-9 |
| **Casos relacionados** | CP-SEG-008 (acceso a BD), CP-SEG-007 (token manipulado), CP-FUN-001 |
| **Normativa** | Ley N.º 19.628; Ley N.º 21.719; Ley N.º 21.663; ISO/IEC 27001 A.5.17, A.8.24 |
| **Alias previo** | F13 (parte) |

### Estado actual

El repositorio versiona y publica secretos operativos:

- `.env:1` y `BACKEND/.env:3`: `JWT_SECRET=0d1d8132f0fde5beabb417b434ff10f1cae8635a461686b0f46ac9c2bbfbd0e8`.
- `README.md:30`: el mismo secreto, documentado para el usuario.
- `BACKEND/.env:2`: `DATABASE_URL=postgres://postgres:alone15@localhost:5432/cuidarteplus`.
- `BACKEND/src/db.js:4-6`: fallback con la misma contraseña `alone15`.
- `docker-compose.yml:7`: `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}`.
- `docker-compose.yml:10-11`: publica `${PORT_POSTGRES:-15442}:5432`, accesible desde el host.
- `docker-compose.yml:35`: `JWT_SECRET=${JWT_SECRET:-your-secret-key-change-in-production}`, un valor por defecto conocido.
- Siete archivos de rutas usan `process.env.JWT_SECRET || "inseguro"`: `auth.js:8`, `users.js:8`, `pacientes.js:9`, `examenes.js:8`, `documentos.js:7`, `roles.js:5`, `audit.js:6`.

`git ls-files` confirma que `.env` y `BACKEND/.env` están versionados. El `.gitignore` solo excluye `node_modules` de backend y frontend.

### Reproducción

**1. Confirmar el secreto:**

```bash
git ls-files | findstr /I ".env"
type .env
type BACKEND\.env
```

**2. Forjar un token de administrador:**

```bash
node -e "const jwt=require('./BACKEND/node_modules/jsonwebtoken');console.log(jwt.sign({usuarioId:1,nombreUsuario:'admin',rolNombre:'admin',rolId:1},'0d1d8132f0fde5beabb417b434ff10f1cae8635a461686b0f46ac9c2bbfbd0e8',{expiresIn:'2h'}))"
```

Usar el token en `GET /usuarios` o `GET /auditoria`.

**3. Conectarse a la base publicada:**

```bash
psql "postgres://postgres:postgres@localhost:15442/cuidarteplus" -c "\dt"
```

La Actividad 2.3.2 ya documentó el acceso a la BD en el puerto 15442 con el usuario `postgres`.

### Impacto

- **Bypass total de autenticación:** con el secreto se firman tokens con cualquier `usuarioId` y `rolNombre`.
- **Compromiso de la base:** lectura, modificación y borrado de fichas, exámenes, documentos y auditoría.
- **Persistencia:** el atacante puede crear usuarios administradores y borrar evidencia.
- **Cumplimiento:** un secreto versionado es una brecha de seguridad y un incidente notificable.

### Causa raíz

1. Secretos incluidos en el repositorio para facilitar el despliegue de la evaluación.
2. Valores por defecto inseguros en Docker Compose y en el código.
3. Ausencia de validación de entorno al arranque: si falta la variable, la aplicación no falla, usa `"inseguro"`.
4. Base de datos publicada al host con credenciales por defecto.
5. Falta de gestor de secretos y de rotación.

### Recomendación

- **Rotar inmediatamente** el secreto JWT y la contraseña de PostgreSQL; asumir que ambos están comprometidos.
- Eliminar los secretos del historial de Git (`git filter-repo`/BFG) y añadir `.env*` al `.gitignore`.
- Validar el entorno al arranque: si `JWT_SECRET` no existe o es débil, **fallar cerrado**.
- Usar un gestor de secretos (Vault, AWS Secrets Manager, Doppler, variables del orquestador) y rotación periódica.
- No publicar el puerto de PostgreSQL; usar una red interna y un usuario de aplicación con privilegios mínimos.
- Exigir TLS para la conexión a la base (`sslmode=verify-full`).
- Auditar el uso de secretos y alertar sobre accesos anómalos.

### Criterio de aceptación / retest

| Verificación | Resultado esperado |
|---|---|
| `git log -S "0d1d8132"` | Sin resultados tras la limpieza |
| `GET /usuarios` con token forjado con el secreto antiguo | 401 |
| `psql` al puerto 15442 desde el host | Conexión rechazada |
| Arranque sin `JWT_SECRET` | El proceso falla con error explícito |
| `docker compose config` | Sin contraseñas por defecto |

---

## <a id="hal-04"></a>HAL-04 — Cualquier usuario autenticado puede crear un administrador

| Campo | Valor |
|---|---|
| **Severidad** | **Crítica** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-862 (Missing Authorization), CWE-269 (Improper Privilege Management), CWE-285 |
| **OWASP Top 10 2021** | A01:2021 — Broken Access Control |
| **Ubicación** | `BACKEND/src/routes/users.js:23-72`; `BACKEND/src/validations/users.js:18-22` |
| **Requisitos** | RB-1, RB-2; NFR-SEG-4 |
| **Casos relacionados** | CP-SEG-004, CP-SEG-005, CP-FUN-015 |
| **Normativa** | Ley N.º 19.628; Ley N.º 20.584; ISO/IEC 27001 A.8.2, A.8.3 |
| **Alias previo** | F05 |

### Estado actual

`POST /usuarios` solo comprueba que el token exista y sea verificable:

```js
// BACKEND/src/routes/users.js:23-53
router.post("/", validate(createUserSchema), async (req, res) => {
  const { nombre_usuario, contrasena_hash, correo, rol_id } = req.body;
  try {
    const authUser = getUserFromAuthHeader(req);
    if (!authUser) {
      return res.status(401).json({ error: "No autorizado", glosa: "Token inválido" });
    }
    // ...
    const result = await pool.query(
      "INSERT INTO usuarios (nombre_usuario, contrasena, correo) VALUES ($1, $2, $3) RETURNING ...",
      [nombre_usuario, contrasena_hash, correo]
    );
    // ...
    } else if (rol_id) {
      await pool.query(
        "INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)",
        [newUser.id, rol_id]
      );
    }
```

No hay `requireRole(["admin"])`, no se valida que `rol_id` corresponda a un rol permitido y no se comprueba que el actor sea administrador. Un paciente con token válido puede enviar `rol_id: 1` y crear un usuario con rol `admin`.

### Reproducción

1. Iniciar sesión como `paciente/paciente` y copiar el token.
2. Enviar:

```bash
curl -X POST http://localhost:4444/usuarios \
  -H "Authorization: Bearer <TOKEN_PACIENTE>" \
  -H "Content-Type: application/json" \
  -d '{"nombre_usuario":"eviladmin","contrasena_hash":"evil123","correo":"evil@example.cl","rol_id":1}'
```

3. Observar `201 Created` con el nuevo usuario.
4. Iniciar sesión como `eviladmin/evil123`.
5. Ejecutar `GET /usuarios` con el nuevo token: responde 200 porque el rol es `admin`.
6. Opcional: `DELETE /usuarios/1` para eliminar al administrador original.

### Impacto

- **Escalamiento vertical completo:** de paciente a administrador en una sola petición.
- **Control del sistema:** creación de usuarios, cambio de roles, acceso a auditoría y a todos los datos clínicos.
- **Persistencia:** el atacante puede crear cuentas adicionales y borrar evidencia.
- **Cumplimiento:** viola el principio de mínimo privilegio y la segregación de funciones.

### Causa raíz

1. Se confundió autenticación (tener token) con autorización (ser administrador).
2. El `rol_id` es controlado por el cliente y no se valida contra una allowlist.
3. No existe un middleware de autorización reutilizable; cada ruta implementa su propia lógica, con inconsistencias.
4. La validación `createUserSchema` acepta cualquier entero positivo como `rol_id`.

### Recomendación

- Exigir rol `admin` para `POST /usuarios`.
- No aceptar `rol_id` del cliente para decisiones de privilegio; asignar roles desde el servidor.
- Validar que el rol exista y esté permitido (`admin`, `medico`, `paciente`).
- Usar una transacción para usuario + rol + auditoría (HAL-15).
- Registrar la creación con el actor real y el rol asignado.
- Añadir pruebas: paciente → 403; médico → 403; admin → 201.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| Paciente crea usuario con `rol_id: 1` | 403 |
| Médico crea usuario con `rol_id: 1` | 403 |
| Admin crea usuario con `rol_id: 2` | 201 y rol médico |
| Admin crea usuario con `rol_id: 999` | 400, sin usuario huérfano |
| CP-SEG-004/005 | **Aprueban** |

---

## <a id="hal-05"></a>HAL-05 — Autoascenso de médico a administrador en `PUT /usuarios/:id`

| Campo | Valor |
|---|---|
| **Severidad** | **Crítica** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-269 (Improper Privilege Management), CWE-862 (Missing Authorization) |
| **OWASP Top 10 2021** | A01:2021 — Broken Access Control |
| **Ubicación** | `BACKEND/src/routes/users.js:437-532` (foco en 454-455, 484-489, 522-531) |
| **Requisitos** | RB-1, RB-2; NFR-SEG-4 |
| **Casos relacionados** | CP-SEG-004, CP-SEG-005, CP-FUN-015 |
| **Normativa** | Ley N.º 19.628; Ley N.º 20.584; ISO/IEC 27001 A.8.2 |
| **Alias previo** | F07 |

### Estado actual

La función `updateUsuarioSistemaMedico` calcula:

```js
// BACKEND/src/routes/users.js:452-455
const userRoles = userRolesResult.rows.map((r) => r.nombre);
const isAdmin = userRoles.includes("admin") || userRoles.includes("administrador");
const isAdminOrMedico =
  userRoles.includes("admin") || userRoles.includes("administrador") || userRoles.includes("medico");
```

Luego permite cambiar el rol si `isAdminOrMedico`:

```js
// BACKEND/src/routes/users.js:483-531
// Si no es admin o médico, no puede cambiar roles de otros usuarios
if (rol_id !== undefined && !isAdminOrMedico) {
  return res.status(403).json({ error: "No autorizado", glosa: "No tiene permisos para cambiar roles" });
}

// ...
if (rol_id !== undefined && isAdminOrMedico) {
  await pool.query(`DELETE FROM usuario_roles WHERE usuario_id = $1`, [req.params.id]);
  await pool.query(
    `INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)`,
    [req.params.id, rol_id]
  );
}
```

El comentario dice “si no es admin o médico”, pero la condición permite a un médico. No se distingue entre editar el perfil y asignar roles, ni se impide que el médico se edite a sí mismo. La única protección para el paciente es que no puede cambiar su propio rol; el médico sí.

Además, `updateUserSchema` no declara `rol_id` (`validations/users.js:25-46`) y `validate` no reasigna el objeto validado (`validate.js:5`). Por eso, si se envía `rol_id` junto con otro campo válido, el rol llega al handler (ver HAL-21).

### Reproducción

1. Iniciar sesión como `medico/medico` y copiar el token.
2. Enviar:

```bash
curl -X PUT http://localhost:4444/usuarios/2 \
  -H "Authorization: Bearer <TOKEN_MEDICO>" \
  -H "Content-Type: application/json" \
  -d '{"correo":"medico@cuidarteplus.com","rol_id":1}'
```

3. Observar `200 OK` con `rol_id: 1` y `rol_nombre: "admin"`.
4. Cerrar sesión y volver a entrar como `medico/medico`.
5. `GET /usuarios` responde 200; el médico ya es administrador.

### Impacto

- **Escalamiento vertical:** un médico accede a funciones administrativas, auditoría y gestión de usuarios.
- **Destrucción de roles:** el `DELETE` seguido de `INSERT` puede dejar al usuario sin rol si el `INSERT` falla (HAL-15).
- **Conflicto de intereses:** un médico puede modificar su propio rol y los de otros.
- **Cumplimiento:** rompe la segregación de funciones y el mínimo privilegio.

### Causa raíz

1. La autorización se basa en una condición `isAdminOrMedico` que mezcla dos niveles de privilegio.
2. No hay un endpoint separado para “cambiar rol” con autorización de administrador.
3. La validación no declara `rol_id`, pero el middleware no elimina el campo del `req.body`.
4. No hay transacción ni auditoría antes/después del cambio.

### Recomendación

- Solo un administrador puede cambiar roles.
- Un usuario nunca puede cambiar su propio rol, ni siquiera un administrador (o requiere doble control).
- Separar `PUT /usuarios/:id/perfil` de `PUT /usuarios/:id/rol`.
- Usar una allowlist de roles y validar que el rol exista.
- Registrar `rol_anterior` y `rol_nuevo` en auditoría.
- Invalidar los tokens del usuario afectado tras el cambio.
- Añadir pruebas de autoascenso y de cambio por médico.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| Médico cambia su propio `rol_id` a 1 | 403 |
| Médico cambia el rol de otro usuario | 403 |
| Admin cambia el rol de un médico a paciente | 200, con auditoría |
| Admin cambia su propio rol | 400/403 o doble confirmación |
| Token antiguo tras cambio de rol | Rol anterior ya no tiene efecto |

---

## <a id="hal-06"></a>HAL-06 — `DELETE /usuarios/:id` sin autenticación y destrucción con respuesta 500

| Campo | Valor |
|---|---|
| **Severidad** | **Crítica** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-306 (Missing Authentication), CWE-862 (Missing Authorization), CWE-209 (Error Message Information Leak) |
| **OWASP Top 10 2021** | A01:2021 — Broken Access Control |
| **Ubicación** | `BACKEND/src/routes/users.js:571-597`; `BACKEND/src/init.sql:88-93`; `dump-cuidarteplus.sql:266-271` |
| **Requisitos** | RB-2; NFR-SEG-4, NFR-SEG-6 |
| **Casos relacionados** | CP-SEG-003, CP-SEG-004, CP-FUN-015; se propone CP-NUEVO-02 |
| **Normativa** | Ley N.º 19.628; Ley N.º 20.584; Ley N.º 21.663 |
| **Alias previo** | F03 |

### Estado actual

El handler elimina al usuario **antes** de intentar autenticar:

```js
// BACKEND/src/routes/users.js:571-597
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM usuarios WHERE id=$1 RETURNING *",
      [req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "No encontrado" });

    const authUser = getUserFromAuthHeader(req);
    await pool.query(
      "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
      [
        authUser?.nombreUsuario || null,
        `USUARIOS_ELIMINAR: eliminó usuario ID ${req.params.id}`,
      ]
    );

    res.json({ deleted: true });
  } catch (err) {
    // ...
  }
});
```

No hay verificación de token antes del `DELETE`, ni de rol, ni de que el usuario exista como administrador. La autenticación ocurre **después** de borrar y solo para auditar.

Además, si hay token, `authUser.nombreUsuario` es un string (`"admin"`, `"medico"`, etc.) y se inserta en `auditoria.usuario_id`, que es `BIGINT` (`init.sql:90`, `dump:268`). PostgreSQL rechaza el valor con `22P02`; la eliminación ya se confirmó, pero la respuesta es 500. Sin token, `null` es válido y la respuesta es 200.

### Reproducción

**Sin token:**

```bash
curl -i -X DELETE http://localhost:4444/usuarios/3
```

Resultado: `200 OK` con `{"deleted":true}`; el usuario 3 ya no existe.

**Con token:**

```bash
curl -i -X DELETE http://localhost:4444/usuarios/3 \
  -H "Authorization: Bearer <TOKEN_ADMIN>"
```

Resultado: `500` con un mensaje de error de PostgreSQL; el usuario 3 ya no existe.

### Impacto

- **Destrucción no autorizada:** cualquier persona puede borrar cuentas, incluidos administradores y médicos.
- **Pérdida de trazabilidad clínica:** `pacientes.usuario_id` tiene `ON DELETE SET NULL`; se pierde el vínculo entre la ficha y la cuenta.
- **Denegación de servicio:** se puede dejar el sistema sin administradores.
- **Inconsistencia:** la API responde error después de una operación exitosa; un cliente que reintenta puede borrar otros registros por error.
- **Cumplimiento:** no hay control de acceso ni auditoría confiable.

### Causa raíz

1. El orden de las operaciones es incorrecto: se muta antes de autorizar.
2. No existe un middleware de autenticación/autorización global.
3. No hay borrado lógico ni protección del último administrador.
4. El tipo de `auditoria.usuario_id` no coincide con el valor insertado (HAL-17).
5. No hay transacción que revierta el `DELETE` si la auditoría falla (HAL-15).

### Recomendación

- Exigir autenticación y rol `admin` antes de cualquier operación.
- Prohibir la autoeliminación y la eliminación del último administrador.
- Usar borrado lógico (`activo=false`, `deleted_at`) o anonimización, no `DELETE` físico.
- Ejecutar `DELETE` + auditoría en una transacción.
- Corregir el tipo de `usuario_id` y usar el ID numérico del actor.
- Devolver 204/200 solo si la auditoría se registró.
- Añadir pruebas de eliminación anónima, por paciente, por médico y por admin.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `DELETE /usuarios/3` sin token | 401, usuario intacto |
| Paciente elimina a otro | 403, usuario intacto |
| Admin elimina a un médico | 200, borrado lógico y auditoría |
| Admin se elimina a sí mismo | 400/403 |
| Admin elimina al último admin | 400/403 |
| Fallo de auditoría | Rollback, usuario intacto |

---

## <a id="hal-07"></a>HAL-07 — CRUD de roles sin autenticación y autorización basada en nombres mutables

| Campo | Valor |
|---|---|
| **Severidad** | **Crítica** |
| **Estado** | Abierto — confirmado por revisión estática y por CP-SEG-009 (EST + EJEC) |
| **CWE** | CWE-306 (Missing Authentication), CWE-862 (Missing Authorization), CWE-269 (Improper Privilege Management) |
| **OWASP Top 10 2021** | A01:2021 — Broken Access Control |
| **Ubicación** | `BACKEND/src/routes/roles.js:18-92`; `BACKEND/src/app.js:35`; usos de nombres en `users.js`, `pacientes.js`, `examenes.js`, `documentos.js`, `audit.js`; `init.sql:13-16,105` |
| **Requisitos** | RB-1, RB-2; NFR-SEG-4 |
| **Casos relacionados** | CP-SEG-009 (falla, **BUG-002**), CP-SEG-004, CP-FUN-015 |
| **Normativa** | Ley N.º 19.628; Ley N.º 20.584; ISO/IEC 27001 A.8.2 |
| **Alias previo** | F04 |

### Estado actual

`roles.js` no importa ni usa ningún middleware de autenticación. Las cuatro operaciones están abiertas:

```js
// BACKEND/src/routes/roles.js:18-34
router.post('/', async (req, res) => {
  const { nombre } = req.body;
  try {
    const result = await pool.query('INSERT INTO roles (nombre) VALUES ($1) RETURNING *', [nombre]);
    const authUser = getUserFromAuthHeader(req);
    await pool.query('INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)', [
      authUser?.nombreUsuario || null,
      `ROLES_CREAR: creó rol ${nombre}`,
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) { /* ... */ }
});
```

`PUT /roles/:id` y `DELETE /roles/:id` tienen el mismo patrón. `GET /roles` también es público.

La autorización del sistema se basa en el **nombre** del rol, no en un código inmutable:

- `users.js:113`: `userRoles.includes("admin") || userRoles.includes("administrador")`
- `users.js:453-455`: `isAdmin`, `isAdminOrMedico`
- `pacientes.js:37`: `allowedRoles.some(role => userRoles.includes(role))`
- `documentos.js:55`: igual
- `audit.js:80`: `isAdmin = userRoles.includes("admin")`

Por lo tanto:

1. `PUT /roles/3` con `{"nombre":"admin"}` **no basta por sí solo**: `roles.nombre` tiene una restricción `UNIQUE` (`init.sql:15`; `dump-cuidarteplus.sql:497`) y la operación devuelve 500. La restricción no es una defensa: basta una petición previa para liberar el nombre.
2. Cadena viable en dos peticiones: `PUT /roles/1` con `{"nombre":"admin_renombrado"}` y luego `PUT /roles/3` con `{"nombre":"admin"}`. Todos los pacientes pasan a ser administradores; el administrador original pierde su rol.
3. Alternativa en una petición: `PUT /roles/3` con `{"nombre":"administrador"}`. Varias comprobaciones de `users.js` (`113`, `453-455`) aceptan `"administrador"` como admin, lo que permite listar usuarios y cambiar el propio `rol_id` a `1`.
4. `DELETE /roles/1` elimina el rol `admin`; `usuario_roles` se borra en cascada y el sistema queda sin administración.
5. `POST /roles` permite crear roles con nombres arbitrarios (`Admin`, `root`); la restricción `UNIQUE` impide duplicar exactamente `admin`, pero no protege los roles del sistema.
6. `PUT /roles/1` con `{"nombre":"x"}` rompe todas las comprobaciones que buscan `admin`.

### Reproducción

**Escalamiento por renombrado (dos peticiones):**

1. `PUT /roles/1` sin token, body `{"nombre":"admin_renombrado"}`. Libera el nombre `admin`.
2. `PUT /roles/3` sin token, body `{"nombre":"admin"}`. El rol `paciente` pasa a llamarse `admin`.
3. Iniciar sesión como `paciente/paciente`.
4. El JWT incluye `rolNombre: "admin"`; `GET /usuarios` responde 200.
5. El paciente ahora puede crear usuarios, cambiar roles y ver auditoría.

> **Nota técnica:** el intento directo `PUT /roles/3` con `{"nombre":"admin"}` falla con 500 por la restricción `UNIQUE`. Eso no reduce la criticidad: el atacante solo necesita renombrar antes el rol `admin`, o usar el alias `administrador`, que el backend acepta en `users.js`.

**Denegación de servicio:**

1. `DELETE /roles/1` sin token.
2. Iniciar sesión como `admin/admin`; el token no tiene rol.
3. `GET /usuarios` responde 403; no hay forma de recuperar el rol desde la API.

### Impacto

- **Bypass total de autorización:** el nombre del rol es la única barrera y es mutable sin autenticación.
- **Denegación de servicio administrativa:** borrar o renombrar roles deja el sistema inoperable.
- **Integridad:** las asignaciones de rol se pierden por `ON DELETE CASCADE`.
- **Cumplimiento:** no hay control de acceso ni segregación de funciones.

### Causa raíz

1. Endpoints de administración sin autenticación.
2. Uso de nombres de rol como identificadores de seguridad, en lugar de códigos inmutables.
3. Falta de protección de los roles del sistema (`admin`, `medico`, `paciente`).
4. Validación insuficiente: `nombre` no se valida como allowlist ni se normaliza.
5. Auditoría con `nombreUsuario` en columna `BIGINT` (HAL-17).

### Recomendación

- Exigir rol `admin` para `POST/PUT/DELETE /roles` y autenticación para `GET /roles`.
- Introducir un campo `codigo` inmutable (`ADMIN`, `MEDICO`, `PACIENTE`) separado de `nombre` (display).
- Usar el `codigo` o el `id` en las comprobaciones, nunca el nombre mostrado.
- Proteger los roles del sistema: no permitir renombrarlos ni eliminarlos.
- Validar `nombre` con allowlist/longitud y evitar duplicados.
- Ejecutar las operaciones en transacción y auditar antes/después.
- Añadir pruebas de renombrado, borrado y creación no autorizada.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `PUT /roles/3` sin token | 401 |
| Paciente `PUT /roles/3` | 403 |
| Admin renombra rol `paciente` a `admin` | 400, rol del sistema protegido |
| Admin borra rol `admin` | 400, rol del sistema protegido |
| `GET /roles` sin token | 401 |
| CP-SEG-009 | **Aprueba** |

> **Nota sobre `/tipo-examen`:** el catálogo también es público (`tipo-examen.js:5-19`) y CP-SEG-009 lo incluye. Su sensibilidad es menor; se documenta como observación OBS-02 y se recomienda exigir autenticación, sin elevarlo a crítico.

---

## <a id="hal-08"></a>HAL-08 — Vinculación de una ficha clínica existente por RUT sin verificación de identidad

| Campo | Valor |
|---|---|
| **Severidad** | **Crítica** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-639 (Authorization Bypass Through User-Controlled Key), CWE-287 (Improper Authentication), CWE-863 (Incorrect Authorization) |
| **OWASP Top 10 2021** | A01:2021 — Broken Access Control; A07:2021 — Identification and Authentication Failures |
| **Ubicación** | `BACKEND/src/routes/auth.js:71-142` (foco en 77-94, 127-141) |
| **Requisitos** | RF-1.1, RF-2.1, RF-2.2; RB-1; NFR-SEG-4, NFR-SEG-8 |
| **Casos relacionados** | CP-FUN-002, CP-SEG-006; se propone CP-NUEVO-03 |
| **Normativa** | Ley N.º 19.628; Ley N.º 21.719; Ley N.º 20.584 |
| **Alias previo** | F06 (elevado de Mayor a Crítico) |

### Estado actual

El registro acepta un RUT opcional. Si existe un paciente con ese RUT y **no** tiene usuario asociado, el nuevo usuario se vincula automáticamente:

```js
// BACKEND/src/routes/auth.js:77-94
let pacienteExistente = null;
if (normalizedRut) {
  const rutCheck = await pool.query(
    "SELECT id, usuario_id FROM pacientes WHERE rut = $1",
    [normalizedRut]
  );
  if (rutCheck.rows.length > 0) {
    pacienteExistente = rutCheck.rows[0];
    if (pacienteExistente.usuario_id) {
      return res.status(400).json({
        error: "RUT ya registrado",
        glosa: "Este RUT ya tiene una cuenta de usuario asociada",
      });
    }
  }
}
```

```js
// BACKEND/src/routes/auth.js:127-141
if (normalizedRut) {
  if (pacienteExistente) {
    await pool.query(
      "UPDATE pacientes SET usuario_id = $1 WHERE rut = $2",
      [user.id, normalizedRut]
    );
  } else {
    await pool.query(
      `INSERT INTO pacientes (rut, primer_nombre, apellido_paterno, email, fecha_nacimiento, sexo, usuario_id)
       VALUES ($1, $2, $3, $4, '2000-01-01', 'M', $5)`,
      [normalizedRut, nombre_usuario, "", correo, user.id]
    );
  }
}
```

No hay verificación de que el solicitante sea el titular del RUT: no se envía un código al correo o teléfono registrado, no se solicita documento, no se pide consentimiento, no se notifica al paciente y no se audita la vinculación. El RUT es un dato semipúblico y, además, es enumerable mediante HAL-01.

### Reproducción

1. Identificar un paciente existente sin `usuario_id` (por ejemplo, RUT `11111111-1` en un entorno de prueba).
2. Registrar una cuenta con ese RUT:

```bash
curl -X POST http://localhost:4444/autenticacion/registro \
  -H "Content-Type: application/json" \
  -d '{"nombre_usuario":"attacker","password":"Clave123","correo":"attacker@example.cl","rut":"11111111-1"}'
```

3. Iniciar sesión como `attacker`.
4. `GET /pacientes/1` devuelve la ficha completa; `GET /examenes` devuelve los exámenes del titular.
5. El titular legítimo ya no puede registrarse: recibe “RUT ya registrado”.

### Impacto

- **Apropiación de ficha clínica:** acceso a diagnósticos, tratamientos, documentos y datos de contacto.
- **Suplantación:** el atacante puede modificar la ficha (`PUT /pacientes/:id`) y alterar datos clínicos.
- **Bloqueo del titular:** el dueño legítimo pierde la posibilidad de crear su cuenta.
- **Cumplimiento:** acceso a datos de salud sin base de licitud ni consentimiento; viola la reserva de la ficha clínica.

### Causa raíz

1. El RUT se usa como prueba de identidad, cuando solo es un identificador.
2. No hay un proceso de verificación (OTP, email, SMS, presencial o mediado por admin).
3. El registro prioriza la conversión (evitar fricción) sobre la seguridad.
4. No hay auditoría ni notificación al titular.
5. La creación de un paciente con fecha `2000-01-01` y sexo `M` para RUT nuevos genera datos falsos.

### Recomendación

- No vincular automáticamente por RUT.
- Implementar verificación de identidad: código de un solo uso al correo/teléfono registrado, validación documental o aprobación administrativa.
- Usar invitaciones con token de un solo uso enviadas al contacto del paciente.
- Pedir consentimiento informado y registrar su evidencia.
- Notificar al paciente cuando se vincule una cuenta.
- Auditar la vinculación con actor, método y fecha.
- Para RUT nuevos, solicitar los datos reales; no inventar fecha/sexo.
- Añadir pruebas de apropiación y de conflicto de RUT.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| Registro con RUT de un paciente existente sin verificación | 403/202, no vincula |
| Registro con código OTP válido | 201, vincula y audita |
| Registro con RUT ya vinculado | 409, no revela datos |
| Titular legítimo completa el registro | 201, sin bloqueo |
| Paciente A intenta ver ficha de B tras registro | 403 |

---

## Resumen de la sección

| ID | Vulnerabilidad | CWE principal | Requisito | Caso |
|---|---|---|---|---|
| HAL-01 | Ficha por RUT pública | CWE-306 | NFR-SEG-4 | CP-SEG-003/006 |
| HAL-02 | Contraseñas en claro | CWE-256 | RF-2.1 | CP-SEG-008 |
| HAL-03 | Secretos y BD expuestos | CWE-798 | NFR-SEG-1/3 | CP-SEG-008 |
| HAL-04 | Paciente crea admin | CWE-862 | RB-1/RB-2 | CP-SEG-004/005 |
| HAL-05 | Médico se autoasciende | CWE-269 | RB-1/RB-2 | CP-SEG-004/005 |
| HAL-06 | Delete usuarios sin auth | CWE-306 | NFR-SEG-4 | CP-SEG-003/004 |
| HAL-07 | Roles sin auth / nombres mutables | CWE-306/269 | NFR-SEG-4 | CP-SEG-009 |
| HAL-08 | Apropiación por RUT | CWE-639 | RF-2.1/2.2 | CP-FUN-002 |

*Continuar con [04 — Hallazgos mayores](04-hallazgos-mayores.md).*
