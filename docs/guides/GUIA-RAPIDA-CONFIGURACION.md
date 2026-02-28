# 🚀 Guía Rápida de Configuración - CMS HLAURE

## ⚡ Cambio de Host/IP - Guía Express

### 🎯 **Lo Esencial - 3 Pasos Principales**

#### **1. Actualizar `.env`** ⚙️
```env
# 🚨 CRÍTICO: Cambiar esta línea
FRONTEND_URL=http://TU_NUEVA_IP:3001

# Ejemplos:
# FRONTEND_URL=http://192.168.1.100:3001
# FRONTEND_URL=http://10.0.0.50:3001
# FRONTEND_URL=https://tu-dominio.com:3001
```

#### **2. Reiniciar Aplicación** 🔄
```bash
# Detener aplicación (Ctrl+C si está corriendo)
# Luego iniciar de nuevo:
npm start
```

#### **3. Actualizar URLs en Displays** 📺
```
NUEVA URL: http://TU_NUEVA_IP:3001/display.html?screenId=1
```

---

## 🔍 **Detección Automática vs Manual**

### **Modo Automático (Por defecto)**
La app detecta automáticamente la IP local. **No necesitas cambiar código**.

### **Modo Manual (Si es necesario)**
Si el auto-detect falla, puedes forzar una IP en `src/lib/network-config.ts`:

```typescript
const config: NetworkConfig = {
  CLIENT_HOST: '192.168.1.100', // ← Tu IP fija
  PORT: 3001,
};
```

---

## 📋 **Checklist Rápido de Migración**

- [ ] ✅ Actualizar `FRONTEND_URL` en `.env`
- [ ] ✅ Reiniciar aplicación (`npm start`)
- [ ] ✅ Verificar: `curl http://TU_IP:3001/api/status`
- [ ] ✅ Actualizar URLs en todas las pantallas
- [ ] ✅ Test: Login en `http://TU_IP:3001`
- [ ] ✅ Test: Display funciona `http://TU_IP:3001/display.html?screenId=1`

---

## 🌐 **URLs Importantes Post-Migración**

```bash
# Dashboard
http://TU_IP:3001/

# API Status
http://TU_IP:3001/api/status

# Configuración dinámica
http://TU_IP:3001/api/config

# Display Pantalla 1
http://TU_IP:3001/display.html?screenId=1

# Display Pantalla 2  
http://TU_IP:3001/display.html?screenId=2
```

---

## 🚨 **Errores Comunes y Solución**

### **Error: "Cannot connect to server"**
```bash
# Verificar que el servidor esté corriendo
# Si usas npm start, debería estar corriendo en la terminal
# Si no está corriendo:
npm start
```

### **Error: "Database connection failed"**
```bash
# Verificar MySQL está corriendo
sudo systemctl status mysql
# Verificar credenciales en .env
cat .env | grep MYSQL
```

### **Error: "WebSocket connection failed"**
```bash
# Verificar puerto 3001 abierto
sudo ufw allow 3001
netstat -tulpn | grep 3001
```

### **Error: "Display no recibe contenido"**
1. Verificar URL del display: `http://TU_IP:3001/display.html?screenId=1`
2. Verificar WebSocket: Abrir consola del navegador en el display
3. Verificar que hay contenido asignado a esa pantalla en el dashboard

---

## 🔧 **Configuraciones Adicionales**

### **Cambiar Puerto (si 3001 está ocupado)**
```env
# En .env
PORT=3002

# Actualizar también
FRONTEND_URL=http://TU_IP:3002
```

### **Base de Datos en Servidor Remoto**
```env
MYSQL_HOST=192.168.1.200
MYSQL_PORT=3306
MYSQL_USER=cms_user
MYSQL_PASSWORD=password_seguro
```

### **HTTPS/SSL (Producción)**
Usar reverse proxy (Apache en Laragon/XAMPP) - Ver `REVERSE-PROXY.md`

---

## 📞 **Soporte Rápido**

**¿Todo funcionaba antes y ahora no?**
1. ¿Cambiaste de IP/host? → Actualizar `.env`
2. ¿Reiniciaste el servidor? → `npm start`
3. ¿Actualizaste las URLs de displays? → Usar nueva IP

**¿Las pantallas no se conectan?**
1. URL correcta en display: `http://TU_IP:3001/display.html?screenId=X`
2. Puerto 3001 abierto en firewall
3. WebSocket funcionando (revisar consola del navegador)

**¿No puedes hacer login?**
1. Servidor corriendo: verificar que `npm start` esté activo
2. Base de datos conectada: verificar `.env`
3. URL correcta: `http://TU_IP:3001`

---

**💡 Tip**: La mayoría de problemas se solucionan actualizando `FRONTEND_URL` en `.env` y reiniciando la aplicación.