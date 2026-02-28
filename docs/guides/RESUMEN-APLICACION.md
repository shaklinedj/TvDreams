# 📱 Resumen CMS HLAURE - Sistema de Gestión de Contenido para Pantallas Publicitarias

## 🏗️ **Arquitectura General de la Aplicación**

### **Descripción del Sistema**
CMS HLAURE es una aplicación completa de gestión de contenido para pantallas publicitarias digitales (Digital Signage). El sistema permite administrar medios audiovisuales y distribuirlos a múltiples pantallas de forma centralizada.

### **Componentes Principales**

```
┌─────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA CMS HLAURE                  │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React)     │  Backend (Express)  │  Database     │
│  - Dashboard Admin    │  - API REST         │  - MySQL      │
│  - Login/Auth         │  - WebSocket        │  - Usuarios   │
│  - Gestión Medios     │  - File Upload      │  - Medios     │
│  - Gestión Pantallas  │  - Thumbnails       │  - Pantallas  │
│                       │  - Auth JWT         │  - Analytics  │
├─────────────────────────────────────────────────────────────┤
│              Displays (Pantallas Remotas)                   │
│  - HTML/JS Standalone │  - WebSocket Client │               │
│  - Auto-config        │  - Fullscreen Mode  │               │
│  - Content Rotation   │  - Real-time Updates│               │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 **Principales Funcionalidades**

### **1. Dashboard Administrativo**
- **Gestión de Usuarios**: Creación, edición y eliminación de usuarios con roles (admin/user)
- **Gestión de Medios**: Upload, organización y previsualización de contenido multimedia
- **Gestión de Pantallas**: Configuración y asignación de contenido a displays
- **Analytics**: Métricas de uso, conexiones y visualizaciones
- **Carpetas**: Organización del contenido por categorías (promociones, eventos, productos, temporadas)

### **2. Sistema de Displays (Pantallas)**
- **Reproducción Automática**: Rotación de contenido sin intervención manual
- **Tiempo Real**: Actualizaciones instantáneas vía WebSocket
- **Modo Pantalla Completa**: Optimizado para displays comerciales
- **Orientación**: Soporte para pantallas horizontales y verticales
- **Auto-configuración**: Las pantallas se configuran automáticamente al conectarse

### **3. Gestión de Contenido**
- **Formatos Soportados**: Imágenes (JPG, PNG, GIF) y Videos (MP4, AVI, MOV)
- **Thumbnails Automáticos**: Generación automática de previsualizaciones
- **Organización por Carpetas**: Sistema de categorización del contenido
- **Asignación Flexible**: Contenido específico por pantalla o carpeta

## 💻 **Stack Tecnológico**

### **Frontend**
- **Framework**: React 19.1.1 con TypeScript
- **Build Tool**: Vite 5.4.1
- **UI Components**: Radix UI + shadcn/ui
- **Styling**: Tailwind CSS 3.4.11
- **Estado**: Zustand + React Query
- **Routing**: React Router DOM 6.26.2
- **Animaciones**: Framer Motion + Lottie

### **Backend**
- **Runtime**: Node.js con TypeScript
- **Framework**: Express 5.1.0
- **WebSocket**: ws 8.18.3
- **Autenticación**: JWT (jsonwebtoken 9.0.2)
- **Password Hashing**: bcrypt 5.1.1
- **File Upload**: Multer 2.0.2
- **Video Processing**: FFmpeg (fluent-ffmpeg + ffmpeg-static)

### **Base de Datos**
- **SGBD**: MySQL 3.15.0
- **ORM**: Conexión nativa con mysql2
- **Esquema**: 8 tablas principales (usuarios, medios, pantallas, analytics, etc.)

### **Infraestructura**
- **Environment**: Variables de entorno con dotenv
- **CORS**: Configurado para desarrollo y producción
- **Static Files**: Servicio de archivos estáticos
- **Cross-Platform**: Compatible con Windows, macOS, Linux

## 🌐 **Configuración de Red y Despliegue**

### **Arquitectura de Red**

#### **En Desarrollo (`npm run dev`)**
```
Frontend (Vite): http://localhost:5173
Backend (Express): http://localhost:3001
Proxy: Vite redirige /api, /uploads al backend automáticamente
```

#### **En Producción (`npm run start`)**
```
Todo desde puerto único: http://localhost:3001
Frontend: Servido desde carpeta dist/
Backend: API + archivos estáticos
```

### **Configuración de Host - Archivos Clave**

#### **1. Archivo: `src/lib/network-config.ts`**
```typescript
// CONFIGURACIÓN PRINCIPAL DE RED
const config: NetworkConfig = {
  CLIENT_HOST: getClientHost(), // Auto-detecta hostname
  PORT: 3001,
};
```

#### **2. Archivo: `src/lib/server-config.ts`**
```typescript
// CONFIGURACIÓN DEL SERVIDOR
export function getServerConfig() {
  return {
    listenHost: '0.0.0.0',     // Escucha en todas las interfaces
    clientHost: CLIENT_HOST,    // Host para clientes
    port: PORT,
    apiBaseUrl: `http://${CLIENT_HOST}:${PORT}`,
    wsUrl: `ws://${CLIENT_HOST}:${PORT}`
  };
}
```

#### **3. Endpoint Dinámico: `/api/config`**
```typescript
// El servidor detecta automáticamente la IP local
app.get('/api/config', (req, res) => {
  const actualHost = getLocalIpAddress();
  const dynamicConfig = {
    clientHost: actualHost,
    apiBaseUrl: `http://${actualHost}:${PORT}`,
    wsUrl: `ws://${actualHost}:${PORT}`
  };
  res.json(dynamicConfig);
});
```

## 🔧 **Puntos Clave de Configuración para Cambio de Host**

### **Cuando cambias el servidor a una nueva IP/Host, debes modificar:**

#### **1. Variables de Entorno (`.env`)**
```env
# 🚨 CRÍTICO: Actualizar esta URL cuando cambies de host
FRONTEND_URL=http://192.168.1.100:3001  # ← CAMBIAR IP AQUÍ

