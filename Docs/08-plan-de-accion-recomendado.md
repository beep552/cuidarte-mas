# 08 — Plan de acción y retest

> **Objetivo.** Pasar de un sistema **NO CERTIFICADO** a un sistema verificable en tres horizontes: contener lo explotable en 7 días, corregir las causas estructurales en 30 días y consolidar el cumplimiento y la mejora continua en 90 días. Cada acción tiene responsable, esfuerzo estimado, dependencia y criterio de cierre verificable.

**Alcance:** 38 hallazgos (8 críticos, 17 mayores, 4 medios, 9 menores). Las estimaciones son orientativas para un equipo de 4-6 personas y no incluyen la contratación de terceros ni la compra de herramientas.

---

## 1. Principios de priorización

1. **Contener antes de rediseñar.** Rotar secretos, cerrar puertos y bloquear los vectores sin autenticación no requiere arquitectura nueva.
2. **Corregir la causa, no solo el síntoma.** Añadir un `if` en una ruta no sustituye un middleware de autorización; hashear una contraseña no corrige la política.
3. **Una sola fuente de verdad para autorización.** Los roles deben tener códigos inmutables y una función central; el frontend no es un control de seguridad.
4. **Transacciones y auditoría desde el diseño.** Toda operación multi-tabla debe ser atómica y auditable.
5. **Verificar con retest.** Un hallazgo se cierra solo cuando el caso de prueba correspondiente pasa y la evidencia queda registrada.
6. **No degradar por controles compensatorios.** Un botón oculto no cierra un endpoint abierto.

---

## 2. Horizonte 0-7 días — Contención (P0)

**Meta:** eliminar las vías de compromiso total y dejar el sistema en un estado en el que se pueda probar sin exponer datos reales.

| ID | Acción | Responsable | Esfuerzo | Dependencia | Criterio de cierre |
|---|---|---|---|---|---|
| **HAL-03** | Rotar `JWT_SECRET` y contraseña de PostgreSQL; eliminar `.env` del historial; cerrar el puerto `15442`; fallar al arrancar si falta el secreto; invalidar todos los tokens emitidos. | DevOps + Backend | 1-2 pd | Acceso al repositorio y al entorno | `git log -S` sin secreto; `psql` externo rechazado; arranque sin `JWT_SECRET` falla; tokens antiguos → 401 |
| **HAL-01** | Exigir autenticación y autorización en `GET /pacientes/buscar/rut/:rut`; devolver solo el titular, médico autorizado o admin; rate limiting; auditoría. | Backend | 1-2 pd | HAL-03 (token confiable) | Anónimo → 401; paciente ajeno → 403; propio → 200; 100 req/min → 429 |
| **HAL-02** | Implementar Argon2id/bcrypt; migrar seeds y usuarios; eliminar comparación `!==`; forzar cambio de contraseñas semilla. | Backend + DBA | 2-3 pd | Definir política (HAL-12) | `SELECT contrasena` muestra `$argon2id$...`; login correcto/incorrecto; CP-SEG-008 aprueba |
| **HAL-04** | Exigir rol admin en `POST /usuarios`; validar `rol_id` contra allowlist; no aceptar roles del cliente sin autorización. | Backend | 1 pd | Middleware de autorización | Paciente/médico → 403; admin → 201; rol inválido → 400 sin usuario huérfano |
| **HAL-05** | Separar cambio de perfil y cambio de rol; solo admin cambia roles; prohibir autoascenso; invalidar tokens afectados. | Backend | 2 pd | HAL-04, HAL-21 | Médico no puede cambiar su rol; admin sí; token antiguo sin privilegios |
| **HAL-06** | Exigir autenticación y rol admin **antes** del `DELETE`; borrado lógico; prohibir autoeliminación y último admin. | Backend | 1-2 pd | Middleware de autorización | Sin token → 401; paciente → 403; admin → 200 lógico; usuario intacto si falla auditoría |
| **HAL-07** | Exigir admin en `POST/PUT/DELETE /roles`; autenticación en `GET`; proteger roles del sistema; introducir `codigo` inmutable. | Backend + DBA | 2-3 pd | Modelo de roles | `PUT /roles/3` anónimo → 401; renombrar sistema → 400; CP-SEG-009 aprueba |
| **HAL-08** | Deshabilitar el autoenlace por RUT; exigir verificación (OTP/invitación/aprobación); notificar y auditar. | Backend + Producto | 2-3 pd | Proveedor de correo/SMS o flujo manual | Registro con RUT existente no vincula; OTP válido vincula; titular no queda bloqueado |
| **HAL-17** | Usar `authUser.usuarioId` numérico en `auditoria.usuario_id`; corregir tipo/constraints; transacción con la operación. | Backend + DBA | 1 pd | HAL-15 | `DELETE` con token → 200 y fila de auditoría con ID; sin `22P02` |
| **HAL-19** | Rate limiting por IP y usuario en login; bloqueo progresivo; registrar fallos; alertas. | Backend + DevOps | 1-2 pd | Redis o almacén compartido | 5 fallos → 429/bloqueo; intento correcto bloqueado; CP-SEG-010 aprueba |
| **HAL-23** | Eliminar `COPY uploads/` o añadir `BACKEND/uploads/.gitkeep`; `.dockerignore`; build en CI. | DevOps | 0,5 pd | — | `docker compose build` en clon limpio pasa |
| **HAL-24** | `psql -v ON_ERROR_STOP=1`; `set -euo pipefail`; verificar tablas/seeds; healthcheck. | DevOps + DBA | 1 pd | — | Dump con error falla; dump válido healthy; reejecución controlada |
| **HAL-30** | Deshabilitar Swagger/OpenAPI en producción o exigir admin. | Backend | 0,5 pd | — | Anónimo → 401/404 en prod |

