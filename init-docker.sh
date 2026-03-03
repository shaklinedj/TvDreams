#!/bin/bash

# Script de Inicialización de Docker para TvDreams
# Ejecutar SOLO la PRIMERA VEZ: ./init-docker.sh
# Automatiza:
#   1. Verificación de Docker/Docker Compose
#   2. Creación de archivos necesarios
#   3. Compilación de imagen Docker
#   4. Inicialización de base de datos
#   5. Inicio de servicios
#   6. Verificación de salud

set -e

# ====================================================
# COLORES
# ====================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ====================================================
# BANNER
# ====================================================
clear
echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║       🐳 Inicializador de Docker - TvDreams               ║"
echo "║       Setup automático para producción                    ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ====================================================
# PASO 1: Verificar requisitos previos
# ====================================================
echo -e "${BLUE}[1/7]${NC} Verificando requisitos previos..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado${NC}"
    echo "   Instala desde: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose no está instalado${NC}"
    echo "   Instala desde: https://docs.docker.com/compose/install/"
    exit 1
fi

DOCKER_VERSION=$(docker --version | awk '{print $3}' | cut -d',' -f1)
COMPOSE_VERSION=$(docker-compose --version | awk '{print $3}' | cut -d',' -f1)

echo -e "${GREEN}✅${NC} Docker ${DOCKER_VERSION} instalado"
echo -e "${GREEN}✅${NC} Docker Compose ${COMPOSE_VERSION} instalado"

# ====================================================
# PASO 2: Verificar estructura del proyecto
# ====================================================
echo -e "\n${BLUE}[2/7]${NC} Verificando estructura del proyecto..."

REQUIRED_FILES=("Dockerfile" "docker-compose.yml" "docker-manager.sh" "package.json" "src/server/index.ts")
REQUIRED_DIRS=("database" "src" "public" "uploads")

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Archivo requerido no encontrado: $file${NC}"
        exit 1
    fi
done

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo -e "${YELLOW}⚠️  Directorio no existe, creando: $dir${NC}"
        mkdir -p "$dir"
    fi
done

echo -e "${GREEN}✅${NC} Estructura del proyecto validada"

# ====================================================
# PASO 3: Preparar archivo .env
# ====================================================
echo -e "\n${BLUE}[3/7]${NC} Preparando configuración de entorno..."

if [ ! -f ".env" ]; then
    if [ -f ".env.docker" ]; then
        cp .env.docker .env
        echo -e "${GREEN}✅${NC} Copiado .env.docker -> .env"
    elif [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✅${NC} Copiado .env.example -> .env"
    else
        echo -e "${YELLOW}⚠️  No hay archivo .env, usando valores por defecto${NC}"
    fi
else
    echo -e "${GREEN}✅${NC} .env ya existe"
fi

# ====================================================
# PASO 4: Crear directorios necesarios
# ====================================================
echo -e "\n${BLUE}[4/7]${NC} Creando directorios de volúmenes..."

mkdir -p uploads data logs backups
chmod -R 755 uploads data logs backups

echo -e "${GREEN}✅${NC} Directorios listos"

# ====================================================
# PASO 5: Build de imagen Docker
# ====================================================
echo -e "\n${BLUE}[5/7]${NC} Construyendo imagen Docker..."
echo -e "   ${CYAN}Esto puede tomar 2-5 minutos en la primera ejecución...${NC}"

if docker-compose build --progress=plain 2>&1 | tee /tmp/docker-build.log; then
    echo -e "${GREEN}✅${NC} Imagen Docker construida exitosamente"
else
    echo -e "${RED}❌ Error al construir imagen Docker${NC}"
    echo "   Revisa /tmp/docker-build.log para más detalles"
    exit 1
fi

# ====================================================
# PASO 6: Iniciar servicios
# ====================================================
echo -e "\n${BLUE}[6/7]${NC} Iniciando servicios (app + MySQL)..."
echo -e "   ${CYAN}Esperando inicialización de base de datos...${NC}"

docker-compose up -d

# Esperar a que MySQL esté listo
echo -e "\n   ${CYAN}⏳ Esperando a que MySQL inicie (hasta 60 segundos)...${NC}"
max_attempts=60
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker-compose exec -T db mysqladmin ping -u root -proot &>/dev/null; then
        echo -e "   ${GREEN}✅ MySQL respondiendo${NC}"
        break
    fi
    attempt=$((attempt + 1))
    echo -n "."
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "\n   ${RED}❌ MySQL no respondió en el tiempo esperado${NC}"
    echo -e "   ${YELLOW}Intenta: docker-compose logs db${NC}"
    exit 1
fi

# Esperar a que la app esté lista
echo -e "\n   ${CYAN}⏳ Esperando a que la app inicie (hasta 60 segundos)...${NC}"
max_attempts=60
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker-compose exec -T app wget --quiet --tries=1 --spider http://localhost:3001/api/status &>/dev/null; then
        echo -e "   ${GREEN}✅ App respondiendo${NC}"
        break
    fi
    attempt=$((attempt + 1))
    echo -n "."
    sleep 1
done

echo ""

# ====================================================
# PASO 7: Verificación final
# ====================================================
echo -e "\n${BLUE}[7/7]${NC} Verificación final del sistema..."

if ! docker-compose ps | grep -q "tvdreams-app.*Up"; then
    echo -e "${RED}❌ La app no está corriendo${NC}"
    docker-compose logs app
    exit 1
fi

if ! docker-compose ps | grep -q "tvdreams-db.*Up"; then
    echo -e "${RED}❌ La base de datos no está corriendo${NC}"
    docker-compose logs db
    exit 1
fi

echo -e "${GREEN}✅${NC} Servicios verificados y corriendo"

# ====================================================
# RESUMEN FINAL
# ====================================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}║  🎉 ¡INICIALIZACIÓN COMPLETADA EXITOSAMENTE!              ║${NC}"
echo -e "${GREEN}║                                                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}📍 ACCESOS INMEDIATOS:${NC}"
echo "   🌐 Frontend:      http://localhost:3001"
echo "   📺 Display:       http://localhost:3001/display.html"
echo "   💾 MySQL:         localhost:3306"
echo ""

echo -e "${CYAN}👤 Credenciales por defecto:${NC}"
echo "   Usuario: cms_user"
echo "   Contraseña: (verificar en .env)"
echo "   Base de datos: cms_usuarios_julius"
echo ""

echo -e "${CYAN}📋 Próximos pasos:${NC}"
echo "   1. Abre http://localhost:3001 en tu navegador"
echo "   2. Inicia sesión con admin/admin"
echo "   3. Cambia la contraseña"
echo ""

echo -e "${CYAN}🛠️  Comandos útiles:${NC}"
echo "   Ver logs:          docker-compose logs -f app"
echo "   Detener:           docker-compose down"
echo "   Reiniciar:         docker-compose restart"
echo "   Manager:           ./docker-manager.sh"
echo "   Backup:            ./backup-docker.sh"
echo ""

echo -e "${CYAN}📚 Documentación:${NC}"
echo "   cat DOCKER-DEPLOYMENT.md        # Guía completa"
echo "   cat DOCKER-QUICK-REF-ES.md      # Referencia rápida"
echo ""

echo -e "${YELLOW}💡 NOTA:${NC} Este script solo se debe ejecutar UNA VEZ"
echo -e "    Próximas veces usa: ${CYAN}./docker-manager.sh${NC} o ${CYAN}docker-compose up -d${NC}"
echo ""
