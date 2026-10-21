# 04 — Hallazgos mayores (HAL-09 a HAL-25)

> **Criterio de esta sección.** Los hallazgos mayores requieren una sesión válida de bajo privilegio, rompen un requisito principal de seguridad, integridad, disponibilidad o trazabilidad, o impiden un despliegue/verificación confiable. No permiten por sí solos el compromiso total que describen los críticos, pero habilitan o amplifican su impacto.

---

## <a id="hal-09"></a>HAL-09 — Sesión sin revocación, logout real, refresh ni invalidación por cambio de rol

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-613 (Insufficient Session Expiration), CWE-522, CWE-539 |
| **OWASP** | A07:2021 — Identification and Authentication Failures |
| **Ubicación** | `BACKEND/src/routes/auth.js:44-55`; `FRONTEND/src/context/AuthContext.jsx:7-9, 41, 59, 65-71`; `FRONTEND/src/lib/api.jsx:21` |
| **Requisitos** | RF-1.1, RF-1.2; NFR-SEG-9 |
| **Casos** | CP-SEG-007; se propone CP-NUEVO-04 |
| **Normativa** | Ley N.º 19.628; Ley N.º 21.719; ISO/IEC 27001 A.8.5 |

### Estado actual

El token se firma con vigencia de 2 horas:

```js
// BACKEND/src/routes/auth.js:44-55
const token = jwt.sign(
  { usuarioId: user.id, nombreUsuario: user.nombre_usuario,
    rolId: rolId, rolNombre: rolNombre, pacienteId: pacienteId, roles: roles },
  JWT_SECRET,
  { expiresIn: "2h" }
);
```

No existe endpoint de logout, lista de revocación, `jti`, refresh token ni invalidación por cambio de contraseña/rol. El “logout” del frontend solo borra `localStorage`:

```js
// FRONTEND/src/context/AuthContext.jsx:65-71
const logout = () => {
  setToken(null);
  setUser(null);
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};
```

El token se guarda en `localStorage` (`AuthContext.jsx:41,59`) y se lee en cada petición (`api.jsx:21`). Los claims `rolNombre`, `roles` y `pacienteId` quedan obsoletos hasta que expira el token, aunque el rol cambie en la base.

### Reproducción

1. Iniciar sesión y copiar el token.
2. Ejecutar `logout` en el navegador.
3. Usar el token copiado en `GET /examenes`: sigue respondiendo 200 hasta 2 horas después.
4. Cambiar el rol del usuario con un administrador; el token antiguo conserva los claims anteriores.
5. Cambiar la contraseña; el token antiguo sigue siendo aceptado.

### Impacto

- Un token robado (XSS, equipo compartido, logs) es reutilizable hasta su expiración.
- Un usuario degradado conserva privilegios residuales.
- No se puede cerrar sesión de forma efectiva en un dispositivo comprometido.
- La ausencia de refresh obliga a sesiones largas o a reautenticaciones bruscas.

### Causa raíz

1. JWT stateless sin mecanismo de revocación.
2. El logout es solo del cliente.
3. Los roles se copian al token y no se revalidan en cada operación.
4. No hay `jti`, `iss`, `aud` ni rotación.

### Recomendación

- Access token corto (5-15 min) + refresh token rotativo con revocación.
- `jti` y lista de revocación (Redis/DB) para logout y cambios sensibles.
- Invalidar tokens al cambiar contraseña, rol o estado del usuario.
- Guardar el token en cookie `HttpOnly`, `Secure`, `SameSite=Strict` o en memoria; evitar `localStorage`.
- Revalidar rol/estado en el backend para operaciones críticas.
- Añadir `iss`, `aud` y algoritmo explícito (`HS256` o `RS256`).

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| Token tras logout | 401 |
| Token tras cambio de contraseña | 401 |
| Token tras degradación de rol | Sin privilegios antiguos |
| Token expirado | 401 y redirección a login |
| Robo de token simulate | Ventana de abuso ≤ 15 min |

---

## <a id="hal-10"></a>HAL-10 — CORS abierto a cualquier origen

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-942 (Permissive Cross-domain Policy) |
| **OWASP** | A05:2021 — Security Misconfiguration |
| **Ubicación** | `BACKEND/src/app.js:21` |
| **Requisitos** | NFR-SEG-4, NFR-SEG-5 |
| **Casos** | CP-SEG-003, CP-SEG-005 |
| **Normativa** | ISO/IEC 27001 A.8.20; OWASP ASVS V14 |

### Estado actual

```js
// BACKEND/src/app.js:21
app.use(cors());
```

La configuración por defecto refleja cualquier `Origin` y responde `Access-Control-Allow-Origin: *`. No hay allowlist, no se restringen métodos ni cabeceras y no se valida el origen de la aplicación.

### Reproducción

```bash
curl -i -H "Origin: https://evil.example" http://localhost:4444/
```

Observar `Access-Control-Allow-Origin: *`. Si el token está accesible para JavaScript (HAL-09), una página maliciosa puede leer respuestas de la API.

### Impacto

- Amplía la superficie de exfiltración si existe XSS o un token accesible.
- Permite que cualquier sitio consuma endpoints públicos (HAL-01) y de enumeración.
- Facilita pruebas automatizadas maliciosas y *scraping*.

### Causa raíz

Configuración de conveniencia para el desarrollo, sin política de orígenes.

### Recomendación

- Allowlist explícita: `origin: [process.env.FRONTEND_URL]`.
- Restringir métodos y cabeceras.
- No usar `credentials: true` con `*`.
- Validar `Origin` en el servidor y registrar rechazos.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `Origin: https://evil.example` | Sin cabecera CORS de permiso |
| `Origin: http://localhost:3333` | Permitido |
| Preflight desde origen no autorizado | 403 |

---

## <a id="hal-11"></a>HAL-11 — Sin TLS ni cabeceras de seguridad

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-319 (Cleartext Transmission), CWE-693 (Protection Mechanism Failure), CWE-1021 |
| **OWASP** | A02:2021 — Cryptographic Failures; A05:2021 — Security Misconfiguration |
| **Ubicación** | `BACKEND/src/app.js:19-23,50`; `FRONTEND/nginx.conf:1-24`; `docker-compose.yml:37-38,56-57`; `FRONTEND/Dockerfile:34`; `FRONTEND/.env:1` |
| **Requisitos** | NFR-SEG-1, NFR-SEG-3 |
| **Casos** | CP-SEG-001, CP-SEG-003; se propone CP-NUEVO-05 |
| **Normativa** | Ley N.º 19.628; Ley N.º 21.719; ISO/IEC 27001 A.8.24 |

### Estado actual