# Configuración de base de datos (si cambia el host DB)
MYSQL_HOST=localhost  # ← Cambiar si DB está en otro servidor
MYSQL_PORT=3306
MYSQL_USER=cms_user
MYSQL_PASSWORD=tu_password
MYSQL_DATABASE=cms_usuarios_jules

# JWT Secret (mantener igual)
JWT_SECRET=tu-clave-secreta-jwt
```

#### **2. Configuración de Red Automática**
La aplicación tiene **auto-detección de IP**, pero puedes forzar una IP específica:

**En `src/lib/network-config.ts`:**
```typescript
// Para forzar una IP específica (no recomendado)
const config: NetworkConfig = {
  CLIENT_HOST: '192.168.1.100', // ← IP fija en lugar de auto-detect
  PORT: 3001,
};
```

#### **3. URLs de Display** 
Cuando cambies de host, las URLs de las pantallas serán:
```
ANTES: http://localhost:3001/display.html?screenId=1
DESPUÉS: http://192.168.1.100:3001/display.html?screenId=1
```

### **Proceso de Migración de Host**

#### **Paso 1: Preparar el nuevo servidor**
```bash
# Instalar Node.js, MySQL y dependencias
npm install
npm run build
```

#### **Paso 2: Configurar variables de entorno**
```bash
# Copiar y editar .env
cp .env.example .env
# Editar FRONTEND_URL con nueva IP
```

#### **Paso 3: Migrar base de datos**
```bash
# Exportar datos del servidor anterior
mysqldump -u cms_user -p cms_usuarios_jules > backup.sql

# Importar en nuevo servidor
mysql -u cms_user -p cms_usuarios_jules < backup.sql
```

#### **Paso 4: Actualizar displays**
```bash
# Las pantallas necesitan nuevas URLs:
http://NUEVA_IP:3001/display.html?screenId=1
```

## 🔒 **Configuración de Seguridad**

### **Autenticación**
- **JWT Tokens**: Autenticación basada en tokens
- **Roles**: Admin y User con permisos diferenciados
- **Password Hashing**: bcrypt con salt rounds
- **Session Management**: Control de sesiones activas

### **Variables de Entorno Críticas**
```env
JWT_SECRET=clave-muy-segura-y-larga    # 🚨 NUNCA compartir
MYSQL_PASSWORD=password_seguro         # 🚨 Proteger acceso DB
```

## 📊 **Base de Datos - Esquema Principal**

### **Tablas Principales**
1. **`users`**: Usuarios del sistema (admin/user)
2. **`media`**: Archivos multimedia subidos
3. **`screens`**: Configuración de pantallas
4. **`folders`**: Organización de contenido
5. **`screen_media`**: Asignación pantalla-contenido
6. **`connection_events`**: Log de conexiones
7. **`media_views`**: Analytics de reproducciones
8. **`system_metrics`**: Métricas del sistema

### **Relaciones Clave**
```sql
media → folders (organización)
screens → screen_media → media (asignación)
screens → connection_events (monitoreo)
screens → media_views (analytics)
```

## 🚀 **Comandos de Despliegue**

### **Desarrollo**
```bash
npm run dev          # Frontend: 5173, Backend: 3001
npm run dev:client   # Solo frontend
npm run dev:server   # Solo backend
```

### **Producción**
```bash
npm run build        # Construir frontend
npm start            # Iniciar servidor producción
```

### **Mantenimiento**
```bash
npm run lint         # Verificar código
npm audit fix        # Corregir vulnerabilidades
npm start            # Iniciar aplicación
```

## 🔍 **Solución de Problemas Comunes**

### **Error: No se conectan las pantallas**
```bash
# Verificar que el servidor esté corriendo
curl http://localhost:3001/api/status