**Esfuerzo P0:** ~17-24 personas-día. **Salida:** ningún crítico explotable sin autenticación; entorno reproducible; secretos rotados.

> **Advertencia:** si no se puede completar P0 antes de una entrega, **no desplegar con datos reales**. El sistema puede usarse solo en un entorno aislado con datos sintéticos.

---

## 3. Horizonte 8-30 días — Corrección estructural (P1)

**Meta:** reemplazar parches por controles de diseño y dejar los 38 hallazgos en estado “corregido pendiente de retest” o “aceptado con justificación”.

### 3.1 Autorización, identidad y sesión

| ID | Acción | Responsable | Esfuerzo | Criterio de cierre |
|---|---|---|---|---|
| **HAL-09** | Access token corto (5-15 min) + refresh rotativo; `jti` y revocación; invalidar por cambio de contraseña/rol; cookie `HttpOnly`/`Secure` o memoria. | Backend + Frontend | 4-6 pd | Token tras logout/cambio → 401; ventana de abuso ≤ 15 min; CP-NUEVO-04 aprueba |
| **HAL-12** | Política de 12 caracteres, complejidad/frase de paso, lista de filtradas, bloqueo de datos personales; actualizar UI y casos CP-FUN-003/004. | Backend + Frontend + QA | 2-3 pd | `abc123` → 400; `Cuidarte#2026` → 201; pruebas actualizadas |
| **HAL-13** | Validar DV con módulo 11; normalizar `K`/`k`, `trim`, puntos; misma función en backend y frontend; índice funcional. | Backend + Frontend | 1-2 pd | `12.345.678-5` → 400; `-7` → 201; duplicados normalizados → 400 |
| **HAL-14** | Eliminar `usuario_id` de `POST/PUT /pacientes`; endpoint administrativo de vinculación con verificación y auditoría. | Backend | 1-2 pd | Paciente/médico envían `usuario_id` → ignorado/400; admin vincula con auditoría |
| **HAL-21** | Reasignar `req[source] = await schema.validate(...)`; declarar `rol_id` con allowlist; separar DTOs. | Backend | 1 pd | `{rol_id}` solo → 200/403, no 400; campo desconocido eliminado |
| **HAL-33** | Borrado lógico, prohibición de autoeliminación y del último admin, transferencia de fichas. | Backend + Frontend | 1-2 pd | Autoeliminación → 400/403; último admin → 400/403; ficha reasignada |
| **HAL-34** | Incluir rol(es) en `GET /usuarios`; mostrar en tabla; filtro por rol. | Backend + Frontend | 1 pd | La tabla nunca muestra “N/A”; contrato probado |
| **HAL-35** | Centralizar `isAdmin()` y códigos de rol; aceptar `admin`/`administrador` durante migración. | Frontend + Backend | 1 pd | Ambos nombres acceden; paciente denegado; misma decisión backend/UI |
| **HAL-38** | Interceptor 401: limpiar sesión, redirigir una vez, distinguir 403; validar `exp` al iniciar. | Frontend | 1-2 pd | Token expirado → login; 403 no desloguea; sin bucles |