- El backend escucha HTTP en el puerto 4000 (`app.js:49-50`).
- Nginx sirve HTTP en el puerto 80 (`nginx.conf:1-2`), sin TLS ni redirección.
- Docker Compose publica `4444:4000` y `3333:80` (`docker-compose.yml:37-38,56-57`).
- El frontend apunta a `http://localhost:4000` (`FRONTEND/.env:1`).
- No existe `helmet` en `BACKEND/package.json` ni cabeceras `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` o `Permissions-Policy`.

### Reproducción

```bash
curl -I http://localhost:4444/
curl -I http://localhost:3333/
```

No se observan cabeceras de seguridad ni redirección a HTTPS. Un proxy de confianza puede inspeccionar credenciales y tokens.

### Impacto

- Interceptación de credenciales y JWT en redes no confiables.
- *Clickjacking* y *framing* de la aplicación.
- Mayor impacto de XSS al no existir CSP.
- Incumplimiento de NFR-SEG-1/3 y de las expectativas de confidencialidad.

### Causa raíz

Despliegue de laboratorio sin terminación TLS ni endurecimiento HTTP.

### Recomendación

- Terminación TLS en Nginx o en un balanceador; redirección 301/308 a HTTPS.
- HSTS con `max-age` y `includeSubDomains`.
- `helmet` con CSP, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`.
- Cookies `Secure`, `HttpOnly`, `SameSite`.
- Certificados gestionados y renovación automática.
- Pruebas con SSL Labs o `testssl.sh`.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `http://` | Redirección a `https://` |
| Cabeceras | HSTS, CSP, nosniff, frame-ancestors |
| TLS | Versión ≥ 1.2, cifrados fuertes |
| Token en tránsito | No visible en texto claro |

---

## <a id="hal-12"></a>HAL-12 — Política de contraseñas débil (6 caracteres, sin complejidad)

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-521 (Weak Password Requirements) |
| **OWASP** | A07:2021 — Identification and Authentication Failures |
| **Ubicación** | `BACKEND/src/validations/auth.js:21-24`; `BACKEND/src/validations/users.js:9-12`; `FRONTEND/src/validations/auth.js:26-29`; `FRONTEND/src/validations/users.js:11-15`; `BACKEND/sql/dump-cuidarteplus.sql:288-290` |
| **Requisitos** | RF-2.1; NFR-SEG-9; Restricción 2.4 del ERS |
| **Casos** | CP-FUN-003, CP-FUN-004, CP-FUN-015 |
| **Normativa** | ISO/IEC 27001 A.5.17; OWASP ASVS V2.1 |

### Estado actual

Backend:

```js
// BACKEND/src/validations/auth.js:21-24
password: yup
  .string()
  .required("La contraseña es requerida")
  .min(6, "La contraseña debe tener al menos 6 caracteres"),
```

El esquema de creación de usuarios exige lo mismo (`users.js:9-12`), al igual que el frontend (`FRONTEND/src/validations/auth.js:26-29`, `users.js:11-15`). No se exige mayúscula, minúscula, número, símbolo, longitud máxima, lista de contraseñas filtradas ni prohibición de usar el nombre de usuario. Los seeds usan `admin/admin`, `medico/medico` y `paciente/paciente`.

El ERS/EP1 exige **mínimo 12 caracteres con mayúscula, minúscula, número y símbolo**. Los casos CP-FUN-003 y CP-FUN-004 prueban 5 y 6 caracteres, por lo que validan la política débil implementada, no la política objetivo.

### Reproducción

1. Registrarse con `abc123` → 201.
2. Iniciar sesión con `abc123` → 200.
3. Crear un usuario administrador con `123456` → 201.

### Impacto

- Contraseñas triviales y reutilizables; facilitan fuerza bruta y *credential stuffing*.
- Los seeds conocidos permiten acceso inmediato en demo/pruebas.
- Incumplimiento directo de la restricción 2.4 del ERS.

### Causa raíz

La validación se diseñó para el mínimo técnico, no para la política de seguridad; además, los casos de prueba se alinearon con el código en lugar de con el requisito.

### Recomendación

- Mínimo 12 caracteres; fomentar frases de paso.
- Exigir al menos 3 de 4 categorías o una frase de paso robusta.
- Rechazar contraseñas filtradas (Have I Been Pwned/k-anonymity).
- Prohibir usuario, correo, nombre y variaciones.
- Longitud máxima razonable (128) y normalización Unicode.
- MFA para admin/médico.
- Actualizar CP-FUN-003/004 a la política de 12 caracteres.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `abc123` | 400, no cumple política |
| `Cuidarte#2026` | 201 |
| Contraseña igual al usuario | 400 |
| Contraseña filtrada conocida | 400 |
| CP-FUN-003/004 | Aprobados con la política de 12 caracteres |

---

## <a id="hal-13"></a>HAL-13 — Validación de RUT solo por formato; no se valida el dígito verificador

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-20 (Improper Input Validation), CWE-345 (Insufficient Verification of Data Authenticity) |
| **OWASP** | A04:2021 — Insecure Design |
| **Ubicación** | `BACKEND/src/utils/rut.js:5-8`; `BACKEND/src/validations/auth.js:30-33`; `BACKEND/src/validations/pacientes.js:5-8,96-100` |
| **Requisitos** | RF-2.2; NFR-SEG-5 |
| **Casos** | CP-FUN-007 |
| **Normativa** | Ley N.º 19.628 (calidad del dato); ISO/IEC 25012 |

### Estado actual

La normalización solo elimina puntos:

```js
// BACKEND/src/utils/rut.js:5-8
function normalizeRut(rut) {
  if (!rut) return rut;
  return rut.replace(/\./g, "");
}
```

La validación es una expresión regular de formato:

```js
// BACKEND/src/validations/auth.js:30-33
rut: yup
  .string()
  .matches(/^([0-9]{1,2}(\.[0-9]{3})*-[0-9kK]|[0-9]+-[0-9kK])$/, "El RUT debe tener formato válido ...")
  .optional(),
```

No se calcula el dígito verificador (módulo 11), no se normaliza `K` a `k`, no se hace `trim`, no se valida el largo del cuerpo y no se rechazan RUT como `12.345.678-5` (cuyo DV correcto es `7`). La base solo tiene `UNIQUE(rut)`, que impide duplicados pero no valida el DV.

### Reproducción

1. Registrar un paciente con RUT `12.345.678-5` (DV inválido) → 201.
2. Registrar un usuario con el mismo RUT → se vincula a la ficha inválida.
3. Crear dos fichas para la misma persona con variantes `12345678-5` y `12.345.678-5`: la normalización las iguala, pero un RUT con `k` mayúscula/minúscula puede tratarse distinto.

### Impacto

- Fichas duplicadas o asociadas a RUT inexistentes.
- Dificultad para identificar al paciente y para interoperar con sistemas de salud.
- Riesgo de vinculación errónea (HAL-08) y de fraude.
- Datos clínicos asociados a una identidad incorrecta.

