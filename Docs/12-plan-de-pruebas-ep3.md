# 12 — Plan de pruebas EP3

> **Objetivo.** Definir cómo verificar, en un entorno controlado, que los hallazgos de esta auditoría son reales, qué casos permiten demostrarlo y qué criterios deben cumplirse para declarar el sistema apto. El plan distingue lo **ya ejecutado** (Actividad 2.3.2) de lo **propuesto para el retest**.

**Alcance:** autenticación, autorización, pacientes, exámenes, documentos, usuarios, roles, auditoría, frontend y despliegue.  
**Enfoque:** basado en riesgo, con prioridad en los 8 hallazgos críticos y en los 17 mayores.  
**Duración estimada:** 4 semanas / 24-30 días-persona.

---

## 1. Contexto y punto de partida

La suite previa tenía **32 casos diseñados**, de los cuales se ejecutaron **31** (96,9 %). Aprobaron **28** (90,3 % de los ejecutados), fallaron **3** (CP-SEG-008, CP-SEG-009 y CP-SEG-010) y quedó **1 pendiente** (CP-SEG-006). El dictamen previo fue **NO CERTIFICADO**.

Esta revisión añade 38 hallazgos y 22 casos nuevos (CP-NUEVO-01 a CP-NUEVO-22). El plan EP3 no repite toda la suite: prioriza los casos que demuestran los defectos críticos, los que cubren brechas previas y los que permiten decidir si una corrección es suficiente.

> **Regla de oro:** un caso que solo recorre el flujo feliz no demuestra seguridad. Cada caso de seguridad debe incluir un actor, un recurso ajeno, una intención maliciosa y un resultado esperado de denegación.

---

## 2. Principios del plan

1. **Riesgo primero:** ningún caso de rendimiento o estética se ejecuta antes de los controles de acceso.
2. **Evidencia verificable:** cada ejecución registra commit, entorno, datos, comando, código HTTP y salida.
3. **Independencia:** quien corrige no certifica su propia corrección.
4. **Reproducibilidad:** el entorno se construye desde cero y se destruye al final.
5. **Trazabilidad:** todo caso se conecta con un hallazgo, un requisito y una norma.
6. **Mínimo privilegio en las pruebas:** se usan cuentas sintéticas con el rol estrictamente necesario.
7. **No daño:** no se usan datos reales ni se prueba contra producción.

---

## 3. Tipos de prueba y justificación

| Tipo | Qué verifica | Técnica | Por qué es necesario |
|---|---|---|---|
| **Funcional** | Flujos de registro, login, pacientes, exámenes, documentos y usuarios | Caja negra, particiones de equivalencia, valores límite | Confirma que las correcciones no rompen la operación |
| **Seguridad — autenticación** | Contraseñas, JWT, sesión, logout, expiración, fuerza bruta | Pruebas negativas, manipulación de token, diccionario controlado | Los hallazgos HAL-02, HAL-09, HAL-12 y HAL-19 afectan la identidad |
| **Seguridad — autorización** | Acceso anónimo, IDOR, escalamiento, roles, propiedad del recurso | Matriz de actores × recursos, pruebas con dos cuentas | Explica seis de los ocho hallazgos críticos |
| **Seguridad — entradas y archivos** | Validación, MIME, tamaño, poliglotas, inyección | Fuzzing ligero, archivos malformados, cargas > límite | HAL-18 y HAL-22 permiten abuso de uploads; HAL-26 agrava el manejo de errores |
| **Seguridad — configuración** | TLS, CORS, cabeceras, Swagger, secretos, puertos | Inspección, `testssl.sh`, `curl -I`, escaneo de configuración | HAL-03, HAL-10, HAL-11 y HAL-30 |
| **SCA / cadena de suministro** | Dependencias y runtime | `npm audit`, revisión de versiones, build reproducible | HAL-25; no basta un análisis manual |
| **Rendimiento** | Latencia, throughput, comportamiento bajo carga | `curl -w`, k6, percentiles p50/p95/p99 | HAL-29 introduce 5 s artificiales; HAL-32 agrava listados |
| **Usabilidad y accesibilidad** | Claridad de errores, diálogos destructivos, foco, teclado, lectores | Heurísticas, axe DevTools, Lighthouse, prueba manual | HAL-26, HAL-34, HAL-35, HAL-36 y HAL-37 |
| **Despliegue y compatibilidad** | Build limpio, puertos, variables, navegadores | Clon limpio, `docker compose up`, matriz de navegadores | HAL-23 y HAL-24 impiden reproducir el entorno |
| **Regresión** | Que una corrección no reintroduzca un defecto | Retest dirigido + suite de humo | Cierra el ciclo de HAL-01 a HAL-38 |

