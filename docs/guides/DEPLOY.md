# Guía de Despliegue para Producción con PHP/MySQL

Esta guía se enfoca en desplegar la aplicación CMS usando solo PHP/MySQL con reverse proxy usando Laragon, XAMPP o instalaciones nativas de PHP/MySQL.

## 📋 Prerrequisitos

### Opción A: Laragon (Recomendado para Windows)
1. **Laragon** instalado y funcionando
2. **Node.js** (versión 18 o superior) 
3. **MySQL** configurado en Laragon
4. **Apache** activado en Laragon para reverse proxy

### Opción B: XAMPP
1. **XAMPP** instalado con Apache y MySQL
2. **Node.js** (versión 18 o superior)
3. **Apache mod_proxy** habilitado

### Opción C: PHP/MySQL Nativo
1. **PHP** 7.4+ o 8.x instalado
2. **MySQL** 5.7+ o MariaDB 10.3+
3. **Apache** con mod_proxy habilitado
4. **Node.js** (versión 18 o superior)

> ✅ **Compatibilidad**: Cross-platform (Windows, macOS, Linux)

## 🚀 Pasos para Despliegue

### 1. Preparar el Proyecto

```bash
# Instalar dependencias
npm install

# Construir el frontend para producción
npm run build
```

### 2. Configurar Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# JWT Secret Key
JWT_SECRET=tu-clave-secreta-muy-segura-aqui

# MySQL Database Configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=cms_usuarios_jules

# Environment
NODE_ENV=production

# Frontend URL (opcional)
FRONTEND_URL=http://localhost:3001
```

**Para XAMPP:** Usar `root` sin contraseña por defecto
**Para Laragon:** Usar `root` sin contraseña por defecto
**Para instalación nativa:** Configurar según tu instalación MySQL

### 3. Configurar la Base de Datos

```bash
# Ejecutar scripts de base de datos
mysql -u root -p < database/setup-database.sql
mysql -u cms_user -p cms_usuarios_jules < database/full-schema.sql
```

### 4. Ejecutar en Producción

Hay varias opciones para mantener la aplicación ejecutándose, incluso después de cerrar la sesión SSH/PuTTY:

#### Opción A: Usando PM2 (Recomendado)

PM2 es un gestor de procesos que mantiene la aplicación ejecutándose en segundo plano.

**Instalar PM2 globalmente:**
```bash
npm install -g pm2
```

**Iniciar la aplicación con PM2:**
```bash
# Iniciar usando el archivo de configuración incluido
pm2 start ecosystem.config.js

# O iniciar directamente
pm2 start src/server/index.ts --name cms-hlaure --interpreter tsx

# Ver estado de la aplicación
pm2 status

# Ver logs en tiempo real
pm2 logs cms-hlaure

# Reiniciar la aplicación
pm2 restart cms-hlaure

# Detener la aplicación
pm2 stop cms-hlaure

# Configurar PM2 para iniciar automáticamente al arrancar el servidor
pm2 startup
pm2 save
```

**Ventajas de PM2:**
- ✅ Auto-reinicio si la aplicación falla
- ✅ Logs centralizados
- ✅ Monitoreo de recursos
- ✅ Reinicio automático al arrancar el servidor
- ✅ Funciona en Windows, Linux y macOS

#### Opción B: Usando systemd (Solo Linux)

Si prefieres usar systemd en lugar de PM2:

```bash
# 1. Copiar el archivo de servicio incluido
sudo cp cms-hlaure.service /etc/systemd/system/

# 2. Editar el archivo y actualizar rutas
sudo nano /etc/systemd/system/cms-hlaure.service
# Cambiar: WorkingDirectory=/path/to/cms_hlaure por tu ruta real
# Cambiar: User=www-data por tu usuario

# 3. Recargar systemd
sudo systemctl daemon-reload

# 4. Habilitar el servicio para inicio automático
sudo systemctl enable cms-hlaure

# 5. Iniciar el servicio
sudo systemctl start cms-hlaure

# Ver estado
sudo systemctl status cms-hlaure