### Causa raíz

Se confundió “formato válido” con “RUT válido”; no se usó una librería de validación chilena (el frontend ya incluye `@fdograph/rut-utilities`).

### Recomendación

- Normalizar: `trim`, quitar puntos, `K` → `k`.
- Validar cuerpo numérico y DV con módulo 11.
- Rechazar longitudes fuera de rango y RUT con todos los dígitos iguales.
- Usar la misma función en backend y frontend.
- Añadir pruebas con DV válido/inválido y variantes de formato.
- Mantener `UNIQUE` y considerar un índice funcional sobre el RUT normalizado.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `12.345.678-5` | 400, DV inválido |
| `12.345.678-7` | 201 |
| `12345678-7` | 201, normalizado |
| `12.345.678-k` | 400/201 según DV, con `k` normalizada |
| Duplicado con otro formato | 400 |

---

## <a id="hal-14"></a>HAL-14 — `usuario_id` aceptado como campo modificable en pacientes (*mass assignment*)

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-915 (Improperly Controlled Modification of Dynamically-Determined Object Attributes) |
| **OWASP** | A01:2021 — Broken Access Control; A04:2021 — Insecure Design |
| **Ubicación** | `BACKEND/src/routes/pacientes.js:81,116,334-342`; `BACKEND/src/middleware/validate.js:5` |
| **Requisitos** | RB-1, RB-3; NFR-SEG-4 |
| **Casos** | CP-FUN-007, CP-SEG-006 |
| **Normativa** | Ley N.º 19.628; Ley N.º 20.584 |

### Estado actual

`POST /pacientes` desestructura `usuario_id` y lo inserta:

```js
// BACKEND/src/routes/pacientes.js:81,116
usuario_id,
// ...
usuario_id || null,
```

`PUT /pacientes/:id` lo incluye en la allowlist:

```js
// BACKEND/src/routes/pacientes.js:334-342
const allowedFields = [
  "rut", "primer_nombre", "apellido_paterno", "apellido_materno",
  "fecha_nacimiento", "sexo", "nacionalidad", "estado_civil",
  "email", "telefono", "direccion",
  "contacto_emergencia_nombre", "contacto_emergencia_telefono", "contacto_emergencia_relacion",
  "tipo_prevision", "tiene_convenio",
  "grupo_sanguineo", "alergias", "enfermedades_cronicas", "discapacidades", "observaciones_medicas_generales",
  "usuario_id"
];
```

Aunque `updatePacienteSchema` no declara `usuario_id`, `validate` no reasigna el objeto validado (`validate.js:5`), por lo que el campo permanece en `req.body`. Un médico puede reasignar la ficha a otro usuario; un paciente puede desvincular su ficha o vincularla a otra cuenta.

### Reproducción

**Como médico:**

```bash
curl -X PUT http://localhost:4444/pacientes/1 \
  -H "Authorization: Bearer <TOKEN_MEDICO>" \
  -H "Content-Type: application/json" \
  -d '{"usuario_id":3}'
```

Luego, el usuario 3 (paciente) puede ver la ficha 1.

**Como paciente:**

```bash
curl -X PUT http://localhost:4444/pacientes/1 \
  -H "Authorization: Bearer <TOKEN_PACIENTE>" \
  -H "Content-Type: application/json" \
  -d '{"usuario_id":null}'
```

La ficha queda sin dueño; el paciente pierde acceso a su propia información.

### Impacto

- Reasignación de fichas clínicas entre cuentas.
- Denegación de acceso al titular.
- Exposición de datos a una cuenta no autorizada.
- Pérdida de integridad del vínculo paciente↔usuario.

### Causa raíz

1. El campo de relación se trata como dato editable por el cliente.
2. La validación no declara una allowlist estricta y el middleware no reasigna el resultado.
3. No hay un endpoint dedicado para vincular cuentas con verificación.

### Recomendación

- Eliminar `usuario_id` de `POST/PUT /pacientes`.
- Crear un endpoint administrativo `POST /pacientes/:id/vincular` con verificación y auditoría.
- Aplicar allowlist estricta en el esquema y reasignar `req.body` validado.
- Validar que el usuario exista y que la operación sea autorizada.
- Añadir pruebas de reasignación y desvinculación.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| Paciente envía `usuario_id` | 400/ignorado |
| Médico envía `usuario_id` | 400/ignorado |
| Admin vincula con verificación | 200, auditado |
| Paciente desvincula su ficha | 403 |

---

## <a id="hal-15"></a>HAL-15 — Operaciones multi-paso sin transacciones; estados parciales

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-662 (Improper Synchronization), CWE-754 (Improper Check for Unusual Conditions), CWE-841 |
| **OWASP** | A04:2021 — Insecure Design |
| **Ubicación** | `BACKEND/src/routes/auth.js:109-147`; `users.js:35-62,524-531,573-587`; `roles.js:21-27`; `pacientes.js:84-126`; `documentos.js:93-108` |
| **Requisitos** | RF-1, RF-2, RF-3, RF-5; NFR-SEG-6 |
| **Casos** | CP-FUN-002, CP-FUN-011, CP-FUN-015, CP-FUN-016 |
| **Normativa** | ISO/IEC 25010 (fiabilidad); ISO/IEC 27001 A.8.32 |

### Estado actual

No existe `pool.connect()`, `BEGIN`, `COMMIT` ni `ROLLBACK` en el backend. Cada `pool.query` es autónomo. Ejemplos:

- Registro: inserta usuario, asigna rol, vincula/crea paciente y audita, sin transacción (`auth.js:109-147`).
- Creación de usuario: inserta usuario, inserta rol y audita (`users.js:35-62`).
- Cambio de rol: `DELETE` todos los roles + `INSERT` nuevo rol (`users.js:524-531`).
- Eliminación de usuario: `DELETE` + auditoría (`users.js:573-587`).
- Creación de paciente/examen/documento: inserción + auditoría.

Si el segundo paso falla, el primero queda confirmado. Ejemplos:

- `POST /usuarios` con `rol_id: 999`: el usuario se crea, el `INSERT` de rol falla por FK y la respuesta es 500; queda un usuario sin rol.
- `POST /autenticacion/registro`: si falla la creación del paciente, queda una cuenta sin ficha.
- `PUT /usuarios/:id` con rol: si el `INSERT` falla, el usuario queda sin ningún rol.
- `DELETE /usuarios/:id`: el usuario se borra y la auditoría falla (HAL-17), sin rollback.

### Reproducción

```bash
curl -X POST http://localhost:4444/usuarios \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"nombre_usuario":"huerfano","contrasena_hash":"Clave123","correo":"huerfano@example.cl","rol_id":999}'
```

Respuesta 500. Verificar en la base: el usuario `huerfano` existe, pero no tiene fila en `usuario_roles`.

