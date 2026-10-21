#!/bin/bash
# Inicialización de la base de datos cuidarteplus.
#
# Corrige HAL-24: ON_ERROR_STOP=1 (antes 0), set -euo pipefail, verificación
# del conteo de tablas esperado y despliegue del trigger de inmutabilidad de
# auditoría. Ahora un dump con error deja el contenedor inicializándose en
# fallo en lugar de declarar una inicialización parcial como exitosa.
set -euo pipefail

echo "========================================="
echo "Inicializando base de datos cuidarteplus..."
echo "========================================="

# Esperar un momento para asegurar que la base de datos esté lista
sleep 2

echo "Procesando dump-cuidarteplus.sql..."

# Crear un archivo temporal procesado
PROCESSED_DUMP="/tmp/dump-processed.sql"

# Procesar el dump (elimina comandos problemáticos y ajusta \connect)
grep -v "^DROP DATABASE" /tmp/dump-cuidarteplus.sql | \
  grep -v "^CREATE DATABASE" | \
  grep -v "^ALTER DATABASE " | \
  grep -v "^CREATE SCHEMA public" | \
  grep -v "^ALTER SCHEMA public OWNER" | \
  grep -v "^COMMENT ON SCHEMA public" | \
  sed "s/\\\\connect cuidarteplus/\\\\c $POSTGRES_DB/g" | \
  sed "s/\\\\connect $POSTGRES_DB/\\\\c $POSTGRES_DB/g" > "$PROCESSED_DUMP"

echo "Cargando dump procesado en la base de datos $POSTGRES_DB..."
# ON_ERROR_STOP=1: cualquier error interrumpe el script y falla el contenedor.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < "$PROCESSED_DUMP"

echo "Verificando tablas creadas..."
TABLE_COUNT=$(psql -t -A --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "Tablas creadas: $TABLE_COUNT"

# El dump define 8 tablas del sistemas; menos que eso equivale a un dump incompleto.
TABLAS_ESPERADAS=8
if (( TABLE_COUNT < TABLAS_ESPERADAS )); then
  echo "ERROR: se esperaban al menos $TABLAS_ESPERADAS tablas y se encontraron $TABLE_COUNT."
  exit 1
fi

echo "Verificando semillas (roles y usuarios)..."
USUARIOS=$(psql -t -A --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "SELECT COUNT(*) FROM public.usuarios;")
ROLES=$(psql -t -A --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "SELECT COUNT(*) FROM public.roles;")
if (( USUARIOS < 3 || ROLES < 3 )); then
  echo "ERROR: faltan semillas (usuarios=$USUARIOS, roles=$ROLES)."
  exit 1
fi

echo "Aplicando inmutabilidad de auditoría (HAL-28)..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE OR REPLACE FUNCTION auditoria_append_only()
RETURNS TRIGGER AS $trigger$
BEGIN
  RAISE EXCEPTION 'auditoria es append-only: % prohibido', TG_OP;
END;
$trigger$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auditoria_append_only_guard ON public.auditoria;
CREATE TRIGGER auditoria_append_only_guard
BEFORE UPDATE OR DELETE ON public.auditoria
FOR EACH ROW EXECUTE FUNCTION auditoria_append_only();
SQL

echo "========================================="
echo "Base de datos inicializada correctamente."
echo "========================================="