# Ver logs
sudo journalctl -u cms-hlaure -f
```

#### Opción C: Usando nohup (Método Simple)

Si no quieres instalar PM2 ni configurar systemd:

```bash
# Iniciar en segundo plano
nohup npm start > logs/app.log 2>&1 &

# Ver el proceso
ps aux | grep node

# Ver logs
tail -f logs/app.log

# Detener (buscar el PID primero)
kill <PID>
```

#### Opción D: Comando simple (NO recomendado para producción)

Solo para pruebas temporales:
```bash
npm start
```

⚠️ **IMPORTANTE**: Con este método, la aplicación se detendrá al cerrar la terminal.

La aplicación se ejecutará en http://localhost:3001

### 5. Configurar Reverse Proxy con Apache

Para eliminar el puerto de la URL y tener URLs más profesionales, configura Apache como reverse proxy.

#### Para Laragon:

1. **Habilitar módulos Apache** (ya habilitados por defecto):
   - mod_proxy
   - mod_proxy_http
   - mod_proxy_wstunnel

2. **Crear Virtual Host**:
   Crear archivo `C:\laragon\etc\apache2\sites-enabled\cms-hlaure.conf`:

```apache
<VirtualHost *:80>
    ServerName cms-hlaure.test
    DocumentRoot "C:\laragon\www\cms-hlaure"
    
    # Reverse Proxy hacia Node.js
    ProxyPreserveHost On
    ProxyPass / http://localhost:3001/
    ProxyPassReverse / http://localhost:3001/
    
    # WebSocket support
    ProxyPass /socket.io/ ws://localhost:3001/socket.io/
    ProxyPassReverse /socket.io/ ws://localhost:3001/socket.io/
    
    # Configuración para archivos grandes
    LimitRequestBody 1073741824
    ProxyTimeout 300
    
    # Headers necesarios
    ProxyPreserveHost On
    ProxyAddHeaders On
    
    ErrorLog "C:\laragon\logs\cms-hlaure-error.log"
    CustomLog "C:\laragon\logs\cms-hlaure-access.log" combined
</VirtualHost>
```

3. **Agregar entrada en hosts**:
   Editar `C:\Windows\System32\drivers\etc\hosts`:
   ```
   127.0.0.1 cms-hlaure.test
   ```

4. **Reiniciar Apache en Laragon**

#### Para XAMPP:

1. **Habilitar módulos Apache**:
   Editar `xampp/apache/conf/httpd.conf` y descomentar:
   ```apache
   LoadModule proxy_module modules/mod_proxy.so
   LoadModule proxy_http_module modules/mod_proxy_http.so
   LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so
   ```

2. **Crear Virtual Host**:
   Editar `xampp/apache/conf/extra/httpd-vhosts.conf`:

```apache
<VirtualHost *:80>
    ServerName cms-hlaure.local
    
    # Reverse Proxy hacia Node.js
    ProxyPreserveHost On
    ProxyPass / http://localhost:3001/
    ProxyPassReverse / http://localhost:3001/
    
    # WebSocket support
    ProxyPass /socket.io/ ws://localhost:3001/socket.io/
    ProxyPassReverse /socket.io/ ws://localhost:3001/socket.io/
    
    # Configuración para archivos grandes
    LimitRequestBody 1073741824
    ProxyTimeout 300
    
    ErrorLog "logs/cms-hlaure-error.log"
    CustomLog "logs/cms-hlaure-access.log" combined
</VirtualHost>
```

## 🌐 Acceso a la Aplicación

**Sin reverse proxy:**
- Dashboard: http://localhost:3001
- API: http://localhost:3001/api

**Con reverse proxy:**
- Dashboard: http://cms-hlaure.test (Laragon)
- Dashboard: http://cms-hlaure.local (XAMPP)
- API: http://cms-hlaure.test/api

## 📱 Conectar Displays

Los displays deben configurarse para apuntar a:

**Sin reverse proxy:**
```
http://TU_IP:3001/display?screenId=1
```

**Con reverse proxy:**
```
http://cms-hlaure.test/display?screenId=1
```

## 🔧 Comandos Útiles

```bash
# Verificar que el servidor está corriendo
curl http://localhost:3001/api/status