### Impacto

- Usuarios sin rol que no pueden operar o quedan en estado indefinido.
- Cuentas huérfanas y datos inconsistentes.
- Reintentos que duplican registros o borran datos.
- Auditoría incompleta.
- Dificultad para reconciliar datos tras incidentes.

### Causa raíz

Uso de conexiones del pool para operaciones relacionadas sin una unidad transaccional; ausencia de capa de servicio/repositorio.

### Recomendación

- Usar un cliente dedicado: `const client = await pool.connect()`, `BEGIN`, operaciones, `COMMIT`, `ROLLBACK` en `catch`, `finally client.release()`.
- Encapsular casos de uso en servicios transaccionales.
- Validar FKs antes de insertar.
- Añadir pruebas de fallo inducido y verificar rollback.
- Considerar un ORM o un patrón Unit of Work.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `rol_id` inexistente | 400 y ningún usuario creado |
| Fallo de auditoría | Rollback completo |
| Registro con fallo de paciente | Sin cuenta huérfana |
| Cambio de rol con fallo | Rol anterior intacto |

---

## <a id="hal-16"></a>HAL-16 — Auditoría forjable e incompleta

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-117 (Improper Output Neutralization for Logs), CWE-778 (Insufficient Logging), CWE-284 |
| **OWASP** | A09:2021 — Security Logging and Monitoring Failures |
| **Ubicación** | `BACKEND/src/routes/audit.js:19-44`; `auth.js:10-69` (solo log de éxito en 57-60); `init.sql:88-93` |
| **Requisitos** | RF-5.1; NFR-SEG-6 |
| **Casos** | CP-FUN-016, CP-SEG-010; se propone CP-NUEVO-06 |
| **Normativa** | Ley N.º 20.584; Ley N.º 21.663; ISO/IEC 27001 A.8.15 |

### Estado actual

Cualquier usuario autenticado puede insertar una acción arbitraria:

```js
// BACKEND/src/routes/audit.js:19-44
router.post("/", async (req, res) => {
  const { accion, detalles } = req.body;
  const authUser = getUserFromAuthHeader(req);
  if (!authUser) return res.status(401).json({ error: "No autorizado" });
  const actionText = detalles ? `${accion}: ${detalles}` : accion;
  const result = await pool.query(
    "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2) RETURNING *",
    [authUser?.usuarioId || null, actionText]
  );
  res.status(201).json(result.rows[0]);
});
```

No hay validación de la acción contra un catálogo, ni firma, ni restricción a un servicio interno. Un paciente puede escribir “USUARIOS_ELIMINAR: eliminó usuario ID 1” y el administrador lo verá como un registro legítimo.

Además:

- Solo se audita el login exitoso (`auth.js:57-60`); los fallos no se registran.
- No se guardan IP, user-agent, resultado, recurso, valores anteriores/nuevos ni correlation ID.
- `GET /auditoria` no tiene paginación ni filtros (`audit.js:92-97`).
- En `audit.js:80`, `isAdmin` solo acepta `"admin"`, no `"administrador"`, a diferencia de otros módulos.
- El `usuario_id` es `BIGINT` y algunas rutas insertan el nombre (HAL-17).

### Reproducción

1. Iniciar sesión como paciente.
2. Enviar:

```bash
curl -X POST http://localhost:4444/auditoria \
  -H "Authorization: Bearer <TOKEN_PACIENTE>" \
  -H "Content-Type: application/json" \
  -d '{"accion":"USUARIOS_ELIMINAR","detalles":"eliminó usuario ID 1"}'
```

3. Entrar como admin y abrir `/auditoria`: el registro falso aparece.
4. Probar 10 logins fallidos: no se crea ningún registro.

### Impacto

- Se pierde la no repudiación: no se puede confiar en la auditoría para investigar incidentes.
- Un atacante puede contaminar o desviar la investigación.
- No se detectan ataques de fuerza bruta (HAL-19).
- Incumplimiento de trazabilidad legal y de ciberseguridad.

### Causa raíz

1. La auditoría se expone como endpoint de escritura para el cliente.
2. No hay una capa de auditoría del servidor con acciones tipadas.
3. El esquema no tiene campos forenses.
4. No hay integridad criptográfica ni control de acceso de escritura.

### Recomendación

- Eliminar `POST /auditoria` del API público; auditar desde el servidor en cada caso de uso.
- Definir un enum de acciones y validar.
- Registrar: actor, acción, recurso, resultado, IP, user-agent, timestamp, correlation ID, valores antes/después.
- Auditar login exitoso y fallido, cambios de rol, accesos a fichas y descargas.
- Firma/hash chain y almacenamiento append-only (HAL-28).
- Paginación y filtros para el administrador.
- Alertas para eventos críticos.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| Paciente `POST /auditoria` | 404/403 |
| Login fallido | Registro con resultado `FAIL` |
| 10 intentos fallidos | 10 registros + alerta |
| Registro manipulado | Hash inválido detectable |
| Admin consulta logs | Paginado y filtrable |

---

## <a id="hal-17"></a>HAL-17 — Inserción de nombre de usuario en `auditoria.usuario_id BIGINT`

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-704 (Incorrect Type Conversion), CWE-681 |
| **OWASP** | A04:2021 — Insecure Design |
| **Ubicación** | `BACKEND/src/routes/users.js:580-587`; `roles.js:23-27,63-67,81-85`; `init.sql:88-93`; `dump-cuidarteplus.sql:266-271` |
| **Requisitos** | RF-5.1; NFR-SEG-6 |
| **Casos** | CP-FUN-016, CP-NUEVO-02 |
| **Normativa** | Ley N.º 21.663; ISO/IEC 27001 A.8.15 |

### Estado actual

El esquema define `usuario_id BIGINT`:

