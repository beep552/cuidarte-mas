# Auditoría estática de calidad, seguridad y cumplimiento — Cuidarte+

**Asignatura:** ISY1102 — Seguridad y Calidad en el Desarrollo de Software  
**Evaluación:** EP3 — Verificando la calidad, seguridad y cumplimiento normativo  
**Caso:** Sistema de Gestión Cuidarte+ (Caso A)  
**Versión documental:** 1.0  
**Fecha de corte:** 21 de octubre de 2026  
**Alcance:** revisión estática del código fuente, contraste con las Actividades 2.2.2, 2.3.2 y 2.4.2, y análisis de dependencias. **No se modificó el código de la aplicación.**

---

## 1. Propósito

Este conjunto documental entrega la evidencia técnica, el análisis y la trazabilidad necesarios para la Evaluación Parcial N.º 3. Se revisaron los módulos de autenticación, pacientes, exámenes, documentos, usuarios, roles, auditoría, base de datos, contenedores y frontend, contrastando cada hallazgo con los requerimientos del ERS, los casos de prueba ya diseñados y la normativa chilena aplicable.

El documento no se limita a listar errores: para cada hallazgo se indica **dónde falla**, **cómo se reproduce**, **qué impacto tiene**, **cuál es su causa raíz**, **qué requisito o norma incumple** y **cómo debe verificarse su corrección**.

---

## 2. Resultado global

| Métrica | Resultado |
|---|---:|
| Hallazgos documentados | **38** |
| Críticos | **8** |
| Mayores | **17** |
| Medios | **4** |
| Menores | **9** |
| Hallazgos previos contrastados | **13 de 13 confirmados** (con ajustes, divisiones y cambios de severidad) |
| Hallazgos previos rechazados | **0** |
| Observaciones complementarias | **12** |
| Casos de prueba previos | **32 diseñados / 31 ejecutados / 28 aprobados** (90,3 % de los ejecutados) |
| Casos previos fallidos | **3** (CP-SEG-008, CP-SEG-009, CP-SEG-010) |
| Caso previo pendiente | **CP-SEG-006** |
| Dictamen previo | **NO CERTIFICADO** |
| Veredicto de esta revisión | **No apto para certificación ni despliegue productivo en su estado actual** |

> **Nota de conteo.** La planificación inicial preveía 8 críticos, 17 mayores, 3 medios y 10 menores. Tras separar el manejo de errores de carga (multer/dropzone) de la validación MIME, ese ítem se clasificó como Medio; el catálogo `/tipo-examen` se integró en HAL-07 por compartir causa raíz con los endpoints de catálogo sin autenticación. El total se mantiene en 38. Los conteos definitivos son **8 / 17 / 4 / 9**.

---

## 3. Índice documental

| Documento | Contenido | Uso en EP3 |
|---|---|---|
| [01 — Resumen ejecutivo](01-resumen-ejecutivo.md) | Contexto, resultados, riesgos principales, veredicto y recomendaciones | Introducción y conclusiones |
| [02 — Metodología y criterios](02-metodologia-y-criterios.md) | Estrategia, fuentes, criterios de severidad, límites y validez | Plan de pruebas, criterios de calidad |
| [03 — Hallazgos críticos](03-hallazgos-criticos.md) | HAL-01 a HAL-08, con código, reproducción e impacto | Incidentes y criticidad |
| [04 — Hallazgos mayores](04-hallazgos-mayores.md) | HAL-09 a HAL-25 | Incidentes y criticidad |
| [05 — Hallazgos medios y menores](05-hallazgos-medios-menores.md) | HAL-26 a HAL-38 y observaciones complementarias | Incidentes y criticidad |
| [06 — Matriz de trazabilidad](06-matriz-trazabilidad.md) | Hallazgo ↔ archivo ↔ RF/RNF/RB ↔ CP ↔ norma ↔ sección EP3 | Cobertura y trazabilidad |
| [07 — Contraste con los 13 hallazgos previos](07-contraste-hallazgos-previos.md) | Confirmación, rechazo, división y ajuste de severidad | Retroalimentación y ajustes |
| [08 — Plan de acción y retest](08-plan-de-accion-recomendado.md) | Prioridades, esfuerzo, responsables, criterios de cierre y retest | Plan de mejora |
| [09 — Riesgos y cumplimiento normativo](09-riesgos-y-cumplimiento.md) | Ley 19.628, 21.719, 20.584, 21.663; ISO/IEC; OWASP; análisis ético | Análisis ético y normativo |
| [10 — Evidencias y reproducción](10-evidencias-y-reproduccion.md) | Comandos, rutas, salidas, recetas de reproducción y salvaguardas | Ejecución y evidencias |
| [11 — Inventario de revisión](11-inventario-revision.md) | Archivos revisados, cobertura, rutas y limitaciones | Anexo técnico |
| [12 — Plan de pruebas EP3](12-plan-de-pruebas-ep3.md) | Estrategia, tipos, criterios de aceptación, cronograma y casos representativos | Plan de pruebas y diseño de casos |
| [13 — Correcciones aplicadas](13-correcciones-aplicadas.md) | Matriz hallazgo ↔ archivo ↔ corrección ya implementada en el repo; verificaciones ejecutadas | Remediación |
| [14 — Hallazgos no corregibles en código](14-hallazgos-no-corregibles-en-codigo.md) | HAL-11/25/27/28 parciales, MFA, HIBP, limpieza de historial git y antivirus | Remediación (pendientes de infraestructura/operación) |

