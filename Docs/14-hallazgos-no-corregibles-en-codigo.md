# Hallazgos que NO pueden corregirse solo en código

Estos hallazgos del pentest requieren decisiones de infraestructura, de
operación o de producto. Lo que **sí** se hizo en código se indica por
hallazgo; el resto queda documentado como deuda operativa con su
recomendación.

## HAL-11 — TLS real y HSTS operacional

- **Lo que se corrigió en código**: cabeceras de seguridad (`nosniff`,
  `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`) y HSTS
  opt-in por `ENABLE_HSTS=1` (`BACKEND/src/app.js`). El frontend lista
  `Content-Security-Policy` de referencia en su `index.html` si aplica.
- **Lo que falta (infraestructura)**: un **proxy inverso con TLS real**
  (Nginx/Traefik/Caddy con certificado Let's Encrypt o interno) delante del
  backend, redirección 80→443 y carga del certificado. HSTS `Strict-Max-Age`
  a producción debe activarse solo después de validar el certificado.
- **Respuesta esperada del retest del hallazgo**: `https://` en todos los
  entornos, `Strict-Transport-Security` visible desde el proxy.

## HAL-25 — Dependencias vulnerables y SCA en CI

- **Lo que se corrigió en código**: runtime actualizado a **Node 22 LTS** en
  ambos Dockerfiles.
- **Lo que falta (operación)**: ejecutar `npm audit fix` / `npm update` contra
  un lockfile real, agregar análisis SCA (npm audit, Dependabot/Renovate,
  `npm ci` + audit como paso de CI) y pipeline que falle con vulnerabilidades
  `high`/`critical`.

## HAL-27 — Cifrado en reposo de datos clínicos y TLS hacia PostgreSQL

- **Lo que falta (infraestructura/BD)**: cifrado a nivel de disco o del
  sistema de almacenamiento del volumen de Postgres, TLS hacia la base de
  datos con certificados propios (el backend ya soporta `PG_SSL=true` vía
  `pg`), y cifrado de los archivos subidos si el requisito regulatorio lo
  exige. Esto no tiene expresión "código" fuera de las cabeceras de conexión
  ya preparadas.

## HAL-28 (parcial) — Retención de auditoría y transferencia a SIEM

- **Lo que se corrigió en código**: trigger de inmutabilidad
  (`auditoria_append_only_guard`) y paginación/reglas de acceso de la lectura.
- **Lo que falta (operación)**: política de retención (particionado por fecha,
  archivado, purge), y exportación hacia un SIEM/centralización de logs
  (syslog, splunk, ELK). Requiere decisiones de compliance.

## MFA / OBS-04 — Recuperación de contraseña del frontend

- **Lo que falta (producto/infraestructura)**: flujo completo de recuperación de
  contraseña con tokens de un solo uso y envío de correo (requiere proveedor
  SMTP, plantillas y endpoints con verificación); MFA requiere elegir un
  proveedor (TOTP server-side o servicio de identidad).
- **Nota**: el backend ya responde `202`/mensajes genéricos en login para no
  filtrar existencia de usuarios, y todos los cambios de contraseña pasan por
  la política fuerte (HAL-12), lo que mitiga parte del riesgo.

## Verificación de contraseñas filtradas (HIBP)

- **Lo que falta (operación/terceros)**: consulta opcional a la API
  `--pwned-passwords` de Have I Been Pwned (rango k-anónimo) al crear contraseñas.
  Requiere decisión sobre llamadas a servicios externos desde el servidor.

## Limpieza del historial de Git (secreto antiguo)

- **Contexto**: el secreto JWT antiguo quedó en el historial de commits
  (`HAL-03`). El secreto fue **rotado** y los `.env` ya no se versionan, pero
  el calor del secreto antiguo en la historia persiste clonando el repo.
- **Acción operativa requerida** (destructiva, requiere coordinar con todo el
  equipo y hacer re-clone):
  ```bash
  pipx install git-filter-repo
  git clone --mirror <url> repo-mirror
  cd repo-mirror
  git filter-repo --replace-text textode-sustitucion.txt   # sustituir el secreto por ***REMOVED***
  git push --force
  ```
  o usar **BFG Repo-Cleaner** (`bfg --replace-text`). Después, invalidar
  todos los tokens (ya garantizado por `token_version` de HAL-09) y rotar
  credenciales de BD una vez más.

## Antivirus / escaneo de archivos subidos (asociado a HAL-18)

- **Lo que se corrigió en código**: validación por magic bytes, límite de
  tamaño, tipo y cantidad en la UI.
- **Lo que falta (infraestructura)**: escaneo con antivirus (ClamAV u otro) de
  los archivos en cola de subida, y almacenamiento en bucket con políticas de
  acceso aisladas.

## Referencia

Ver `13-correcciones-aplicadas.md` para la matriz completa de **hallazgos
corregidos en código** (HAL-01 a HAL-38) y qué archivos se tocaron.