# Verificar configuración de red
curl http://localhost:3001/api/config

# Revisar logs del servidor (en la terminal donde corre npm start)
# Los logs aparecen directamente en consola
```

### **Error: Base de datos no conecta**
```bash
# Verificar conexión MySQL
mysql -u cms_user -p -h localhost

# Verificar variables de entorno
echo $MYSQL_HOST
cat .env | grep MYSQL
```

### **Error: WebSocket no conecta**
```bash
# Verificar puerto no está bloqueado
netstat -tulpn | grep 3001

# Verificar firewall
sudo ufw status
```

## 📱 **URLs de Acceso Post-Migración**

### **Dashboard Principal**
```
http://NUEVA_IP:3001/
```

### **API Endpoints**
```
http://NUEVA_IP:3001/api/status     # Estado del sistema
http://NUEVA_IP:3001/api/config     # Configuración dinámica
http://NUEVA_IP:3001/api/users      # Gestión usuarios
http://NUEVA_IP:3001/api/media      # Gestión medios
http://NUEVA_IP:3001/api/screens    # Gestión pantallas
```

### **Displays**
```
http://NUEVA_IP:3001/display.html?screenId=1  # Pantalla 1
http://NUEVA_IP:3001/display.html?screenId=2  # Pantalla 2
```

### **Archivos Estáticos**
```
http://NUEVA_IP:3001/uploads/       # Medios subidos
```

## 🌐 **Configuración con Reverse Proxy (Opcional)**

Para URLs más profesionales sin puertos:

### **Con Apache (Laragon/XAMPP)**
```apache
<VirtualHost *:80>
    ServerName cms-hlaure.test
    
    # Reverse Proxy hacia Node.js
    ProxyPreserveHost On
    ProxyPass / http://localhost:3001/
    ProxyPassReverse / http://localhost:3001/
    
    # WebSocket support
    ProxyPass /socket.io/ ws://localhost:3001/socket.io/
    ProxyPassReverse /socket.io/ ws://localhost:3001/socket.io/
    
    # Headers necesarios
    ProxyAddHeaders On
</VirtualHost>
```

### **URLs Resultantes**
```
Dashboard: http://cms-hlaure.test/
Displays:  http://cms-hlaure.test/display.html?screenId=1
```

---

## ✅ **Checklist de Migración de Host**

- [ ] **Servidor preparado**: Node.js, MySQL instalados
- [ ] **Dependencias**: `npm install` ejecutado
- [ ] **Build**: `npm run build` exitoso
- [ ] **Base de datos**: Migrada y funcionando
- [ ] **Variables de entorno**: `.env` actualizado con nueva IP
- [ ] **Firewall**: Puerto 3001 abierto
- [ ] **Aplicación**: `npm start` funcionando
- [ ] **Conectividad**: `/api/status` responde correctamente
- [ ] **Displays**: URLs actualizadas en dispositivos remotos
- [ ] **Tests**: Usuarios pueden loguearse y subir contenido
- [ ] **WebSocket**: Pantallas reciben actualizaciones en tiempo real

---

**📞 Soporte**: Este resumen cubre todos los aspectos críticos para migrar el CMS HLAURE a un nuevo host. La aplicación está diseñada para ser flexible y adaptarse automáticamente a cambios de IP gracias a su sistema de auto-detección de red.