### 3.2 Integridad, datos y auditoría

| ID | Acción | Responsable | Esfuerzo | Criterio de cierre |
|---|---|---|---|---|
| **HAL-15** | Transacciones con `pool.connect()`/`BEGIN`/`COMMIT`/`ROLLBACK` en registro, usuarios, roles, pacientes, exámenes y documentos. | Backend | 4-6 pd | `rol_id` inválido no crea usuario; fallo de auditoría revierte; pruebas de fallo inducido |
| **HAL-16** | Eliminar `POST /auditoria` público; auditar desde el servidor; enum de acciones; IP, UA, resultado, recurso, correlation ID; auditar login fallido. | Backend | 3-4 pd | Paciente no puede insertar; login fallido registrado; admin consulta paginado |
| **HAL-18** | Validar magic bytes/`file-type`; coherencia extensión/MIME; antivirus/ClamAV; re-encodeo de imágenes; cuarentena; `nosniff`/attachment. | Backend + DevOps | 4-6 pd | HTML con MIME PDF → 400; EICAR rechazado; PDF real → 201 |
| **HAL-20** | Normalizar IDs (`String`/`Number` o `setTypeParser`); pruebas de documentos propios/ajenos. | Backend + QA | 0,5-1 pd | Paciente descarga su documento → 200; ajeno → 403 |
| **HAL-22** | Derivar `paciente_id` del examen en el servidor; no aceptarlo del cliente; validar coherencia. | Backend | 1 pd | Examen 1 + paciente 2 → 400; examen 1 + paciente 1 → 201 |
| **HAL-27** | TLS a PostgreSQL (`sslmode=verify-full`); cifrado de volumen/backups; cifrado de columnas/documentos; KMS; usuario de app con privilegios mínimos. | DevOps + DBA | 5-8 pd | `SHOW ssl` on; volumen ilegible; dump cifrado; conexión sin TLS rechazada |
| **HAL-28** | Rol DB solo INSERT/SELECT; triggers anti-update/delete; hash chain; WORM/SIEM; retención y legal hold; snapshot del actor. | DBA + Backend + DevOps | 4-6 pd | App no puede borrar; hash detecta alteración; retención probada |
| **HAL-31** | Mapper central de errores; respuestas genéricas con `correlationId`; logs estructurados sin PII; mapear 23505/23503/22P02. | Backend | 1-2 pd | 500 sin SQL/tablas/valores; logs con ID; pruebas de fuga |
| **HAL-32** | Paginación server-side con límite máximo; proyección por rol; UI server-side; auditoría paginada. | Backend + Frontend | 3-4 pd | `limit=1000` recorta/400; respuesta con metadatos; no se descarga todo |

### 3.3 Configuración, transporte y calidad

| ID | Acción | Responsable | Esfuerzo | Criterio de cierre |
|---|---|---|---|---|
| **HAL-10** | CORS con allowlist (`FRONTEND_URL`), métodos/cabeceras mínimos, validación de Origin. | Backend + DevOps | 0,5-1 pd | `evil.example` sin cabecera; localhost permitido; preflight no autorizado → 403 |
| **HAL-11** | TLS en Nginx/balanceador, redirección 308, HSTS, CSP, `nosniff`, `frame-ancestors`, `Referrer-Policy`, helmet. | DevOps + Backend | 2-3 pd | HTTP → HTTPS; cabeceras presentes; TLS ≥ 1.2; testssl sin hallazgos altos |
| **HAL-25** | Node 22/24 LTS; actualizar dependencias; `npm audit fix`; Dependabot/Renovate; SCA en CI; SBOM; imagen mínima. | DevOps + Backend + Frontend | 4-6 pd | `npm audit --audit-level=high` = 0; runtime soportado; CI bloquea altas |
| **HAL-26** | Error handler de multer (400/413 JSON); `maxSize` en dropzone; mensaje específico; constantes compartidas. | Backend + Frontend | 1-2 pd | `.txt` → 400; 11 MB → 413; mensaje visible; CP-FUN-013 aprueba |
| **HAL-29** | Eliminar delay o condicionarlo a `SIMULATE_DELAY_MS=0` por defecto; pruebas de carga y SLO. | Backend + QA | 1 pd | p95 < 500 ms local; sin retardo en prod; carga 50 usuarios estable |
| **HAL-36** | `formatDateOnly` sin `new Date` para `DATE`; API devuelve `YYYY-MM-DD`; pruebas multi-zona. | Frontend + Backend | 1-2 pd | 2000-01-01 se muestra igual en Santiago/UTC/Tokio |
| **HAL-37** | Nombre completo en el diálogo; incluir RUT; prueba de texto. | Frontend | 0,5 pd | Diálogo sin `undefined`; muestra nombre y RUT |
| **OBS-01/05/06/09/11** | CI con tests, lint, SAST/SCA; logs estructurados; healthchecks; rate limit de registro; migraciones versionadas. | DevOps + QA | 4-6 pd | Pipeline verde; healthchecks; migraciones aplicables |

