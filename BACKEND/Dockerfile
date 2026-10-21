FROM node:22-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código de la aplicación
# Corrige HAL-23: `COPY uploads/` eliminada — el directorio lo crea la
# aplicación al arrancar (app.js hace fs.mkdirSync) y Compose lo monta como
# volumen; así el build funciona en un clon limpio.
COPY src/ ./src/
COPY sql/ ./sql/

# Exponer puerto
EXPOSE 3000

# Ejecutar con usuario no privilegiado (OBS-12, endurecimiento básico)
RUN addgroup -S app && adduser -S app -G app -h /app \
    && chown -R app:app /app
USER app

# Comando para iniciar la aplicación
CMD ["node", "src/app.js"]