### 3.1 Priorización

| Prioridad | Ámbito | Casos | Criterio |
|---|---|---|---|
| **P0** | Acceso anónimo, escalamiento, credenciales, roles | CP-SEG-003, CP-SEG-006, CP-SEG-008, CP-NUEVO-01/02/03/04 | Explotable sin privilegios o con una cuenta básica |
| **P1** | Sesión, auditoría, uploads, configuración | CP-SEG-007/009/010, CP-FUN-013, CP-NUEVO-05/06/07/08 | Requiere una sesión o una condición adicional |
| **P2** | Rendimiento, usabilidad, despliegue | CP-USA-002/003, CP-NUEVO-09/10/13/19/20/21 | Afecta calidad, cumplimiento o disponibilidad |

---

## 4. Criterios de entrada

El plan no comienza hasta que se cumplan **todos** estos criterios:

- [ ] Commit congelado e identificado (`git rev-parse HEAD`).
- [ ] Alcance y autorización por escrito; entorno aislado y sin datos reales.
- [ ] Build reproducible desde un clon limpio o workaround documentado para HAL-23.
- [ ] Base de datos inicializada y verificada (`init.sql` o dump corregido).
- [ ] Cuentas sintéticas: `admin`, `medico`, `paciente`, más dos pacientes de prueba.
- [ ] Al menos un examen y un documento por paciente, con archivos de distintos tipos.
- [ ] Herramientas instaladas y versionadas (sección 6).
- [ ] Copia de seguridad del volumen y procedimiento de reconstrucción.
- [ ] Casos de prueba revisados y aprobados por QA y por el responsable de seguridad.
- [ ] Criterios de salida y plantilla de incidente acordados.

**Si falta un criterio de entrada, el plan se suspende.** Ejecutar sin datos controlados produce resultados no comparables y puede exponer información.

---

## 5. Criterios de salida

Para declarar el sistema **apto para certificación** deben cumplirse:

| Criterio | Umbral |
|---|---|
| Casos P0 ejecutados | 100 % |
| Casos P1 ejecutados | 100 % |
| Casos P2 ejecutados | ≥ 90 % |
| Hallazgos críticos abiertos | **0** |
| Hallazgos mayores abiertos | **0** (o aceptación formal con compensating controls) |
| Hallazgos medios y menores | Plan de cierre con responsable y fecha |
| Retest de los 38 hallazgos | 100 % con evidencia |
| Casos aprobados sobre ejecutados | ≥ 95 % |
| Cobertura de trazabilidad | 100 % (hallazgo ↔ caso ↔ requisito ↔ norma) |
| Regresiones críticas | 0 |
| Evidencia archivada | 100 % de los casos ejecutados |

### 5.1 Suspensión y reanudación

| Situación | Acción |
|---|---|
| El build no levanta o la base queda inconsistente | Suspender; corregir HAL-23/HAL-24; reiniciar desde cero |
| Se detecta acceso a datos reales | Detener de inmediato; notificar al responsable de privacidad |
| Un caso crítico produce un incidente de seguridad | Contener, preservar evidencia, rotar secretos, reanudar con autorización |
| El entorno se corrompe | Reconstruir desde el commit y repetir el caso |
| Cambia el código durante la ejecución | Congelar de nuevo y reiniciar la suite afectada |