**Esfuerzo P1:** ~55-80 personas-día. **Salida:** 0 críticos y 0 mayores abiertos; medios con plan o corregidos; suite de retest ejecutada.

---

## 4. Horizonte 31-90 días — Cumplimiento y mejora continua (P2)

**Meta:** demostrar que el sistema no solo es seguro, sino que puede operar con datos reales bajo un marco de cumplimiento y mejora continua.

| Línea de trabajo | Acción | Responsable | Esfuerzo | Criterio de cierre |
|---|---|---|---|---|
| **Privacidad** | DPIA/EIPD, registro de actividades de tratamiento (ROPA), base de licitud, consentimiento, aviso de privacidad, derechos ARCO. | Legal/Privacidad + Producto | 8-12 pd | DPIA aprobada; ROPA completo; flujo de derechos probado |
| **Retención** | Política de retención por tipo de dato, purga, anonimización, legal hold, backups cifrados y restauración. | DBA + Legal | 3-5 pd | Purga programada; restauración probada; evidencia |
| **Incidentes** | Plan de respuesta, roles, playbooks, contacto con la Agencia, notificación a titulares, simulacro. | Seguridad + Legal | 4-6 pd | Simulacro ejecutado; tiempos medidos; plantillas aprobadas |
| **Continuidad** | RTO/RPO, alta disponibilidad, respaldo/restauración, plan de recuperación. | DevOps | 5-8 pd | Prueba de restore; RTO/RPO cumplidos |
| **Verificación externa** | Pentest independiente, revisión de código, test de intrusión de API y de lógica de negocio. | Tercero + QA | 5-10 pd | Informe sin críticos/altos; retest |
| **Observabilidad** | SIEM, alertas, dashboards, trazas, retención de logs, métricas de seguridad. | DevOps + Seguridad | 4-6 pd | Alertas de login fallido, rol, acceso a ficha y error 5xx |
| **Proveedores** | Evaluación de dependencias, SBOM, SLA, cláusulas de tratamiento, cadena de suministro. | Compras + Legal + DevOps | 3-5 pd | Inventario y evaluaciones firmadas |
| **Formación** | Capacitación en OWASP Top 10, privacidad, phishing, respuesta a incidentes. | RRHH + Seguridad | 1-2 pd | Asistencia y evaluación |
| **Certificación** | Reauditoría con los 38 hallazgos y los CP-NUEVO; emitir nuevo dictamen. | QA + Seguridad | 5-8 pd | 0 críticos/altos; todos los CP pasan; dictamen |

**Esfuerzo P2:** ~38-62 personas-día. **Salida:** sistema apto para operar con datos reales, con evidencia de cumplimiento y mejora continua.

---

## 5. Responsables y modelo de trabajo

| Rol | Responsabilidad principal | Hallazgos asociados |
|---|---|---|
| **Backend Lead** | Autorización, validación, transacciones, auditoría, uploads | HAL-01 a HAL-08, 14-22, 26, 28, 31, 32 |
| **Frontend Lead** | Guards, sesión, fechas, diálogos, mensajes | HAL-09, 26, 34-38 |
| **DevOps/Infra** | Secretos, TLS, red, Docker, CI, dependencias | HAL-03, 10, 11, 23-25, 27 |
| **DBA** | Esquema, tipos, roles, transacciones, cifrado, retención | HAL-15, 17, 27, 28 |
| **QA/Seguridad** | Casos, retest, SAST/DAST, evidencias | Todos |
| **Legal/Privacidad** | DPIA, ROPA, retención, incidentes, normativa | HAL-01, 02, 03, 08, 27, 28 |
| **Producto/PO** | Priorización, aceptación de riesgo, comunicación | HAL-08, 12, 33 |

