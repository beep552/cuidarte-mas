# 09 — Riesgos y cumplimiento normativo

> **Premisa.** Cuidarte+ trata datos personales sensibles de salud. Un fallo de acceso no es solo un defecto técnico: afecta dignidad, privacidad, seguridad del paciente y derechos garantizados por la Constitución y por leyes especiales. Este documento traduce los 38 hallazgos a riesgo legal, ético y operativo, y propone el marco de cumplimiento que debe acompañar la corrección técnica.

---

## 1. Activos y clasificación de datos

| Activo | Ejemplos | Clasificación | Impacto de exposición |
|---|---|---|---|
| Identidad del paciente | RUT, nombre, fecha de nacimiento, sexo, nacionalidad | Personal / identificatorio | Suplantación, fraude, discriminación |
| Datos de contacto | Dirección, teléfono, correo, contacto de emergencia | Personal | Acoso, phishing, robo de identidad |
| Datos clínicos | Alergias, enfermedades crónicas, discapacidades, observaciones, diagnósticos, tratamiento | **Sensible (salud)** | Daño directo, estigma, discriminación, riesgo vital |
| Documentos | PDF/imágenes de exámenes | **Sensible (salud)** | Exposición masiva, malware |
| Credenciales | Contraseñas, hashes, tokens, secretos JWT | Crítico | Compromiso total |
| Auditoría | Registros de acceso y acciones | Crítico para trazabilidad | Pérdida de evidencia, impunidad |
| Base de datos | Toda la información anterior | Crítico | Compromiso integral |

**Principio aplicable:** los datos de salud son una categoría de dato sensible. Su tratamiento exige una base de licitud, finalidad determinada, medidas de seguridad reforzadas y un nivel de acceso mínimo.

---

## 2. Marco normativo aplicable

### 2.1 Ley N.º 19.628 sobre protección de la vida privada y datos personales

| Obligación | Implicancia para Cuidarte+ | Evidencia de brecha |
|---|---|---|
| **Consentimiento y base de licitud** (arts. 4 y siguientes) | El tratamiento de datos de salud requiere consentimiento o una excepción legal; debe informarse la finalidad. | No se observa consentimiento informado ni registro de base de licitud en el registro de usuarios (HAL-08). |
| **Finalidad determinada** | Los datos deben usarse para la atención y gestión clínica, no para fines indeterminados. | La ficha pública por RUT (HAL-01) permite cualquier finalidad, sin vínculo terapéutico. |
| **Calidad del dato** | Datos exactos, completos y actualizados. | RUT sin DV (HAL-13), fecha de nacimiento errónea (HAL-36), datos inventados al registrar (`2000-01-01`, sexo `M`) en HAL-08. |
| **Seguridad** (art. 6) | Medidas técnicas y organizativas para evitar pérdida, alteración, acceso o difusión no autorizada. | Contraseñas en claro (HAL-02), secretos publicados (HAL-03), sin cifrado en reposo (HAL-27), sin TLS (HAL-11). |
| **Conservación** (art. 7) | No conservar más allá de la finalidad; permitir cancelación. | Sin política de retención (HAL-28); borrado físico sin control (HAL-06/HAL-33). |
| **Derechos del titular** (arts. 8-11) | Acceso, rectificación, cancelación y oposición. | El paciente no puede acceder a sus documentos por el bug HAL-20; no hay flujo de rectificación/cancelación auditado. |
| **Datos sensibles** | Salud exige protección reforzada y limitación de acceso. | HAL-01, HAL-08, HAL-14, HAL-27. |

### 2.2 Ley N.º 21.719 (modifica la Ley 19.628 y crea la Agencia de Protección de Datos)

**Estado:** publicada en diciembre de 2024, con entrada en vigor diferida (prevista para diciembre de 2026) y obligaciones progresivas. A la fecha de corte (octubre de 2026) no está plenamente vigente, pero **su diseño ya es el estándar de cumplimiento exigible** y las organizaciones deben prepararse.

