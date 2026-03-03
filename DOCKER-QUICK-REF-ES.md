# 🎯 Docker Quick Reference - TvDreams

## ⚡ 60 segundos - Primeros pasos

```bash
# 1. Opción A: Menú interactivo (RECOMENDADO)
chmod +x docker-manager.sh
./docker-manager.sh
# → Selecciona opción 1

# 2. Opción B: Directo
docker-compose up -d
sleep 30
# Listo ✅
```

**Acceso:**
- 🌐 http://localhost:3001
- 📺 http://localhost:3001/display.html

---

## 🔧 Comandos día a día

| Tarea | Comando |
|-------|---------|
| **Iniciar** | `docker-compose up -d` |
| **Detener** | `docker-compose down` |
| **Reiniciar** | `docker-compose restart` |
| **Ver estado** | `docker-compose ps` |
| **Logs app** | `docker-compose logs -f app` |
| **Logs BD** | `docker-compose logs -f db` |
| **MySQL CLI** | `docker-compose exec db mysql -u cms_user -p` |
| **Build** | `docker-compose build` |
| **Limpiar todo** | `docker-compose down -v` |

---

## 🆘 Problemas frecuentes

| Problema | Solución |
|----------|----------|
| **"Connection refused"** | `sleep 30` esperar a que MySQL inicie |
| **Puerto 3001 en uso** | `APP_PORT=3002` en `.env` |
| **Sin disco** | `docker system prune -a` |
| **DB corrupta** | `docker-compose down -v && docker-compose up -d` |
| **Permisos archivos** | `sudo chown -R 1000:1000 uploads data` |

---

## 💾 Backup

```bash
# Manual
./backup-docker.sh

# Automático (cron)
crontab -e
# Agregar: 0 2 * * * /opt/tvdreams/backup-docker.sh
```

---

## 🌐 Producción

```bash
# 1. Editar .env
nano .env

# 2. Iniciar producción
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 3. SSL con Nginx (copiar nginx-tvdreams.conf)
```

---

## 📊 Monitoreo

```bash
# Uso de recursos
docker stats

# Logs en vivo
docker-compose logs -f

# Historial
docker-compose logs --tail 100
```

---

## 📚 Documentación

- **DOCKER-DEPLOYMENT.md** - Guía completa (20+ páginas)
- **DOCKER-SETUP-COMPLETE.md** - Resumen ejecutivo  
- **nginx-tvdreams.conf** - Config Nginx para SSL

---

**¡Listo! Cualquier duda, consulta DOCKER-DEPLOYMENT.md** 🚀
