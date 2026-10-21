# 01 — Resumen ejecutivo

## 1. Contexto

Cuidarte+ es un sistema de gestión clínica que permite a médicos registrar pacientes y exámenes, a pacientes consultar su información y a administradores gestionar usuarios, roles y auditoría. Por la naturaleza de los datos que trata —diagnósticos, exámenes, documentos clínicos, RUT, dirección, teléfono y contacto de emergencia—, cualquier fallo de control de acceso tiene consecuencias directas sobre derechos fundamentales y sobre el cumplimiento de la Ley N.º 19.628, la Ley N.º 21.719, la Ley N.º 20.584 y la Ley N.º 21.663.

La Actividad 2.4.2 ya había emitido un dictamen **NO CERTIFICADO**, sustentado en un defecto crítico abierto (contraseñas en texto plano, BUG-001), un defecto mayor (ausencia de bloqueo por fuerza bruta, BUG-003) y un defecto menor (catálogos sin autenticación, BUG-002), además del caso CP-SEG-006 sin ejecutar. Esta revisión confirma ese dictamen y lo profundiza: no solo se mantienen los defectos previos, sino que se identifican **vías adicionales de escalamiento de privilegios y de exposición de datos clínicos** que no estaban cubiertas por los 13 hallazgos iniciales.

---

## 2. Resultado en una frase

**Cuidarte+ no es apto para certificación ni para despliegue con datos reales:** ocho defectos críticos permiten acceso no autorizado a fichas clínicas, creación o autoascenso a administrador, eliminación de usuarios sin autenticación, manipulación de roles y compromiso total de credenciales y base de datos.

---

## 3. Hallazgos críticos (8)

| ID | Hallazgo | Efecto inmediato | Evidencia |
|---|---|---|---|
| **HAL-01** | `GET /pacientes/buscar/rut/:rut` es público y devuelve la ficha clínica completa | Cualquier persona con un RUT obtiene nombre, fecha de nacimiento, dirección, teléfono, alergias, enfermedades crónicas y observaciones | EST |
| **HAL-02** | Contraseñas en texto plano y comparación directa | Quien lea la base de datos obtiene todas las credenciales; `admin/admin` funciona | EST + EJEC (CP-SEG-008) |
| **HAL-03** | Secretos JWT y de base de datos comprometidos; PostgreSQL publicado | Forja de tokens, conexión directa a la base y lectura/modificación de datos clínicos | EST + EJEC (CP-SEG-008) |
| **HAL-04** | `POST /usuarios` solo verifica que exista un token; acepta `rol_id: 1` | Cualquier paciente crea un administrador y toma el sistema | EST |
| **HAL-05** | `PUT /usuarios/:id` permite que un médico cambie su propio rol a administrador | Escalamiento vertical directo con una cuenta médica | EST |
| **HAL-06** | `DELETE /usuarios/:id` no exige autenticación | Cualquiera elimina cuentas, incluidos administradores; con token, la operación borra y luego responde 500 | EST |
| **HAL-07** | `POST/PUT/DELETE /roles` sin autenticación y autorización basada en nombres mutables | Liberar el nombre `admin` y reasignarlo a `paciente` (dos peticiones) convierte a todos los pacientes en administradores; el alias `administrador` habilita el autoascenso con una petición; borrar `admin` deja el sistema sin administración | EST |
| **HAL-08** | El registro vincula una ficha existente por RUT sin verificar identidad | Un atacante que conoce un RUT se apropia de la ficha clínica y de los exámenes de esa persona | EST |

---

## 4. Hallazgos mayores (17)