| Obligación | Implicancia | Brecha actual |
|---|---|---|
| **Principios de licitud, lealtad, transparencia, minimización, exactitud, limitación, integridad y confidencialidad** | Marco general de tratamiento. | HAL-01, HAL-08, HAL-27, HAL-32. |
| **Delegado de Protección de Datos (DPO)** | Designación y funciones. | No se identifica un DPO ni un canal de contacto. |
| **Evaluación de Impacto (DPIA/EIPD)** | Obligatoria para tratamientos de alto riesgo, como datos de salud a gran escala. | No existe DPIA. |
| **Registro de actividades de tratamiento (ROPA)** | Inventario de tratamientos, finalidades, bases legales, destinatarios y plazos. | No existe ROPA. |
| **Notificación de brechas** | Notificar a la Agencia y a los titulares afectados cuando corresponda, sin dilación indebida. | No hay plan de respuesta ni registro de brechas (HAL-28). |
| **Derechos del titular y portabilidad** | Procedimientos y plazos. | No hay flujo implementado. |
| **Privacidad desde el diseño y por defecto** | Minimización, seudonimización, configuración segura. | La arquitectura expone datos por defecto (HAL-01, HAL-32). |
| **Régimen sancionatorio** | Multas y responsabilidad. | Riesgo legal y reputacional si se opera sin cumplir. |

> **Precaución interpretativa.** No se afirma que Cuidarte+ esté hoy sujeto a una sanción específica por la Ley 21.719 antes de su vigencia plena; se afirma que su arquitectura **no cumple el estándar** que la ley introducirá y que, si el sistema opera con datos reales, el riesgo legal es material.

### 2.3 Ley N.º 20.584 sobre derechos y deberes de los pacientes

| Obligación | Implicancia | Brecha |
|---|---|---|
| **Reserva de la ficha clínica** (arts. 12 y siguientes) | La ficha es reservada; solo acceden el paciente y el personal autorizado. | HAL-01 expone la ficha completa sin autenticación; HAL-08 permite apropiarse de ella. |
| **Consentimiento informado** | Para actuaciones clínicas y tratamiento de datos. | No hay evidencia de consentimiento en el registro. |
| **Acceso del paciente a su ficha** | Derecho a conocer y obtener copia. | HAL-20 impide al paciente descargar sus documentos. |
| **Confidencialidad** (art. 23) | Deber de secreto del personal y de los sistemas. | HAL-03, HAL-14, HAL-27. |
| **Fidelidad y calidad del registro** | La ficha debe reflejar la atención real. | HAL-22 permite asociar un documento al paciente equivocado; HAL-36 muestra una fecha errónea. |

### 2.4 Ley N.º 21.663 — Marco de Ciberseguridad

**Aplicabilidad:** Cuidarte+ no se clasifica en este informe como operador de importancia vital ni como servicio esencial, porque no se dispone de la información organizacional para determinarlo. Se usa como **marco de referencia** para higiene, gestión de incidentes y resiliencia.

| Expectativa | Implicancia | Brecha |
|---|---|---|
| Gobernanza y responsables de ciberseguridad | Roles y rendición de cuentas. | No se identifican responsables. |
| Gestión de riesgos y controles | Identificación, evaluación y tratamiento. | Este informe es un primer paso; no hay proceso continuo. |
| Detección, respuesta y notificación de incidentes | Playbooks, registro, plazos. | HAL-16/HAL-28 impiden detectar y reconstruir. |
| Continuidad operativa | Respaldos, recuperación, pruebas. | Sin política de respaldo/restauración verificada. |
| Cadena de suministro | Gestión de dependencias. | HAL-25 (13/29 vulnerabilidades, Node EOL). |

### 2.5 Estándares técnicos de referencia

| Estándar | Uso en este informe |
|---|---|
| **ISO/IEC 27001:2022** | Sistema de gestión de seguridad; controles A.5.15, A.5.17, A.8.2, A.8.3, A.8.5, A.8.8, A.8.9, A.8.15, A.8.16, A.8.20, A.8.24, A.8.28, A.8.32. |
| **ISO/IEC 27799** | Seguridad de la información en salud; protección de datos clínicos. |
| **ISO/IEC 25010** | Calidad del producto: seguridad, fiabilidad, eficiencia, usabilidad, mantenibilidad, portabilidad. |
| **ISO/IEC 29119** | Procesos y documentación de pruebas; reproducibilidad. |
| **OWASP Top 10 2021** | A01, A02, A04, A05, A06, A07, A09. |
| **OWASP ASVS 4.0** | V2 autenticación, V3 sesión, V4 control de acceso, V5 validación, V6 criptografía, V7 errores/logs, V8 datos, V9 comunicaciones, V12 archivos, V13 API. |
| **NIST SP 800-61** | Respuesta a incidentes (referencia metodológica). |

