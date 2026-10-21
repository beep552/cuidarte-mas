# 02 — Metodología y criterios de evaluación

## 1. Objetivo metodológico

Determinar, con evidencia verificable, si Cuidarte+ cumple los criterios de calidad, seguridad y cumplimiento normativo declarados en el ERS y en la Actividad 2.2.2, e identificar las brechas que impiden su certificación. La revisión combina **análisis estático manual**, **trazabilidad de requisitos**, **análisis de dependencias** y **contraste con la ejecución previa** documentada en la Actividad 2.3.2.

---

## 2. Preguntas de auditoría

La revisión se organizó alrededor de ocho preguntas:

1. ¿Puede un usuario no autenticado acceder a datos o funciones críticas?
2. ¿Puede un usuario autenticado elevar sus privilegios o los de otro?
3. ¿Se protege la confidencialidad, integridad y disponibilidad de los datos clínicos?
4. ¿Las credenciales y los secretos se almacenan y gestionan de forma segura?
5. ¿La auditoría permite reconstruir quién hizo qué, cuándo y con qué resultado?
6. ¿Las entradas y archivos se validan en el servidor?
7. ¿El sistema es desplegable, reproducible y observable?
8. ¿Se cumplen las obligaciones legales y los estándares adoptados?

Cada hallazgo debe responder al menos una de estas preguntas y citar la evidencia que lo sustenta.

---

## 3. Fuentes de evidencia

| Fuente | Uso | Ubicación |
|---|---|---|
| Código fuente backend | Rutas, middleware, validaciones, consultas, auditoría | `BACKEND/src/**` (18 archivos JS) |
| Código fuente frontend | Guards, contexto de autenticación, formularios, manejo de errores | `FRONTEND/src/**` (38 archivos JS/JSX) |
| Esquema y datos | Tablas, tipos, restricciones, seeds | `BACKEND/sql/init.sql`, `dump-cuidarteplus.sql`, `init-db.sh` |
| Contenedores | Build, puertos, variables, volúmenes | `docker-compose.yml`, `BACKEND/Dockerfile`, `FRONTEND/Dockerfile`, `nginx.conf` |
| Configuración | Secretos, URLs, entorno | `.env`, `BACKEND/.env`, `FRONTEND/.env`, `README.md` |
| Documento de requerimientos | RF, NFR, RB, restricciones | EP1 y referencias del ERS citadas en EP1 |
| Casos de prueba | Cobertura, resultados, defectos | Actividad 2.2.2 (diseño) y 2.3.2 (ejecución) |
| Certificación previa | Dictamen, criterios, antecedentes | Actividad 2.4.2 |
| Dependencias | Vulnerabilidades conocidas | `npm audit --json` (backend y frontend), evidencia en documento 10 |

---

## 4. Proceso de revisión

### 4.1 Fase 1 — Inventario y reconocimiento

Se identificaron los puntos de entrada (rutas Express), los actores (admin, médico, paciente, anónimo), los activos (credenciales, fichas, exámenes, documentos, auditoría, roles) y las fronteras de confianza (navegador → API → PostgreSQL; contenedor → host). Se revisaron los archivos de configuración y el historial de archivos versionados (`git ls-files`).

### 4.2 Fase 2 — Revisión estática dirigida

Para cada ruta se verificó:

- **Autenticación:** ¿se valida el token? ¿se distingue ausencia de token de token inválido?
- **Autorización:** ¿se verifica el rol y la propiedad del recurso? ¿se consulta el rol en base de datos o se confía en el JWT?
- **Validación:** ¿se valida el esquema? ¿se reasigna el objeto validado? ¿se permiten campos no declarados?
- **Persistencia:** ¿se usan consultas parametrizadas? ¿hay transacciones? ¿se respetan los tipos?
- **Auditoría:** ¿se registra la acción? ¿con qué identidad? ¿es forjable?
- **Errores:** ¿se filtran detalles internos? ¿se mantiene la coherencia transaccional?
- **Configuración:** CORS, TLS, cabeceras, secretos, puertos, límites.

### 4.3 Fase 3 — Contraste con casos y requisitos

