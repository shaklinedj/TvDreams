# 🚀 Guía Rápida - Solución Implementada

## ✨ Problemas Resueltos

### ❌ Antes
- Te conectabas por `172.20.80.220` pero WebSocket usaba `192.168.1.1`
- Al cerrar PuTTY, la aplicación se detenía

### ✅ Ahora
- WebSocket usa automáticamente la misma IP que usas para conectarte
- Puedes mantener la aplicación corriendo con PM2

---

## 🎯 Uso Inmediato

### 1. Iniciar con PM2 (Recomendado)

```bash
# Primera vez: Instalar PM2
npm install -g pm2

# Iniciar aplicación
npm run pm2:start

# Ver estado
npm run pm2:status

# Ver logs
npm run pm2:logs
```

**✅ Ventajas:**
- Sigue corriendo después de cerrar SSH/PuTTY
- Se reinicia automáticamente si falla
- Logs centralizados
- Fácil de administrar

### 2. Inicio Rápido con nohup

```bash
# Iniciar en segundo plano
nohup npm start > logs/app.log 2>&1 &

# Ver logs
tail -f logs/app.log

# Encontrar proceso
ps aux | grep node

# Detener (usa el PID del comando anterior)
kill <PID>
```

---

## 🌐 WebSocket con IP Correcta

**No necesitas hacer nada.** La detección es automática.

### Ejemplo:
```
Accedes a: http://172.20.80.220:3001
           ↓
WebSocket: ws://172.20.80.220:3001 ✅

Accedes a: http://192.168.1.1:3001
           ↓
WebSocket: ws://192.168.1.1:3001 ✅
```

### Verificar:
1. Abre F12 en el navegador
2. Ve a la pestaña Console
3. Busca: `Server config loaded: API=http://...`
4. La IP debe coincidir con la URL que usaste

---

## 📋 Comandos Útiles PM2

```bash
# Estado de todos los procesos
npm run pm2:status

# Ver logs en tiempo real
npm run pm2:logs

# Reiniciar aplicación
npm run pm2:restart

# Detener aplicación
npm run pm2:stop

# Iniciar aplicación
npm run pm2:start

# Configurar inicio automático al arrancar servidor
pm2 startup
pm2 save
```

---

## 🔧 Solución de Problemas

### WebSocket sigue con IP incorrecta
1. Limpia caché del navegador: Ctrl+Shift+Del
2. Recarga con Ctrl+F5
3. Verifica en F12 Console

### PM2 no inicia
```bash
# Ver detalles del error
pm2 logs cms-hlaure --err --lines 50

# Verificar que MySQL está corriendo
sudo systemctl status mysql

# Reiniciar PM2
pm2 restart cms-hlaure
```

### Puerto 3001 ocupado
```bash
# Ver qué proceso usa el puerto
sudo lsof -i :3001

# Detener ese proceso
sudo kill -9 <PID>

# O cambiar puerto en .env
PORT=3002
```

---

## 📖 Más Información

- **Documentación completa**: `docs/guides/MULTI-IP-WEBSOCKET-FIX.md`
- **Despliegue producción**: `docs/guides/DEPLOY.md`
- **Resumen de cambios**: `CAMBIOS-RESUMEN.md`

---

## ⚡ Comandos Rápidos

```bash
# Ver IP del servidor
hostname -I

# Ver procesos Node.js corriendo
ps aux | grep node

# Abrir puerto en firewall (Linux)
sudo ufw allow 3001/tcp

# Ver logs del sistema
journalctl -u cms-hlaure -f

# Verificar MySQL
sudo systemctl status mysql
```

---

## 🎉 ¡Listo!

Ya puedes:
- ✅ Conectarte por cualquier IP y el WebSocket funcionará
- ✅ Cerrar SSH/PuTTY sin que se detenga la aplicación
- ✅ Ver logs y estado con PM2
- ✅ Reiniciar automáticamente si hay problemas