---

## 3. Matriz de cumplimiento por hallazgo

| Hallazgo | Ley 19.628 | Ley 21.719 | Ley 20.584 | Ley 21.663 | ISO 27001 | OWASP |
|---|---|---|---|---|---|---|
| HAL-01 | Consentimiento, finalidad, seguridad | Minimización, confidencialidad | Reserva, acceso | Gestión de riesgos | A.8.3, A.8.12 | A01 |
| HAL-02 | Seguridad | Integridad, confidencialidad | Confidencialidad | Higiene | A.8.24 | A02, A07 |
| HAL-03 | Seguridad | Seguridad desde el diseño | Confidencialidad | Cadena de suministro | A.5.17, A.8.24 | A02, A05 |
| HAL-04 | Seguridad | Control de acceso | Reserva | Gobernanza | A.8.2, A.8.3 | A01 |
| HAL-05 | Seguridad | Control de acceso | Reserva | Gobernanza | A.8.2 | A01 |
| HAL-06 | Seguridad, conservación | Integridad, disponibilidad | Reserva | Continuidad | A.8.2, A.8.10 | A01 |
| HAL-07 | Seguridad | Control de acceso | Reserva | Gobernanza | A.8.2 | A01 |
| HAL-08 | Consentimiento, calidad | Licitud, identidad | Consentimiento, reserva | Gestión de identidad | A.8.3 | A01, A07 |
| HAL-09 | Seguridad | Confidencialidad | Confidencialidad | Higiene | A.8.5 | A07 |
| HAL-10 | Seguridad | Confidencialidad | — | Perímetro | A.8.20 | A05 |
| HAL-11 | Seguridad | Confidencialidad | Confidencialidad | Resiliencia | A.8.24 | A02, A05 |
| HAL-12 | Seguridad | Integridad | — | Higiene | A.5.17 | A07 |
| HAL-13 | Calidad | Exactitud | Fidelidad | — | A.8.28 | A04 |
| HAL-14 | Seguridad | Integridad, minimización | Reserva | — | A.8.3 | A01 |
| HAL-15 | Seguridad | Integridad | Fidelidad | Continuidad | A.8.32 | A04 |
| HAL-16 | Seguridad | Responsabilidad | Trazabilidad | Detección | A.8.15 | A09 |
| HAL-17 | Seguridad | Responsabilidad | Trazabilidad | Detección | A.8.15 | A09 |
| HAL-18 | Seguridad | Integridad | Reserva | Cadena de suministro | A.8.28 | A04, A08 |
| HAL-19 | Seguridad | Confidencialidad | — | Higiene | A.8.5 | A07 |
| HAL-20 | Acceso | Derechos del titular | Acceso a ficha | — | A.8.3 | A01 |
| HAL-21 | Seguridad | Integridad | — | — | A.8.2 | A01, A04 |
| HAL-22 | Calidad | Exactitud | Fidelidad | — | A.8.28 | A01, A04 |
| HAL-23 | — | — | — | Continuidad | A.8.32 | A05 |
| HAL-24 | — | — | — | Continuidad | A.8.32 | A04 |
| HAL-25 | Seguridad | Seguridad | — | Cadena de suministro | A.8.8 | A06 |
| HAL-26 | — | Transparencia | — | — | A.8.28 | A04 |
| HAL-27 | Seguridad | Confidencialidad | Confidencialidad | Resiliencia | A.8.24 | A02 |
| HAL-28 | Conservación | Responsabilidad | Trazabilidad | Detección/respuesta | A.8.15, A.8.16 | A09 |
| HAL-29 | — | — | — | Disponibilidad | A.8.32 | A04 |
| HAL-30 | Seguridad | Minimización | — | Perímetro | A.8.9 | A05 |
| HAL-31 | Seguridad | Confidencialidad | — | Detección | A.8.28 | A05, A09 |
| HAL-32 | Finalidad, minimización | Minimización | Reserva | — | A.8.3 | A01 |
| HAL-33 | Conservación | Disponibilidad | — | Continuidad | A.5.15, A.8.2 | A01 |
| HAL-34 | — | Transparencia | — | — | A.8.3 | A04 |
| HAL-35 | — | — | — | — | A.8.2 | A01 |
| HAL-36 | Calidad | Exactitud | Fidelidad | — | A.8.28 | — |
| HAL-37 | — | Transparencia | — | — | A.8.28 | — |
| HAL-38 | Seguridad | Confidencialidad | — | Higiene | A.8.5 | A07 |