# Ver logs de la aplicación
npm start

# Verificar estado de Apache (Laragon)
# Laragon → Apache → Reload

# Verificar estado de Apache (XAMPP)
# XAMPP Control Panel → Apache → Admin
```

## 📂 Estructura de Archivos en Producción

```
proyecto/
├── dist/                 # ← Frontend construido
├── uploads/              # ← Archivos subidos
│   ├── horizontales/
│   └── verticales/
├── src/server/           # ← Código del servidor
├── .env                  # ← Variables de entorno
└── database/             # ← Scripts SQL
```

## ⚠️ Notas Importantes

1. **No usar `npm run dev` en producción** - solo para desarrollo
2. **Configurar firewall** para permitir puerto 3001 si es necesario
3. **Usar HTTPS** en producción real (no localhost)
4. **Hacer backup** de la base de datos regularmente
5. **Solo usar `npm start`** para iniciar en producción

## 🐛 Solución de Problemas

### Problemas Comunes

- **Error de conexión**: Verificar que MySQL está corriendo en Laragon/XAMPP
- **Puerto ocupado**: Cambiar puerto en las variables de entorno
- **WebSocket no conecta**: Verificar que no hay firewall bloqueando
- **Base de datos no conecta**: Verificar credenciales en `.env`
- **Apache no inicia**: Verificar configuración de virtual hosts
- **Proxy no funciona**: Verificar que módulos proxy están habilitados

### WebSocket con IP Incorrecta

Si el servidor tiene múltiples IPs (ej: 192.168.1.1 y 172.20.80.220) y al conectarte por una IP el WebSocket usa otra diferente:

**Solución automática (v2.0+):**
La aplicación ahora detecta automáticamente la IP por la cual te conectas y usa esa misma IP para el WebSocket.

**Cómo funciona:**
- Cuando accedes a `http://172.20.80.220:3001`, la aplicación detecta que te conectaste por esa IP
- Automáticamente configura el WebSocket en `ws://172.20.80.220:3001`
- Los displays se conectan usando la misma IP que el navegador

**Verificar que funciona:**
1. Abre las herramientas de desarrollo del navegador (F12)
2. Ve a la consola y busca mensajes como: `Server config loaded: API=http://172.20.80.220:3001, WS=ws://172.20.80.220:3001`
3. La IP debe coincidir con la que usaste en la URL del navegador

**Si aún hay problemas:**
- Limpia la caché del navegador (Ctrl+Shift+Del)
- Recarga la página con Ctrl+F5
- Verifica que no hay proxy o reverse proxy interfiriendo

### Aplicación se Cierra al Cerrar SSH/PuTTY

Si al cerrar la sesión SSH o PuTTY la aplicación se detiene:

**Causa:** La aplicación se ejecuta en primer plano y se cierra con la terminal.

**Solución:** Usar PM2, systemd o nohup (ver sección "4. Ejecutar en Producción")

**Verificar que PM2 está corriendo:**
```bash
pm2 status
pm2 logs cms-hlaure --lines 50
```

## 📝 Configuración Adicional

### Para Laragon con SSL (Opcional)

```apache
<VirtualHost *:443>
    ServerName cms-hlaure.test
    SSLEngine on
    SSLCertificateFile "C:\laragon\etc\ssl\laragon.crt"
    SSLCertificateKeyFile "C:\laragon\etc\ssl\laragon.key"
    
    # Resto de la configuración igual que HTTP
    ProxyPreserveHost On
    ProxyPass / http://localhost:3001/
    ProxyPassReverse / http://localhost:3001/
    
    ProxyPass /socket.io/ ws://localhost:3001/socket.io/
    ProxyPassReverse /socket.io/ ws://localhost:3001/socket.io/
</VirtualHost>
```

### Para XAMPP con SSL (Opcional)

Habilitar SSL en XAMPP y seguir configuración similar.