| ID | Hallazgo | Ámbito |
|---|---|---|
| HAL-09 | Sesión sin revocación, logout real, refresh ni invalidación por cambio de rol; JWT en `localStorage` | Autenticación |
| HAL-10 | CORS abierto a cualquier origen | Configuración |
| HAL-11 | Sin TLS ni cabeceras de seguridad (helmet, CSP, HSTS, anti-clickjacking) | Transporte |
| HAL-12 | Política de contraseñas de 6 caracteres, sin complejidad ni lista de contraseñas filtradas | Autenticación |
| HAL-13 | Validación de RUT solo por expresión regular; no se valida el dígito verificador | Validación |
| HAL-14 | `usuario_id` aceptado como campo modificable en pacientes (*mass assignment*) | Autorización |
| HAL-15 | Operaciones multi-paso sin transacciones; estados parciales | Integridad |
| HAL-16 | `POST /auditoria` permite forjar registros; no se auditan logins fallidos; faltan IP, user-agent y resultado | Auditoría |
| HAL-17 | Inserción de `nombreUsuario` (texto) en `auditoria.usuario_id BIGINT`; 500 después de operaciones destructivas | Auditoría |
| HAL-18 | Carga de archivos validada solo por el MIME declarado por el cliente | Carga de archivos |
| HAL-19 | Sin rate limiting, bloqueo progresivo ni CAPTCHA; fuerza bruta viable | Autenticación |
| HAL-20 | Comparación `BIGINT` (string) vs. número del JWT: el paciente recibe 403 en sus propios documentos | Control de acceso |
| HAL-21 | `updateUserSchema` omite `rol_id` y `validate` no reasigna el objeto validado; el rol igual llega al handler | Validación |
| HAL-22 | No se verifica que el examen y el paciente del documento correspondan entre sí | Integridad clínica |
| HAL-23 | El build Docker falla en un clon limpio por `COPY uploads/` cuando el directorio no existe | Despliegue |
| HAL-24 | `init-db.sh` usa `ON_ERROR_STOP=0`; una inicialización parcial se reporta como exitosa | Base de datos |
| HAL-25 | Dependencias vulnerables (13 backend / 29 frontend) y runtime Node EOL | Cadena de suministro |

---

## 5. Hallazgos medios y menores (13)

| ID | Severidad | Hallazgo |
|---|---|---|
| HAL-26 | Media | Errores de multer no controlados y desalineación entre la UI de carga y el límite real |
| HAL-27 | Media | Datos clínicos y documentos sin cifrado en reposo; conexión a PostgreSQL sin TLS |
| HAL-28 | Media | Auditoría sin inmutabilidad, retención ni protección contra update/delete |
| HAL-29 | Media | Retardo artificial de 5 segundos en endpoints críticos; incumple NFR-PERF-1 |
| HAL-30 | Menor | Swagger UI y `/openapi.json` públicos |
| HAL-31 | Menor | Mensajes de error con detalles internos de PostgreSQL y del servidor |
| HAL-32 | Menor | Listados sin paginación ni minimización de campos |
| HAL-33 | Menor | Un administrador puede eliminarse a sí mismo o eliminar al último administrador |
| HAL-34 | Menor | `GET /usuarios` no devuelve el rol; la UI muestra “N/A” |
| HAL-35 | Menor | `RequireAdmin` no reconoce el rol `"administrador"` que `users.js` sí acepta |
| HAL-36 | Menor | La fecha de nacimiento se muestra un día antes por interpretación UTC |
| HAL-37 | Menor | El diálogo de eliminación de paciente muestra `undefined` |
| HAL-38 | Menor | Axios no maneja 401 ni expiración de sesión; el usuario queda en un estado inconsistente |

---

## 6. Los cinco riesgos que deben explicarse en la defensa

### 6.1 Compromiso total sin autenticación

La combinación de HAL-01 (ficha por RUT), HAL-02 (contraseñas en claro) y HAL-03 (secretos y base publicados) permite a un atacante externo:

1. Enumerar RUT y obtener fichas clínicas sin token.
2. Conectarse a PostgreSQL con `postgres/postgres` en el puerto `15442` y leer o modificar todo.
3. Forjar un JWT con el secreto publicado y actuar como administrador.

No se requiere una cuenta, una vulnerabilidad de memoria ni una cadena compleja. Es un fallo de configuración y de diseño explotable con herramientas básicas.

### 6.2 Escalamiento de privilegios por tres vías independientes

- **HAL-04:** un paciente crea un administrador.
- **HAL-05:** un médico se asciende a sí mismo.
- **HAL-07:** se libera el nombre `admin` y se reasigna a `paciente`, o se renombra `paciente` a `administrador`, alias que varias rutas aceptan como admin.

