# 06 — Matriz de trazabilidad

> **Uso.** Esta matriz conecta cada hallazgo con su ubicación exacta, el requisito del ERS, el caso de prueba previo o propuesto, la norma aplicable y la sección de EP3 en la que se utiliza. Es la base para demostrar cobertura y para ejecutar el retest.

**Convenciones de evidencia:** `EST` = revisión estática; `EJEC` = ejecución documentada en la Actividad 2.3.2; `DEP` = análisis de dependencias; `EST+EJEC` = ambas.

---

## 1. Matriz principal (38 hallazgos)

| ID | Sev. | CWE | Ubicación (`archivo:línea`) | Requisito | Caso(s) | Norma / estándar | EP3 |
|---|---|---|---|---|---|---|---|
| [HAL-01](03-hallazgos-criticos.md#hal-01) | Crítica | CWE-306, CWE-200 | `BACKEND/src/routes/pacientes.js:249-273` | RF-4.1, RF-4.2; RB-1; NFR-SEG-4, NFR-SEG-8 | CP-SEG-003, CP-SEG-006; CP-NUEVO-01 | Ley 19.628; Ley 21.719; Ley 20.584 | §6, §7 |
| [HAL-02](03-hallazgos-criticos.md#hal-02) | Crítica | CWE-256, CWE-916, CWE-759 | `auth.js:13-23,109-112`; `users.js:35-38,500-502`; `dump-cuidarteplus.sql:288-290`; `init.sql:7` | RF-1.1, RF-2.1; NFR-SEG-1, NFR-SEG-8 | CP-SEG-008; CP-FUN-001/002/015 | Ley 19.628; Ley 21.719; ISO 27001 A.8.24 | §6, §7 |
| [HAL-03](03-hallazgos-criticos.md#hal-03) | Crítica | CWE-798, CWE-259, CWE-522 | `.env:1`; `BACKEND/.env:2-3`; `README.md:30,46`; `docker-compose.yml:7,10-11,33,35`; `db.js:4-6`; fallback en 7 rutas | RF-1.1; NFR-SEG-1/3/8/9 | CP-SEG-007, CP-SEG-008; CP-FUN-001 | Ley 19.628; Ley 21.719; Ley 21.663; ISO 27001 A.5.17, A.8.24 | §6, §7, §9 |
| [HAL-04](03-hallazgos-criticos.md#hal-04) | Crítica | CWE-862, CWE-269, CWE-285 | `users.js:23-72`; `validations/users.js:18-22` | RB-1, RB-2; NFR-SEG-4 | CP-SEG-004/005; CP-FUN-015 | Ley 19.628; Ley 20.584; ISO 27001 A.8.2, A.8.3 | §6, §7 |
| [HAL-05](03-hallazgos-criticos.md#hal-05) | Crítica | CWE-269, CWE-862 | `users.js:437-532` (454-455, 484-489, 522-531); `validations/users.js:25-46`; `validate.js:5` | RB-1, RB-2; NFR-SEG-4 | CP-SEG-004/005; CP-FUN-015 | Ley 19.628; Ley 20.584; ISO 27001 A.8.2 | §6, §7 |
| [HAL-06](03-hallazgos-criticos.md#hal-06) | Crítica | CWE-306, CWE-862, CWE-209 | `users.js:571-597`; `init.sql:88-93`; `dump-cuidarteplus.sql:266-271` | RB-2; NFR-SEG-4, NFR-SEG-6 | CP-SEG-003/004; CP-FUN-015; CP-NUEVO-02 | Ley 19.628; Ley 20.584; Ley 21.663 | §6, §7 |
| [HAL-07](03-hallazgos-criticos.md#hal-07) | Crítica | CWE-306, CWE-862, CWE-269 | `roles.js:18-92`; `app.js:35`; `users.js:113,453-455`; `pacientes.js:37`; `documentos.js:55`; `audit.js:80`; `init.sql:13-16,105` | RB-1, RB-2; NFR-SEG-4 | CP-SEG-009, CP-SEG-004; CP-FUN-015 | Ley 19.628; Ley 20.584; ISO 27001 A.8.2 | §6, §7 |
| [HAL-08](03-hallazgos-criticos.md#hal-08) | Crítica | CWE-639, CWE-287, CWE-863 | `auth.js:71-142` (77-94, 127-141) | RF-1.1, RF-2.1, RF-2.2; RB-1; NFR-SEG-4/8 | CP-FUN-002, CP-SEG-006; CP-NUEVO-03 | Ley 19.628; Ley 21.719; Ley 20.584 | §6, §7 |
| [HAL-09](04-hallazgos-mayores.md#hal-09) | Mayor | CWE-613, CWE-522, CWE-539 | `auth.js:44-55`; `AuthContext.jsx:7-9,41,59,65-71`; `api.jsx:21` | RF-1.1, RF-1.2; NFR-SEG-9 | CP-SEG-007; CP-NUEVO-04 | Ley 19.628; Ley 21.719; ISO 27001 A.8.5 | §6, §7 |
| [HAL-10](04-hallazgos-mayores.md#hal-10) | Mayor | CWE-942 | `app.js:21` | NFR-SEG-4, NFR-SEG-5 | CP-SEG-003/005 | ISO 27001 A.8.20; ASVS V14 | §6, §7 |
| [HAL-11](04-hallazgos-mayores.md#hal-11) | Mayor | CWE-319, CWE-693, CWE-1021 | `app.js:19-23,50`; `nginx.conf:1-24`; `docker-compose.yml:37-38,56-57`; `FRONTEND/Dockerfile:34`; `FRONTEND/.env:1` | NFR-SEG-1, NFR-SEG-3 | CP-SEG-001/003; CP-NUEVO-05 | Ley 19.628; Ley 21.719; ISO 27001 A.8.24 | §6, §7 |
| [HAL-12](04-hallazgos-mayores.md#hal-12) | Mayor | CWE-521 | `validations/auth.js:21-24`; `validations/users.js:9-12`; `FRONTEND/src/validations/auth.js:26-29`; `FRONTEND/src/validations/users.js:11-15`; `dump:288-290` | RF-2.1; NFR-SEG-9; Restricción 2.4 | CP-FUN-003/004/015 | ISO 27001 A.5.17; ASVS V2.1 | §6, §7 |
| [HAL-13](04-hallazgos-mayores.md#hal-13) | Mayor | CWE-20, CWE-345 | `utils/rut.js:5-8`; `validations/auth.js:30-33`; `validations/pacientes.js:5-8,96-100` | RF-2.2; NFR-SEG-5 | CP-FUN-007 | Ley 19.628; ISO/IEC 25012 | §6, §7 |
| [HAL-14](04-hallazgos-mayores.md#hal-14) | Mayor | CWE-915 | `pacientes.js:81,116,334-342`; `validate.js:5` | RB-1, RB-3; NFR-SEG-4 | CP-FUN-007, CP-SEG-006 | Ley 19.628; Ley 20.584 | §6, §7 |
| [HAL-15](04-hallazgos-mayores.md#hal-15) | Mayor | CWE-662, CWE-754, CWE-841 | `auth.js:109-147`; `users.js:35-62,524-531,573-587`; `roles.js:21-27`; `pacientes.js:84-126`; `documentos.js:93-108` | RF-1/2/3/5; NFR-SEG-6 | CP-FUN-002/011/015/016 | ISO 25010; ISO 27001 A.8.32 | §6, §7 |
| [HAL-16](04-hallazgos-mayores.md#hal-16) | Mayor | CWE-117, CWE-778, CWE-284 | `audit.js:19-44`; `auth.js:10-69` (57-60); `init.sql:88-93` | RF-5.1; NFR-SEG-6 | CP-FUN-016, CP-SEG-010; CP-NUEVO-06 | Ley 20.584; Ley 21.663; ISO 27001 A.8.15 | §6, §7 |
| [HAL-17](04-hallazgos-mayores.md#hal-17) | Mayor | CWE-704, CWE-681 | `users.js:580-587`; `roles.js:23-27,63-67,81-85`; `init.sql:88-93`; `dump:266-271` | RF-5.1; NFR-SEG-6 | CP-FUN-016; CP-NUEVO-02 | Ley 21.663; ISO 27001 A.8.15 | §6, §7 |
| [HAL-18](04-hallazgos-mayores.md#hal-18) | Mayor | CWE-434, CWE-436, CWE-646 | `documentos.js:10-28,66-98,236-252` | RF-4.3, RF-4.4; NFR-SEG-5 | CP-FUN-012/013 | Ley 19.628; ISO 27001 A.8.28 | §6, §7 |
| [HAL-19](04-hallazgos-mayores.md#hal-19) | Mayor | CWE-307, CWE-799 | `auth.js:10-69`; ausencia en `BACKEND/package.json` | RF-1.1; NFR-SEG-9 | CP-SEG-010 | ISO 27001 A.8.5; ASVS V2.2 | §6, §7 |
| [HAL-20](04-hallazgos-mayores.md#hal-20) | Mayor | CWE-704, CWE-697 | `documentos.js:143-152,221-223` | RF-4.1, RF-4.2; RB-1 | CP-FUN-014; CP-NUEVO-07 | Ley 20.584 | §6, §7 |
| [HAL-21](04-hallazgos-mayores.md#hal-21) | Mayor | CWE-20, CWE-915, CWE-863 | `validations/users.js:25-46`; `validate.js:5-6` | RB-2; NFR-SEG-4 | CP-FUN-015 | ISO 27001 A.8.2 | §6, §7 |
| [HAL-22](04-hallazgos-mayores.md#hal-22) | Mayor | CWE-20, CWE-345, CWE-639 | `documentos.js:77-98` | RF-3.1, RF-4.4; NFR-SEG-6 | CP-FUN-012; CP-NUEVO-08 | Ley 20.584 | §6, §7 |
| [HAL-23](04-hallazgos-mayores.md#hal-23) | Mayor | CWE-710, CWE-1051 | `BACKEND/Dockerfile:14`; `docker-compose.yml:42-43`; ausencia de `BACKEND/uploads` | NFR-DIS, NFR-COMPAT | CP-FUN-001 (precondición) | ISO/IEC 29119 | §6, §8 |
| [HAL-24](04-hallazgos-mayores.md#hal-24) | Mayor | CWE-754, CWE-391 | `BACKEND/sql/init-db.sh:28,30-37` | NFR-DIS | Precondición de toda la ejecución | ISO/IEC 29119; ISO 27001 A.8.32 | §6, §8 |
| [HAL-25](04-hallazgos-mayores.md#hal-25) | Mayor | CWE-1104, CWE-937 | `BACKEND/package.json`; `FRONTEND/package.json`; `BACKEND/Dockerfile:1`; `FRONTEND/Dockerfile:2`; lockfiles | NFR-SEG; ISO 25010 | CP-SEG-001/007; CP-NUEVO-09 | ISO 27001 A.8.8; ASVS V14.2 | §6, §8 |
| [HAL-26](05-hallazgos-medios-menores.md#hal-26) | Media | CWE-754, CWE-209 | `documentos.js:10-28,66,111-117`; `ExamenDetalle.jsx:79-114,376` | RF-4.3/4.4; NFR-USAB-1; NFR-SEG-5 | CP-FUN-012/013; CP-NUEVO-10 | ISO 25010; ISO 29119 | §6, §7 |
| [HAL-27](05-hallazgos-medios-menores.md#hal-27) | Media | CWE-311, CWE-319, CWE-312 | `init.sql:7,28-51,82`; `db.js:8`; `docker-compose.yml:13,33` | NFR-SEG-1/3; RF-4.3 | CP-SEG-001/008; CP-NUEVO-11 | Ley 19.628; Ley 21.719; Ley 20.584; ISO 27001 A.8.24 | §6, §9 |
| [HAL-28](05-hallazgos-medios-menores.md#hal-28) | Media | CWE-778, CWE-693, CWE-285 | `init.sql:88-93`; `audit.js:19-110`; `users.js:580-587`; `docker-compose.yml:33` | RF-5.1; NFR-SEG-6 | CP-FUN-016; CP-NUEVO-12 | Ley 20.584; Ley 21.663; ISO 27001 A.8.15/16 | §6, §9 |
| [HAL-29](05-hallazgos-medios-menores.md#hal-29) | Media | CWE-1050, CWE-400 | `delay.js:5-11`; `documentos.js:66`; `examenes.js:46,99,330`; `pacientes.js:145` | NFR-PERF-1; RF-3/4 | CP-FUN-001/011; CP-SEG-001; CP-NUEVO-13 | ISO 25010; ISO 29119 | §6, §8 |
| [HAL-30](05-hallazgos-medios-menores.md#hal-30) | Menor | CWE-200, CWE-1059 | `app.js:37-41`; `openapi.json` | NFR-SEG-4/5 | CP-SEG-003; CP-NUEVO-14 | ISO 27001 A.8.9 | §6, §7 |
| [HAL-31](05-hallazgos-medios-menores.md#hal-31) | Menor | CWE-209 | `auth.js:63-68,153-164`; `users.js:69,135,241,278,432,566,594`; `pacientes.js:139,167,243,270,381,419`; `examenes.js:93,173,256,324,390,428`; `documentos.js:115,178,257,295`; `roles.js:32,42,53,72,90`; `audit.js:41,107`; `tipo-examen.js:16,37` | NFR-SEG-5/6 | CP-SEG-003; CP-FUN-015; CP-NUEVO-15 | ISO 27001 A.8.28; ASVS V7 | §6, §7 |
| [HAL-32](05-hallazgos-medios-menores.md#hal-32) | Menor | CWE-770, CWE-359 | `pacientes.js:155-160`; `examenes.js:128-168`; `users.js:124-128`; `audit.js:92-97` | RF-4.1, RF-5.1; NFR-PERF-1; NFR-SEG-4 | CP-FUN-008/010/016; CP-NUEVO-16 | Ley 19.628; ISO 25010 | §6, §9 |
| [HAL-33](05-hallazgos-medios-menores.md#hal-33) | Menor | CWE-269, CWE-693 | `users.js:571-597`; `UsuariosTabList.jsx:139-159` | RB-2; NFR-DIS | CP-FUN-015; CP-SEG-004; CP-NUEVO-17 | ISO 27001 A.5.15, A.8.2 | §6, §7 |
| [HAL-34](05-hallazgos-medios-menores.md#hal-34) | Menor | CWE-1059, CWE-20 | `users.js:124-128`; `UsuariosTabList.jsx:80-88` | RF-5.1; NFR-USAB-1; RB-1 | CP-FUN-015; CP-NUEVO-18 | ISO 25010; ISO 29119 | §6, §7 |
| [HAL-35](05-hallazgos-medios-menores.md#hal-35) | Menor | CWE-863, CWE-1059 | `RoleGuard.jsx:11-15,25-39`; `users.js:113`; `UsuariosTabList.jsx:108-117` | RB-1; NFR-USAB-1 | CP-SEG-004; CP-USA-002; CP-NUEVO-19 | ISO 25010; ISO 27001 A.8.2 | §6, §7 |
| [HAL-36](05-hallazgos-medios-menores.md#hal-36) | Menor | CWE-704, CWE-1104 | `PacientesTabList.jsx:106-113`; `init.sql:32`; `FRONTEND/Dockerfile:2` | RF-4.1/4.2; NFR-USAB-1 | CP-FUN-008/010; CP-NUEVO-20 | ISO 25010; Ley 20.584 | §6, §7 |
| [HAL-37](05-hallazgos-medios-menores.md#hal-37) | Menor | CWE-1059, CWE-476 | `PacientesTabList.jsx:141-143,251-257` | RF-4.1; NFR-USAB-1 | CP-FUN-009; CP-USA-003; CP-NUEVO-21 | ISO 25010; WCAG 2.1 | §6, §7 |
| [HAL-38](05-hallazgos-medios-menores.md#hal-38) | Menor | CWE-613, CWE-391 | `api.jsx:46-82`; `AuthContext.jsx:7-13,65-71`; `RoleGuard.jsx:4-9` | RF-1.2; NFR-SEG-9; NFR-USAB-1 | CP-SEG-007; CP-NUEVO-22 | ISO 27001 A.8.5; ASVS V3 | §6, §7 |

---

## 2. Cobertura por requisito

> **Nota.** Los códigos RF, NFR y RB provienen del ERS/EP1 y de las actividades previas. La matriz no inventa requisitos nuevos: cuando un hallazgo es de calidad o de normativa sin un código explícito, se indica el atributo ISO/IEC 25010 o la ley aplicable.

| Requisito / atributo | Hallazgos que lo afectan | Cobertura de prueba |
|---|---|---|
| **RF-1.1** Autenticación de usuarios | HAL-02, HAL-03, HAL-08, HAL-09, HAL-19 | CP-FUN-001/002, CP-SEG-007/008/010 |
| **RF-1.2** Gestión de sesión / cierre | HAL-09, HAL-38 | CP-SEG-007, CP-NUEVO-04/22 |
| **RF-2.1** Registro y credenciales | HAL-02, HAL-08, HAL-12 | CP-FUN-002/003/004, CP-SEG-008 |
| **RF-2.2** Identificación del paciente (RUT) | HAL-08, HAL-13 | CP-FUN-007, CP-NUEVO-03 |
| **RF-3.1** Registro de exámenes | HAL-15, HAL-22 | CP-FUN-011/012 |
| **RF-4.1** Consulta de ficha clínica | HAL-01, HAL-20, HAL-32, HAL-36, HAL-37 | CP-FUN-008/009/010/014, CP-SEG-003/006 |
| **RF-4.2** Actualización de ficha | HAL-01, HAL-14, HAL-20 | CP-FUN-009/010, CP-SEG-006 |
| **RF-4.3** Carga de documentos | HAL-18, HAL-26, HAL-27 | CP-FUN-012/013 |
| **RF-4.4** Consulta/descarga de documentos | HAL-18, HAL-22, HAL-26 | CP-FUN-012/013/014 |
| **RF-5.1** Auditoría y administración | HAL-16, HAL-17, HAL-28, HAL-32, HAL-34 | CP-FUN-015/016 |
| **NFR-SEG-1** Confidencialidad | HAL-02, HAL-03, HAL-11, HAL-27 | CP-SEG-001/008 |
| **NFR-SEG-3** Protección en tránsito | HAL-03, HAL-11, HAL-27 | CP-SEG-001/003 |
| **NFR-SEG-4** Control de acceso | HAL-01, HAL-04, HAL-05, HAL-06, HAL-07, HAL-10, HAL-14, HAL-21, HAL-30, HAL-32 | CP-SEG-003/004/005/006/009 |
| **NFR-SEG-5** Validación de entradas | HAL-10, HAL-13, HAL-18, HAL-26, HAL-31 | CP-FUN-007/012/013 |
| **NFR-SEG-6** Trazabilidad | HAL-06, HAL-15, HAL-16, HAL-17, HAL-22, HAL-28, HAL-31 | CP-FUN-016 |
| **NFR-SEG-8** Protección de datos sensibles | HAL-01, HAL-02, HAL-08, HAL-27 | CP-SEG-006/008 |
| **NFR-SEG-9** Autenticación robusta / sesión | HAL-03, HAL-09, HAL-12, HAL-19, HAL-38 | CP-SEG-007/010 |
| **NFR-PERF-1** Rendimiento | HAL-29, HAL-32 | CP-FUN-001/008/010/011 |
| **NFR-USAB-1** Usabilidad | HAL-26, HAL-34, HAL-35, HAL-36, HAL-37, HAL-38 | CP-USA-002/003 |
| **NFR-DIS** Disponibilidad / despliegue | HAL-23, HAL-24, HAL-29, HAL-33 | CP-FUN-001, precondición de ejecución |
| **NFR-COMPAT** Compatibilidad / portabilidad | HAL-23, HAL-25 | CP-FUN-001, CP-SEG-001 |
| **RB-1** Paciente solo accede a sus datos | HAL-01, HAL-04, HAL-05, HAL-07, HAL-14, HAL-20, HAL-34, HAL-35 | CP-SEG-003/004/005/006/009 |
| **RB-2** Solo admin gestiona usuarios/roles | HAL-04, HAL-05, HAL-06, HAL-07, HAL-21, HAL-33 | CP-SEG-004/005/009 |
| **RB-3** Médico accede a datos clínicos de sus pacientes | HAL-01, HAL-14 | CP-SEG-006, CP-NUEVO-01 |
| **ISO/IEC 25010 — Seguridad** | HAL-01 a HAL-38 (transversal) | Todos los CP-SEG |
| **ISO/IEC 25010 — Fiabilidad** | HAL-15, HAL-23, HAL-24, HAL-28 | CP-FUN-001/002/015/016 |
| **ISO/IEC 25010 — Eficiencia** | HAL-29, HAL-32 | CP-FUN-001/008/010/011 |
| **ISO/IEC 25010 — Usabilidad** | HAL-26, HAL-34 a HAL-38 | CP-USA-002/003 |
| **ISO/IEC 25010 — Mantenibilidad** | HAL-21, HAL-23, HAL-24, HAL-25, HAL-31, OBS-01/11 | Revisión estática y CI |
| **ISO/IEC 25010 — Portabilidad** | HAL-23, HAL-25 | Build limpio, CP-FUN-001 |
| **Ley 19.628 / 21.719** | HAL-01, HAL-02, HAL-03, HAL-08, HAL-11, HAL-13, HAL-27, HAL-32 | CP-SEG-006/008, CP-NUEVO-01/02/03/11 |
| **Ley 20.584** | HAL-01, HAL-04, HAL-05, HAL-06, HAL-07, HAL-08, HAL-14, HAL-20, HAL-22, HAL-28, HAL-36 | CP-SEG-006, CP-FUN-014, CP-NUEVO-07/08 |
| **Ley 21.663** | HAL-03, HAL-06, HAL-16, HAL-17, HAL-28 | CP-FUN-016, CP-NUEVO-06/12 |

---

## 3. Cobertura de casos previos

La Actividad 2.4.2 registra **32 casos diseñados**, **31 ejecutados**, **28 aprobados** (90,3 % de los ejecutados) y **3 fallidos**, con **CP-SEG-006 pendiente**. Los casos se agrupan en:

- **CP-FUN-001 a CP-FUN-016:** flujos funcionales (registro, login, pacientes, exámenes, documentos, usuarios, auditoría).
- **CP-SEG-001 a CP-SEG-010:** seguridad (transporte, autenticación, autorización, roles, contraseñas, fuerza bruta).
- **CP-USA-001 a CP-USA-006:** usabilidad y experiencia.

| Caso previo | Hallazgos que cubre o roza | Resultado previo | Observación |
|---|---|---|---|
| CP-FUN-001 | HAL-02, HAL-03, HAL-23, HAL-29 | Ejecutado | Depende de que el stack levante; HAL-23 lo bloquea en clon limpio. |
| CP-FUN-002 | HAL-02, HAL-08, HAL-15 | Ejecutado | No verifica identidad del titular ni transacciones. |
| CP-FUN-003 | HAL-12 | Ejecutado | Prueba 6 caracteres; valida la política débil, no la de 12. |
| CP-FUN-004 | HAL-12 | Ejecutado | Mismo problema de alineación con el ERS. |
| CP-FUN-007 | HAL-13, HAL-14 | Ejecutado | No cubre DV inválido ni `usuario_id`. |
| CP-FUN-008 | HAL-32, HAL-36 | Ejecutado | No verifica zona horaria ni paginación. |
| CP-FUN-009 | HAL-37 | Ejecutado | No verifica el texto del diálogo. |
| CP-FUN-010 | HAL-32, HAL-36 | Ejecutado | Igual que CP-FUN-008. |
| CP-FUN-011 | HAL-15, HAL-29 | Ejecutado | No mide latencia ni rollback. |
| CP-FUN-012 | HAL-18, HAL-22, HAL-26 | Ejecutado | No prueba poliglotas ni inconsistencia examen/paciente. |
| CP-FUN-013 | HAL-18, HAL-26 | Ejecutado (observación) | El `.txt` no mostró mensaje específico; MIME falsificable. |
| CP-FUN-014 | HAL-20 | Ejecutado | Solo exámenes; no documentos, por eso no detectó el 403. |
| CP-FUN-015 | HAL-02, HAL-04, HAL-05, HAL-07, HAL-12, HAL-15, HAL-21, HAL-31, HAL-33, HAL-34 | Ejecutado | No prueba autoascenso ni rol solo. |
| CP-FUN-016 | HAL-15, HAL-16, HAL-17, HAL-28, HAL-32 | Ejecutado | No intenta forjar auditoría ni verifica inmutabilidad. |
| CP-SEG-001 | HAL-11, HAL-25, HAL-27, HAL-29 | Ejecutado | No evalúa TLS/cabeceras con testssl. |
| CP-SEG-003 | HAL-01, HAL-06, HAL-10, HAL-30, HAL-31 | Ejecutado | Comprueba API sin token, pero no todos los endpoints. |
| CP-SEG-004 | HAL-04, HAL-05, HAL-06, HAL-07, HAL-33, HAL-35 | Ejecutado | No prueba creación de admin por paciente. |
| CP-SEG-005 | HAL-04, HAL-05, HAL-10 | Ejecutado | No prueba cambio de rol por médico. |
| CP-SEG-006 | HAL-01, HAL-08, HAL-14 | **Pendiente** | Debe ejecutarse con dos pacientes y un examen ajeno. |
| CP-SEG-007 | HAL-03, HAL-09, HAL-25, HAL-38 | Ejecutado | Token manipulado; no prueba revocación ni expiración en UI. |
| CP-SEG-008 | HAL-02, HAL-03, HAL-27 | **Falla** | Contraseñas en claro y acceso directo a la BD. |
| CP-SEG-009 | HAL-07 | **Falla** | `/roles` y `/tipo-examen` públicos. |
| CP-SEG-010 | HAL-16, HAL-19 | **Falla** | Sin bloqueo tras 10 intentos. |
| CP-USA-002 | HAL-35 | Ejecutado | No prueba el rol `"administrador"`. |
| CP-USA-003 | HAL-37 | Ejecutado | No verifica el nombre en el diálogo. |

### 3.1 Brechas de cobertura priorizadas

1. **CP-SEG-006 pendiente:** es el caso que verifica el acceso de un paciente a exámenes ajenos; debe ejecutarse antes de emitir cualquier certificación.
2. **Documentos:** ningún caso previo cubre la descarga de documentos por paciente; HAL-20 pasó desapercibido.
3. **Roles:** no se prueba el renombrado ni el borrado de roles; HAL-07 quedó fuera de la suite funcional.
4. **Identidad:** no se prueba la apropiación de ficha por RUT; HAL-08 no tiene caso previo.
5. **Auditoría:** no se prueba la forja ni la inmutabilidad; HAL-16/28 no tienen caso previo.
6. **Frontend:** no se prueba expiración de sesión, zona horaria ni diálogos destructivos.
7. **Despliegue:** no hay caso de build desde clon limpio; HAL-23 bloquea la reproducibilidad.

---

## 4. Casos nuevos propuestos (CP-NUEVO)

| ID | Caso | Hallazgo | Tipo |
|---|---|---|---|
| CP-NUEVO-01 | Acceso anónimo a ficha por RUT y acceso de paciente a ficha ajena | HAL-01 | Seguridad / autorización |
| CP-NUEVO-02 | Eliminación de usuario sin token y con token (verificar 500 y borrado) | HAL-06, HAL-17 | Seguridad / integridad |
| CP-NUEVO-03 | Registro con RUT de un paciente existente sin verificación | HAL-08 | Seguridad / identidad |
| CP-NUEVO-04 | Reutilización de token tras logout, cambio de contraseña y cambio de rol | HAL-09 | Seguridad / sesión |
| CP-NUEVO-05 | TLS, redirección y cabeceras de seguridad | HAL-11 | Seguridad / transporte |
| CP-NUEVO-06 | Forja de un registro de auditoría por un paciente | HAL-16 | Seguridad / auditoría |
| CP-NUEVO-07 | Descarga de documento propio y ajeno por paciente | HAL-20 | Funcional / autorización |
| CP-NUEVO-08 | Documento con examen de un paciente y `paciente_id` de otro | HAL-22 | Integridad clínica |
| CP-NUEVO-09 | `npm audit`, runtime EOL y build reproducible | HAL-25 | SCA / cadena de suministro |
| CP-NUEVO-10 | Carga de `.txt`, archivo > 10 MB y mensaje de error | HAL-26 | Funcional / usabilidad |
| CP-NUEVO-11 | Cifrado en reposo y TLS de la conexión a PostgreSQL | HAL-27 | Seguridad / criptografía |
| CP-NUEVO-12 | Inmutabilidad y retención de auditoría | HAL-28 | Seguridad / auditoría |
| CP-NUEVO-13 | Latencia de endpoints con y sin retardo | HAL-29 | Rendimiento |
| CP-NUEVO-14 | Exposición de Swagger/OpenAPI sin token | HAL-30 | Seguridad / configuración |
| CP-NUEVO-15 | Fuga de detalles internos en errores 500 | HAL-31 | Seguridad / errores |
| CP-NUEVO-16 | Paginación, límites y minimización de listados | HAL-32 | Rendimiento / privacidad |
| CP-NUEVO-17 | Autoeliminación y eliminación del último administrador | HAL-33 | Seguridad / continuidad |
| CP-NUEVO-18 | Rol visible en `GET /usuarios` y en la tabla | HAL-34 | Funcional / usabilidad |
| CP-NUEVO-19 | Acceso de rol `"administrador"` a las pantallas administrativas | HAL-35 | Funcional / autorización |
| CP-NUEVO-20 | Fecha de nacimiento en zonas UTC, Santiago y Tokio | HAL-36 | Funcional / internacionalización |
| CP-NUEVO-21 | Texto del diálogo de eliminación de paciente | HAL-37 | Usabilidad |
| CP-NUEVO-22 | Token expirado en el frontend: limpieza y redirección | HAL-38 | Seguridad / sesión |

---

## 5. Lectura de la matriz

- **Cobertura de hallazgos:** los 38 hallazgos tienen al menos una ubicación, un requisito y un caso (previo o nuevo).
- **Cobertura de requisitos:** todos los RF, NFR y RB citados en EP1 aparecen al menos una vez. La tabla de la sección 2 permite afirmar que el plan de pruebas EP3 cubre el 100 % de los requisitos **documentados y citados**; el ERS completo no estaba disponible (ver limitación en el documento 02).
- **Trazabilidad normativa:** cada hallazgo crítico tiene al menos una ley y un control ISO/OWASP asociado.
- **Retest:** los criterios de aceptación de cada hallazgo (documentos 03-05) se convierten en los casos CP-NUEVO y en los criterios de salida del documento 08.

*Volver al [índice](README.md) · Continuar con [07 — Contraste con los 13 hallazgos previos](07-contraste-hallazgos-previos.md).*
