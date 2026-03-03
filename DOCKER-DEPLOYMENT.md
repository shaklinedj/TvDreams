# 🐳 Guía de Dockerización - TvDreams

## 📋 Tabla de Contenidos

1. [¿Por qué Docker?](#por-qué-docker)
2. [Requisitos previos](#requisitos-previos)
3. [Instalación de Docker](#instalación-de-docker)
4. [Inicio rápido (3 minutos)](#inicio-rápido)
5. [Estructura de contenedores](#estructura-de-contenedores)
6. [Configuración avanzada](#configuración-avanzada)
7. [Despliegue en producción](#despliegue-en-producción)
8. [Solución de problemas](#solución-de-problemas)
9. [Migración de servidor](#migración-de-servidor)

---

## ¿Por qué Docker?

### Ventajas principales:

✅ **Portabilidad**: Funciona igual en tu laptop, en el servidor de desarrollo y en producción  
✅ **Aislamiento**: Las dependencias no contaminan el sistema  
✅ **Reproducibilidad**: Mismo comportamiento en cualquier máquina  
✅ **Escalabilidad**: Fácil de replicar en múltiples servidores  
✅ **Facilidad de backup/restore**: Volúmenes persistentes bien definidos  
✅ **Actualizaciones sin riesgo**: Rollback instantáneo  

---

## Requisitos previos

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **CPU**: 2+ cores recomendado
- **RAM**: 2GB mínimo, 4GB+ para producción
- **Disco**: 5GB disponibles (cresciente con uploads)

---

## Instalación de Docker

### Linux (Ubuntu/Debian)

```bash
# Actualizar paquetes
sudo apt update && sudo apt upgrade -y

# Instalar Docker
sudo apt install -y docker.io docker-compose

# Agregar tu usuario al grupo docker (evita sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verificar instalación
docker --version
docker-compose --version
```

### macOS

```bash
# Con Homebrew
brew install docker docker-compose

# O descargar Docker Desktop desde:
# https://www.docker.com/products/docker-desktop
```

### Windows

Descargar **Docker Desktop for Windows** desde:
https://www.docker.com/products/docker-desktop

---

## Inicio rápido

### Option 1: Usando el script helper (Recomendado)

```bash
# Hacer ejecutable el script
chmod +x docker-manager.sh

# Ejecutar el manager interactivo
./docker-manager.sh
```

Selecciona opción `1` para iniciar todo.

### Option 2: Comandos directos

```bash
# Iniciar contenedores en background
docker-compose up -d

# Esperar 30 segundos mientras la base de datos se inicializa
sleep 30

# Verificar estado
docker-compose ps

# Ver logs
docker-compose logs -f app
```

### Acceso después del inicio:

```
🌐 Frontend: http://localhost:3001
📺 Display:  http://localhost:3001/display.html
💾 MySQL:    localhost:3306
```

**Credenciales por defecto** (cambiar en producción):
- Usuario: `cms_user`
- Contraseña: `cms_password`
- Base de datos: `cms_usuarios_julius`

---

## Estructura de contenedores

```
┌─────────────────────────────────┐
│   Docker Network (Bridge)       │
├─────────────────────────────────┤
│                                 │
│  ┌────────────────────────────┐ │
│  │   tvdreams-app            │ │
│  │ (Node.js + Express)        │ │
│  │ Puerto: 3001               │ │
│  │ Volúmenes:                 │ │
│  │ - uploads/                 │ │
│  │ - data/                    │ │
│  └────────────────────────────┘ │
│            ↕ (TCP)              │
│  ┌────────────────────────────┐ │
│  │   tvdreams-db             │ │
│  │ (MySQL 8.0)                │ │
│  │ Puerto: 3306               │ │
│  │ Volumen: db_data/          │ │
│  └────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

### Explicación de servicios:

**`app` (Aplicación)**
- Imagen: Build local basado en `Dockerfile`
- Depende de: `db` (espera a que esté listo)
- Expone: Puerto 3001 (HTTP)
- Volúmenes:
  - `./uploads/` → `/app/uploads` (archivos subidos)
  - `./data/` → `/app/data` (premios recientes persistidos)
  - `./logs/` → `/app/logs` (logs opcionalmente)

**`db` (Base de datos)**
- Imagen: `mysql:8.0-alpine` (143 MB)
- Expone: Puerto 3306 (MySQL)
- Volumen: `db_data` (volumen Docker, no en disco)
- Health check: Valida disponibilidad cada 10s

---

## Configuración avanzada

### Editar variables de entorno

Opción A: Copiar `.env.docker` a `.env` (recomendado):

```bash
cp .env.docker .env
nano .env  # Editar valores
docker-compose up -d
```

Opción B: Usar archivo `.env.docker` específico:

```bash
docker-compose --env-file .env.docker up -d
```

### Variables importantes:

| Variable | Valor por defecto | Descripción |
|----------|------------------|-------------|
| `NODE_ENV` | `production` | Modo de ejecución |
| `JWT_SECRET` | `your-secret...` | ⚠️ **CAMBIAR EN PRODUCCIÓN** |
| `MYSQL_HOST` | `db` | Nombre del servicio (no cambiar) |
| `MYSQL_PASSWORD` | `cms_password` | ⚠️ **Cambiar en producción** |
| `FRONTEND_URL` | `http://localhost:5173` | URL pública de la app |
| `GMAIL_APP_PASSWORD` | *(vacío)* | Para envío de emails |

### Generar JWT_SECRET seguro

```bash
openssl rand -hex 32
# Resultado: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

## Despliegue en producción

### 1. Preparación del servidor

```bash
# SSH hacia el servidor
ssh tu@servidor.com

# Clonar el repositorio
git clone https://github.com/shaklinedj/TvDreams.git
cd TvDreams

# Crear archivo .env con valores reales
cp .env.docker .env
nano .env  # Editar con valores reales

# Hacer ejecutable el script
chmod +x docker-manager.sh
```

### 2. Variables críticas para producción

```bash
# .env (Personalizar)
NODE_ENV=production
JWT_SECRET=<generar con: openssl rand -hex 32>
MYSQL_ROOT_PASSWORD=<contraseña_fuerte>
MYSQL_PASSWORD=<contraseña_fuerte>
FRONTEND_URL=https://tvdreams.tudominio.com
GMAIL_APP_PASSWORD=<si_usas_gmail>
```

### 3. Iniciar con persistencia

```bash
# Iniciar como servicio
docker-compose up -d

# Verificar estado
docker-compose ps
docker-compose logs app
```

### 4. Configurar HTTPS (Nginx reverse proxy)

```bash
# Instalar Nginx
sudo apt install nginx -y

# Crear archivo de configuración
sudo nano /etc/nginx/sites-available/tvdreams

# Contenido:
server {
    listen 80;
    server_name tvdreams.tudominio.com;
    
    # Redirigir HTTP a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tvdreams.tudominio.com;
    
    # Certificado SSL (usar Certbot)
    ssl_certificate /etc/letsencrypt/live/tvdreams.tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tvdreams.tudominio.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Habilitar y recargar:

```bash
sudo ln -s /etc/nginx/sites-available/tvdreams /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. SSL con Certbot (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot certonly --nginx -d tvdreams.tudominio.com

# Auto-renovación
sudo certbot renew --dry-run
```

---

## Solución de problemas

### Problema: "Connection refused" al conectar a la DB

```bash
# Verificar que el contenedor está corriendo
docker-compose ps

# Ver logs de la DB
docker-compose logs db

# Solución: Esperar más tiempo (30s) y reintentar
sleep 30
docker-compose restart app
```

### Problema: Puerto 3001 ya en uso

```bash
# Cambiar puerto en .env
APP_PORT=3002

# O terminar el proceso que usa el puerto
sudo lsof -i :3001
sudo kill -9 <PID>
```

### Problema: Base de datos no se inicializa

```bash
# Eliminar volumen y reconstruir
docker-compose down -v
docker-compose up -d

# Esperar 40 segundos y verificar logs
sleep 40
docker-compose logs db
```

### Problema: Sin espacio en disco

```bash
# Ver uso de Docker
docker system df

# Limpiar contenedores e imágenes no usadas
docker system prune -a --volumes

# O eliminar todo y comenzar de nuevo
docker-compose down -v
docker image rm tvdreams-app
```

### Problema: Permisos en volúmenes (Linux)

```bash
# Si los archivos en ./uploads son inaccesibles:
sudo chown -R 1000:1000 uploads data logs

# O ejecutar el contenedor como root (no recomendado):
# Agregar en docker-compose.yml bajo 'app':
# user: "0:0"
```

---

## Migración de servidor

### Backup completo:

```bash
# Desde servidor VIEJO
docker-compose exec db mysqldump -u cms_user -p cms_usuarios_julius > backup.sql
docker-compose exec -T db tar czf /tmp/backup.tar.gz /var/lib/mysql
docker cp tvdreams-db:/tmp/backup.tar.gz ./backup_db.tar.gz

# Copiar a nuevo servidor
scp backup.sql tu@nuevo-servidor:/home/user/TvDreams/
scp backup_db.tar.gz tu@nuevo-servidor:/home/user/TvDreams/
```

### Restaurar en servidor NUEVO:

```bash
# En el nuevo servidor
cd /home/user/TvDreams

# Restaurar datos de la DB
docker-compose up -d db
sleep 10
docker-compose exec -T db mysql -u cms_user -p cms_usuarios_julius < backup.sql

# Iniciar app
docker-compose up -d app

# Verificar
docker-compose ps
docker-compose logs app
```

---

## Comandos útiles

```bash
# Iniciar/Detener
docker-compose up -d              # Iniciar en background
docker-compose down               # Detener
docker-compose restart            # Reiniciar
docker-compose restart app        # Reiniciar solo app

# Logs
docker-compose logs               # Ver todos los logs
docker-compose logs -f app        # Seguir logs de app (Ctrl+C para salir)
docker-compose logs --tail 100    # Últimas 100 líneas

# Shell interactivo
docker-compose exec app sh        # Shell en app
docker-compose exec db mysql -u cms_user -p  # MySQL CLI

# Construcción
docker-compose build              # Reconstruir imagen
docker-compose build --no-cache   # Fuerza build sin caché

# Limpieza
docker-compose down -v            # Detener y borrar volúmenes
docker system prune               # Limpiar contenedores no usados
docker volume ls                  # Listar volúmenes
docker volume rm tvdreams_db_data # Borrar volumen (destructivo)

# Estadísticas
docker-compose ps                 # Estado de contenedores
docker stats                      # Uso de recursos en tiempo real
docker-compose logs db | tail -20 # Últimas 20 líneas de DB
```

---

## Checklist de producción

- [ ] ✅ Editar `.env` con valores reales
- [ ] ✅ Cambiar `JWT_SECRET` (usar `openssl rand -hex 32`)
- [ ] ✅ Cambiar `MYSQL_PASSWORD` a contraseña fuerte
- [ ] ✅ Configurar `FRONTEND_URL` con dominio real
- [ ] ✅ Instalar certificado SSL (Certbot + Let's Encrypt)
- [ ] ✅ Nginx reverse proxy configurado
- [ ] ✅ Backup automático de base de datos
- [ ] ✅ Health checks activados y monitoreados
- [ ] ✅ Logs centralizados (opcional con ELK, Datadog, etc)
- [ ] ✅ Monitor de recursos (Docker stats, Prometheus)
- [ ] ✅ Plan de disaster recovery & rollback

---

## Recursos adicionales

- 📖 [Documentación oficial Docker](https://docs.docker.com)
- 📖 [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- 📖 [Best practices para Docker](https://docs.docker.com/develop/prod-checklist/)
- 🎓 [Curso YouTube: Docker fundamentals](https://www.youtube.com/results?search_query=docker+tutorial)

---

**¡Listo! Tu aplicación ahora es portátil y escalable. 🚀**
