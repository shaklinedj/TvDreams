# CMS Usuarios Jules

Sistema de gestión de contenido para pantallas publicitarias con soporte MySQL.

## 📚 **Documentación Completa**

- 📖 **[docs/guides/RESUMEN-APLICACION.md](./docs/guides/RESUMEN-APLICACION.md)** - Resumen completo de funcionalidades, tecnologías y configuración
- 📁 **[docs/guides/TIPOS-ARCHIVOS-SOPORTADOS.md](./docs/guides/TIPOS-ARCHIVOS-SOPORTADOS.md)** - Guía completa de formatos de archivos soportados en el display
- ⚡ **[docs/guides/GUIA-RAPIDA-CONFIGURACION.md](./docs/guides/GUIA-RAPIDA-CONFIGURACION.md)** - Guía express para cambios de host/IP
- 🚀 **[docs/guides/DEPLOY.md](./docs/guides/DEPLOY.md)** - Guía detallada de despliegue en producción
- 🌐 **[docs/guides/REVERSE-PROXY.md](./docs/guides/REVERSE-PROXY.md)** - Configuración de proxy reverso para URLs profesionales
- 📸 **[screenshots/README.md](./screenshots/README.md)** - Capturas de pantalla de la aplicación
# TvDreams — CMS y servidor de display

Proyecto actualizado: este fork incorpora múltiples mejoras respecto al repositorio original. Cambios clave: integración robusta de WebSockets para displays, persistencia local de los últimos premios (sin DB), pruebas manuales de envío de premios, y un helper de despliegue que soporta `pm2` o `systemd`.

## Enlaces de documentación
- Resumen y guías: [docs/guides/RESUMEN-APLICACION.md](./docs/guides/RESUMEN-APLICACION.md)
- Deploy y configuración avanzada: [docs/guides/DEPLOY.md](./docs/guides/DEPLOY.md)
- Reverse proxy: [docs/guides/REVERSE-PROXY.md](./docs/guides/REVERSE-PROXY.md)

## Novedades importantes (resumen)
- `scripts/deploy.sh`: script interactivo para instalar dependencias, build y opción de desplegar con `pm2` o instalar un `systemd` unit.
- `systemd/tvdreams.service`: plantilla de unidad systemd añadida (ajusta `WorkingDirectory` y `EnvironmentFile`).
- Persistencia de premios: los últimos 3 premios se guardan en `data/recent-prizes.json` (sin usar la base de datos).
- Endpoints útiles:
    - `GET /display.html` — cliente display estático
    - `POST /api/test-prize` — endpoint de prueba para simular envíos de premios
    - `GET /api/premio/recent` — devuelve los últimos 3 premios persistidos
- `public/display.js` (display client): usa WebSocket para registrarse y recibir `display_command` con `show_prize`.

## Requisitos
- Node.js 18+ (se recomienda LTS)
- pnpm (recomendado) o npm
- MySQL/MariaDB si vas a usar la base de datos (opcional para la persistencia de premios, que ahora es local)

## Instalación rápida (desarrollo)
```bash
git clone <repo-url>
cd TvDreams
pnpm install
cp .env.example .env
# editar .env según tu entorno
pnpm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Display (fuera/desde otras máquinas): http://<host>:3001/display.html

## Construir y ejecutar (producción)
```bash
pnpm run build
pnpm run start
```

La versión de producción expone la API en el puerto configurado (por defecto 3001).

## Despliegue: pm2 o systemd (script incluido)
Usa `scripts/deploy.sh` para un asistente interactivo que:
- instala dependencias
- hace build
- crea `data/recent-prizes.json` si falta
- ofrece instalar con `pm2` o crear/instalar una unidad `systemd` y activarla

Ejemplo (manual) para systemd:
```bash
# editar systemd/tvdreams.service (ajustar WorkingDirectory y EnvironmentFile)
sudo mv systemd/tvdreams.service /etc/systemd/system/tvdreams.service
sudo systemctl daemon-reload
sudo systemctl enable --now tvdreams
sudo systemctl status tvdreams
```

Si prefieres `pm2`, el script también prepara y muestra el comando `pm2 startup` que debes ejecutar con `sudo`.

## Endpoints y uso inmediato
- Ver estado de la API:
    - `GET /api/status` (si está expuesto)
- Probar envío de premio (local):
    ```bash
    curl -X POST http://localhost:3001/api/test-prize
    ```
- Obtener últimos premios persistidos:
    ```bash
    curl http://localhost:3001/api/premio/recent
    ```

## Directorio `data/`
- `data/recent-prizes.json` — archivo usado para almacenar los últimos 3 premios. Asegúrate de que el usuario que ejecuta el proceso tenga permisos de escritura en `data/`.

## Comportamiento WebSocket / Displays
- Los displays se registran al servidor vía WebSocket con `{ type: 'register', screenId, sessionId }`.
- El servidor envía `display_command` con `command: 'show_prize'` para disparar la UI de premio en las pantallas.
- Se ha añadido reconexión robusta y lógica que evita borrar sesiones si un nuevo socket ya reemplazó al anterior.

## Notas operativas y troubleshooting rápido
- Si no ves mensajes de premio en los displays:
    - Verifica que el display está cargado en `http://<host>:3001/display.html` y conectado por WebSocket.
    - Usa `POST /api/test-prize` para forzar un envío y observa logs del servidor.
- Asegúrate de reiniciar el servidor después de aplicar cambios en `src/`.

## Contribuir
- Hacer cambios en ramas, agregar pruebas y abrir PRs.

---
Si quieres, actualizo y amplío cualquier sección (por ejemplo: pasos detallados de `systemd` para Debian/Ubuntu, o instrucciones no interactivas para CI/CD). 
```
Ver más opciones en [docs/guides/DEPLOY.md](./docs/guides/DEPLOY.md)
