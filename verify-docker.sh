#!/bin/bash

# Script de Verificación Pre-Start para TvDreams Docker
# Verifica que todo esté listo antes de iniciar contenedores
# Uso: ./verify-docker.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

errors=0
warnings=0

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Verificación Pre-Start de Docker         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# ==================================================
# SISTEMA
# ==================================================
echo -e "${CYAN}🔍 VERIFICACIONES DEL SISTEMA${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Docker instalado
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | cut -d',' -f1)
    echo -e "${GREEN}✅${NC} Docker ${DOCKER_VERSION} instalado"
else
    echo -e "${RED}❌${NC} Docker NO instalado"
    errors=$((errors + 1))
fi

# Docker Compose instalado
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version | awk '{print $3}' | cut -d',' -f1)
    echo -e "${GREEN}✅${NC} Docker Compose ${COMPOSE_VERSION} instalado"
else
    echo -e "${RED}❌${NC} Docker Compose NO instalado"
    errors=$((errors + 1))
fi

# Docker daemon corriendo
if docker info &> /dev/null; then
    echo -e "${GREEN}✅${NC} Docker daemon corriendo"
else
    echo -e "${RED}❌${NC} Docker daemon NO está corriendo"
    errors=$((errors + 1))
fi

# ==================================================
# ARCHIVOS DEL PROYECTO
# ==================================================
echo ""
echo -e "${CYAN}📂 ARCHIVOS DEL PROYECTO${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

required_files=(
    "Dockerfile"
    "docker-compose.yml"
    "package.json"
    "src/server/index.ts"
    "database/full-schema.sql"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $file"
    else
        echo -e "${RED}❌${NC} $file NO ENCONTRADO"
        errors=$((errors + 1))
    fi
done

# ==================================================
# DIRECTORIOS NECESARIOS
# ==================================================
echo ""
echo -e "${CYAN}📁 DIRECTORIOS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

required_dirs=(
    "uploads"
    "data"
    "src"
    "public"
    "database"
)

for dir in "${required_dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✅${NC} $dir/"
    else
        echo -e "${YELLOW}⚠️ ${NC} $dir/ NO EXISTE (creando...)"
        mkdir -p "$dir"
        warnings=$((warnings + 1))
    fi
done

# ==================================================
# CONFIGURACIÓN DE ENTORNO
# ==================================================
echo ""
echo -e "${CYAN}⚙️  CONFIGURACIÓN DE ENTORNO${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f ".env" ]; then
    echo -e "${GREEN}✅${NC} .env encontrado"
    # Check key variables
    if grep -q "MYSQL_HOST" .env; then
        MYSQL_HOST=$(grep "^MYSQL_HOST=" .env | cut -d'=' -f2)
        echo -e "   MYSQL_HOST = $MYSQL_HOST"
    fi
    if grep -q "JWT_SECRET" .env; then
        JWT_STATUS=$(grep "^JWT_SECRET=" .env | cut -d'=' -f2)
        if [ -n "$JWT_STATUS" && "$JWT_STATUS" != "your-secret" ]; then
            echo -e "   JWT_SECRET = ✅ Configurado"
        else
            echo -e "   JWT_SECRET = ${YELLOW}⚠️  CAMBIAR EN PRODUCCIÓN${NC}"
            warnings=$((warnings + 1))
        fi
    fi
else
    echo -e "${YELLOW}⚠️ ${NC} .env NO encontrado"
    if [ -f ".env.docker" ]; then
        echo -e "   Usa: cp .env.docker .env"
        warnings=$((warnings + 1))
    else
        echo -e "${RED}❌${NC} Tampoco existe .env.docker"
        errors=$((errors + 1))
    fi
fi

# ==================================================
# PUERTOS DISPONIBLES
# ==================================================
echo ""
echo -e "${CYAN}🔌 PUERTOS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Leer puerto de .env o usar default
if [ -f ".env" ]; then
    APP_PORT=$(grep "^APP_PORT=" .env | cut -d'=' -f2 || echo "3001")
    MYSQL_PORT=$(grep "^MYSQL_PORT=" .env | cut -d'=' -f2 || echo "3306")
else
    APP_PORT="3001"
    MYSQL_PORT="3306"
fi

# Verificar puerto 3001
if ! netstat -tuln 2>/dev/null | grep -q ":$APP_PORT " && ! ss -tuln 2>/dev/null | grep -q ":$APP_PORT "; then
    echo -e "${GREEN}✅${NC} Puerto $APP_PORT disponible"
else
    echo -e "${YELLOW}⚠️ ${NC} Puerto $APP_PORT estará en uso (cambiar en .env si es necesario)"
    warnings=$((warnings + 1))
fi

# ==================================================
# ESPACIO EN DISCO
# ==================================================
echo ""
echo -e "${CYAN}💾 ESPACIO EN DISCO${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

available=$(df . | awk 'NR==2 {print $4}')
if [ "$available" -gt 5242880 ]; then  # 5GB en KB
    space_gb=$((available / 1048576))
    echo -e "${GREEN}✅${NC} ${space_gb}GB disponible"
else
    echo -e "${YELLOW}⚠️ ${NC} Menos de 5GB disponible"
    warnings=$((warnings + 1))
fi

# ==================================================
# CONTENEDORES CORRIENDO
# ==================================================
echo ""
echo -e "${CYAN}🐳 CONTENEDORES${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if docker-compose ps 2>/dev/null | grep -q "tvdreams"; then
    echo -e "${GREEN}✅${NC} Contenedores detectados"
    docker-compose ps
else
    echo -e "${YELLOW}ℹ️ ${NC} No hay contenedores corriendo (primera ejecución)"
fi

# ==================================================
# RESUMEN FINAL
# ==================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $errors -eq 0 ] && [ $warnings -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ VERIFICACIÓN COMPLETA - LISTO PARA IR  ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
    exit 0
elif [ $errors -eq 0 ]; then
    echo -e "${YELLOW}╔════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  ⚠️  VERIFICACIÓN CON ADVERTENCIAS         ║${NC}"
    echo -e "${YELLOW}║  $warnings advertencia(s) - Puedes continuar ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ❌ VERIFICACIÓN FALLIDA                   ║${NC}"
    echo -e "${RED}║  $errors error(es) detectado(s)  ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════╝${NC}"
    exit 1
fi
