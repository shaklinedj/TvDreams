# 🚀 Docker - Primeros Pasos (Para usuarios finales)

## ⚡ Resumen Ejecutivo

Tu aplicación **TvDreams** está lista para ejecutarse en Docker. Solo necesitas **3 comandos** en Windows/Mac/Linux.

> **Tiempo total:** ~5 minutos (la primera vez)

---

## 📋 Requisitos Previos

Antes de empezar, necesitas instalar **Docker Desktop**. Elige tu sistema operativo:

### Windows o macOS

1. Descarga [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. Instala siguiendo los pasos por defecto
3. Reinicia tu computadora

### Linux (Ubuntu/Debian)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER
```

### ✅ Verificar instalación

```bash
docker --version
docker-compose --version
```

Deberías ver versiones. Si hay error, reinstala Docker.

---

## 🚀 INICIO RÁPIDO (3 pasos)

### Paso 1️⃣: Abre una terminal

**Windows:**
- Presiona `Win + R`, escribe `cmd`, presiona Enter

**macOS:**
- Spotlight (Cmd + Space) → Command Prompt

**Linux:**
- Abre Terminal normalmente

### Paso 2️⃣: Ve a la carpeta del proyecto

```bash
cd /ruta/a/TvDreams
```

Reemplaza `/ruta/a/TvDreams` con la carpeta donde clonaste el proyecto.

**Ejemplo (Windows):**
```bash
cd "C:\Users\TuUsuario\Documentos\TvDreams"
```

### Paso 3️⃣: Ejecuta el inicializador

```bash
./init-docker.sh
```

**¿Qué hace este comando?**
- ✅ Verifica que Docker esté instalado
- ✅ Prepara la configuración
- ✅ Descarga imágenes necesarias (3-5 minutos)
- ✅ Inicializa la base de datos automáticamente
- ✅ Inicia todos los servicios

**Espera a ver:**
```
🎉 ¡INICIALIZACIÓN COMPLETADA EXITOSAMENTE!
```

---

## 🌐 Acceso a la aplicación

Una vez que veas el mensaje de éxito, abre tu navegador:

### Frontend (Panel de control)
```
http://localhost:3001
```

### Display (Pantalla de premios)
```
http://localhost:3001/display.html
```

### Base de Datos (MySQL - solo técnicos)
```
Dirección: localhost:3306
Usuario: cms_user
Contraseña: (verificar en .env)
```

---

## 👤 Credenciales Iniciales

**Usuario administrador:**
```
Username: admin
Password: admin
```

⚠️ **IMPORTANTE:** Cambia la contraseña después de iniciar sesión

---

## 🛠️ Comandos Diarios

Una vez inicializado, usa estos comandos en la terminal:

### Iniciar (si se detuvo)
```bash
docker-compose up -d
```

### Detener
```bash
docker-compose down
```

### Ver estado
```bash
docker-compose ps
```

### Ver logs (errores/info)
```bash
docker-compose logs -f app
```

### Menú interactivo
```bash
./docker-manager.sh
```

Selecciona opciones como "Ver logs", "Reiniciar", etc.

---

## ❌ Solución de Problemas

### Problema: "Connection refused"

```bash
# Espera un poco más y luego intenta:
sleep 30
docker-compose ps
```

**Causa:** MySQL tarda en iniciar

---

### Problema: Puerto 3001 ya en uso

```bash
# Edita .env
nano .env

# Cambia la línea:
APP_PORT=3002

# Guarda (Ctrl+X, luego Y, Enter)
# Reinicia:
docker-compose restart
```

Accede a `http://localhost:3002`

---

### Problema: "Docker not found"

```bash
# Reinicia la terminal
# O reinicia tu computadora
docker --version
```

---

### Problema: Pantalla en negro / No carga

```bash
# Ver qué está pasando:
docker-compose logs app

# Reiniciar:
docker-compose restart
```

---

### Problema: Quiero empezar de cero

```bash
# ADVERTENCIA: Esto BORRA TODO (datos, BD, etc)
docker-compose down -v

# Luego ejecuta de nuevo:
./init-docker.sh
```

---

## 💾 Hacer Backup de los datos

Antes de cambios importantes, guarda tus datos:

```bash
./backup-docker.sh
```

Se crea una carpeta `backups/tvdreams_backup_YYYYMMDD_HHMMSS/` con:
- `database.sql` - Copia de BD
- `uploads.tar.gz` - Tus archivos multimedia
- `data.tar.gz` - Datos persistentes

---

## 📚 Documentación Completa

- **DOCKER-DEPLOYMENT.md** - Guía técnica completa
- **DOCKER-QUICK-REF-ES.md** - Referencia rápida de comandos

---

## ✅ Checklist Después de Iniciar

- [ ] Abrí http://localhost:3001
- [ ] Vi la pantalla de login
- [ ] Inicié sesión con admin/admin
- [ ] Cambié la contraseña
- [ ] Subí un archivo de prueba
- [ ] Accedí a `/display.html`
- [ ] Vi la pantalla de display funcionando

---

## 🆘 ¿Necesitas ayuda?

1. Revisa **DOCKER-QUICK-REF-ES.md** para comandos
2. Revisa **DOCKER-DEPLOYMENT.md** para soluciones avanzadas
3. Verifica los logs: `docker-compose logs -f`

---

## 💡 Consejos Útiles

**Automatizar inicios (Linux/macOS):**

Crea un alias en tu `.bashrc` o `.zshrc`:

```bash
alias tvdreams-start="cd /ruta/a/TvDreams && docker-compose up -d"
alias tvdreams-stop="cd /ruta/a/TvDreams && docker-compose down"
alias tvdreams-logs="cd /ruta/a/TvDreams && docker-compose logs -f app"
```

Luego simplemente:
```bash
tvdreams-start
```

---

## 🎯 Próximos Pasos

1. **Sube contenido:**
   - Accede a http://localhost:3001/admin
   - Sube videos, imágenes, etc.

2. **Configura displays:**
   - Abre `display.html` en otro navegador/pantalla
   - Conectará automáticamente

3. **Envía premios:**
   - Usa la sección "Premios" del admin
   - Se mostrarán en tiempo real en los displays

4. **Configuración avanzada:**
   - Ver `DOCKER-DEPLOYMENT.md` para SSL, proxy, etc.

---

**¡Listo para empezar! 🚀**

```bash
./init-docker.sh
```