---

## 4. Análisis de riesgos

### 4.1 Escala

| Nivel | Probabilidad | Impacto |
|---|---|---|
| **Crítico** | Muy probable o trivial de explotar | Compromiso total, daño directo al paciente, sanción legal |
| **Alto** | Probable con conocimientos básicos | Exposición de datos sensibles, pérdida de confianza |
| **Medio** | Posible con condiciones | Impacto acotado o reversible |
| **Bajo** | Poco probable o requiere acceso privilegiado | Molestia, deuda técnica |

### 4.2 Escenarios principales

| # | Escenario | Activos | Prob. | Impacto | Riesgo | Hallazgos |
|---|---|---|---|---|---|---|
| R1 | Un externo enumera RUT y descarga fichas clínicas completas | Fichas, contacto | Alta | Crítico | **Crítico** | HAL-01 |
| R2 | Un atacante se conecta a PostgreSQL con `postgres/postgres` en `15442` y exfiltra/borra todo | Toda la base | Alta | Crítico | **Crítico** | HAL-03, HAL-27 |
| R3 | Un atacante forja un JWT de admin con el secreto publicado | Toda la aplicación | Alta | Crítico | **Crítico** | HAL-03 |
| R4 | Un paciente crea un usuario admin con `rol_id: 1` | Toda la aplicación | Alta | Crítico | **Crítico** | HAL-04 |
| R5 | Un médico se autoasciende a admin | Toda la aplicación | Media | Crítico | **Crítico** | HAL-05, HAL-21 |
| R6 | Un tercero vincula una ficha existente por RUT y se apropia de ella | Ficha, exámenes, documentos | Media | Crítico | **Crítico** | HAL-08 |
| R7 | Se libera el nombre `admin` y se reasigna a `paciente` (o se usa el alias `administrador`); todos los pacientes escalan | Toda la aplicación | Media | Crítico | **Crítico** | HAL-07 |
| R8 | Se borra un admin o el último admin; el sistema queda sin administración | Disponibilidad | Media | Alto | **Alto** | HAL-06, HAL-33 |
| R9 | Fuerza bruta/credenciales débiles permiten entrar como admin | Cuentas | Alta | Alto | **Alto** | HAL-02, HAL-12, HAL-19 |
| R10 | Se sube un archivo malicioso y un médico lo descarga | Equipos clínicos | Media | Alto | **Alto** | HAL-18, HAL-26 |
| R11 | Se altera o borra la auditoría y no se puede investigar | Evidencia | Media | Alto | **Alto** | HAL-16, HAL-17, HAL-28 |
| R12 | Un documento se asocia al paciente equivocado y se toma una decisión clínica errónea | Ficha | Media | Alto | **Alto** | HAL-22 |
| R13 | Un paciente no puede descargar sus documentos y recurre a canales inseguros | Derechos | Alta | Medio | **Medio** | HAL-20 |
| R14 | La fecha de nacimiento se muestra un día antes y se calcula mal la edad | Ficha | Alta | Medio | **Medio** | HAL-36 |
| R15 | Un usuario descarga todo el padrón con una sola petición | Fichas | Media | Medio | **Medio** | HAL-32 |
| R16 | El sistema no se puede construir desde un clon limpio y no se puede certificar | Operación | Alta | Medio | **Medio** | HAL-23, HAL-24 |

### 4.3 Riesgo residual si se corrige solo lo crítico

Aun con HAL-01 a HAL-08 corregidos, persisten:

