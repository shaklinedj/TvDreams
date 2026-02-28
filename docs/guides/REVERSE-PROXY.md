# Configuración de Reverse Proxy para CMS HLAURE

## 📋 Arquitectura Actual

```
[Displays/Clients] → [Apache Reverse Proxy] → [Node.js CMS (puerto 3001)]
                                         ↓
                                   [MySQL Database]
```

## 🚀 Configuración de Reverse Proxy con Apache

Esta configuración permite eliminar puertos de las URLs y tener URLs profesionales como `http://cms-hlaure.test` en lugar de `http://localhost:3001`.

### Opción 1: Apache en Laragon (Recomendado para Windows)

#### Paso 1: Configurar Virtual Host en Laragon

Crear archivo `C:\laragon\etc\apache2\sites-enabled\cms-hlaure.conf`:

```apache
<VirtualHost *:80>
    ServerName cms-hlaure.test
    DocumentRoot "C:\laragon\www\cms-hlaure"
    
    # Reverse Proxy hacia Node.js
    ProxyPreserveHost On
    ProxyPass / http://localhost:3001/
    ProxyPassReverse / http://localhost:3001/
    
    # WebSocket support para actualizaciones en tiempo real
    ProxyPass /socket.io/ ws://localhost:3001/socket.io/
    ProxyPassReverse /socket.io/ ws://localhost:3001/socket.io/
    
    # Configuración para archivos grandes (videos)
    LimitRequestBody 1073741824
    ProxyTimeout 300
    
    # Headers necesarios
    ProxyPreserveHost On
    ProxyAddHeaders On
    
    # Headers de seguridad básica
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
    
    # Logs
    ErrorLog "C:\laragon\logs\cms-hlaure-error.log"
    CustomLog "C:\laragon\logs\cms-hlaure-access.log" combined
</VirtualHost>
```

#### Paso 2: Configurar Hosts

Agregar en `C:\Windows\System32\drivers\etc\hosts`:
```
127.0.0.1 cms-hlaure.test
```

#### Paso 3: Reiniciar Apache

En Laragon: Apache → Reload

### Opción 2: Apache en XAMPP

#### Paso 1: Habilitar Módulos

Editar `xampp/apache/conf/httpd.conf` y descomentar:
```apache
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so
LoadModule headers_module modules/mod_headers.so
```

#### Paso 2: Configurar Virtual Host

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
    
    # Headers de seguridad
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options SAMEORIGIN
    Header always set X-XSS-Protection "1; mode=block"
    
    # Logs
    ErrorLog "logs/cms-hlaure-error.log"
    CustomLog "logs/cms-hlaure-access.log" combined
</VirtualHost>
```

#### Paso 3: Configurar Hosts y Reiniciar

Agregar en hosts file y reiniciar Apache desde XAMPP Control Panel.

### Opción 3: Apache Nativo (Linux/macOS)

#### Para Ubuntu/Debian:

1. **Habilitar módulos**:
```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod headers
```

2. **Crear Virtual Host**:
Crear `/etc/apache2/sites-available/cms-hlaure.conf`:

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
    
    # Headers de seguridad
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options SAMEORIGIN
    Header always set X-XSS-Protection "1; mode=block"
    
    ErrorLog ${APACHE_LOG_DIR}/cms-hlaure-error.log
    CustomLog ${APACHE_LOG_DIR}/cms-hlaure-access.log combined
</VirtualHost>
```

3. **Habilitar y reiniciar**:
```bash
sudo a2ensite cms-hlaure
sudo systemctl reload apache2
```

## 🌐 Variables de Entorno para Proxy

Actualizar `.env` para trabajar con el proxy:

```env
# Para uso con reverse proxy
FRONTEND_URL=http://cms-hlaure.test

# Configuración CORS
CORS_ORIGIN=http://cms-hlaure.test

# Headers de confianza para proxy
TRUST_PROXY=true
```

## 📱 Configuración de Displays

Con reverse proxy configurado, los displays se conectan a:

```
http://cms-hlaure.test/display?screenId=1
http://cms-hlaure.test/display?screenId=2
```

En lugar de:
```
http://localhost:3001/display?screenId=1
```

## 🔒 Configuración SSL (HTTPS)

### Para Laragon con SSL:

```apache
<VirtualHost *:443>
    ServerName cms-hlaure.test
    
    # SSL Configuration
    SSLEngine on
    SSLCertificateFile "C:\laragon\etc\ssl\laragon.crt"
    SSLCertificateKeyFile "C:\laragon\etc\ssl\laragon.key"
    
    # Resto de configuración proxy igual que HTTP
    ProxyPreserveHost On
    ProxyPass / http://localhost:3001/
    ProxyPassReverse / http://localhost:3001/
    
    ProxyPass /socket.io/ ws://localhost:3001/socket.io/
    ProxyPassReverse /socket.io/ ws://localhost:3001/socket.io/
    
    # Headers de seguridad mejorados para HTTPS
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains"
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
</VirtualHost>
```

## 🎯 Ventajas del Reverse Proxy

1. **URLs Profesionales**: `cms-hlaure.test` en lugar de `localhost:3001`
2. **Puerto 80/443**: No necesitas especificar puertos
3. **SSL/HTTPS**: Fácil configuración de certificados
4. **Balanceo de Carga**: Posibilidad de múltiples instancias
5. **Cache**: Apache puede cachear archivos estáticos
6. **Seguridad**: Headers de seguridad y ocultación del puerto real

## 🚀 Comandos de Despliegue con Proxy

```bash
# 1. Preparar aplicación
npm run build
npm start

# 2. Configurar Apache (Laragon)
# Copiar configuración a sites-enabled y reiniciar

# 3. Verificar funcionamiento
curl -I http://cms-hlaure.test
curl http://cms-hlaure.test/api/status

# 4. Verificar WebSocket (opcional)
# En el navegador, abrir console en http://cms-hlaure.test
# y verificar que la conexión WebSocket funciona
```

## 🐛 Solución de Problemas

### Apache no inicia:
- Verificar sintaxis: `httpd -t` o `apache2ctl -t`
- Revisar logs de Apache
- Verificar que no hay conflictos de puertos

### Proxy no funciona:
- Verificar que módulos proxy están habilitados
- Verificar que Node.js está corriendo en puerto 3001
- Revisar logs de Apache para errores de proxy

### WebSocket no conecta:
- Verificar que `mod_proxy_wstunnel` está habilitado
- Revisar configuración de proxy WebSocket
- Verificar que no hay firewall bloqueando

### Performance lenta:
- Configurar cache de Apache para archivos estáticos
- Optimizar configuración de proxy timeout
- Verificar recursos del servidor

## 📝 Configuración Avanzada

### Cache para archivos estáticos:

```apache
# Agregar al VirtualHost
<LocationMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$">
    ExpiresActive On
    ExpiresDefault "access plus 1 month"
    Header append Cache-Control "public, immutable"
</LocationMatch>
```

### Rate Limiting básico:

```apache
# Requiere mod_limitipconn o mod_evasive
LoadModule limitipconn_module modules/mod_limitipconn.so

<Location "/api/upload">
    MaxConnPerIP 3
</Location>
```

Esto proporciona una configuración robusta de reverse proxy usando únicamente Apache, sin depender de nginx.