---

## 6. Entorno y herramientas

### 6.1 Infraestructura

| Componente | Especificación mínima |
|---|---|
| CPU / RAM | 4 vCPU / 8 GB |
| Disco | 20 GB libres |
| Sistema | Windows 11, Linux o macOS con Docker Desktop/Engine |
| Docker Compose | v2 |
| Navegadores | Chrome/Edge actual, Firefox ESR |
| Red | Aislada; sin salida a producción |
| Pantalla móvil | Emulación 360 × 640 para CP-USA |

### 6.2 Servicios y puertos

| Servicio | Puerto host | Puerto interno | Verificación |
|---|---:|---:|---|
| Frontend (nginx) | 3333 | 80 | `curl -I http://localhost:3333` |
| Backend | 4444 | 4000 | `curl http://localhost:4444/` |
| PostgreSQL | 15442 | 5432 | `pg_isready` / `psql` |
| Swagger | 4444 | 4000 | `GET /docs` (debe estar restringido) |

### 6.3 Datos de prueba

- Usuarios seeds: `admin/admin`, `medico/medico`, `paciente/paciente` (solo para el entorno aislado; nunca en producción).
- Dos pacientes sintéticos con RUT ficticios y fichas completas.
- Un examen por paciente, con diagnóstico y tratamiento ficticios.
- Un documento PDF, un JPG y un PNG por examen.
- Un archivo `.txt`, un archivo de 11 MB y un archivo con doble extensión para pruebas negativas.
- Un usuario descartable para probar borrado y auditoría.

### 6.4 Herramientas

| Herramienta | Uso | Estado |
|---|---|---|
| Git / GitHub | Control de versión y evidencia | Disponible |
| Node.js / npm | Sintaxis, scripts y SCA | Disponible |
| `npm audit` | Dependencias | **Ejecutado** |
| Docker Compose | Despliegue | Disponible; build pendiente por HAL-23 |
| `psql` | Verificación directa de datos | Disponible |
| `curl` | Pruebas HTTP y reproducibilidad | Disponible |
| Postman / Newman | Colecciones y ejecución automatizada | Propuesto |
| Playwright o Cypress | Regresión E2E | Propuesto |
| OWASP ZAP | DAST y fuzzing | Propuesto; no ejecutado |
| `testssl.sh` | TLS y cifrados | Propuesto; no ejecutado |
| k6 | Carga y latencia | Propuesto; no ejecutado |
| axe DevTools / Lighthouse | Accesibilidad y usabilidad | Propuesto |
| Editor Markdown / hoja de cálculo | Bitácora y métricas | Disponible |

> **Honestidad metodológica:** solo `npm audit`, `node --check`, `git` y lectura de código se ejecutaron en esta evaluación. Las herramientas marcadas como “propuesto” pertenecen al retest, no a la evidencia actual.

---

## 7. Roles y responsabilidades

| Rol | Responsabilidad |
|---|---|
| **Líder de QA** | Plan, casos, métricas, criterios de salida y comunicación |
| **Responsable de seguridad** | Revisión de casos de autorización, triaje de incidentes, aprobación de cierre |
| **Desarrollador backend** | Correcciones de rutas, validación, transacciones y auditoría |
| **Desarrollador frontend** | Guards, sesión, mensajes, fechas y accesibilidad |
| **DBA / DevOps** | Build, base de datos, secretos, TLS y respaldo |
| **Product Owner / referente clínico** | Priorización, aceptación de riesgo y validación funcional |
| **Referente de privacidad** | Cumplimiento legal, datos de prueba y gestión de incidentes |

**Independencia:** el desarrollador que corrige un hallazgo no firma su propio retest. El cierre requiere evidencia y aprobación de QA o seguridad.

---

## 8. Cronograma