Cada hallazgo se cruzó con:

- Los requerimientos funcionales (RF-1 a RF-5), no funcionales (NFR-SEG, NFR-PERF, NFR-USAB, NFR-DIS, NFR-COMPAT) y reglas de negocio (RB-1 a RB-3) citados en EP1.
- Los casos CP-FUN, CP-SEG y CP-USA de la Actividad 2.2.2.
- Los resultados de la Actividad 2.3.2.
- El dictamen y los criterios de la Actividad 2.4.2.

### 4.4 Fase 4 — Análisis de dependencias

Se ejecutó `npm audit` sobre los lockfiles de backend y frontend. Se registraron severidad, paquete afectado y rango. Los resultados se interpretan como **riesgo de cadena de suministro**: no todos los avisos son explotables en el flujo de Cuidarte+, pero todos exigen revisión y actualización.

### 4.5 Fase 5 — Clasificación y documentación

Cada hallazgo recibió:

- Identificador único (`HAL-xx`).
- Severidad según la rúbrica de la sección 5.
- CWE y categoría OWASP.
- Ubicación exacta (`archivo:línea`).
- Código o configuración relevante.
- Reproducción paso a paso.
- Impacto técnico, clínico, legal y reputacional.
- Causa raíz.
- Recomendación y criterio de retest.
- Trazabilidad a requisitos, casos, normas y secciones EP3.

### 4.6 Fase 6 — Control de calidad interno

Se verificó:

- Que cada hallazgo tuviera al menos una ubicación verificable.
- Que las líneas citadas existieran en el estado del repositorio.
- Que las recomendaciones fueran accionables y no contradijeran otras.
- Que los conteos de severidad cuadraran con el total.
- Que los 13 hallazgos previos estuvieran mapeados.
- Que las afirmaciones dinámicas se distinguieran de las estáticas.

---

## 5. Criterios de severidad

La severidad es una decisión de **riesgo de negocio y de derechos**, no solo una métrica técnica. Se usó la siguiente rúbrica:

### 5.1 Crítica

**Definición:** el defecto permite, por sí solo o con una acción trivial, acceso no autorizado a datos clínicos, suplantación de identidad, escalamiento a administrador o compromiso de la base de datos/secretos.

**Criterios de inclusión (al menos uno):**

- Ejecutable sin autenticación.
- Permite obtener o modificar datos de salud de terceros.
- Permite crear o convertirse en administrador.
- Expone secretos que permiten forjar sesiones o acceder a la base.
- Destruye datos o cuentas sin control.

**Ejemplos:** HAL-01, HAL-02, HAL-03, HAL-04, HAL-05, HAL-06, HAL-07, HAL-08.

### 5.2 Mayor

**Definición:** requiere una sesión válida de bajo privilegio, o rompe un requisito principal de seguridad, integridad, disponibilidad o trazabilidad sin llegar al compromiso total.

**Criterios de inclusión:**

- Un usuario autenticado puede afectar a otro o a un recurso que no le pertenece.
- La autenticación o autorización es débil pero no inexistente.
- Se incumple un NFR de seguridad relevante.
- Se pierde integridad o auditabilidad de forma sistemática.
- El sistema no se puede desplegar o inicializar de forma confiable.

**Ejemplos:** HAL-09 a HAL-25.

### 5.3 Media

**Definición:** impacto limitado, defensa en profundidad, rendimiento o cumplimiento; requiere condiciones adicionales o afecta la experiencia de forma significativa.

**Criterios de inclusión:**

- No permite por sí solo un compromiso total.
- Afecta un atributo de calidad relevante (rendimiento, usabilidad, mantenibilidad).
- Es una brecha de cumplimiento que requiere mitigación, pero no exposición inmediata.
- Su explotación depende de otra vulnerabilidad o de acceso físico/local.

**Ejemplos:** HAL-26 a HAL-29.

### 5.4 Menor

**Definición:** defecto acotado de interfaz, consistencia, documentación o higiene técnica; no otorga privilegios ni compromete datos por sí solo.

**Criterios de inclusión:**