```sql
-- BACKEND/sql/init.sql:88-93
CREATE TABLE auditoria (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  accion TEXT NOT NULL,
  fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Pero varias rutas insertan `authUser.nombreUsuario`, que es un string:

```js
// BACKEND/src/routes/users.js:580-587
const authUser = getUserFromAuthHeader(req);
await pool.query(
  "INSERT INTO auditoria (usuario_id, accion) VALUES ($1, $2)",
  [
    authUser?.nombreUsuario || null,
    `USUARIOS_ELIMINAR: eliminó usuario ID ${req.params.id}`,
  ]
);
```

Lo mismo ocurre en `roles.js:24-27,64-67,82-85`. PostgreSQL rechaza `"admin"` para `BIGINT` con `22P02`; la operación principal ya se confirmó y la respuesta es 500.

### Reproducción

1. Iniciar sesión como admin.
2. `DELETE /usuarios/3` → 500; verificar que el usuario 3 ya no existe y que no hay registro de auditoría.
3. `POST /roles` con token → 500; verificar que el rol sí se creó.
4. Sin token, `POST /roles` → 201, porque `null` es válido en `BIGINT` (pero sin actor).

### Impacto

- Operaciones destructivas devuelven error aunque se ejecutaron.
- Reintentos del cliente pueden duplicar o borrar datos.
- Auditoría incompleta y no confiable.
- Difícil distinguir un fallo real de un éxito con error de respuesta.

### Causa raíz

Confusión entre el nombre de usuario y su ID; falta de tipos/validación; ausencia de pruebas de integración con la base real.

### Recomendación

- Usar siempre `authUser.usuarioId` (numérico) en `auditoria.usuario_id`.
- Añadir una FK y un `CHECK`/tipo consistente.
- Validar el token y el actor antes de la operación.
- Envolver operación + auditoría en transacción.
- Añadir pruebas que verifiquen la fila de auditoría después de cada operación.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `DELETE /usuarios/3` con admin | 200 y fila de auditoría con ID 1 |
| `POST /roles` con admin | 201 y auditoría |
| `POST /roles` sin token | 401 |
| Consulta `SELECT usuario_id` | Valor numérico o NULL, nunca texto |

---

## <a id="hal-18"></a>HAL-18 — Carga de archivos validada solo por el MIME declarado por el cliente

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-434 (Unrestricted Upload of File with Dangerous Type), CWE-436, CWE-646 |
| **OWASP** | A04:2021 — Insecure Design; A08:2021 — Software and Data Integrity Failures |
| **Ubicación** | `BACKEND/src/routes/documentos.js:10-28,66-98,236-252` |
| **Requisitos** | RF-4.3, RF-4.4; NFR-SEG-5 |
| **Casos** | CP-FUN-012, CP-FUN-013 |
| **Normativa** | Ley N.º 19.628; ISO/IEC 27001 A.8.28 |

### Estado actual

Multer valida solo `file.mimetype`, un valor controlado por el cliente:

```js
// BACKEND/src/routes/documentos.js:10-28
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos PDF, JPG o PNG"), false);
    }
  },
});
```

No se inspeccionan los *magic bytes*, no se valida la extensión real, no se re-encodean las imágenes, no se analiza con antivirus y no se separa el almacenamiento. El archivo se guarda como `BYTEA` en la base y se descarga con `Content-Type` inferido de la extensión (`documentos.js:236-252`).

### Reproducción

```bash
printf '<html><script>alert(1)</script></html>' > payload.html
curl -X POST http://localhost:4444/documentos \
  -H "Authorization: Bearer <TOKEN_MEDICO>" \
  -F "documento=@payload.html;type=application/pdf" \
  -F "examen_medico_id=1" \
  -F "paciente_id=1"
```

El archivo se acepta como PDF. Al descargarlo, el contenido es HTML con `Content-Type: application/pdf` y `Content-Disposition: attachment`; según el navegador/proxy, puede descargarse o interpretarse.

### Impacto

- Distribución de malware a médicos/pacientes.
- Almacenamiento de contenido no permitido y abuso de espacio.
- Riesgo de XSS almacenado si en el futuro se sirve inline o se elimina `attachment`.
- Incumplimiento de controles de integridad de archivos.

### Causa raíz

Confianza en el `Content-Type` del cliente; ausencia de validación binaria y de análisis antimalware.

### Recomendación

- Validar *magic bytes* con `file-type` y coherencia con la extensión.
- Allowlist estricta de extensiones y MIME.
- Re-encodeo de imágenes y eliminación de metadatos.
- Antivirus (ClamAV) y cuarentena.
- Almacenamiento en objeto aislado, nombres aleatorios, sin ejecución.
- Forzar `Content-Disposition: attachment` y `X-Content-Type-Options: nosniff`.
- Límite de tamaño y cuota por usuario.
- Pruebas con archivos maliciosos/políglotas.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| PDF real | 201 |
| HTML con MIME `application/pdf` | 400 |
| `.exe` renombrado a `.pdf` | 400 |
| Archivo > 10 MB | 413 |
| Archivo con malware de prueba EICAR | Rechazado/cuarentena |

---

## <a id="hal-19"></a>HAL-19 — Sin rate limiting, bloqueo progresivo ni CAPTCHA; fuerza bruta viable

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por ejecución previa (EJEC) |
| **CWE** | CWE-307 (Improper Restriction of Excessive Authentication Attempts), CWE-799 |
| **OWASP** | A07:2021 — Identification and Authentication Failures |
| **Ubicación** | `BACKEND/src/routes/auth.js:10-69`; ausencia de `express-rate-limit` en `BACKEND/package.json` |
| **Requisitos** | RF-1.1; NFR-SEG-9 |
| **Casos** | CP-SEG-010 (falla, **BUG-003**) |
| **Normativa** | ISO/IEC 27001 A.8.5; OWASP ASVS V2.2 |

### Estado actual

El login no tiene límite de intentos, retardo progresivo, bloqueo temporal, CAPTCHA ni alerta. Cada intento fallido devuelve 401 sin registrar el fallo (HAL-16). La Actividad 2.3.2 documentó que tras 10 intentos fallidos con `admin` y contraseña incorrecta, el intento 11 con la contraseña correcta fue aceptado.

### Reproducción

```bash
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4444/autenticacion/login \
    -H "Content-Type: application/json" \
    -d '{"nombre_usuario":"admin","password":"mala1"}'
done
curl -i -X POST http://localhost:4444/autenticacion/login \
  -H "Content-Type: application/json" \
  -d '{"nombre_usuario":"admin","password":"admin"}'
