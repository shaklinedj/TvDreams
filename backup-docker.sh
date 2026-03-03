#!/bin/bash

# Script de backup automatizado para TvDreams Docker
# Uso: ./backup-docker.sh
# Para automatizar: crontab -e y agregar línea:
# 0 2 * * * /home/usuario/TvDreams/backup-docker.sh >> /var/log/tvdreams-backup.log 2>&1

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="tvdreams_backup_${TIMESTAMP}"
FULL_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Retención (días)
RETENTION_DAYS=30

# Banner
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   TvDreams Docker Backup Manager           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"

# Crear directorio de backups
mkdir -p "${BACKUP_DIR}"
echo -e "${BLUE}📁 Directorio de backups: ${BACKUP_DIR}${NC}"

# Verificar si Docker está corriendo
if ! docker-compose ps | grep -q "Up"; then
    echo -e "${RED}❌ Los contenedores no están corriendo${NC}"
    echo "Inicia con: docker-compose up -d"
    exit 1
fi

echo -e "${YELLOW}🔄 Iniciando backup...${NC}"

# Crear directorio del backup
mkdir -p "${FULL_PATH}"

# 1. BACKUP DE LA BASE DE DATOS MYSQL
echo -e "${BLUE}📊 Haciendo backup de MySQL...${NC}"

docker-compose exec -T db mysqldump \
    -u cms_user \
    -pcms_password \
    cms_usuarios_julius \
    > "${FULL_PATH}/database.sql"

if [ -f "${FULL_PATH}/database.sql" ]; then
    SIZE=$(du -h "${FULL_PATH}/database.sql" | cut -f1)
    echo -e "${GREEN}✅ Database backup exitoso (${SIZE})${NC}"
else
    echo -e "${RED}❌ Error en database backup${NC}"
    exit 1
fi

# 2. BACKUP DE ARCHIVOS CRÍTICOS
echo -e "${BLUE}📁 Haciendo backup de archivos...${NC}"

# Crear tarball de uploads
if [ -d "uploads" ] && [ "$(ls -A uploads)" ]; then
    tar -czf "${FULL_PATH}/uploads.tar.gz" uploads/ 2>/dev/null
    SIZE=$(du -h "${FULL_PATH}/uploads.tar.gz" | cut -f1)
    echo -e "${GREEN}✅ Uploads backup exitoso (${SIZE})${NC}"
else
    echo -e "${YELLOW}⚠️  Directorio uploads está vacío o no existe${NC}"
fi

# Backup de datos persistentes
if [ -d "data" ] && [ "$(ls -A data)" ]; then
    tar -czf "${FULL_PATH}/data.tar.gz" data/ 2>/dev/null
    SIZE=$(du -h "${FULL_PATH}/data.tar.gz" | cut -f1)
    echo -e "${GREEN}✅ Data backup exitoso (${SIZE})${NC}"
else
    echo -e "${YELLOW}⚠️  Directorio data está vacío o no existe${NC}"
fi

# 3. BACKUP DE CONFIGURACIÓN
echo -e "${BLUE}⚙️  Backeando configuración...${NC}"

cat > "${FULL_PATH}/config.txt" << EOF
TvDreams Backup Configuration
============================
Fecha: $(date)
Docker version: $(docker --version)
Docker Compose version: $(docker-compose --version)

Containers:
$(docker-compose ps)
EOF

echo -e "${GREEN}✅ Configuración guardada${NC}"

# 4. CREAR ARCHIVO DE INFORMACIÓN DEL BACKUP
cat > "${FULL_PATH}/BACKUP_INFO.md" << EOF
# Backup Information

**Fecha**: $(date)
**Timestamp**: ${TIMESTAMP}

## Contenidos

- \`database.sql\` - Dump SQL completo de la base de datos MySQL
- \`uploads.tar.gz\` - Archivos multimedia cargados
- \`data.tar.gz\` - Datos persistentes (premios recientes)
- \`config.txt\` - Configuración del sistema al momento del backup

## Para restaurar:

### Restaurar base de datos:
\`\`\`bash
docker-compose up -d db
sleep 10
docker-compose exec -T db mysql -u cms_user -p cms_usuarios_julius < backups/${BACKUP_NAME}/database.sql
\`\`\`

### Restaurar archivos:
\`\`\`bash
tar -xzf backups/${BACKUP_NAME}/uploads.tar.gz
tar -xzf backups/${BACKUP_NAME}/data.tar.gz
\`\`\`

## Verificación:
\`\`\`bash
# Verificar integridad del SQL
mysql -u cms_user -p < backups/${BACKUP_NAME}/database.sql --dry-run

# Verificar archivos
tar -tzf backups/${BACKUP_NAME}/uploads.tar.gz | head
tar -tzf backups/${BACKUP_NAME}/data.tar.gz | head
\`\`\`
EOF

echo -e "${GREEN}✅ BACKUP_INFO.md creado${NC}"

# 5. ESTADÍSTICAS
echo ""
echo -e "${BLUE}📊 Estadísticas del backup:${NC}"
TOTAL_SIZE=$(du -sh "${FULL_PATH}" | cut -f1)
echo "   Ubicación: ${FULL_PATH}"
echo "   Tamaño total: ${TOTAL_SIZE}"
echo "   Archivos:"
ls -lh "${FULL_PATH}" | awk 'NR>1 {print "      " $9 " (" $5 ")"}'

# 6. LIMPIAR BACKUPS ANTIGUOS
echo -e "${BLUE}🧹 Limpiando backups antiguos (>30 días)...${NC}"

find "${BACKUP_DIR}" -type d -name "tvdreams_backup_*" -mtime +${RETENTION_DAYS} -exec rm -rf {} \; 2>/dev/null || true
echo -e "${GREEN}✅ Limpieza completada${NC}"

# 7. RESUMEN FINAL
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ BACKUP COMPLETADO EXITOSAMENTE        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo "📍 Ubicación: ${FULL_PATH}"
echo "💾 Tamaño: ${TOTAL_SIZE}"
echo "📅 Retención: ${RETENTION_DAYS} días"
echo ""
echo "🔐 IMPORTANTE: Considera hacer backup remoto en la nube!"
echo ""

# Opcional: Enviar a servidor remoto
# (Descomenta y configura según necesites)
# echo "☁️  Sincronizando con servidor remoto..."
# rsync -avz --delete "${BACKUP_DIR}/" usuario@servidor:/backups/tvdreams/

exit 0
