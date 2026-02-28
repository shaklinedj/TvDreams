# Solución al Problema de WebSocket con Múltiples IPs

## Problema

Si tu servidor tiene múltiples direcciones IP (por ejemplo: `192.168.1.1` y `172.20.80.220`), puede ocurrir que:

- Te conectas al servidor por: `http://172.20.80.220:3001`
- Pero el WebSocket intenta conectar a: `ws://192.168.1.1:3001` ❌

Esto causa que los displays no puedan conectarse correctamente.

## Solución Implementada

La aplicación ahora **detecta automáticamente** la IP por la cual el cliente se conectó y usa esa misma IP para el WebSocket.

### Cómo funciona

1. **Detección Automática de IP**: Cuando accedes a la aplicación, el servidor detecta la IP que usaste en la URL
2. **Configuración Dinámica**: El endpoint `/api/config` devuelve la configuración con la IP correcta
3. **WebSocket Correcto**: El display se conecta usando la misma IP que usaste para acceder

### Ejemplo

```
Usuario accede a: http://172.20.80.220:3001/display.html
                           ↓
Servidor detecta IP: 172.20.80.220 (desde el header Host)
                           ↓
/api/config devuelve: {
  "clientHost": "172.20.80.220",
  "apiBaseUrl": "http://172.20.80.220:3001",
  "wsUrl": "ws://172.20.80.220:3001"
}
                           ↓
Display se conecta a: ws://172.20.80.220:3001 ✅
```

## Verificación

### 1. Verificar en el Navegador

1. Abre las herramientas de desarrollo (F12)
2. Ve a la pestaña "Console"
3. Busca mensajes como:
   ```
   Server config loaded: API=http://172.20.80.220:3001, WS=ws://172.20.80.220:3001
   ```
4. **La IP debe coincidir con la que usaste en la URL**

### 2. Verificar Conexión del WebSocket

En la consola del navegador, busca:
```
WebSocket connection established.
```

Si ves esto, el WebSocket está conectado correctamente.

### 3. Verificar en el Dashboard

1. Ve a la pestaña de "Pantallas" en el dashboard
2. Verifica que el display aparezca como "Conectado"
3. El contador de "Displays conectados" debe incrementarse

## Casos de Uso

### Escenario 1: Red Local con Router
```
Servidor: 192.168.1.100
Cliente en la misma red: accede a http://192.168.1.100:3001
WebSocket usa: ws://192.168.1.100:3001 ✅
```

### Escenario 2: Servidor con Múltiples NICs
```
Servidor tiene:
  - NIC 1: 192.168.1.1 (Red interna)
  - NIC 2: 172.20.80.220 (Red de displays)

Cliente accede a: http://172.20.80.220:3001
WebSocket usa: ws://172.20.80.220:3001 ✅
```

### Escenario 3: Acceso desde Internet + Red Local
```
Servidor tiene:
  - IP Local: 192.168.1.1
  - IP Pública: 200.150.100.50

Cliente desde internet: http://200.150.100.50:3001
WebSocket usa: ws://200.150.100.50:3001 ✅

Cliente local: http://192.168.1.1:3001
WebSocket usa: ws://192.168.1.1:3001 ✅
```

## Solución de Problemas

### WebSocket sigue usando IP incorrecta

**Solución 1: Limpiar caché del navegador**
```
1. Presiona Ctrl+Shift+Del
2. Selecciona "Imágenes y archivos en caché"
3. Borra la caché
4. Recarga la página con Ctrl+F5
```

**Solución 2: Verificar proxy/reverse proxy**

Si usas Apache o Nginx como reverse proxy, asegúrate de tener:

**Apache:**
```apache
ProxyPreserveHost On
```

**Nginx:**
```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
```

### Display no se conecta

**1. Verificar firewall:**
```bash
# Linux
sudo ufw allow 3001/tcp

# Windows
netsh advfirewall firewall add rule name="CMS Port 3001" dir=in action=allow protocol=TCP localport=3001
```

**2. Verificar que el servidor escucha en todas las interfaces:**

El servidor debe estar configurado con `listenHost: '0.0.0.0'` (ya está configurado por defecto).

Verificar con:
```bash
# Linux/Mac
netstat -an | grep 3001

# Windows
netstat -an | findstr 3001
```

Deberías ver: `0.0.0.0:3001` o `:::3001`

### Logs del servidor para depuración

**Con PM2:**
```bash
pm2 logs cms-hlaure --lines 100
```

**Con npm start:**
```bash
# Los logs aparecerán directamente en la terminal
npm start
```

## Configuración Manual (No Recomendado)

Si por alguna razón necesitas forzar una IP específica, puedes editar:

**Archivo: `src/lib/network-config.ts`**
```typescript
const config: NetworkConfig = {
  CLIENT_HOST: '172.20.80.220', // ← IP fija
  PORT: 3001,
};
```

⚠️ **Advertencia**: Esta configuración fija no funcionará si accedes desde diferentes IPs. Usa solo para debugging.

## Arquitectura Técnica

### Flujo de Detección de IP

```
Cliente                 Servidor                   Base de Datos
   |                       |                             |
   |---GET /display.html-->|                             |
   |<------ HTML ----------|                             |
   |                       |                             |
   |---GET /api/config---->|                             |
   |   (Host: 172.20...)   |                             |
   |                       |                             |
   |                  [Detecta IP del                    |
   |                   header Host]                      |
   |                       |                             |
   |<-- {wsUrl: ws://172..}|                             |
   |                       |                             |
   |--WebSocket Connect--->|                             |
   |   ws://172.20...      |                             |
   |<------- OK -----------|                             |
   |                       |                             |
```

### Código Relevante

**Detección de IP (src/server/index.ts):**
```typescript
const getClientConnectionHost = (req: express.Request): string => {
  // Prioridad 1: Header X-Forwarded-Host (proxy)
  const forwardedHost = req.get('X-Forwarded-Host');
  if (forwardedHost) {
    return forwardedHost.split(',')[0].trim();
  }
  
  // Prioridad 2: Header Host (conexión directa)
  const hostHeader = req.get('Host');
  if (hostHeader) {
    return hostHeader.split(':')[0];
  }
  
  // Fallback: Primera IP disponible
  return getLocalIpAddress();
};
```

**Endpoint de Configuración:**
```typescript
app.get('/api/config', (req, res) => {
  const actualHost = getClientConnectionHost(req);
  const dynamicConfig = {
    clientHost: actualHost,
    apiBaseUrl: `http://${actualHost}:${PORT}`,
    wsUrl: `ws://${actualHost}:${PORT}`
  };
  res.json(dynamicConfig);
});
```

## Referencias

- [Documentación de despliegue](./DEPLOY.md)
- [Guía rápida de configuración](./GUIA-RAPIDA-CONFIGURACION.md)
- [Configuración de reverse proxy](./REVERSE-PROXY.md)