```

No se observa 429 ni bloqueo; el último intento responde 200.

### Impacto

- Fuerza bruta y *credential stuffing* contra cuentas privilegiadas.
- Consumo de recursos y posible denegación de servicio.
- Si se combina con HAL-02/HAL-12, el éxito es cuestión de tiempo.
- Incumplimiento directo de CP-SEG-010 y de la expectativa de autenticación segura.

### Causa raíz

No se implementó una política de intentos; el login se diseñó solo para el camino feliz.

### Recomendación

- Limitar por IP y por usuario (por ejemplo, 5 intentos/minuto, 10/hora).
- Bloqueo temporal progresivo y notificación al usuario.
- CAPTCHA tras umbral.
- MFA para admin/médico.
- Registrar y alertar intentos fallidos.
- Evitar mensajes que distingan usuario inexistente de contraseña incorrecta.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| 5 intentos fallidos | 429 o bloqueo temporal |
| Intento correcto durante bloqueo | 423/429, no 200 |
| 10 intentos desde IP distinta | Límite por usuario igualmente |
| Logs | Intentos fallidos registrados |
| CP-SEG-010 | **Aprueba** |

---

## <a id="hal-20"></a>HAL-20 — Comparación `BIGINT` (string) vs. número del JWT: el paciente recibe 403 en sus propios documentos

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-704 (Incorrect Type Conversion), CWE-697 (Incorrect Comparison) |
| **OWASP** | A01:2021 — Broken Access Control |
| **Ubicación** | `BACKEND/src/routes/documentos.js:143-152,221-223` |
| **Requisitos** | RF-4.1, RF-4.2; RB-1 |
| **Casos** | CP-FUN-014 (no cubre documentos); se propone CP-NUEVO-07 |
| **Normativa** | Ley N.º 20.584 (derecho de acceso a la ficha) |

### Estado actual

PostgreSQL devuelve `BIGINT` como string en `pg` (no hay `setTypeParser` que lo convierta). El JWT contiene `usuarioId` como número. La comparación estricta es siempre verdadera:

```js
// BACKEND/src/routes/documentos.js:143-152
if (userRoles.includes("paciente")) {
  const examenResult = await pool.query(
    `SELECT em.paciente_id, p.usuario_id
     FROM examen_medico em
     JOIN pacientes p ON p.id = em.paciente_id
     WHERE em.id = $1`,
    [req.params.examen_id]
  );
  if (examenResult.rows.length === 0 ||
      examenResult.rows[0].usuario_id !== authUser.usuarioId) {
    return res.status(403).json({ ... "Solo puede ver sus propios documentos" });
  }
}
```

Y en la descarga:

```js
// BACKEND/src/routes/documentos.js:221-223
if (userRoles.includes("paciente")) {
  if (documento.usuario_id !== authUser.usuarioId) {
    return res.status(403).json({ ... });
  }
}
```

`"3" !== 3` es `true`; por eso el paciente recibe 403 incluso para sus propios documentos.

### Reproducción

1. Iniciar sesión como paciente con un examen/documento propio.
2. `GET /documentos/examen/1` → 403.
3. `GET /documentos/1` → 403.
4. Verificar en la base que `pacientes.usuario_id = 3` y que el JWT tiene `usuarioId: 3`.

### Impacto

- El paciente no puede acceder a sus documentos clínicos, un derecho reconocido por la Ley 20.584.
- Aumenta la carga de soporte y puede empujar a canales inseguros.
- CP-FUN-014 no lo detectó porque solo prueba exámenes, no documentos.
- La comparación incorrecta puede afectar otras rutas con el mismo patrón.

### Causa raíz

Desconocimiento del tipo de retorno de `pg` para `BIGINT`; ausencia de normalización de IDs; pruebas incompletas.

### Recomendación

- Normalizar antes de comparar: `String(a) === String(b)` o `Number(a) === Number(b)`.
- Configurar `pg.types.setTypeParser(20, (v) => Number(v))` si los IDs caben en `Number` (o usar `BigInt`).
- Usar `id` numérico consistente en JWT y BD.
- Añadir pruebas de documentos propios/ajenos para paciente.
- Revisar todas las comparaciones de IDs.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| Paciente descarga su documento | 200 |
| Paciente descarga documento ajeno | 403 |
| Médico descarga documento | 200 |
| Admin descarga documento | 200 |
| CP-NUEVO-07 | **Aprueba** |

---

## <a id="hal-21"></a>HAL-21 — `updateUserSchema` omite `rol_id` y `validate` no reasigna el objeto validado

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-20 (Improper Input Validation), CWE-915, CWE-863 |
| **OWASP** | A01:2021 — Broken Access Control; A04:2021 — Insecure Design |
| **Ubicación** | `BACKEND/src/validations/users.js:25-46`; `BACKEND/src/middleware/validate.js:5-6` |
| **Requisitos** | RB-2; NFR-SEG-4 |
| **Casos** | CP-FUN-015 |
| **Normativa** | ISO/IEC 27001 A.8.2 |

### Estado actual

El esquema de actualización no declara `rol_id`:

```js
// BACKEND/src/validations/users.js:25-46
const updateUserSchema = yup.object().shape({
  nombre_usuario: yup.string().min(3).max(50).optional(),
  contrasena_hash: yup.string().min(6).optional(),
  correo: yup.string().email().max(255).optional(),
}).test("at-least-one-field", "...", function (value) {
  return Object.keys(value).length > 0;
});
```

El middleware valida con `stripUnknown: true`, pero **descarta el resultado**:

```js
// BACKEND/src/middleware/validate.js:4-6
const data = req[source];
await schema.validate(data, { abortEarly: false, stripUnknown: true });
next();
```

Consecuencias:

1. `PUT /usuarios/:id` con solo `{rol_id: 1}`: el valor validado queda `{}`; el test “at-least-one-field” falla y responde 400. El cambio de rol “normal” está roto.
2. `PUT /usuarios/:id` con `{correo: "...", rol_id: 1}`: el valor validado conserva `correo`, pasa el test; pero `req.body` sigue teniendo `rol_id`, y el handler lo lee. El rol cambia sin estar en el esquema.
3. Cualquier campo desconocido permanece en `req.body` y puede llegar a la lógica de negocio.

Este defecto es el habilitador técnico de HAL-05 y de HAL-14.

### Reproducción

**Rol solo:**

```bash
curl -i -X PUT http://localhost:4444/usuarios/3 \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"rol_id":2}'
```

Resultado: 400 “Debe proporcionar al menos un campo para actualizar”.

**Rol + correo:**

```bash
curl -i -X PUT http://localhost:4444/usuarios/3 \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"correo":"nuevo@example.cl","rol_id":1}'
```

Resultado: 200 y rol cambiado.

### Impacto

- Funcionalidad de cambio de rol inconsistente.
- Bypass de la validación y de la allowlist.
- Habilita escalamiento de privilegios (HAL-05) y mass assignment (HAL-14).
- Dificulta razonar sobre qué campos acepta cada endpoint.

### Causa raíz

Error de diseño del middleware: se valida una copia y se continúa con el objeto original; el esquema no refleja todos los campos que el handler consume.

### Recomendación

- Reasignar: `req[source] = await schema.validate(data, { abortEarly:false, stripUnknown:true, strict:true })`.
- Declarar `rol_id` en el esquema, con validación de existencia y allowlist.
- Separar DTOs de perfil y de rol.
- Añadir pruebas de campos desconocidos y de roles.
- Revisar todos los esquemas que usan `validate`.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `{rol_id:2}` solo | 200 (si el actor es admin) o 403, no 400 por esquema |
| `{correo, rol_id}` | Rol validado y autorizado |
| Campo desconocido | Eliminado antes del handler |
| `req.body` | Solo campos declarados |

---

## <a id="hal-22"></a>HAL-22 — No se verifica que el examen y el paciente del documento correspondan entre sí

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-20 (Improper Input Validation), CWE-345, CWE-639 |
| **OWASP** | A01:2021 — Broken Access Control; A04:2021 — Insecure Design |
| **Ubicación** | `BACKEND/src/routes/documentos.js:77-98` |
| **Requisitos** | RF-3.1, RF-4.4; NFR-SEG-6 |
| **Casos** | CP-FUN-012; se propone CP-NUEVO-08 |
| **Normativa** | Ley N.º 20.584 (fidelidad de la ficha) |

### Estado actual

El endpoint acepta `examen_medico_id` y `paciente_id` por separado y los inserta sin comprobar la relación:

```js
// BACKEND/src/routes/documentos.js:77-98
const { examen_medico_id, paciente_id } = req.body;
// ...
const result = await pool.query(
  `INSERT INTO documentos_examen (
    examen_medico_id, paciente_id, documento, nombre_archivo
  ) VALUES ($1, $2, $3, $4) RETURNING id, nombre_archivo, created_at`,
  [examen_medico_id, paciente_id, req.file.buffer, req.file.originalname]
);
```

Las FKs verifican que existan ambos registros, pero no que el examen pertenezca a ese paciente. Se puede crear un documento con `examen_medico_id` del paciente A y `paciente_id` del paciente B. La descarga usa el examen para resolver al paciente (`documentos.js:206-213`), ignorando `documentos.paciente_id`, por lo que la inconsistencia queda silenciosa.

### Reproducción

1. Como médico, subir un documento con `examen_medico_id=1` (paciente 1) y `paciente_id=2`.
2. Respuesta 201.
3. `SELECT examen_medico_id, paciente_id FROM documentos_examen` muestra la inconsistencia.
4. Si se consulta por paciente 2, el documento no aparece; si se consulta por examen 1, aparece asociado al paciente 1.

### Impacto

- Documentos clínicos mal atribuidos.
- Riesgo de decisiones médicas basadas en información incorrecta.
- Dificultad para auditar y reconstruir la historia clínica.
- Posible exposición si en el futuro se consulta por `documentos.paciente_id`.

### Causa raíz

El cliente controla ambos identificadores y el servidor no deriva uno del otro; no hay una validación de coherencia.

### Recomendación

- Derivar `paciente_id` desde `examen_medico_id` en el servidor.
- No aceptar `paciente_id` del cliente.
- Validar que el examen exista y que el actor tenga acceso.
- Añadir una restricción/trigger de coherencia si se mantiene la columna.
- Auditar la asociación.
- Pruebas de inconsistencia.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| Examen 1 + paciente 1 | 201, coherente |
| Examen 1 + paciente 2 | 400, rechazado |
| Examen inexistente | 404/400 |
| Paciente sin acceso al examen | 403 |

---

## <a id="hal-23"></a>HAL-23 — El build Docker falla en un clon limpio por `COPY uploads/`

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-710 (Improper Adherence to Coding Standards), CWE-1051 |
| **OWASP** | A05:2021 — Security Misconfiguration (reproducibilidad) |
| **Ubicación** | `BACKEND/Dockerfile:14`; `docker-compose.yml:42-43`; ausencia de `BACKEND/uploads` |
| **Requisitos** | NFR-DIS, NFR-COMPAT; ISO/IEC 25010 portabilidad |
| **Casos** | Ejecución EP3, CP-FUN-001 (precondición “sistema levantado”) |
| **Normativa** | ISO/IEC 29119 (reproducibilidad de pruebas) |

### Estado actual

```dockerfile
# BACKEND/Dockerfile:11-17
COPY src/ ./src/
COPY sql/ ./sql/
COPY uploads/ ./uploads/
RUN mkdir -p uploads/contracts
```

El repositorio no contiene `BACKEND/uploads`: `git ls-files` no lo lista, `Get-Item` no lo encuentra y `.gitignore` no lo excluye (solo ignora `node_modules`). En un clon limpio, el contexto de build no tiene esa ruta y Docker falla con un error de `COPY` antes de llegar al `RUN mkdir`.

Docker Compose monta `./BACKEND/uploads:/app/uploads` (`docker-compose.yml:42-43`), pero el volumen se resuelve en tiempo de ejecución; no corrige el `COPY` de la imagen.

### Reproducción

```bash
git clone <repo> cuidarte-clean
cd cuidarte-clean
docker compose build
```

Resultado esperado: fallo en el paso `COPY uploads/ ./uploads/` (“failed to compute cache key: ... not found” o “no source files were specified”).

### Impacto

- No se puede levantar el sistema desde un clon limpio.
- El plan de pruebas no es reproducible.
- Un evaluador o un pipeline de CI no puede construir la imagen.
- Bloquea la verificación de los demás hallazgos en un entorno estándar.

### Causa raíz

Se asumió que el directorio existía en el host; no se versionó un marcador (`.gitkeep`) ni se eliminó el `COPY` innecesario (la aplicación ya hace `fs.mkdirSync` en `app.js:25-26`).

### Recomendación

- Eliminar `COPY uploads/ ./uploads/` y dejar que `app.js` cree el directorio.
- O añadir `BACKEND/uploads/.gitkeep` y asegurar que el contexto lo incluya.
- Añadir `.dockerignore` coherente y un test de build en CI.
- Documentar el volumen y los permisos.
- Verificar `docker compose up` desde un clon limpio.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `docker compose build` en clon limpio | Éxito |
| `docker compose up` | Backend healthy |
| `GET /` | 200 `{status:"ok"}` |
| CI build | Pasa en cada PR |

---

## <a id="hal-24"></a>HAL-24 — `init-db.sh` usa `ON_ERROR_STOP=0`; una inicialización parcial se reporta como exitosa

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por revisión estática (EST) |
| **CWE** | CWE-754 (Improper Check for Unusual Conditions), CWE-391 (Unchecked Error Condition) |
| **OWASP** | A04:2021 — Insecure Design |
| **Ubicación** | `BACKEND/sql/init-db.sh:28,30-37` |
| **Requisitos** | NFR-DIS; ISO/IEC 25010 fiabilidad |
| **Casos** | Precondición de toda la ejecución EP3 |
| **Normativa** | ISO/IEC 29119; ISO/IEC 27001 A.8.32 |

### Estado actual

```bash
# BACKEND/sql/init-db.sh:27-37
echo "Cargando dump procesado en la base de datos $POSTGRES_DB..."
psql -v ON_ERROR_STOP=0 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < "$PROCESSED_DUMP"