| Semana | Fechas (2026) | Actividades | Entregable |
|---|---|---|---|
| 1 | 22-28 oct | Congelamiento, entorno, build, datos, humo, SCA | Entorno reproducible y línea base |
| 2 | 29 oct - 4 nov | P0: acceso anónimo, IDOR, escalamiento, roles, credenciales | Incidentes críticos y evidencia |
| 3 | 5-11 nov | P1: sesión, uploads, auditoría, configuración; P2: rendimiento y usabilidad | Resultados por caso |
| 4 | 12-18 nov | Retest, regresión, métricas, informe y revisión independiente | Informe EP3 y dictamen |

**Hitos:**

- **H1 (fin semana 1):** build limpio y suite de humo aprobada.
- **H2 (fin semana 2):** todos los P0 ejecutados; 0 críticos sin decisión.
- **H3 (fin semana 3):** P1 y P2 ejecutados; incidentes triados.
- **H4 (fin semana 4):** retest completo y dictamen firmado.

---

## 9. Métricas

| Métrica | Fórmula | Meta |
|---|---|---|
| Cobertura de ejecución | ejecutados / diseñados | ≥ 95 % |
| Tasa de aprobación | aprobados / ejecutados | ≥ 95 % |
| Densidad de defectos | hallazgos / módulo | Tendencia decreciente |
| Críticos abiertos | conteo | 0 |
| Mayores abiertos | conteo | 0 |
| Tiempo medio de corrección (MTTR) | suma de días / defectos cerrados | Crítico ≤ 7 días |
| Cobertura de trazabilidad | hallazgos con caso / total | 100 % |
| Completitud de evidencia | casos con evidencia / ejecutados | 100 % |
| Regresiones | casos que vuelven a fallar | 0 críticas |

Los resultados se registran por caso y por hallazgo. Un porcentaje alto de aprobación no compensa un crítico abierto: el dictamen se basa en el riesgo residual, no en el promedio.

---

## 10. Casos representativos