**Cadencia:** daily de 15 minutos durante P0; revisión semanal de avance y riesgos en P1/P2; tablero con una columna por estado (`Abierto`, `En corrección`, `Corregido pendiente de retest`, `Cerrado`, `Aceptado con justificación`).

**Regla de aceptación de riesgo:** solo un crítico o mayor puede aceptarse con firma del PO y del responsable de seguridad, con justificación, compensación, fecha de revisión y evidencia. **Ningún crítico debe aceptarse para producción con datos reales.**

---

## 6. Retest y criterios de salida

### 6.1 Secuencia de retest

1. **Retest unitario/integrado** del hallazgo corregido (caso específico).
2. **Retest de regresión** de los flujos relacionados (CP-FUN/SEG/ USA).
3. **Retest de seguridad** con ZAP/Postman/Newman sobre los endpoints corregidos.
4. **Retest de configuración** (TLS, CORS, headers, dependencias).
5. **Retest de despliegue** desde clon limpio.
6. **Reauditoría** de los 38 hallazgos y emisión del dictamen.

### 6.2 Criterios de salida globales

| Criterio | Umbral |
|---|---|
| Hallazgos críticos abiertos | **0** |
| Hallazgos mayores abiertos | **0** (o aceptados con firma y compensación) |
| Hallazgos medios | 0 o plan con fecha |
| CP-SEG-006 | Ejecutado y aprobado |
| CP-NUEVO-01 a CP-NUEVO-22 | 100 % ejecutados; 0 fallos críticos |
| `npm audit --audit-level=high` | 0 altas/críticas |
| Build desde clon limpio | Pasa |
| `docker compose up` | Backend/frontend healthy |
| TLS/CORS/headers | testssl y ZAP sin altos |
| Auditoría | Inmutable, completa y verificable |
| Documentación | Actualizada y trazable |

### 6.3 Evidencia de cierre por hallazgo

Cada cierre debe adjuntar:

- ID y descripción del hallazgo.
- Commit/PR y archivos modificados.
- Caso de prueba ejecutado y resultado.
- Salida de la herramienta (captura, log, JSON).
- Fecha, responsable y revisor.
- Riesgo residual, si existe.

---

## 7. Dependencias y riesgos del plan

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El equipo no tiene acceso a un proveedor de OTP/correo | HAL-08 no se puede cerrar completo | Implementar primero invitación manual aprobada por admin; OTP en fase 2 |
| Cambiar roles rompe datos existentes | Regresiones en autorización | Migración con `codigo` + doble lectura; pruebas de compatibilidad |
| TLS/DB cifrada requiere infraestructura | Retraso de P1 | Usar terminación TLS en Nginx y cifrado de volumen como mínimo viable |
| Falta de tiempo para 38 hallazgos | Se libera con críticos abiertos | Congelar despliegue; priorizar P0 y no aceptar críticos |
| Dependencias sin parche compatible | HAL-25 parcial | Aislar/compensar, documentar excepción con fecha y revisar mitigaciones |
| Datos reales en el entorno de pruebas | Incidente de privacidad | Datos sintéticos, anonimización, prohibición de producción |

---

## 8. Resumen ejecutivo del plan

| Horizonte | Foco | Hallazgos | Esfuerzo | Resultado |
|---|---|---|---:|---|
| **0-7 días** | Contención | HAL-01 a HAL-08, 17, 19, 23, 24, 30 | 17-24 pd | Sin críticos explotables; secretos rotados; entorno reproducible |
| **8-30 días** | Corrección estructural | HAL-09 a HAL-16, 18, 20-22, 25-29, 31-38 | 55-80 pd | 0 críticos/altos; suite de retest |
| **31-90 días** | Cumplimiento y mejora | Transversal + OBS | 38-62 pd | Apto para datos reales; evidencia de cumplimiento |

**Conclusión:** el plan es exigente pero viable. La mayor parte del esfuerzo no está en “parchear” sino en **centralizar autorización, transaccionar operaciones y reconstruir la auditoría**, tres inversiones que reducen el riesgo de forma estructural y facilitan las certificaciones futuras.

*Volver al [índice](README.md) · Continuar con [09 — Riesgos y cumplimiento normativo](09-riesgos-y-cumplimiento.md).*