echo "Verificando tablas creadas..."
TABLE_COUNT=$(psql -t -A --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "Tablas creadas: $TABLE_COUNT"
echo "Base de datos inicializada correctamente."
```

`ON_ERROR_STOP=0` hace que `psql` continúe después de errores SQL y retorne 0. El script no compara `TABLE_COUNT` con un valor esperado ni verifica constraints, índices o seeds. `set -e` no ayuda porque `psql` no falla. Además, el pipeline de `grep`/`sed` no usa `pipefail`.

### Reproducción

1. Introducir un error en el dump (por ejemplo, un `INSERT` duplicado o una tabla faltante).
2. Ejecutar `docker compose up` con un volumen limpio.
3. Observar errores en los logs, pero el script termina con “Base de datos inicializada correctamente”.
4. Verificar que faltan tablas/filas y que el backend falla en tiempo de ejecución.

### Impacto

- Entornos de prueba incompletos que parecen sanos.
- Resultados de pruebas no confiables.
- Pérdida de datos o migraciones a medias.
- Difícil diagnóstico.

### Causa raíz

Se priorizó que el contenedor arrancara aunque el dump tuviera errores; no hay verificación de integridad.

### Recomendación

- `psql -v ON_ERROR_STOP=1`.
- `set -euo pipefail`.
- Verificar tablas, constraints, índices y conteos de seeds esperados.
- Fallar el healthcheck si la verificación no pasa.
- Usar migraciones versionadas e idempotentes.
- Registrar la versión del esquema.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| Dump válido | Inicialización completa y healthcheck OK |
| Dump con error | Script falla, contenedor no healthy |
| Tabla faltante | Verificación falla |
| Reejecución | Idempotente o error controlado |

---

## <a id="hal-25"></a>HAL-25 — Dependencias vulnerables y runtime Node EOL

| Campo | Valor |
|---|---|
| **Severidad** | **Mayor** |
| **Estado** | Abierto — confirmado por análisis de dependencias (DEP) |
| **CWE** | CWE-1104 (Use of Unmaintained Third Party Components), CWE-937 |
| **OWASP** | A06:2021 — Vulnerable and Outdated Components |
| **Ubicación** | `BACKEND/package.json`, `FRONTEND/package.json`, `BACKEND/Dockerfile:1`, `FRONTEND/Dockerfile:2`, lockfiles |
| **Requisitos** | NFR-SEG; ISO/IEC 25010 seguridad |
| **Casos** | CP-SEG-001, CP-SEG-007; se propone CP-NUEVO-09 |
| **Normativa** | ISO/IEC 27001 A.8.8; OWASP ASVS V14.2 |

### Estado actual

`npm audit` reportó:

| Proyecto | Críticas | Altas | Moderadas | Bajas | Total |
|---|---:|---:|---:|---:|---:|
| Backend | 1 | 9 | 3 | 0 | **13** |
| Frontend | 0 | 22 | 6 | 1 | **29** |

Backend: `express` (rango afectado), `jws`, `path-to-regexp`, `body-parser`, `qs`, `morgan`, `braces`, `picomatch`, `minimatch`, `chokidar`, `nodemon`; el aviso crítico corresponde a `proxy-addr` en el rango reportado.

Frontend: `axios`, `react-router`, `react-router-dom`, `vite`, `rollup`, `lodash`, `form-data`, `postcss`, `tailwindcss`, `braces`, `micromatch`, `nanoid`, entre otros.

Runtimes:

- `BACKEND/Dockerfile:1`: `FROM node:18-alpine`. Node 18 alcanzó su fin de vida en abril de 2025.
- `FRONTEND/Dockerfile:2`: `FROM node:20`. Node 20 alcanzó su fin de vida en abril de 2026; a la fecha de corte (octubre de 2026) no recibe parches de seguridad.

### Reproducción

```bash
cd BACKEND
npm audit --json > audit-backend.json

cd ../FRONTEND
npm audit --json > audit-frontend.json
```

Revisar `metadata.vulnerabilities` y `vulnerabilities`. La evidencia cruda está en el documento 10.

### Impacto

- Vulnerabilidades conocidas de RCE, DoS, prototype pollution o path traversal en dependencias.
- Runtime sin parches: cualquier CVE futuro de Node queda sin corregir.
- Mayor superficie de cadena de suministro.
- Incumplimiento de controles de gestión de vulnerabilidades.

### Causa raíz

Lockfiles antiguos, ausencia de actualización automatizada y de SCA en CI; imagen base fijada a una versión EOL.

### Recomendación

- Actualizar a Node 22/24 LTS y a las versiones parcheadas de dependencias.
- Ejecutar `npm audit fix` y revisar cambios incompatibles.
- Añadir Dependabot/Renovate y SCA en CI (por ejemplo, `npm audit --audit-level=high`).
- Generar SBOM y firmar imágenes.
- Usar imágenes base mínimas y actualizadas.
- Revisar avisos no explotables y documentar excepciones con fecha de revisión.

### Criterio de aceptación / retest

| Prueba | Resultado esperado |
|---|---|
| `npm audit --audit-level=high` | 0 altas/críticas |
| Imagen base | Node LTS soportado |
| CI | Falla si aparece una vulnerabilidad alta |
| SBOM | Generado y versionado |

---

## Resumen de la sección

| ID | Hallazgo | CWE | Requisito | Caso |
|---|---|---|---|---|
| HAL-09 | Sesión no revocable | CWE-613 | NFR-SEG-9 | CP-SEG-007 |
| HAL-10 | CORS abierto | CWE-942 | NFR-SEG-5 | CP-SEG-003 |
| HAL-11 | Sin TLS/headers | CWE-319 | NFR-SEG-1/3 | CP-NUEVO-05 |
| HAL-12 | Contraseñas débiles | CWE-521 | RF-2.1 | CP-FUN-003/004 |
| HAL-13 | RUT sin DV | CWE-20 | RF-2.2 | CP-FUN-007 |
| HAL-14 | Mass assignment | CWE-915 | RB-1 | CP-FUN-007 |
| HAL-15 | Sin transacciones | CWE-662 | RF-1/2/3/5 | CP-FUN-002/015 |
| HAL-16 | Auditoría forjable | CWE-778 | RF-5.1 | CP-FUN-016 |
| HAL-17 | BIGINT vs nombre | CWE-704 | RF-5.1 | CP-FUN-016 |
| HAL-18 | MIME only | CWE-434 | RF-4.3/4.4 | CP-FUN-012/013 |
| HAL-19 | Sin rate limit | CWE-307 | NFR-SEG-9 | CP-SEG-010 |
| HAL-20 | BIGINT vs número | CWE-704 | RF-4.1/4.2 | CP-NUEVO-07 |
| HAL-21 | Esquema/validate | CWE-20 | RB-2 | CP-FUN-015 |
| HAL-22 | Documento inconsistente | CWE-20 | RF-3.1/4.4 | CP-NUEVO-08 |
| HAL-23 | Build Docker | CWE-710 | NFR-DIS | CP-FUN-001 |
| HAL-24 | init-db parcial | CWE-754 | NFR-DIS | Precondición |
| HAL-25 | Dependencias EOL | CWE-1104 | NFR-SEG | CP-NUEVO-09 |

*Continuar con [05 — Hallazgos medios y menores](05-hallazgos-medios-menores.md).*
