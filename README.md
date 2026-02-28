# CMS Usuarios Jules

Sistema de gestión de contenido para pantallas publicitarias con soporte MySQL.

## 📚 **Documentación Completa**

- 📖 **[docs/guides/RESUMEN-APLICACION.md](./docs/guides/RESUMEN-APLICACION.md)** - Resumen completo de funcionalidades, tecnologías y configuración
- 📁 **[docs/guides/TIPOS-ARCHIVOS-SOPORTADOS.md](./docs/guides/TIPOS-ARCHIVOS-SOPORTADOS.md)** - Guía completa de formatos de archivos soportados en el display
- ⚡ **[docs/guides/GUIA-RAPIDA-CONFIGURACION.md](./docs/guides/GUIA-RAPIDA-CONFIGURACION.md)** - Guía express para cambios de host/IP
- 🚀 **[docs/guides/DEPLOY.md](./docs/guides/DEPLOY.md)** - Guía detallada de despliegue en producción
- 🌐 **[docs/guides/REVERSE-PROXY.md](./docs/guides/REVERSE-PROXY.md)** - Configuración de proxy reverso para URLs profesionales
- 📸 **[screenshots/README.md](./screenshots/README.md)** - Capturas de pantalla de la aplicación

## Requisitos

- Node.js 18+
- MySQL 5.7+ o MariaDB 10.3+
- NPM

> ✅ **Compatibilidad**: Cross-platform (Windows, macOS, Linux)

## Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd cms_ususarios_jules
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar base de datos MySQL**
   
   **⚠️ IMPORTANTE**: Configurar MySQL ANTES de ejecutar la aplicación.
   
   **Opción A - Instalación Manual:**
   ```bash
   # 1. Como usuario root, crear base de datos y usuario
   mysql -u root -p < database/setup-database.sql
   
   # 2. Importar esquema completo con datos iniciales
   mysql -u cms_user -p cms_usuarios_jules < database/full-schema.sql
   ```
   
   **Opción B - Script Automático:**
   ```bash
   # Ejecutar script de inicialización automática
   node init-db.js
   ```

4. **Configurar variables de entorno**
   
   Copiar `.env.example` a `.env` y configurar:
   ```env
   JWT_SECRET=tu-clave-secreta-jwt
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=cms_user
   MYSQL_PASSWORD=tu_contraseña
   MYSQL_DATABASE=cms_usuarios_jules
   FRONTEND_URL=http://localhost:5173
   ```

## Desarrollo

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Display: http://localhost:3001/display.html

## Producción

### Inicio Rápido
```bash
npm run build
npm start
```

### Mantener la Aplicación Ejecutándose (Recomendado para Producción)

Si necesitas que la aplicación siga ejecutándose después de cerrar SSH/PuTTY:

**Opción 1: PM2 (Recomendado)**
```bash
# Instalar PM2
npm install -g pm2

# Iniciar con PM2
npm run pm2:start

# Ver estado
npm run pm2:status

# Ver logs
npm run pm2:logs
```

**Opción 2: nohup (Método simple)**
```bash
nohup npm start > logs/app.log 2>&1 &
```

Ver más opciones en [docs/guides/DEPLOY.md](./docs/guides/DEPLOY.md)

## Configuración de Red con Múltiples IPs

Si tu servidor tiene múltiples direcciones IP (ej: 192.168.1.1 y 172.20.80.220), la aplicación detecta automáticamente la IP por la que te conectas y configura el WebSocket para usar esa misma IP.

**Ejemplo:**
- Te conectas a: `http://172.20.80.220:3001`
- WebSocket usa: `ws://172.20.80.220:3001` ✅ (misma IP)

No se requiere configuración manual. La detección es automática.

## Características

- **Dashboard**: Gestión de medios y pantallas
- **Display**: Sistema de reproducción para pantallas publicitarias
- **Formatos soportados**: 
  - 📸 Imágenes: JPEG, PNG, GIF, WebP (hasta 10MB)
  - 🎥 Videos: MP4, WebM, AVI, MOV (hasta 1GB)
- **Thumbnails**: Generación automática para optimización
- **Analytics**: Métricas de uso y conexiones
- **Multi-pantalla**: Soporte para múltiples displays simultáneos

