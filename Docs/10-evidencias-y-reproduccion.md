# 10 — Evidencias y reproducción

> **Objetivo.** Dejar constancia de cómo se obtuvo cada afirmación del informe, qué se ejecutó realmente, qué se verificó solo por lectura de código y cómo convertir una observación estática en una prueba reproducible en un entorno aislado.

**Fecha de corte:** 21 de octubre de 2026  
**Commit revisado:** `e021d8f5a86c36072efa92852753070e73a3483e` (`main`, 2026-10-07)  
**Naturaleza de esta evaluación:** revisión estática, análisis de dependencias y contraste documental. **No se levantó la aplicación ni se ejecutaron pruebas dinámicas nuevas.**

---

## 1. Línea base verificable

| Elemento | Valor observado | Cómo se verificó |
|---|---|---|
| Repositorio | `cuidarte-mas` | `git rev-parse --show-toplevel` |
| Rama | `main` | `git branch --show-current` |
| Commit | `e021d8f5a86c36072efa92852753070e73a3483e` | `git rev-parse HEAD` |
| Fecha del commit | 2026-10-07 16:51:52 -0300 | `git log -1 --date=iso` |
| Archivos versionados | 91 | `git ls-files \| Measure-Object -Line` |
| Cambios locales | Solo `Docs/` sin seguimiento | `git status --short` |
| Node usado para sintaxis | v25.2.1 | `node -v` |
| Sistema de revisión | Windows 11, PowerShell 7 | Entorno de trabajo |

El árbol de trabajo no contiene modificaciones de la aplicación. Todos los cambios de esta evaluación están contenidos en `Docs/`. Esto es relevante para la cadena de evidencia: las rutas y líneas citadas corresponden exactamente al commit indicado, no a una versión posterior.

> **Nota sobre Node.** La versión 25.2.1 se usó únicamente como analizador de sintaxis (`node --check`). La aplicación declara y usa `node:18-alpine` en `BACKEND/Dockerfile:1`; no se afirma que se haya ejecutado en Node 25.

---

## 2. Comprobaciones estáticas ejecutadas

### 2.1 Comandos y salidas

| # | Comprobación | Comando | Resultado observado |
|---|---|---|---|
| S1 | Identidad del repositorio | `git rev-parse HEAD; git status --short` | Commit `e021d8f`; solo `?? Docs/` |
| S2 | Sintaxis de todo el backend | `Get-ChildItem -Recurse -File BACKEND\src -Include *.js \| ForEach-Object { node --check $_.FullName }` | **18 archivos, 0 errores** |
| S3 | Dependencias backend | `npm audit --json --prefix BACKEND` | **13**: 1 crítica, 9 altas, 3 moderadas, 0 bajas |
| S4 | Dependencias frontend | `npm audit --json --prefix FRONTEND` | **29**: 0 críticas, 22 altas, 6 moderadas, 1 baja |
| S5 | Secretos versionados | `git ls-files \| Select-String -Pattern '(^\|/)\.env$'` | `.env`, `BACKEND/.env`, `FRONTEND/.env` |
| S6 | Fallback de secreto JWT | `git grep -n "process.env.JWT_SECRET \|\|"` | 7 archivos de rutas con `"inseguro"` |
| S7 | Contraseña de base en código | `git grep -n "alone15"` | `BACKEND/.env:2`; `BACKEND/src/db.js:6` |
| S8 | Directorio de uploads | `Test-Path BACKEND\uploads` | **False** (no existe en el clon) |
| S9 | COPY de Docker | Lectura de `BACKEND/Dockerfile:14` | `COPY uploads/ ./uploads/` sobre un directorio inexistente |
| S10 | Rutas Express | `Select-String -Path BACKEND\src\routes\*.js -Pattern 'router\.(get\|post\|put\|delete)'` | **32 rutas** en 8 archivos |
| S11 | Endpoints auxiliares | Lectura de `BACKEND/src/app.js:37-47` | 4: Swagger, OpenAPI, estáticos y health |
| S12 | Inventario de código | `git ls-files` | 18 JS backend, 38 JS/JSX frontend, 2 SQL, 1 shell |

### 2.2 Resultado del análisis de dependencias

**Backend — 13 avisos**