---

## 4. Convenciones

### 4.1 Identificadores

- **HAL-01 … HAL-38:** hallazgos de esta auditoría.
- **BUG-001, BUG-002, BUG-003:** identificadores usados en la Actividad 2.4.2. Se conservan como alias para no romper la trazabilidad histórica.
- **OBS-01 … OBS-12:** observaciones complementarias que no alcanzan la categoría de hallazgo o que requieren validación dinámica adicional.
- **F01 … F13:** los 13 hallazgos previos aportados por el equipo, contrastados en el documento 07.

### 4.2 Severidad

| Severidad | Criterio operativo |
|---|---|
| **Crítica** | Permite compromiso total o acceso no autorizado a datos clínicos sin autenticación, o escalamiento directo a administrador. Exige corrección antes de cualquier despliegue. |
| **Mayor** | Requiere una sesión válida de bajo privilegio, rompe un requisito principal de seguridad/calidad, o afecta la disponibilidad, integridad o trazabilidad de forma relevante. |
| **Media** | Impacto limitado o de defensa en profundidad; afecta la experiencia, el rendimiento o el cumplimiento, pero no permite por sí solo un compromiso total. |
| **Menor** | Defecto acotado de interfaz, consistencia, documentación o higiene técnica; no impide la operación ni otorga privilegios. |

### 4.3 Estado y evidencia

| Código | Significado |
|---|---|
| **Abierto** | El defecto existe en el código revisado y no fue corregido. |
| **Confirmado (EST)** | Confirmado por lectura y trazabilidad estática del código. |
| **Confirmado (EJEC)** | Confirmado además por la ejecución documentada en la Actividad 2.3.2. |
| **Confirmado (DEP)** | Confirmado por análisis de dependencias (`npm audit`). |
| **Con reserva** | Existe evidencia parcial; requiere prueba dinámica o de integración para precisar el impacto. |
| **No confirmado** | La hipótesis no se sostiene tras revisar el código. |

### 4.4 Rutas

Las rutas se expresan relativas a la raíz del repositorio. Los números de línea corresponden al estado del repositorio en la fecha de corte. En Windows la carpeta puede aparecer como `Docs`; el contenido es el mismo.

---

## 5. Advertencia de uso

Este documento contiene **recetas de reproducción** de vulnerabilidades reales. Deben ejecutarse únicamente en un entorno aislado, con datos sintéticos y autorización expresa. No deben probarse contra producción, datos reales de pacientes ni sistemas de terceros. La divulgación de los hallazgos debe seguir el principio de **divulgación responsable**: primero al equipo responsable, con plazo razonable de corrección, y sin publicar datos de pacientes.

---

## 6. Lectura recomendada para la defensa

1. **01** para el mensaje ejecutivo y el veredicto.
2. **03** para explicar los ocho hallazgos que justifican el “NO CERTIFICADO”.
3. **07** para demostrar que los 13 hallazgos previos fueron verificados uno por uno.
4. **06** para mostrar trazabilidad requisito ↔ prueba ↔ hallazgo ↔ norma.
5. **09** para el análisis ético y normativo.
6. **12** para el plan de pruebas y los casos representativos exigidos por EP3.

---

*Documentación elaborada para ISY1102 — EP3. Todo el análisis es reproducible a partir de las rutas y comandos indicados en el documento 10.*
