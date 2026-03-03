#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════╗"
echo "║       TvDreams Docker Manager             ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar que Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker no está instalado${NC}"
    echo "Instala Docker desde: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose no está instalado${NC}"
    echo "Instala Docker Compose desde: https://docs.docker.com/compose/install/"
    exit 1
fi

# Verificar si es la primera ejecución
if ! docker-compose ps &>/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Parece que es la PRIMERA VEZ que ejecutas Docker${NC}"
    echo ""
    echo -e "${BLUE}Se recomienda ejecutar primero el script de inicialización:${NC}"
    echo ""
    echo -e "  ${CYAN}./init-docker.sh${NC}"
    echo ""
    echo "Este script:"
    echo "  ✅ Verifica Docker y Docker Compose"
    echo "  ✅ Prepara el archivo .env"
    echo "  ✅ Construye la imagen"
    echo "  ✅ Inicializa la BD"
    echo "  ✅ Inicia todos los servicios"
    echo "  ✅ Verifica que todo funcione"
    echo ""
    read -p "¿Continuar de todas formas? (s/n): " continue_anyway
    if [ "$continue_anyway" != "s" ] && [ "$continue_anyway" != "S" ]; then
        echo -e "${YELLOW}Ejecuta primero: ./init-docker.sh${NC}"
        exit 0
    fi
fi

# Menu principal
echo -e "${YELLOW}Selecciona una opción:${NC}"
echo "1) Iniciar contenedores (docker-compose up -d)"
echo "2) Detener contenedores"
echo "3) Ver logs de la aplicación"
echo "4) Ver logs de la base de datos"
echo "5) Reconstruir imagen (docker-compose build)"
echo "6) Reiniciar contenedores"
echo "7) Ejecutar shell en MySQL"
echo "8) Ver estado de los contenedores"
echo "9) Limpiar todo (borrar contenedores, volúmenes)"
echo "10) Salir"

read -p "Opción: " option

case $option in
    1)
        echo -e "${BLUE}🚀 Iniciando contenedores...${NC}"
        docker-compose up -d
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Contenedores iniciados correctamente${NC}"
            echo -e "${BLUE}📍 Acceso:${NC}"
            echo "   - App: http://localhost:3001"
            echo "   - Display: http://localhost:3001/display.html"
            echo ""
            echo "Espera 30 segundos para que la base de datos inicie completamente..."
            sleep 30
            echo -e "${GREEN}✅ Sistema listo${NC}"
        else
            echo -e "${RED}❌ Error al iniciar contenedores${NC}"
        fi
        ;;
    2)
        echo -e "${BLUE}🛑 Deteniendo contenedores...${NC}"
        docker-compose down
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Contenedores detenidos${NC}"
        fi
        ;;
    3)
        echo -e "${BLUE}📋 Logs de la aplicación (Ctrl+C para salir):${NC}"
        docker-compose logs -f app
        ;;
    4)
        echo -e "${BLUE}📋 Logs de la base de datos (Ctrl+C para salir):${NC}"
        docker-compose logs -f db
        ;;
    5)
        echo -e "${BLUE}🔨 Reconstruyendo imagen...${NC}"
        docker-compose build --no-cache
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Imagen reconstruida${NC}"
        else
            echo -e "${RED}❌ Error al reconstruir${NC}"
        fi
        ;;
    6)
        echo -e "${BLUE}🔄 Reiniciando contenedores...${NC}"
        docker-compose restart
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Contenedores reiniciados${NC}"
        fi
        ;;
    7)
        echo -e "${BLUE}🔧 Abriendo shell en MySQL...${NC}"
        docker-compose exec db mysql -u cms_user -p cms_usuarios_jules
        ;;
    8)
        echo -e "${BLUE}📊 Estado de contenedores:${NC}"
        docker-compose ps
        ;;
    9)
        echo -e "${RED}⚠️  ADVERTENCIA: Esto borrará todos los contenedores y volúmenes${NC}"
        read -p "¿Estás seguro? (s/n): " confirm
        if [ "$confirm" = "s" ] || [ "$confirm" = "S" ]; then
            echo -e "${BLUE}🗑️  Limpiando...${NC}"
            docker-compose down -v
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ Sistema limpiado${NC}"
            fi
        else
            echo -e "${YELLOW}Cancelado${NC}"
        fi
        ;;
    10)
        echo -e "${BLUE}👋 ¡Hasta luego!${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Opción inválida${NC}"
        exit 1
        ;;
esac