| Severidad | Cantidad | Ejemplos representativos |
|---|---:|---|
| Crítica | 1 | `proxy-addr` (suplantación de IP en subredes de confianza) |
| Alta | 9 | `express` (cadena `path-to-regexp`, `qs`, `body-parser`), `jsonwebtoken`/`jws`, `nodemon`/`chokidar` |
| Moderada | 3 | `qs`, `body-parser`, `morgan` (inyección de logs) |
| Baja | 0 | — |

**Frontend — 29 avisos**

| Severidad | Cantidad | Ejemplos representativos |
|---|---:|---|
| Crítica | 0 | — |
| Alta | 22 | `axios`, `react-router-dom`, `vite`, `postcss`, `tailwindcss`, `lodash`, `js-yaml` |
| Moderada | 6 | Cadena de herramientas de build |
| Baja | 1 | Dependencia transitiva de desarrollo |

Los conteos corresponden a la salida de `npm audit` en la fecha de corte. Un aviso de dependencia **no prueba explotabilidad** en el flujo de Cuidarte+; se registra como riesgo de cadena de suministro y se somete a revisión en CP-NUEVO-09. La interpretación completa está en [HAL-25](04-hallazgos-mayores.md#hal-25).

### 2.3 Búsquedas estáticas dirigidas

Estas búsquedas permitieron localizar patrones concretos sin ejecutar la aplicación:

```powershell
# Rutas sin middleware de autenticación
Select-String -Path BACKEND\src\routes\*.js -Pattern 'router\.(get|post|put|delete)\('

# Comparaciones de contraseña en claro
Select-String -Path BACKEND\src\routes\*.js -Pattern 'contrasena !==|contrasena ='

# Mensajes internos expuestos al cliente
Select-String -Path BACKEND\src\routes\*.js -Pattern 'err\.message'

# Comparaciones de identificadores
Select-String -Path BACKEND\src\routes\documentos.js -Pattern 'usuario_id !=='

# Secretos y valores por defecto
git grep -n "JWT_SECRET\|alone15\|POSTGRES_PASSWORD"
```

Los resultados se citan en cada hallazgo con `archivo:línea`. No se usaron expresiones regulares para inferir comportamiento: cada coincidencia se contrastó leyendo el bloque completo de la ruta.

---

## 3. Matriz de evidencia por hallazgo

**Niveles:** `E1` = lectura de código/configuración; `E2` = ejecución previa documentada en la Actividad 2.3.2; `E3` = análisis de dependencias. `E1+E2` indica que la lectura se refuerza con un resultado previo, no que esta evaluación haya vuelto a ejecutar la prueba.

| ID | Evidencia principal (`archivo:línea`) | Comprobación | Nivel |
|---|---|---|---|
| [HAL-01](03-hallazgos-criticos.md#hal-01) | `pacientes.js:249-273` | La ruta `GET /pacientes/buscar/rut/:rut` no invoca autenticación ni autorización y devuelve `p.*` | E1 |
| [HAL-02](03-hallazgos-criticos.md#hal-02) | `auth.js:13-23,109-112`; `users.js:35-38,500-502`; `dump-cuidarteplus.sql:288-290` | Contraseñas comparadas e insertadas en texto plano; seeds legibles | E1+E2 |
| [HAL-03](03-hallazgos-criticos.md#hal-03) | `.env:1`; `BACKEND/.env:2-3`; `README.md:30,46`; `docker-compose.yml:7,10-11,33,35`; `db.js:4-6` | Secretos versionados, valores por defecto y PostgreSQL publicado | E1+E2 |
| [HAL-04](03-hallazgos-criticos.md#hal-04) | `users.js:23-72`; `validations/users.js:18-22` | `POST /usuarios` solo exige un token válido; acepta `rol_id` arbitrario | E1 |
| [HAL-05](03-hallazgos-criticos.md#hal-05) | `users.js:437-532`; `validations/users.js:25-46`; `validate.js:5` | Un médico satisface `isAdminOrMedico` y puede reasignar roles | E1 |
| [HAL-06](03-hallazgos-criticos.md#hal-06) | `users.js:571-597`; `init.sql:88-93` | El `DELETE` se ejecuta antes de leer el token; la auditoría inserta texto en `BIGINT` | E1 |
| [HAL-07](03-hallazgos-criticos.md#hal-07) | `roles.js:18-92`; `users.js:113,453-455`; `pacientes.js:37` | CRUD de roles público; la autorización depende del nombre mutable | E1+E2 |
| [HAL-08](03-hallazgos-criticos.md#hal-08) | `auth.js:71-142` (77-94, 127-141) | El registro vincula una ficha existente por RUT sin verificar identidad | E1 |
| [HAL-09](04-hallazgos-mayores.md#hal-09) | `auth.js:44-55`; `AuthContext.jsx:7-9,41,59,65-71` | JWT de 2 h sin `jti` ni revocación; logout solo borra `localStorage` | E1 |
| [HAL-10](04-hallazgos-mayores.md#hal-10) | `app.js:21` | `app.use(cors())` sin lista de orígenes | E1 |
| [HAL-11](04-hallazgos-mayores.md#hal-11) | `app.js:19-23,50`; `nginx.conf:1-24`; `docker-compose.yml:37-38,56-57` | Sin TLS, sin `helmet` y sin cabeceras de seguridad | E1 |
| [HAL-12](04-hallazgos-mayores.md#hal-12) | `validations/auth.js:21-24`; `validations/users.js:9-12`; frontend equivalente | Política mínima de 6 caracteres, sin complejidad ni bloqueo | E1+E2 |
| [HAL-13](04-hallazgos-mayores.md#hal-13) | `utils/rut.js:5-8`; `validations/auth.js:30-33`; `validations/pacientes.js:5-8` | Solo se valida el formato; no se calcula el dígito verificador | E1 |
| [HAL-14](04-hallazgos-mayores.md#hal-14) | `pacientes.js:81,116,334-342`; `validate.js:5` | `usuario_id` se acepta en creación y actualización de pacientes | E1 |
| [HAL-15](04-hallazgos-mayores.md#hal-15) | `auth.js:109-147`; `users.js:35-62,524-531`; `roles.js:21-27`; `documentos.js:93-108` | Varias escrituras secuenciales sin transacción | E1 |
| [HAL-16](04-hallazgos-mayores.md#hal-16) | `audit.js:19-44`; `auth.js:10-69` | `POST /auditoria` acepta texto libre; no se auditan fallos de login | E1 |
| [HAL-17](04-hallazgos-mayores.md#hal-17) | `users.js:580-587`; `roles.js:23-27,63-67,81-85` | Se inserta `nombreUsuario` (texto) en `auditoria.usuario_id BIGINT` | E1 |
| [HAL-18](04-hallazgos-mayores.md#hal-18) | `documentos.js:10-28,66-98` | `fileFilter` confía en `file.mimetype`, declarado por el cliente | E1+E2 |
| [HAL-19](04-hallazgos-mayores.md#hal-19) | `auth.js:10-69`; ausencia de rate limit en `package.json` | No hay límite de intentos, bloqueo ni CAPTCHA | E1+E2 |
| [HAL-20](04-hallazgos-mayores.md#hal-20) | `documentos.js:143-152,221-223` | `usuario_id` de PostgreSQL es string y `authUser.usuarioId` es número; `!==` siempre falla | E1 |
| [HAL-21](04-hallazgos-mayores.md#hal-21) | `validations/users.js:25-46`; `validate.js:5` | `updateUserSchema` omite `rol_id`; `validate` no reasigna el objeto validado | E1 |
| [HAL-22](04-hallazgos-mayores.md#hal-22) | `documentos.js:77-98` | No se comprueba que `examen_medico_id` pertenezca a `paciente_id` | E1 |
| [HAL-23](04-hallazgos-mayores.md#hal-23) | `BACKEND/Dockerfile:14`; `docker-compose.yml:42-43` | `COPY uploads/` falla si el directorio no existe; no está versionado | E1 |
| [HAL-24](04-hallazgos-mayores.md#hal-24) | `init-db.sh:28` | `psql -v ON_ERROR_STOP=0` continúa y reporta éxito tras errores | E1 |
| [HAL-25](04-hallazgos-mayores.md#hal-25) | `package.json`; lockfiles; `Dockerfile:1-2` | 13 avisos backend y 29 frontend; Node 18/20 EOL | E3 |
| [HAL-26](05-hallazgos-medios-menores.md#hal-26) | `documentos.js:10-28,66,111-117`; `ExamenDetalle.jsx:79-114,376` | Errores de multer fuera del `try/catch`; UI sin `maxSize` | E1+E2 |
| [HAL-27](05-hallazgos-medios-menores.md#hal-27) | `init.sql:7,28-51,82`; `db.js:8`; `docker-compose.yml:13,33` | Datos y documentos en claro; conexión sin TLS | E1 |
| [HAL-28](05-hallazgos-medios-menores.md#hal-28) | `init.sql:88-93`; `audit.js:19-110` | Sin trigger, permisos restrictivos, retención ni partición | E1 |
| [HAL-29](05-hallazgos-medios-menores.md#hal-29) | `delay.js:5-11`; `documentos.js:66`; `examenes.js:46,99,330`; `pacientes.js:145` | Retardo fijo de 5 000 ms en rutas críticas | E1 |
| [HAL-30](05-hallazgos-medios-menores.md#hal-30) | `app.js:37-41`; `openapi.json` | Swagger UI y especificación accesibles sin token | E1 |
| [HAL-31](05-hallazgos-medios-menores.md#hal-31) | 40+ ocurrencias de `err.message` en rutas | Los 500 devuelven detalles de PostgreSQL y del servidor | E1 |
| [HAL-32](05-hallazgos-medios-menores.md#hal-32) | `pacientes.js:155-160`; `examenes.js:128-168`; `users.js:124-128`; `audit.js:92-97` | `SELECT *` sin `LIMIT`, paginación ni minimización | E1 |
| [HAL-33](05-hallazgos-medios-menores.md#hal-33) | `users.js:571-597`; `UsuariosTabList.jsx:139-159` | Sin protección del último administrador ni de la autoeliminación | E1 |
| [HAL-34](05-hallazgos-medios-menores.md#hal-34) | `users.js:124-128`; `UsuariosTabList.jsx:80-88` | `GET /usuarios` no selecciona el rol; la tabla muestra “N/A” | E1 |
| [HAL-35](05-hallazgos-medios-menores.md#hal-35) | `RoleGuard.jsx:11-15`; `users.js:113` | `users.js` acepta `"administrador"`; el guard solo acepta `"admin"` | E1 |
| [HAL-36](05-hallazgos-medios-menores.md#hal-36) | `PacientesTabList.jsx:106-113`; `init.sql:32` | `DATE` serializada como instante UTC y formateada en zona local | E1 |
| [HAL-37](05-hallazgos-medios-menores.md#hal-37) | `PacientesTabList.jsx:141-143,251-257` | Se pasa `row.original.nombre`, campo inexistente; el diálogo muestra `undefined` | E1 |
| [HAL-38](05-hallazgos-medios-menores.md#hal-38) | `api.jsx:46-82`; `AuthContext.jsx:7-13,65-71` | El interceptor no trata 401: no limpia sesión ni redirige | E1 |

**Cobertura de evidencia:** 38/38 hallazgos con al menos una ubicación verificable; 7 con refuerzo de ejecución previa (HAL-02, HAL-03, HAL-07, HAL-12, HAL-18, HAL-19, HAL-26); 1 con evidencia de dependencias (HAL-25). Ningún hallazgo se basa solo en una impresión subjetiva.

---

## 4. Recetas de reproducción

### 4.1 Salvaguardas obligatorias

Estas recetas modifican datos y privilegios. Antes de ejecutarlas:

1. Usar una máquina virtual o un equipo aislado, sin acceso a redes de producción.
2. Cargar solo datos sintéticos; nunca fichas de pacientes reales.
3. Rotar los secretos del repositorio antes de exponer cualquier instancia.
4. Guardar una instantánea de la base y del volumen `postgres_data`.
5. Ejecutar en un rango horario autorizado y con supervisión.
6. Destruir el entorno al finalizar (`docker compose down -v`) y rotar credenciales.

### 4.2 Preparación del entorno

```powershell
# 1. Crear el directorio que falta para que el build no falle (workaround HAL-23)
New-Item -ItemType Directory -Force BACKEND\uploads | Out-Null

# 2. Levantar el stack
docker compose up -d --build

# 3. Verificar salud
docker compose ps

# 4. Variables de trabajo
$API = "http://localhost:4444"
```

Si se ejecuta el backend fuera de Docker, la API queda en `http://localhost:4000` y el `DATABASE_URL` versionado apunta a `localhost:5432`; si se quiere usar el puerto publicado por Compose (`15442`), hay que ajustar esa variable. Las recetas usan el puerto publicado `4444`, que es el que consume el frontend.

### 4.3 HAL-01 — Ficha clínica sin autenticación

```powershell
# Reemplazar por un RUT sintético existente en la base de prueba
$RUT = "12.345.678-5"
curl.exe -i "$API/pacientes/buscar/rut/$RUT"
```

**Resultado esperado (defecto):** `HTTP/1.1 200 OK` con un JSON que incluye nombre, RUT, fecha de nacimiento, dirección, teléfono, alergias, enfermedades crónicas y `usuario_id`.  
**Resultado correcto:** `401` sin token, o `403` si el solicitante no tiene relación clínica con el paciente.  
**Cuidado:** no usar un RUT real. El 404 confirma si un RUT existe, lo que también es un problema de enumeración.

### 4.4 HAL-02 — Contraseñas en texto plano

```powershell
docker exec -it cuidarteplus-postgres-ev psql -U postgres -d cuidarteplus `
  -c "SELECT nombre_usuario, contrasena FROM usuarios ORDER BY id;"
```

**Resultado observado en la ejecución previa:** las contraseñas de `admin`, `medico` y `paciente` se leen directamente.  
**Resultado correcto:** la columna debe contener un hash `argon2id` o `bcrypt` con salt, y la comparación debe usar una función de verificación.

### 4.5 HAL-03 — Forja de token con el secreto versionado

```powershell
$env:JWT_SECRET = (Get-Content .env | Select-String '^JWT_SECRET=').ToString().Split('=')[1]

$TOKEN = node -e "const jwt=require('./BACKEND/node_modules/jsonwebtoken'); console.log(jwt.sign({usuarioId:1,nombreUsuario:'admin',rolId:1,rolNombre:'admin'}, process.env.JWT_SECRET, {expiresIn:'2h'}))"

curl.exe -i "$API/usuarios" -H "Authorization: Bearer $TOKEN"
```

**Resultado esperado (defecto):** `200 OK` con la lista completa de usuarios, sin haber iniciado sesión.  
**Resultado correcto:** el secreto no debe estar en el repositorio; un token firmado con el valor antiguo debe ser rechazado tras la rotación.

```powershell
# Acceso directo a PostgreSQL publicado
psql "postgres://postgres:postgres@localhost:15442/cuidarteplus" -c "\dt"
```

### 4.6 HAL-04 — Un paciente crea un administrador

```powershell
$PAC = (curl.exe -s -X POST "$API/autenticacion/login" `
  -H "Content-Type: application/json" `
  -d '{"nombre_usuario":"paciente","password":"paciente"}' | ConvertFrom-Json).token

curl.exe -i -X POST "$API/usuarios" `
  -H "Authorization: Bearer $PAC" `
  -H "Content-Type: application/json" `
  -d '{"nombre_usuario":"admin_falso","contrasena_hash":"admin_falso","correo":"admin_falso@example.test","rol_id":1}'
```

**Resultado esperado (defecto):** `201 Created`. Luego, `admin_falso` puede iniciar sesión y acceder a `GET /usuarios` y `GET /auditoria`.  
**Resultado correcto:** `403` para un paciente; solo un administrador puede crear usuarios y asignar roles.

### 4.7 HAL-05 — Autoascenso de médico a administrador

```powershell
$MED = (curl.exe -s -X POST "$API/autenticacion/login" `
  -H "Content-Type: application/json" `
  -d '{"nombre_usuario":"medico","password":"medico"}' | ConvertFrom-Json).token

# Usar el id del médico autenticado; en los seeds suele ser 2
curl.exe -i -X PUT "$API/usuarios/2" `
  -H "Authorization: Bearer $MED" `
  -H "Content-Type: application/json" `
  -d '{"nombre_usuario":"medico","rol_id":1}'
```

**Resultado esperado (defecto):** `200 OK`; el médico queda con rol `admin`.  
**Resultado correcto:** `403`; un médico no puede modificar roles ni su propio rol.

### 4.8 HAL-06 — Eliminación de usuario sin token

```powershell
# Crear un usuario descartable y anotar su id
$ADMIN = (curl.exe -s -X POST "$API/autenticacion/login" `
  -H "Content-Type: application/json" `
  -d '{"nombre_usuario":"admin","password":"admin"}' | ConvertFrom-Json).token

curl.exe -s -X POST "$API/usuarios" `
  -H "Authorization: Bearer $ADMIN" `
  -H "Content-Type: application/json" `
  -d '{"nombre_usuario":"borrar_prueba","contrasena_hash":"borrar_prueba","correo":"borrar@example.test","rol_id":3}'

# Eliminar sin Authorization
curl.exe -i -X DELETE "$API/usuarios/<ID_DESCARTABLE>"
```

**Resultado esperado (defecto):** `200 OK` y el usuario desaparece.  
**Variante con token:** el borrado ocurre y luego la respuesta es `500` porque `nombreUsuario` se inserta en `auditoria.usuario_id BIGINT` (HAL-17).  
**Resultado correcto:** `401` sin token; `403` si el solicitante no es administrador; auditoría consistente y borrado lógico o reversible.

### 4.9 HAL-07 — Reasignar el nombre `admin` al rol `paciente`

```powershell
# 1. Liberar el nombre "admin" (el rol 1 deja de llamarse así)
curl.exe -i -X PUT "$API/roles/1" `
  -H "Content-Type: application/json" `
  -d '{"nombre":"admin_renombrado"}'

# 2. Ahora sí, renombrar "paciente" a "admin"
curl.exe -i -X PUT "$API/roles/3" `
  -H "Content-Type: application/json" `
  -d '{"nombre":"admin"}'

# 3. Cualquier paciente pasa a ser administrador por nombre
$PAC = (curl.exe -s -X POST "$API/autenticacion/login" `
  -H "Content-Type: application/json" `
  -d '{"nombre_usuario":"paciente","password":"paciente"}' | ConvertFrom-Json).token

curl.exe -i "$API/usuarios" -H "Authorization: Bearer $PAC"
```

**Resultado esperado (defecto):** `200` en ambos renombrados y `200` al listar usuarios con el token de paciente.  
**Variante de una petición:** `PUT /roles/3` con `{"nombre":"administrador"}` también funciona; `users.js:113,453-455` acepta ese alias como admin y permite listar usuarios y cambiar el `rol_id` propio.  
**Intento directo:** `PUT /roles/3` con `{"nombre":"admin"}` devuelve `500` por la restricción `UNIQUE` sobre `roles.nombre`; no es una mitigación, solo obliga a liberar el nombre primero.  
**Resultado correcto:** `401/403` en todo el CRUD de roles; los roles no deben ser mutables por nombre y la autorización debe usar identificadores estables.

> **Restauración:** ejecutar `PUT /roles/3` con `{"nombre":"paciente"}` y después `PUT /roles/1` con `{"nombre":"admin"}` (en ese orden, para no chocar con `UNIQUE`). Si se borró el rol `admin`, reconstruir la base desde cero; `DELETE /roles/1` elimina en cascada las asignaciones.

### 4.10 HAL-08 — Toma de control de una ficha por RUT

```powershell
# 1. Crear un paciente sintético sin usuario asociado (requiere médico o admin)
curl.exe -s -X POST "$API/pacientes" `
  -H "Authorization: Bearer $MED" `
  -H "Content-Type: application/json" `
  -d '{"rut":"11.111.111-1","primer_nombre":"Paciente","apellido_paterno":"Sintetico","fecha_nacimiento":"1990-01-01","sexo":"M","email":"sintetico@example.test"}'

# 2. Registrarse con ese RUT, sin verificación de identidad
curl.exe -i -X POST "$API/autenticacion/registro" `
  -H "Content-Type: application/json" `
  -d '{"nombre_usuario":"atacante","password":"atacante1","correo":"atacante@example.test","rut":"11.111.111-1"}'

# 3. Iniciar sesión y leer la ficha vinculada
$ATK = (curl.exe -s -X POST "$API/autenticacion/login" `
  -H "Content-Type: application/json" `
  -d '{"nombre_usuario":"atacante","password":"atacante1"}' | ConvertFrom-Json).token

curl.exe -i "$API/pacientes/<ID_PACIENTE_SINTETICO>" -H "Authorization: Bearer $ATK"
```

**Resultado esperado (defecto):** `201` en el registro y `200` al leer una ficha que el atacante no acreditó.  
**Resultado correcto:** el registro no debe vincular una ficha existente sin verificación (OTP presencial, documento, consentimiento) ni permitir que el titular quede bloqueado.

### 4.11 HAL-16 — Forjar un registro de auditoría

```powershell
$PAC = (curl.exe -s -X POST "$API/autenticacion/login" `
  -H "Content-Type: application/json" `
  -d '{"nombre_usuario":"paciente","password":"paciente"}' | ConvertFrom-Json).token

curl.exe -i -X POST "$API/auditoria" `
  -H "Authorization: Bearer $PAC" `
  -H "Content-Type: application/json" `
  -d '{"accion":"USUARIOS_ELIMINAR","detalles":"eliminó usuario ID 1"}'
```

**Resultado esperado (defecto):** `201`; el registro aparece como si fuera una acción administrativa.  
**Resultado correcto:** la auditoría debe ser generada por el servidor, sin texto libre del cliente, con actor, recurso, resultado, IP, user-agent y correlación.

### 4.12 HAL-20 — El paciente recibe 403 en sus propios documentos

```powershell
$PAC = (curl.exe -s -X POST "$API/autenticacion/login" `
  -H "Content-Type: application/json" `
  -d '{"nombre_usuario":"paciente","password":"paciente"}' | ConvertFrom-Json).token

# Usar un documento que pertenezca al paciente autenticado
curl.exe -i "$API/documentos/<ID_DOCUMENTO_PROPIO>" -H "Authorization: Bearer $PAC"
```

**Resultado esperado (defecto):** `403` con “Solo puede ver sus propios documentos”, aunque el documento sea propio.  
**Causa:** `documento.usuario_id` (string de `pg`) se compara con `authUser.usuarioId` (número del JWT) usando `!==`.  
**Resultado correcto:** `200` con el archivo; `403` solo para documentos ajenos.

### 4.13 HAL-26 — Carga de un archivo no permitido

```powershell
# Archivo de texto pequeño
"prueba" | Out-File -Encoding utf8 prueba.txt

curl.exe -i -X POST "$API/documentos" `
  -H "Authorization: Bearer $MED" `
  -F "documento=@prueba.txt;type=text/plain" `
  -F "examen_medico_id=1" `
  -F "paciente_id=1"
```

**Resultado esperado (defecto):** error de multer no capturado; el manejador por defecto de Express devuelve HTML/`500`, no un `400` JSON con mensaje específico.  
**Resultado correcto:** `400` con `{ error, glosa }`, sin traza interna; `413` para archivos sobre 10 MB.

### 4.14 HAL-29 — Latencia artificial

```powershell
curl.exe -s -o NUL -w "tiempo_total=%{time_total}s\n" `
  "$API/pacientes" -H "Authorization: Bearer $ADMIN"
```

**Resultado esperado (defecto):** alrededor de `5.0 s` por el `delayMiddleware(5000)` de `pacientes.js:145`.  
**Resultado correcto:** latencia de milisegundos, sin retardos artificiales; la latencia se mide con percentiles p50/p95/p99 y no con una sola muestra.

---

## 5. Evidencia de ejecución previa (Actividad 2.3.2)

La revisión no volvió a ejecutar la suite, pero contrastó sus resultados documentados. La métrica correcta es:

| Métrica | Valor |
|---|---:|
| Casos diseñados | **32** |
| Casos ejecutados | **31** (96,9 % de los diseñados) |
| Casos aprobados | **28** (87,5 % de los diseñados; **90,3 % de los ejecutados**) |
| Casos fallidos | **3** (CP-SEG-008, CP-SEG-009, CP-SEG-010) |
| Casos pendientes | **1** (CP-SEG-006) |
| Casos bloqueados | **0** |

> **Corrección de una imprecisión frecuente.** “28 de 31” corresponde a **aprobados sobre ejecutados**, no a “ejecutados sobre diseñados”. El total diseñado es 32 y el ejecutado es 31. Esta distinción se usa en todos los documentos de esta entrega.

| Caso | Qué verificaba | Resultado previo | Lectura para esta auditoría |
|---|---|---|---|
| CP-SEG-008 | Contraseñas y acceso a la base | **Falla** | Confirma HAL-02 y HAL-03: contraseñas legibles y base accesible. |
| CP-SEG-009 | Catálogos y roles sin autenticación | **Falla** | Confirma HAL-07; el impacto real es mayor que un catálogo público. |
| CP-SEG-010 | Bloqueo tras intentos fallidos | **Falla** | Confirma HAL-19: no hay rate limiting ni bloqueo. |
| CP-SEG-006 | Paciente accede a un examen ajeno | **Pendiente** | Brecha de cobertura; debe ejecutarse antes de certificar. |
| CP-FUN-013 | Carga de un `.txt` | **Observación** | El mensaje no fue específico; coherente con HAL-18 y HAL-26. |
| CP-SEG-003 | API sin token | **Aprueba parcialmente** | No recorrió todos los endpoints; HAL-01 quedó fuera. |
| CP-FUN-001 a 016 | Flujos funcionales | **16/16 aprueban** | La funcionalidad básica existe; no demuestra seguridad. |
| CP-USA-001 a 006 | Usabilidad | **6/6 aprueban** | No se probaron diálogos destructivos ni zonas horarias. |

**Dictamen previo:** NO CERTIFICADO. **Dictamen de esta revisión:** se confirma y se amplía; ver [01 — Resumen ejecutivo](01-resumen-ejecutivo.md).

---

## 6. Cadena de evidencia y control de calidad

| Control | Aplicación |
|---|---|
| Identificación de versión | Commit y fecha en cada documento |
| Reproducibilidad | Comandos y rutas exactas; sin dependencia de datos de producción |
| Separación E1/E2/E3 | Cada fila de la matriz declara su nivel |
| Verificación de líneas | Las líneas citadas se comprobaron contra el commit |
| Conteo de severidades | 8 críticas, 17 mayores, 4 medias, 9 menores = 38 |
| Contraste previo | 13/13 hallazgos previos revisados; 0 rechazados |
| Integridad documental | `git status --short` solo muestra `Docs/` |

No se adjuntan capturas de pantalla porque esta evaluación no generó ejecución nueva. La evidencia es texto, salida de comandos y código citado. Cuando se ejecute el retest, cada caso debe adjuntar: comando, salida, código HTTP, marca de tiempo, commit y, si aplica, captura o log.

---

## 7. Limitaciones

1. **No hubo ejecución dinámica nueva.** Los hallazgos E1 son afirmaciones sobre el código, no sobre una instancia en ejecución.
2. **No se construyó la imagen Docker.** HAL-23 se verificó por lectura y por la ausencia del directorio, no por un build fallido reproducido en esta sesión.
3. **No se ejecutaron ZAP, testssl.sh, k6 ni pruebas de carga.** Las afirmaciones de rendimiento y TLS son estáticas o se apoyan en la configuración.
4. **Los avisos de dependencias cambian con el tiempo.** Los conteos son válidos a la fecha de corte.
5. **El ERS completo no estaba disponible.** La trazabilidad usa los RF, NFR y RB citados en EP1 y en las actividades previas.
6. **No se auditaron controles organizacionales, de red, de proveedores ni de infraestructura.** El alcance es el repositorio y su configuración.
7. **Las recetas pueden variar según los IDs de los seeds.** Se indican como parámetros; no se asume un ID fijo salvo en ejemplos explícitos.

---

## 8. Uso responsable de esta evidencia

- **Divulgación responsable:** entregar primero al equipo responsable, con plazo razonable de corrección.
- **Minimización:** no incluir datos reales, capturas con PII ni secretos en informes públicos.
- **Autorización:** no ejecutar las recetas contra sistemas de terceros ni contra producción.
- **Rotación:** considerar comprometidos el `JWT_SECRET` y la contraseña de PostgreSQL; rotarlos antes de cualquier despliegue.
- **Trazabilidad:** conservar la salida original y la fecha; no editar la evidencia después de recolectada.

---

*Volver al [índice](README.md) · Ver [11 — Inventario de revisión](11-inventario-revision.md) · Continuar con [12 — Plan de pruebas EP3](12-plan-de-pruebas-ep3.md).*