Cada vía es suficiente por sí sola. La corrección de una no elimina las otras; se requiere un modelo de autorización único, centralizado y probado.

### 6.3 Apropiación de fichas clínicas

HAL-08 permite que un tercero vincule una ficha existente a su cuenta con solo conocer el RUT. La ficha queda accesible mediante `/pacientes/:id` y `/examenes`, y el dueño legítimo pierde la posibilidad de registrarse. Es un daño directo al paciente, no solo una falla técnica.

### 6.4 Integridad de la auditoría

HAL-16, HAL-17 y HAL-28 afectan la capacidad de reconstruir incidentes:

- Cualquier usuario autenticado puede insertar acciones falsas.
- Los logins fallidos no se registran.
- Las operaciones destructivas pueden ejecutarse y luego fallar al auditar.
- La tabla no es inmutable y el `ON DELETE SET NULL` borra la atribución del actor.

Sin auditoría confiable no hay notificación de brechas, investigación forense ni cumplimiento de la Ley N.º 21.663.

### 6.5 Reproducibilidad y operación

HAL-23 (build Docker), HAL-24 (inicialización parcial) y HAL-29 (5 segundos de retardo) impiden afirmar que el sistema es desplegable y verificable de forma reproducible. Un proyecto que no se puede levantar desde un clon limpio no puede sostener un plan de pruebas confiable.

---

## 7. Contraste con los 13 hallazgos previos

Los 13 hallazgos aportados se confirmaron. Los ajustes principales fueron:

| Hallazgo previo | Resultado | Cambio |
|---|---|---|
| F01 contraseñas en texto plano | Confirmado | Se mantiene Crítico (HAL-02) |
| F02 búsqueda pública por RUT | Confirmado | Crítico (HAL-01) |
| F03 `DELETE /usuarios` sin auth | Confirmado | Crítico (HAL-06); se agrega el 500 posterior al borrado (HAL-17) |
| F04 roles sin auth | Confirmado | **Elevado a Crítico** (HAL-07) por el renombrado de roles: liberar `admin` y reasignarlo, o usar el alias `administrador` |
| F05 cualquier token crea admin | Confirmado | Crítico (HAL-04) |
| F06 vinculación por RUT | Confirmado | **Elevado a Crítico** (HAL-08) por apropiación de ficha clínica |
| F07 autoascenso de médico | Confirmado | **Elevado a Crítico** (HAL-05) |
| F08 auditoría manipulable | Confirmado | **Dividido** en HAL-16, HAL-17 y HAL-28 |
| F09 política de contraseñas / RUT | Confirmado | **Dividido** en HAL-12 y HAL-13 |
| F10 MIME / multer / dropzone | Confirmado | **Dividido** en HAL-18 y HAL-26 |
| F11 fecha un día antes | Confirmado | Menor (HAL-36) |
| F12 manejo de 401 | Confirmado | **Dividido** en HAL-09 y HAL-38 |
| F13 secretos, JWT, TLS, CORS, helmet, token, Swagger, errores | Confirmado | **Dividido** en HAL-03 (Crítico), HAL-09/10/11 (Mayores), HAL-27 (Media) y HAL-30/31 (Menores) |

El detalle, la justificación y los aspectos no confirmados (SQL injection, XSS directo, CSRF, path traversal, command injection) están en [07 — Contraste con los 13 hallazgos previos](07-contraste-hallazgos-previos.md).

---

## 8. Veredicto

| Criterio | Resultado |
|---|---|
| ¿Los controles de autenticación protegen el acceso? | **No.** Hay endpoints críticos sin autenticación y credenciales en claro. |
| ¿La autorización se aplica en el backend? | **Parcialmente.** Existen verificaciones, pero son inconsistentes y evadibles. |
| ¿Los datos clínicos están protegidos? | **No.** Ficha por RUT pública, documentos sin cifrado, DB expuesta. |
| ¿La auditoría es confiable? | **No.** Forjable, incompleta y no inmutable. |
| ¿El sistema es desplegable y verificable? | **Con reservas.** El build Docker falla en clon limpio y la inicialización no es atómica. |
| ¿Cumple la normativa chilena? | **No.** Ley 19.628, 21.719, 20.584 y 21.663 presentan brechas directas. |
| **Dictamen** | **NO CERTIFICADO / NO APTO PARA PRODUCCIÓN** |

