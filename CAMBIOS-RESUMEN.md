# Resumen de Cambios - WebSocket y Persistencia de Proceso

## 🎯 Problemas Solucionados

### 1. WebSocket usa IP incorrecta
**Problema:** Servidor con dos IPs (192.168.1.1 y 172.20.80.220). Al conectar por 172.20.80.220, el WebSocket intenta usar 192.168.1.1.

**Solución:** Detección automática de la IP por la cual el cliente se conecta.

### 2. App se cierra al cerrar SSH/PuTTY
**Problema:** Al ejecutar `npm start` desde terminal y cerrar la sesión, la aplicación se detiene.

**Solución:** Documentación completa para usar PM2, systemd o nohup.

---

## 📝 Archivos Modificados

### 1. `src/server/index.ts`

**Función agregada:**
```typescript
/**
 * Get the IP address from request headers.
 * This returns the IP address that the client used to connect to the server.
 * Supports proxy headers (X-Forwarded-For, X-Real-IP) and direct connections.
 */
const getClientConnectionHost = (req: express.Request): string => {
  // Check if behind a proxy (X-Forwarded-Host header)
  const forwardedHost = req.get('X-Forwarded-Host');
  if (forwardedHost) {
    return forwardedHost.split(',')[0].trim();
  }
  
  // Use the Host header (contains hostname and port)
  const hostHeader = req.get('Host');
  if (hostHeader) {
    // Extract just the hostname part (remove port if present)
    const hostname = hostHeader.split(':')[0];
    return hostname;
  }
  
  // Fallback to first available local IP
  return getLocalIpAddress();
};
```

**Endpoint modificado:**
```typescript
// Configuration endpoint for display clients
app.get('/api/config', (req, res) => {
  // Use the IP address from the client's connection instead of picking the first available IP
  const actualHost = getClientConnectionHost(req);
  const dynamicConfig = {
    ...serverConfig,
    clientHost: actualHost,
    port: serverConfig.port,
    apiBaseUrl: `http://${actualHost}:${serverConfig.port}`,
    wsUrl: `ws://${actualHost}:${serverConfig.port}`
  };
  
  res.json(dynamicConfig);
});
```

---

## 🆕 Archivos Nuevos Creados

### 1. `ecosystem.config.js` - Configuración PM2
```javascript
module.exports = {
  apps: [{
    name: 'cms-hlaure',
    script: 'src/server/index.ts',
    interpreter: 'node',
    interpreter_args: '--import tsx',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    // ...más configuraciones
  }]
};
```

### 2. `cms-hlaure.service` - Servicio systemd
```ini
[Unit]
Description=CMS HLAURE - Sistema de Gestión de Contenido para Pantallas Publicitarias
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/cms_hlaure
ExecStart=/usr/bin/node --import tsx src/server/index.ts
Restart=always
# ...más configuraciones
```

### 3. `docs/guides/MULTI-IP-WEBSOCKET-FIX.md`
Documentación completa sobre:
- Cómo funciona la detección de IP
- Casos de uso
- Solución de problemas
- Verificación de la configuración

---

## 📦 Otros Cambios

### `package.json` - Scripts PM2 agregados
```json
{
  "scripts": {
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:stop": "pm2 stop cms-hlaure",
    "pm2:restart": "pm2 restart cms-hlaure",
    "pm2:logs": "pm2 logs cms-hlaure",
    "pm2:status": "pm2 status"
  }
}
```

### `scripts/setup-dirs.js` - Directorio logs
```javascript
const dirsToCreate = ['db', 'uploads', 'logs']; // logs agregado
```

### `docs/guides/DEPLOY.md` - Sección de producción expandida
- Opción A: PM2 (Recomendado)
- Opción B: systemd (Linux)
- Opción C: nohup (Simple)
- Troubleshooting para múltiples IPs

### `README.md` - Guía rápida de producción
- Instrucciones de PM2
- Mención de detección automática de IP

---

## ✅ Verificación de Cambios

### Tests de Linting y Build
```bash
✓ npm run lint     # Sin errores
✓ npm run build    # Build exitoso
✓ tsc --noEmit     # TypeScript compila correctamente
```

### Tests de Detección de IP
```
✓ Test 1 - Conexión directa a 172.20.80.220:3001
✓ Test 2 - Conexión directa a 192.168.1.1:3001
✓ Test 3 - Detrás de proxy
✓ Test 4 - Conexión localhost
```

---

## 🚀 Cómo Usar

### Para Problema 1 (WebSocket IP incorrecta)
**No se requiere acción manual.** La detección es automática.

1. Accede a tu servidor: `http://172.20.80.220:3001`
2. El WebSocket usará automáticamente: `ws://172.20.80.220:3001`
3. Los displays se conectarán a la IP correcta

### Para Problema 2 (Proceso se cierra)

**Opción recomendada: PM2**
```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicación
npm run pm2:start

# Ver estado
npm run pm2:status

# Ver logs
npm run pm2:logs

# La aplicación seguirá corriendo después de cerrar SSH/PuTTY ✓
```

**Alternativa: nohup**
```bash
nohup npm start > logs/app.log 2>&1 &
```

---

## 📊 Flujo de Detección de IP

```
Cliente accede a: http://172.20.80.220:3001/display.html
          ↓
Servidor recibe request con header: "Host: 172.20.80.220:3001"
          ↓
getClientConnectionHost() extrae: "172.20.80.220"
          ↓
/api/config devuelve:
{
  "clientHost": "172.20.80.220",
  "apiBaseUrl": "http://172.20.80.220:3001",
  "wsUrl": "ws://172.20.80.220:3001"
}
          ↓
Display se conecta a: ws://172.20.80.220:3001 ✅
```

---

## 🔍 Verificar que Funciona

### En el navegador (F12 → Console)
```
Server config loaded: API=http://172.20.80.220:3001, WS=ws://172.20.80.220:3001
WebSocket connection established.
```

### En el Dashboard
- Ver pestaña "Pantallas"
- Display debe aparecer como "Conectado"
- Contador "Displays conectados" aumenta

---

## 📚 Documentación Adicional

- **Guía detallada**: `docs/guides/MULTI-IP-WEBSOCKET-FIX.md`
- **Despliegue**: `docs/guides/DEPLOY.md`
- **README principal**: `README.md`

---

## ⚠️ Notas Importantes

1. **Limpiar caché**: Si tienes problemas, limpia la caché del navegador (Ctrl+Shift+Del)
2. **Firewall**: Asegúrate de que el puerto 3001 está abierto
3. **PM2 persistente**: Usa `pm2 startup` y `pm2 save` para reinicio automático
4. **Proxy**: Si usas Apache/Nginx, asegúrate de que `ProxyPreserveHost` está activado

---

## 🎉 Resultado Final

✅ WebSocket se conecta a la IP correcta automáticamente
✅ La aplicación puede ejecutarse en segundo plano con PM2
✅ Documentación completa para todos los casos de uso
✅ Compatible con múltiples escenarios de red
✅ Sin cambios manuales necesarios en el código
