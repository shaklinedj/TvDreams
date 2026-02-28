# 🔄 Diagrama de Flujo - Solución WebSocket Multi-IP

## Problema Original

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVIDOR CON DOS IPs                          │
│                                                                   │
│  Interfaz 1: 192.168.1.1      Interfaz 2: 172.20.80.220         │
│     (Red A)                          (Red B)                     │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
    ┌──────────────────┐      ┌──────────────────┐
    │   Cliente 1      │      │   Cliente 2      │
    │   Red A          │      │   Red B          │
    └──────────────────┘      └──────────────────┘
              │                         │
              │                         │
      Accede por:              Accede por:
   192.168.1.1:3001        172.20.80.220:3001
              │                         │
              └────────────┬────────────┘
                           │
                    ❌ PROBLEMA
                           │
         getLocalIpAddress() siempre retorna
              la primera IP encontrada
                   (192.168.1.1)
                           │
                           ▼
              ┌────────────────────────┐
              │ WebSocket en           │
              │ ws://192.168.1.1:3001  │
              └────────────────────────┘
                           │
                    Cliente 2 NO puede
                      conectarse ❌
```

---

## Solución Implementada

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVIDOR CON DOS IPs                          │
│                                                                   │
│  Interfaz 1: 192.168.1.1      Interfaz 2: 172.20.80.220         │
│     (Red A)                          (Red B)                     │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
    ┌──────────────────┐      ┌──────────────────┐
    │   Cliente 1      │      │   Cliente 2      │
    │   Red A          │      │   Red B          │
    └──────────────────┘      └──────────────────┘
              │                         │
              │                         │
      GET /display.html          GET /display.html
   Host: 192.168.1.1:3001    Host: 172.20.80.220:3001
              │                         │
              │                         │
              ▼                         ▼
    ┌──────────────────┐      ┌──────────────────┐
    │ GET /api/config  │      │ GET /api/config  │
    │ Host: 192.168... │      │ Host: 172.20...  │
    └──────────────────┘      └──────────────────┘
              │                         │
              │                         │
              ▼                         ▼
    ┌──────────────────┐      ┌──────────────────┐
    │getClientConnection│      │getClientConnection│
    │  Host(req)       │      │  Host(req)       │
    │  ↓               │      │  ↓               │
    │ 192.168.1.1      │      │ 172.20.80.220    │
    └──────────────────┘      └──────────────────┘
              │                         │
              │                         │
              ▼                         ▼
    ┌──────────────────┐      ┌──────────────────┐
    │ {                │      │ {                │
    │  wsUrl: "ws://   │      │  wsUrl: "ws://   │
    │  192.168.1.1..." │      │  172.20.80.220..."│
    │ }                │      │ }                │
    └──────────────────┘      └──────────────────┘
              │                         │
              │                         │
              ▼                         ▼
    ┌──────────────────┐      ┌──────────────────┐
    │ WebSocket conecta│      │ WebSocket conecta│
    │ ws://192.168...  │      │ ws://172.20...   │
    │      ✅          │      │      ✅          │
    └──────────────────┘      └──────────────────┘
```

---

## Flujo Detallado del Código

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Cliente hace request HTTP                                     │
│    GET http://172.20.80.220:3001/display.html                    │
│    Headers: Host: 172.20.80.220:3001                             │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Display.js carga y ejecuta loadServerConfig()                 │
│    fetch('/api/config')                                           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Servidor recibe GET /api/config                               │
│    req.get('Host') = '172.20.80.220:3001'                        │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. getClientConnectionHost(req)                                   │
│    const hostHeader = req.get('Host')  // '172.20.80.220:3001'  │
│    const hostname = hostHeader.split(':')[0]  // '172.20.80.220'│
│    return hostname                                                │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Construir configuración dinámica                              │
│    {                                                              │
│      clientHost: '172.20.80.220',                                │
│      apiBaseUrl: 'http://172.20.80.220:3001',                    │
│      wsUrl: 'ws://172.20.80.220:3001'                            │
│    }                                                              │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Display.js recibe config                                      │
│    API_BASE_URL = 'http://172.20.80.220:3001'                    │
│    WS_URL = 'ws://172.20.80.220:3001'                            │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. Display.js conecta WebSocket                                  │
│    this.ws = new WebSocket('ws://172.20.80.220:3001')            │
│    ✅ CONEXIÓN EXITOSA                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Comparación Antes vs Después