- Mensajes confusos, datos mal formateados, columnas vacías.
- Inconsistencias de rol o de UI.
- Exposición de documentación que no contiene secretos.
- Deuda técnica sin impacto directo en seguridad.

**Ejemplos:** HAL-30 a HAL-38.

### 5.5 Regla de no compensación

Un hallazgo crítico **no se degrada** porque existan controles compensatorios parciales. Por ejemplo, aunque el frontend oculte un botón, si el endpoint carece de autorización, el hallazgo sigue siendo crítico. Del mismo modo, un 403 en la UI no sustituye un 403 en el backend.

---

## 6. Criterios de confirmación

| Resultado | Criterio | Ejemplo |
|---|---|---|
| **Confirmado** | El código o la configuración evidencian el comportamiento; la ruta y la línea son verificables. | HAL-01: la ruta no invoca ningún middleware de autenticación. |
| **Confirmado con ajuste** | El comportamiento existe, pero la severidad o el alcance difieren de la hipótesis inicial. | HAL-07: se eleva a crítico por el renombrado de roles. |
| **Dividido** | La hipótesis agrupa defectos con causas o remediaciones distintas. | F13 se divide en HAL-03, HAL-09, HAL-10, HAL-11, HAL-30 y HAL-31. |
| **No confirmado** | La hipótesis no se sostiene tras revisar el código. | SQL injection: las consultas usan parámetros. |
| **Fuera de alcance** | Requiere infraestructura, datos o sistemas no disponibles. | Controles de red perimetral, WAF, SIEM. |

---

## 7. Niveles de evidencia

| Nivel | Descripción | Uso en este informe |
|---|---|---|
| **E1 — Código** | Lectura directa de la implementación y de la configuración. | Base de todos los hallazgos. |
| **E2 — Ejecución previa** | Resultado documentado en la Actividad 2.3.2. | HAL-02 (CP-SEG-008), HAL-07/HAL-19 (CP-SEG-009/010), HAL-18/HAL-26 (CP-FUN-013). |
| **E3 — Dependencias** | `npm audit` y versiones de runtime. | HAL-25. |
| **E4 — Documental** | ERS, EP1, criterios de certificación. | Trazabilidad y severidad. |
| **E5 — Inferencia** | Razonamiento sobre el comportamiento probable, sin ejecución. | Se marca explícitamente como “con reserva” cuando aplica. |

No se presentan como ejecutados los hallazgos que solo tienen evidencia E1. Las recetas de reproducción del documento 10 permiten convertir E1 en E2 en un entorno aislado.

---

## 8. Criterios de calidad y seguridad utilizados

### 8.1 Seguridad

- **OWASP Top 10 2021:** A01 Broken Access Control, A02 Cryptographic Failures, A03 Injection, A04 Insecure Design, A05 Security Misconfiguration, A06 Vulnerable and Outdated Components, A07 Identification and Authentication Failures, A08 Software and Data Integrity Failures, A09 Security Logging and Monitoring Failures, A10 Server-Side Request Forgery.
- **OWASP ASVS 4.0:** autenticación (V2), gestión de sesiones (V3), control de acceso (V4), validación (V5), criptografía (V6), errores y logging (V7), protección de datos (V8), comunicaciones (V9), archivos (V12), API (V13).
- **CWE/SANS Top 25:** CWE-306, CWE-862, CWE-269, CWE-256, CWE-798, CWE-434, CWE-307, CWE-209, CWE-778, entre otros.
- **ISO/IEC 27001:2022:** controles de acceso, criptografía, seguridad de las comunicaciones, registro y monitoreo, gestión de incidentes, seguridad en el desarrollo.

### 8.2 Calidad

- **ISO/IEC 25010:2011/2023:** seguridad, fiabilidad, eficiencia de desempeño, usabilidad, mantenibilidad, portabilidad.
- **ISO/IEC 29119:** procesos, documentación y técnicas de prueba.
- **IEEE 829:** estructura de documentación de pruebas.
- **WCAG 2.1:** accesibilidad, especialmente en formularios y mensajes de error.

### 8.3 Cumplimiento normativo chileno