- **Riesgo alto:** fuerza bruta (HAL-19) + contraseñas débiles (HAL-12) + secretos rotados pero sin gestión (HAL-03).
- **Riesgo alto:** auditoría no confiable (HAL-16/28) → no se puede detectar ni notificar una brecha.
- **Riesgo medio:** archivos maliciosos (HAL-18), cifrado en reposo (HAL-27), documentos mal asociados (HAL-22).
- **Riesgo operativo:** build/inicialización no reproducible (HAL-23/24) y dependencias EOL (HAL-25).

Por eso el plan de 30 días no es opcional: sin él, el sistema puede aprobar un retest superficial y seguir siendo inseguro.

---

## 5. Análisis ético

### 5.1 Principios aplicados

| Principio | Pregunta ética | Aplicación a Cuidarte+ |
|---|---|---|
| **Autonomía** | ¿El paciente decide sobre sus datos? | No hay consentimiento informado ni control sobre la vinculación de su ficha (HAL-08). |
| **No maleficencia** | ¿El sistema evita daño? | HAL-01, HAL-22 y HAL-36 pueden causar daño clínico o discriminación. |
| **Beneficencia** | ¿El sistema ayuda sin exponer? | La funcionalidad existe, pero la seguridad la vuelve riesgosa. |
| **Justicia** | ¿Todos los pacientes reciben el mismo nivel de protección? | Un atacante con un RUT puede afectar a cualquier persona; los datos de salud son especialmente sensibles. |
| **Privacidad** | ¿Se limita la recolección y el acceso? | No hay minimización (HAL-32); la ficha pública (HAL-01) elimina el límite. |
| **Transparencia** | ¿El titular sabe qué se hace con sus datos? | No hay aviso claro, consentimiento ni trazabilidad comprensible. |
| **Responsabilidad** | ¿Alguien responde por el sistema? | Auditoría forjable (HAL-16) y sin inmutabilidad (HAL-28). |
| **Confianza** | ¿El sistema merece la confianza depositada? | Los controles actuales no la sostienen; el dictamen es NO CERTIFICADO. |

### 5.2 Grupos de interés

| Grupo | Interés | Riesgo si falla |
|---|---|---|
| **Pacientes** | Atención oportuna, privacidad, acceso a su ficha | Exposición de datos, suplantación, decisiones clínicas erróneas |
| **Médicos** | Información fiable, herramientas usables | Documentos mal asociados, malware, responsabilidad profesional |
| **Administradores** | Control y trazabilidad | Pérdida de control, auditoría no confiable |
| **Equipo desarrollador** | Entregar un sistema funcional | Responsabilidad profesional, reputación, deuda técnica |
| **Institución** | Cumplimiento, continuidad, reputación | Sanciones, pérdida de confianza, incidentes |
| **Sociedad** | Protección de datos de salud | Discriminación, exclusión, daño a derechos fundamentales |

### 5.3 Dilemas éticos y postura

1. **Seguridad vs. facilidad de registro.** La fricción de verificar identidad es incómoda, pero **no verificar** traslada el costo al paciente (HAL-08). La postura ética es verificar con el menor riesgo y ofrecer un canal alternativo presencial.
2. **Usabilidad vs. control de acceso.** Ocultar un botón no es seguridad. La usabilidad debe construirse sobre un backend que autorice; nunca al revés.
3. **Retención vs. derecho al olvido.** La ficha clínica tiene plazos legales de conservación; no se puede borrar indiscriminadamente. Se requiere una política de retención con base legal, no un `DELETE` libre (HAL-06/HAL-28).
4. **Investigación vs. privacidad.** Cualquier uso secundario de datos clínicos debe ser anonimizado, agregado y aprobado por un comité de ética; no se observa ese control.
5. **Velocidad de entrega vs. deber de cuidado.** El proyecto se describe en `BACKEND/package.json` como “intencionalmente vulnerable”. Esa etiqueta puede ser válida para un laboratorio, pero **no autoriza** a operar con datos reales ni a omitir controles. La responsabilidad profesional exige no desplegar y comunicar el riesgo.

### 5.4 Divulgación responsable