| Aspecto | ❌ Antes | ✅ Después |
|---------|---------|------------|
| Detección IP | Primera IP encontrada | IP del header Host |
| Cliente 1 (192.168.1.1) | ✅ Funciona | ✅ Funciona |
| Cliente 2 (172.20.80.220) | ❌ Falla | ✅ Funciona |
| Detrás de proxy | ❌ No soportado | ✅ Soportado |
| Configuración manual | 🔧 Requerida | 🎉 Automática |

---

## Código Clave

### getClientConnectionHost()
```typescript
const getClientConnectionHost = (req: express.Request): string => {
  // 1. Prioridad: Proxy headers
  const forwardedHost = req.get('X-Forwarded-Host');
  if (forwardedHost) {
    return forwardedHost.split(',')[0].trim();
  }
  
  // 2. Siguiente: Header Host directo
  const hostHeader = req.get('Host');
  if (hostHeader) {
    const hostname = hostHeader.split(':')[0];
    return hostname;  // ← Aquí se extrae la IP correcta
  }
  
  // 3. Fallback: Primera IP del servidor
  return getLocalIpAddress();
};
```

### Endpoint /api/config
```typescript
app.get('/api/config', (req, res) => {
  const actualHost = getClientConnectionHost(req);  // ← Detecta IP
  const dynamicConfig = {
    ...serverConfig,
    clientHost: actualHost,
    apiBaseUrl: `http://${actualHost}:${serverConfig.port}`,
    wsUrl: `ws://${actualHost}:${serverConfig.port}`  // ← WebSocket correcto
  };
  res.json(dynamicConfig);
});
```

---

## Proceso de Mantener App Corriendo

```
┌─────────────────────────────────────────────────────────────────┐
│                     Sin PM2 (Problema)                            │
└─────────────────────────────────────────────────────────────────┘

SSH Session                     Servidor
    │                               │
    │─────── npm start ────────────▶│
    │                               │ App ejecutándose
    │                               │ en foreground
    │                               │
    │                               │
    X   Cerrar SSH                  │
                                    │
                                    X  App se detiene ❌


┌─────────────────────────────────────────────────────────────────┐
│                     Con PM2 (Solución)                            │
└─────────────────────────────────────────────────────────────────┘

SSH Session                     PM2 Daemon                Aplicación
    │                               │                          │
    │──── pm2 start ──────────────▶│                          │
    │                               │                          │
    │                               │──── fork ──────────────▶│
    │                               │                          │
    │                               │                    App corriendo
    │                               │                    en background
    │                               │                          │
    X   Cerrar SSH                  │                          │
                                    │                          │
                              ✅ PM2 sigue                ✅ App sigue
                              ejecutándose                ejecutándose
                                    │                          │
                                    │──── monitor ────────────│
                                    │◀──── heartbeat ─────────│
                                    │                          │
                              Si falla, PM2                    │
                              reinicia automático              │
```

---

## Ventajas de la Solución

✅ **Automática**: No requiere configuración manual
✅ **Flexible**: Funciona con cualquier IP
✅ **Compatible**: Soporta proxies (X-Forwarded-Host)
✅ **Robusta**: Fallback a primera IP si headers no disponibles
✅ **Persistente**: PM2 mantiene app corriendo
✅ **Resiliente**: Auto-reinicio en caso de fallos
✅ **Monitoreable**: Logs centralizados con PM2