---

## 9. Recomendaciones prioritarias

### 9.1 Primeros 7 días (bloqueantes)

1. Rotar el secreto JWT y la contraseña de PostgreSQL; eliminarlos del repositorio y del historial.
2. Cerrar el puerto `15442` y dejar de usar `postgres/postgres`.
3. Exigir autenticación y autorización en `/pacientes/buscar/rut`, `/usuarios` (POST/DELETE), `/roles` (POST/PUT/DELETE) y `/auditoria` (POST).
4. Implementar hashing Argon2id/bcrypt y migrar las contraseñas existentes.
5. Bloquear el cambio de rol a administrador salvo para un administrador, y prohibir el autoascenso.
6. Deshabilitar el autoenlace por RUT; exigir verificación de identidad.
7. Corregir la comparación de `BIGINT` en documentos y el tipo de `auditoria.usuario_id`.
8. Corregir el build Docker y la inicialización de la base.

### 9.2 30 días

- Centralizar autenticación/autorización en middlewares únicos.
- Introducir transacciones en todas las operaciones multi-tabla.
- Implementar rate limiting, bloqueo progresivo y MFA para roles privilegiados.
- Adoptar helmet, CORS con allowlist y TLS extremo a extremo.
- Rehacer la auditoría con campos estructurados, append-only y retención.
- Validar archivos por *magic bytes* y analizar con antivirus.
- Incorporar pruebas automatizadas de autorización y CI con SAST/SCA.

### 9.3 90 días

- DPIA, registro de actividades de tratamiento, consentimiento y derechos del titular.
- Plan de respuesta a incidentes y notificación de brechas.
- Revisión de dependencias y actualización a versiones soportadas.
- Pruebas de carga, disponibilidad, respaldo y restauración.
- Auditoría externa de seguridad y retest completo.

El detalle de responsables, esfuerzo y criterios de cierre está en [08 — Plan de acción y retest](08-plan-de-accion-recomendado.md).

---

## 10. Limitaciones

- La revisión es **estática**; no se ejecutó el sistema en esta evaluación. Las recetas de reproducción están documentadas, pero deben ejecutarse en un entorno aislado.
- Los resultados de ejecución previos provienen de la Actividad 2.3.2 y se usan como evidencia complementaria, no como una nueva ejecución.
- `npm audit` reporta vulnerabilidades de dependencias directas y transitivas; algunas pueden no ser alcanzables en el flujo real. Se clasifican como riesgo de cadena de suministro y requieren validación con SCA/DAST.
- No se dispone del ERS completo; la trazabilidad se apoya en los códigos RF, NFR y RB citados en EP1 y en las actividades previas.
- No se evaluaron aspectos de infraestructura cloud, redes perimetrales ni controles organizacionales, salvo lo visible en Docker Compose y en la configuración del repositorio.

---

## 11. Conclusión

Cuidarte+ tiene una base funcional que, en las pruebas previas, permitió completar los flujos principales y aprobar 28 casos. Sin embargo, la seguridad no se puede evaluar por el porcentaje de casos felices: se evalúa por la capacidad de resistir el abuso. En el estado actual, un atacante sin cuenta puede leer fichas clínicas, un paciente puede convertirse en administrador y un médico puede ascender a administrador; la base de datos y el secreto de firma están en el repositorio. Eso es suficiente para sostener el dictamen **NO CERTIFICADO**.

La buena noticia es que la mayoría de los defectos son corregibles con cambios acotados y verificables: middlewares de autorización, hashing, rotación de secretos, transacciones, validación de archivos y una auditoría append-only. El plan de acción propuesto permite pasar de un sistema vulnerable a uno auditable en tres horizontes, con criterios de retest medibles.

---

*Ver [03 — Hallazgos críticos](03-hallazgos-criticos.md) para la evidencia detallada.*