- Reportar primero al equipo responsable y a la institución, con un plazo razonable (por ejemplo, 90 días) antes de cualquier publicación.
- No usar datos reales de pacientes en pruebas, capturas o demostraciones.
- No publicar exploits listos para usar contra sistemas en producción.
- Documentar la cadena de custodia de la evidencia.
- Coordinar la divulgación con el plan de respuesta a incidentes y con la obligación de notificar a la Agencia si corresponde.
- Reconocer el trabajo del equipo y evitar atribuciones personales; el objetivo es corregir, no exponer.

---

## 6. Respuesta a incidentes y notificación de brechas

### 6.1 Fases (NIST SP 800-61 adaptado)

| Fase | Acciones mínimas | Evidencia |
|---|---|---|
| **Preparación** | Roles, contactos, playbooks, inventario, backups, accesos de emergencia. | Plan aprobado, simulacro. |
| **Detección y análisis** | Alertas de login fallido, accesos anómalos, cambios de rol, errores 5xx, integridad de auditoría. | Logs, SIEM, ticket. |
| **Contención** | Rotar secretos, revocar tokens, aislar contenedores, cerrar puertos, bloquear cuentas. | Registro de acciones con hora. |
| **Erradicación** | Corregir la causa, parchear, actualizar dependencias, restaurar desde backup confiable. | Commit, análisis, evidencia. |
| **Recuperación** | Restaurar servicio, verificar integridad, monitorear. | Pruebas de humo, métricas. |
| **Lecciones aprendidas** | Postmortem sin culpa, acciones correctivas, actualización de riesgos. | Informe y seguimiento. |

### 6.2 Notificación

- **Ley 21.719:** notificar a la Agencia y a los titulares afectados cuando la brecha afecte derechos, sin dilación indebida, con la información disponible y medidas de mitigación. Los plazos y el formato deben confirmarse con asesoría legal y con la normativa de implementación.
- **Ley 20.584:** informar a los pacientes afectados y adoptar medidas para resguardar la reserva de la ficha.
- **Ley 21.663:** si el operador califica como servicio esencial o de importancia vital, seguir el canal y los plazos que establezca la ANCI.
- **Contratos y seguros:** revisar obligaciones de notificación a clientes, proveedores y aseguradoras.

### 6.3 Qué no hacer

- No borrar logs ni “limpiar” la auditoría para ocultar el incidente.
- No notificar a los pacientes sin un mensaje claro, verificable y sin exponer más datos.
- No reutilizar el mismo secreto o contraseña tras la contención.
- No reanudar el servicio sin verificar la causa raíz y la integridad de los datos.

---

## 7. Hoja de ruta de cumplimiento

| Plazo | Entregable | Responsable | Evidencia |
|---|---|---|---|
| 7 días | Contención técnica (P0) y registro del incidente | Seguridad/DevOps | Tickets, commits, rotación |
| 30 días | Política de seguridad, control de acceso, auditoría, cifrado, retención inicial | CISO/DPO/Backend | Documentos aprobados, pruebas |
| 60 días | DPIA, ROPA, consentimiento, aviso de privacidad, derechos del titular | DPO/Legal | Documentos y flujos |
| 90 días | Plan de respuesta probado, backups restaurados, pentest, formación | CISO/QA/RRHH | Simulacro, informe, asistencia |
| 90+ días | Certificación/auditoría externa y mejora continua | Dirección | Dictamen |

---

## 8. Conclusión

Cuidarte+ no es solo un sistema con bugs: es un sistema que **trata datos de salud sin los controles mínimos** para hacerlo. La combinación de ficha pública, secretos comprometidos, contraseñas en claro, escalamiento de roles y auditoría mutable configura un riesgo crítico para los pacientes y una brecha directa con la Ley 19.628, la Ley 20.584 y el estándar que introduce la Ley 21.719.

La respuesta ética no es “agregar un parche y desplegar”. Es **detener el despliegue con datos reales**, contener los vectores, corregir las causas estructurales, verificar con pruebas y asumir la responsabilidad de comunicar. La buena noticia es que el plan propuesto es viable y que la mayoría de los controles son conocidos: autorización central, hashing, secretos gestionados, transacciones, auditoría inmutable, cifrado y pruebas continuas.

*Volver al [índice](README.md) · Continuar con [10 — Evidencias y reproducción](10-evidencias-y-reproduccion.md).*