## Credenciales por defecto

- Usuario: `admin`
- Contraseña: `admin`

Cambiar después del primer login.

> ⚠️ **¿No puedes entrar con admin/admin?** Ver [database/TROUBLESHOOTING.md](./database/TROUBLESHOOTING.md) para solucionar problemas de credenciales.

## 📸 Capturas de Pantalla

### Login y Dashboard Principal
![Login](https://github.com/user-attachments/assets/51611ef1-e170-4375-8921-93b7463c339e)
![Dashboard](https://github.com/user-attachments/assets/6acd2f1f-9e66-41eb-a4a3-9b0c7e057fd0)

### Gestión de Pantallas y Analíticas
![Pantallas](https://github.com/user-attachments/assets/b705afb6-9685-4020-8b00-5164e34e0197)
![Analíticas](https://github.com/user-attachments/assets/88b82782-826c-4aac-9454-13fd416c3ca6)

### Sistema de Display
![Display](https://github.com/user-attachments/assets/9e9cae19-1f6d-4c7e-a986-b009a69ba134)

Ver más capturas en [screenshots/README.md](./screenshots/README.md)

## Base de datos

El sistema usa MySQL con las siguientes tablas principales:

- `users` - Usuarios del sistema
- `media` - Archivos de imagen y video
- `screens` - Configuración de pantallas
- `folders` - Organización de contenido
- `analytics` - Métricas del sistema

Ver `database/full-schema.sql` para el esquema completo consolidado.

> 📝 **Nota**: Los archivos `database-schema.sql`, `scripts/mysql-schema.sql` y `add-session-id-migration.sql` han sido consolidados en `database/full-schema.sql` para una mejor organización.

## 🚀 Despliegue en Producción

### Con Apache + Reverse Proxy

```apache
<VirtualHost *:80>
    ServerName tu-dominio.com
    
    # Redireccionar a HTTPS
    Redirect permanent / https://tu-dominio.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName tu-dominio.com
    
    # Certificados SSL
    SSLEngine on
    SSLCertificateFile /path/to/certificate.crt
    SSLCertificateKeyFile /path/to/private.key
    
    # Proxy hacia Node.js
    ProxyPass / http://localhost:3001/
    ProxyPassReverse / http://localhost:3001/
    
    # WebSocket support
    ProxyPass /socket.io/ ws://localhost:3001/socket.io/
    ProxyPassReverse /socket.io/ ws://localhost:3001/socket.io/
    
    # Headers para archivos grandes
    LimitRequestBody 1073741824
</VirtualHost>
```

### Con Caddy (Más Simple)

```caddy
tu-dominio.com {
    reverse_proxy localhost:3001
    
    # Automáticamente maneja HTTPS
    # Automáticamente maneja WebSocket
    
    # Configuración para archivos grandes
    request_body {
        max_size 100MB
    }
}
```

### Comandos de Producción

```bash
# 1. Construir aplicación
npm run build

# 2. Configurar variables de entorno de producción
cp .env.example .env
# Editar .env con valores de producción

# 3. Configurar base de datos MySQL
mysql -u root -p < database/setup-database.sql
mysql -u cms_user -p cms_usuarios_jules < database/full-schema.sql

# 4. Iniciar aplicación
npm start

# 5. Verificar que el servidor está corriendo
curl http://localhost:3001/api/status
```

### Configuración MySQL en Producción

**Variables de entorno requeridas en `.env`:**
```env
# JWT Secret Key (cambiar por una clave segura)
JWT_SECRET=tu-clave-jwt-muy-segura-para-produccion

# MySQL Configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=cms_user
MYSQL_PASSWORD=cms_password_2024
MYSQL_DATABASE=cms_usuarios_jules

# Environment
NODE_ENV=production
```

**Configuración de seguridad MySQL:**
```sql
-- Cambiar contraseña del usuario en producción
ALTER USER 'cms_user'@'localhost' IDENTIFIED BY 'contraseña-segura-produccion';

-- Configurar límites de conexión
ALTER USER 'cms_user'@'localhost' WITH MAX_CONNECTIONS_PER_HOUR 100;

-- Verificar permisos
SHOW GRANTS FOR 'cms_user'@'localhost';
```