- **Ley N.º 19.628** sobre protección de la vida privada y datos personales.
- **Ley N.º 21.719** que modifica la Ley 19.628 y crea la Agencia de Protección de Datos Personales (vigencia y obligaciones progresivas).
- **Ley N.º 20.584** que regula los derechos y deberes de los pacientes, incluida la reserva de la ficha clínica.
- **Ley N.º 21.663** Marco de Ciberseguridad e Infraestructura Crítica de la Información.

La matriz de cumplimiento y el análisis ético se desarrollan en [09 — Riesgos y cumplimiento normativo](09-riesgos-y-cumplimiento.md).

---

## 9. Método de trazabilidad

Cada hallazgo se vincula mediante cuatro ejes:

1. **Eje técnico:** archivo, línea, función, consulta, configuración.
2. **Eje de requisitos:** RF, NFR o RB del ERS.
3. **Eje de pruebas:** CP-FUN, CP-SEG o CP-USA; si no existe cobertura, se propone un caso nuevo.
4. **Eje normativo/EP3:** ley, estándar y sección del informe EP3.

La matriz completa está en [06 — Matriz de trazabilidad](06-matriz-trazabilidad.md). Las relaciones se expresan como:

```
HAL-01 → pacientes.js:249-273 → RF-4.1/RF-4.2, RB-1, NFR-SEG-4/8 → CP-SEG-003/006 + CP-NUEVO-01 → Ley 19.628/20.584 → EP3 §6/§7
```

---

## 10. Límites y validez

### 10.1 Lo que la revisión sí permite afirmar

- Que los defectos descritos existen en el código y la configuración revisados.
- Que las rutas y líneas citadas son verificables.
- Que los 13 hallazgos previos se confirman o se ajustan con justificación.
- Que el dictamen de no certificación se sostiene con independencia del porcentaje de casos aprobados.

### 10.2 Lo que la revisión no permite afirmar

- Que no existan otros defectos no cubiertos por el alcance.
- Que una vulnerabilidad de dependencia sea explotable en el flujo real sin una prueba de concepto.
- Que el sistema se comporte exactamente igual en producción, dado que no se ejecutó en esta evaluación.
- Que los controles organizacionales, de red o de proveedores cumplan o incumplan, porque no fueron auditados.

### 10.3 Sesgos y mitigaciones

| Sesgo posible | Mitigación aplicada |
|---|---|
| Confundir un control de UI con un control de backend | Se verificó cada endpoint en el servidor, no solo la pantalla. |
| Sobreestimar la explotabilidad de dependencias | Se clasificaron como riesgo de cadena de suministro y se pidió validación SCA/DAST. |
| Degradar un hallazgo por controles compensatorios | Se aplicó la regla de no compensación. |
| Confundir un defecto funcional con uno de seguridad | Se separaron severidad y categoría; por ejemplo, HAL-20 es funcional pero afecta un derecho del paciente. |
| Generalizar desde un caso aislado | Se citó la ruta y la línea exactas y se evitó extrapolar sin evidencia. |

---

## 11. Reproducibilidad

Para reproducir la revisión:

1. Clonar el repositorio en un entorno aislado.
2. Verificar la ausencia de datos reales.
3. Ejecutar las comprobaciones estáticas del documento 10.
4. Levantar el stack solo si se corrigió HAL-23 o se creó el directorio `BACKEND/uploads`.
5. Ejecutar las recetas con usuarios sintéticos (`admin`, `medico`, `paciente` del dump).
6. Registrar salidas, códigos HTTP y capturas.
7. Destruir el entorno y rotar cualquier secreto expuesto.

Las recetas están diseñadas para ser **deterministas** y no dependen de datos de producción.

---

## 12. Conclusión metodológica

La combinación de revisión estática, trazabilidad y contraste con la ejecución previa permite sostener conclusiones defendibles sin depender de una nueva ejecución. La limitación principal —no haber ejecutado el sistema en esta evaluación— se compensa con recetas reproducibles y con la evidencia E2 de la Actividad 2.3.2. El resultado es un informe auditable: cada afirmación tiene una ubicación, un requisito y una prueba asociada, y cada recomendación tiene un criterio de cierre verificable.