Se presentan ocho casos que cubren los tipos exigidos: funcional, seguridad, rendimiento, usabilidad y despliegue. Los 22 casos nuevos completos están en la [matriz de trazabilidad](06-matriz-trazabilidad.md#4-casos-nuevos-propuestos-cp-nuevo).

### 10.1 CP-FUN-001 — Humo funcional y despliegue

| Campo | Detalle |
|---|---|
| **Tipo** | Funcional / despliegue |
| **Objetivo** | Verificar que el sistema se construye y que los flujos básicos operan tras una instalación limpia |
| **Precondiciones** | Clon limpio; Docker disponible; `BACKEND/uploads` creado o HAL-23 corregido |
| **Datos** | Seeds `admin`, `medico`, `paciente`; un paciente sintético |
| **Pasos** | 1. `docker compose up -d --build`.<br>2. Esperar healthcheck.<br>3. Abrir frontend en `3333`.<br>4. Iniciar sesión como admin.<br>5. Crear un paciente.<br>6. Crear un examen.<br>7. Cerrar sesión. |
| **Resultado esperado** | Stack levantado; login exitoso; paciente y examen creados; logout limpio |
| **Resultado previo** | **Aprueba** en la suite 2.3.2 (16/16 funcionales) |
| **Estado** | Ejecutado previamente; repetir en el retest |
| **Evidencia** | Captura de `docker compose ps`, códigos HTTP y registro del paciente |
| **Trazabilidad** | HAL-23, HAL-24, HAL-29; RF-1.1, RF-3.1, RF-4.1; CP-NUEVO-09 |
| **Criterio de aceptación** | Build reproducible y flujo completo sin errores 500 |

> **Observación:** la suite previa se ejecutó sin build Docker limpio. Si el retest usa el repositorio tal como está, el paso 1 falla por `COPY uploads/` (HAL-23). El caso debe registrar esa falla como bloqueo, no como aprobación.

### 10.2 CP-FUN-013 — Carga de archivo no permitido

| Campo | Detalle |
|---|---|
| **Tipo** | Funcional / seguridad de entradas |
| **Objetivo** | Verificar que el servidor rechaza un `.txt` con un mensaje específico y sin traza interna |
| **Precondiciones** | Sesión de médico; examen y paciente sintéticos |
| **Datos** | `prueba.txt` de 1 KB; `grande.bin` de 11 MB; archivo con doble extensión |
| **Pasos** | 1. Subir `prueba.txt`.<br>2. Subir `grande.bin`.<br>3. Subir un PDF válido como control.<br>4. Revisar el mensaje en la UI y la respuesta HTTP. |
| **Resultado esperado** | `.txt` → `400` con mensaje; 11 MB → `413`; PDF → `201`; sin HTML ni SQL |
| **Resultado previo** | **Observación:** el `.txt` no mostró un mensaje específico |
| **Estado** | Ejecutado con observación; se repite en el retest |
| **Evidencia** | Código HTTP, cuerpo de respuesta y captura del toast |
| **Trazabilidad** | HAL-18, HAL-26; RF-4.3; CP-NUEVO-10 |
| **Criterio de aceptación** | Mensaje claro, código correcto y ausencia de detalles internos |

### 10.3 CP-SEG-003 — Acceso sin token a endpoints sensibles

| Campo | Detalle |
|---|---|
| **Tipo** | Seguridad / autenticación |
| **Objetivo** | Verificar que ningún endpoint sensible responde con datos sin token |
| **Precondiciones** | Base con datos sintéticos; sin cabecera `Authorization` |
| **Datos** | RUT sintético; IDs de pacientes, exámenes, documentos, usuarios y roles |
| **Pasos** | 1. `GET /pacientes/buscar/rut/:rut`.<br>2. `GET /roles`.<br>3. `GET /tipo-examen`.<br>4. `DELETE /usuarios/:id` sobre un usuario descartable.<br>5. `GET /docs` y `GET /openapi.json`.<br>6. Registrar códigos y cuerpos. |
| **Resultado esperado** | `401` en datos clínicos y usuarios; `403` donde corresponda; Swagger restringido |
| **Resultado previo** | **Aprueba parcialmente:** no recorrió todos los endpoints |
| **Estado** | Ejecutado parcialmente; ampliar en el retest |
| **Evidencia** | Matriz de 6 solicitudes con código y cuerpo |
| **Trazabilidad** | HAL-01, HAL-06, HAL-07, HAL-30; RB-1, RB-2; CP-NUEVO-01/14 |
| **Criterio de aceptación** | Ningún dato clínico ni función administrativa sin autenticación |

### 10.4 CP-SEG-006 — Paciente accede a un examen ajeno

| Campo | Detalle |
|---|---|
| **Tipo** | Seguridad / autorización (IDOR) |
| **Objetivo** | Verificar que un paciente no puede leer ni descargar exámenes de otro |
| **Precondiciones** | Dos pacientes con usuario; un examen y un documento por paciente |
| **Datos** | Token del paciente A; ID del examen y documento del paciente B |
| **Pasos** | 1. Login como paciente A.<br>2. `GET /examenes/:id_b`.<br>3. `GET /examenes/paciente/:id_b`.<br>4. `GET /documentos/examen/:examen_b`.<br>5. `GET /documentos/:doc_b`.<br>6. Repetir con el recurso propio como control. |
| **Resultado esperado** | `403/404` en recursos ajenos; `200` en el propio |
| **Resultado previo** | **Pendiente** (sin resultado registrado) |
| **Estado** | **Debe ejecutarse antes de cualquier certificación** |
| **Evidencia** | Dos sesiones, cuatro solicitudes ajenas, dos controles propios |
| **Trazabilidad** | HAL-01, HAL-08, HAL-14, HAL-20; RB-1, RB-3; CP-NUEVO-01/07 |
| **Criterio de aceptación** | Ningún acceso cruzado; el control propio sí funciona |

> **Nota:** el código de `GET /examenes/:id` filtra por `paciente_id`, pero `GET /documentos/:id` falla por la comparación de tipos (HAL-20). El caso debe separar ambos resultados: aprobar exámenes no implica aprobar documentos.

### 10.5 CP-SEG-008 — Contraseñas y acceso directo a la base

| Campo | Detalle |
|---|---|
| **Tipo** | Seguridad / criptografía y almacenamiento |
| **Objetivo** | Verificar que las contraseñas no son legibles y que la base no está expuesta |
| **Precondiciones** | Stack levantado; acceso al host de prueba |
| **Datos** | Consulta a `usuarios`; intento de conexión a `15442` |
| **Pasos** | 1. `SELECT nombre_usuario, contrasena FROM usuarios`.<br>2. Verificar formato del valor.<br>3. Intentar `psql` desde el host.<br>4. Revisar `docker compose config` en busca de credenciales por defecto. |
| **Resultado esperado** | Hash con salt; conexión rechazada o autenticada con usuario mínimo; sin defaults |
| **Resultado previo** | **Falla:** contraseñas legibles y base accesible |
| **Estado** | Ejecutado y fallido; bloquea la certificación |
| **Evidencia** | Salida de `psql`, `docker compose config` y `git grep` de secretos |
| **Trazabilidad** | HAL-02, HAL-03, HAL-27; NFR-SEG-1/8; CP-NUEVO-11 |
| **Criterio de aceptación** | `argon2id`/`bcrypt`; puerto no publicado; secretos rotados |

### 10.6 CP-USA-003 — Diálogo de eliminación de paciente

| Campo | Detalle |
|---|---|
| **Tipo** | Usabilidad / accesibilidad |
| **Objetivo** | Verificar que el diálogo identifica correctamente al paciente antes de una acción destructiva |
| **Precondiciones** | Sesión de admin; al menos dos pacientes con nombres similares |
| **Datos** | Paciente con nombre y apellido; paciente sin apellido materno |
| **Pasos** | 1. Abrir Pacientes.<br>2. Pulsar eliminar en la primera fila.<br>3. Leer el texto.<br>4. Cancelar.<br>5. Repetir con el segundo paciente.<br>6. Navegar con teclado y lector de pantalla. |
| **Resultado esperado** | Nombre completo y RUT; sin `undefined`; foco atrapado; cancelación segura |
| **Resultado previo** | **Aprueba** en la suite previa, pero no verificaba el texto |
| **Estado** | Ejecutado con cobertura insuficiente; repetir con HAL-37 |
| **Evidencia** | Captura del diálogo y texto anunciado |
| **Trazabilidad** | HAL-37; RF-4.1; NFR-USAB-1; WCAG 2.1; CP-NUEVO-21 |
| **Criterio de aceptación** | Texto correcto, sin ambigüedad y accesible |

### 10.7 CP-NUEVO-13 — Latencia artificial

| Campo | Detalle |
|---|---|
| **Tipo** | Rendimiento |
| **Objetivo** | Cuantificar el impacto del retardo de 5 s y establecer una línea base |
| **Precondiciones** | Stack estable; token de admin; datos sintéticos |
| **Datos** | 30 solicitudes a `GET /pacientes`, `GET /examenes` y `POST /documentos` |
| **Pasos** | 1. Ejecutar 30 solicitudes secuenciales.<br>2. Registrar `time_total`.<br>3. Calcular p50, p95 y p99.<br>4. Repetir con `delay.js` desactivado en una rama de prueba.<br>5. Comparar. |
| **Resultado esperado** | Sin retardo: p95 < 500 ms en local; con retardo: ~5 s |
| **Resultado previo** | No ejecutado |
| **Estado** | Propuesto |
| **Evidencia** | CSV de tiempos y gráfico de percentiles |
| **Trazabilidad** | HAL-29, HAL-32; NFR-PERF-1; CP-NUEVO-16 |
| **Criterio de aceptación** | El retardo se elimina o se justifica; p95 dentro del objetivo |

### 10.8 CP-NUEVO-09 — Dependencias, runtime y build reproducible

| Campo | Detalle |
|---|---|
| **Tipo** | SCA / despliegue |
| **Objetivo** | Verificar que el sistema se construye desde cero y que las dependencias están soportadas |
| **Precondiciones** | Clon limpio; acceso a registry; sin caché local |
| **Datos** | `package-lock.json` de backend y frontend; `Dockerfile` |
| **Pasos** | 1. `npm ci` en ambos proyectos.<br>2. `npm audit --json`.<br>3. `docker compose build --no-cache`.<br>4. `docker compose up -d`.<br>5. Verificar versión de Node dentro de la imagen.<br>6. Repetir el build en otra máquina. |
| **Resultado esperado** | Build exitoso; 0 críticas; runtime soportado; mismo resultado en ambas máquinas |
| **Resultado previo** | `npm audit`: 13 backend / 29 frontend; build no probado |
| **Estado** | SCA ejecutado; build pendiente |
| **Evidencia** | Salida de `npm audit`, `docker build` y `node -v` en el contenedor |
| **Trazabilidad** | HAL-23, HAL-25; NFR-SEG, NFR-COMPAT; CP-NUEVO-09 |
| **Criterio de aceptación** | Build reproducible; sin críticas; Node 22/24 LTS |

---

## 11. Resumen de ejecución previa

| Categoría | Diseñados | Ejecutados | Aprueban | Fallan | Pendientes |
|---|---:|---:|---:|---:|---:|
| Funcional (FUN) | 16 | 16 | 16 | 0 | 0 |
| Seguridad (SEG) | 10 | 9 | 6 | 3 | 1 |
| Usabilidad (USA) | 6 | 6 | 6 | 0 | 0 |
| **Total** | **32** | **31** | **28** | **3** | **1** |

**Lectura:**

- La funcionalidad básica está cubierta y aprobada; el problema no es que el sistema “no funcione”, sino que funciona sin los controles de seguridad necesarios.
- Los 3 fallos de seguridad son CP-SEG-008 (contraseñas/base), CP-SEG-009 (roles/catálogos) y CP-SEG-010 (fuerza bruta).
- CP-SEG-006 sigue pendiente y es el caso que verifica el acceso a datos clínicos ajenos.
- La suite previa no cubrió: acceso anónimo por RUT, creación de admin por paciente, autoascenso de médico, forja de auditoría, documentos propios, ZIP/políglota, TLS, Swagger, paginación, fechas y diálogos destructivos.

---

## 12. Gestión de incidentes

### 12.1 Plantilla

```text
INC-2026-NNN
Título:            [resumen en una línea]
Hallazgo:          HAL-xx / CP-xxx
Severidad:         Crítica | Mayor | Media | Menor
Entorno:           commit, sistema, navegador, contenedor
Precondiciones:    datos y sesión necesarios
Pasos:             1. ... 2. ... 3. ...
Resultado esperado:
Resultado obtenido:
Evidencia:         archivo, captura, código HTTP, log
Impacto:           técnico, clínico, legal, reputacional
Causa probable:
Responsable:
Estado:            Nuevo | En triaje | En corrección | Listo para retest | Cerrado | Reabierto | Aceptado con riesgo
Retest:            fecha, commit, resultado
```

### 12.2 Ejemplo

```text
INC-2026-001
Título: Ficha clínica accesible sin autenticación por RUT
Hallazgo: HAL-01 / CP-NUEVO-01
Severidad: Crítica
Entorno: main@e021d8f, Docker local, Chrome 141
Precondiciones: paciente sintético con RUT 11.111.111-1
Pasos: GET /pacientes/buscar/rut/11.111.111-1 sin Authorization
Resultado esperado: 401
Resultado obtenido: 200 con ficha completa
Evidencia: salida de curl y JSON (datos sintéticos)
Impacto: exposición de datos de salud; incumplimiento Ley 19.628/20.584
Causa probable: ruta sin middleware de autenticación
Responsable: Backend Lead
Estado: Nuevo
Retest: pendiente de corrección
```

### 12.3 Ciclo de vida y plazos

| Severidad | Contención | Corrección | Retest |
|---|---|---|---|
| Crítica | ≤ 24 h | ≤ 7 días | ≤ 48 h tras el fix |
| Mayor | ≤ 72 h | ≤ 30 días | ≤ 5 días |
| Media | ≤ 10 días | ≤ 60 días | ≤ 10 días |
| Menor | ≤ 30 días | ≤ 90 días | ≤ 15 días |

Un incidente solo se cierra con evidencia de retest en el commit corregido. “Se cambió el código” no es un cierre.

---

## 13. Trazabilidad del plan

| Tipo de prueba | Casos representativos | Hallazgos | Requisitos |
|---|---|---|---|
| Funcional | CP-FUN-001, CP-FUN-013 | HAL-18, HAL-23, HAL-24, HAL-26 | RF-1, RF-3, RF-4 |
| Seguridad / autenticación | CP-SEG-003, CP-SEG-008 | HAL-01, HAL-02, HAL-03, HAL-06, HAL-07, HAL-30 | NFR-SEG-1/8/9 |
| Seguridad / autorización | CP-SEG-006 | HAL-01, HAL-08, HAL-14, HAL-20 | RB-1, RB-3, NFR-SEG-4 |
| Rendimiento | CP-NUEVO-13 | HAL-29, HAL-32 | NFR-PERF-1 |
| Usabilidad | CP-USA-003 | HAL-37 | NFR-USAB-1, WCAG 2.1 |
| Despliegue / SCA | CP-NUEVO-09 | HAL-23, HAL-25 | NFR-DIS, NFR-COMPAT |
| Regresión | Retest de HAL-01 a HAL-38 | Todos | Todos |

La matriz completa, con los 38 hallazgos y los 22 casos nuevos, está en [06 — Matriz de trazabilidad](06-matriz-trazabilidad.md). El plan de corrección y los criterios de cierre están en [08 — Plan de acción recomendado](08-plan-de-accion-recomendado.md).

---

## 14. Riesgos del propio plan

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El build no levanta por HAL-23 | Alta | Alto | Workaround documentado o corrección previa |
| Datos de prueba contaminados | Media | Alto | Reconstruir el volumen por caso crítico |
| Falta de independencia | Media | Alto | QA/seguridad firma el retest |
| Tiempo insuficiente para 54 casos | Alta | Medio | Priorizar P0/P1 y muestrear P2 |
| Falsos positivos de SCA | Media | Medio | Validar explotabilidad, no solo el aviso |
| Presión para certificar sin CP-SEG-006 | Media | Crítico | Criterio de salida no negociable |
| Exposición accidental de datos | Baja | Crítico | Entorno aislado y datos sintéticos |

---

## 15. Aprobación

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Líder de QA | | | |
| Responsable de seguridad | | | |
| DBA / DevOps | | | |
| Product Owner | | | |
| Referente de privacidad | | | |

**Condición de aprobación:** el plan se aprueba con los criterios de entrada y salida de las secciones 4 y 5. Cualquier excepción debe documentarse como riesgo aceptado, con responsable y fecha de revisión.

---

## 16. Conclusión

El plan EP3 combina lo que ya se demostró con lo que falta demostrar. La suite previa aprobó 28 casos, pero dejó abiertos tres fallos de seguridad y un caso crítico sin ejecutar. Esta revisión añade 38 hallazgos y 22 casos nuevos; los ocho casos representativos de este documento permiten verificar las causas principales sin esperar a agotar la lista completa.

La decisión de certificación no depende de ejecutar más casos felices, sino de cerrar los críticos y demostrar, con evidencia, que un atacante sin privilegios ya no puede leer una ficha, crear un administrador, cambiar un rol ni borrar un usuario.

---

*Volver al [índice](README.md) · Ver [11 — Inventario de revisión](11-inventario-revision.md) · Consultar [08 — Plan de acción recomendado](08-plan-de-accion-recomendado.md).*
