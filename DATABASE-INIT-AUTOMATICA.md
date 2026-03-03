# ✅ Base de Datos - Inicialización Automática en Docker

## 🔄 Cómo funciona la inicialización automática

Cuando ejecutas `./init-docker.sh` o `docker-compose up -d`, la base de datos **se configura SOLA**.

### Flujo de inicialización:

```
1. Docker inicia el contenedor MySQL
   ↓
2. MySQL busca scripts en /docker-entrypoint-initdb.d/
   ↓
3. Ejecuta automáticamente (en orden):
   - 01-setup.sql     (create user, permisos)
   - 02-schema.sql    (tablas, índices, datos)
   ↓
4. Base de datos lista! ✅
```

### Archivos usados:

```
database/
├── setup-database.sql     → Se copia como /docker-entrypoint-initdb.d/01-setup.sql
├── full-schema.sql        → Se copia como /docker-entrypoint-initdb.d/02-schema.sql
└── README.md
```

En `docker-compose.yml`:

```yaml
volumes:
  - ./database/setup-database.sql:/docker-entrypoint-initdb.d/01-setup.sql:ro
  - ./database/full-schema.sql:/docker-entrypoint-initdb.d/02-schema.sql:ro
```

---

## ✨ Ventajas del sistema actual

✅ **Automático** - No hay que mandar comandos manuales  
✅ **Reproducible** - Siempre igual en cualquier máquina  
✅ **Idempotente** - Se puede ejecutar múltiples veces sin problemas  
✅ **Rápido** - Inicialización en segundos  
✅ **Limpio** - Sin archivos temporales o scripts loose  

---

## 📊 Qué se crea automáticamente

### Usuario & BD
```sql
CREATE DATABASE cms_usuarios_julius
CREATE USER 'cms_user'@'localhost' IDENTIFIED BY 'pru5e@hu'
GRANT ALL PRIVILEGES ON cms_usuarios_julius.* TO 'cms_user'@'localhost'
```

### Tablas
- `users` - Administradores y usuarios
- `folders` - Carpetas de contenido
- `media` - Archivos (imágenes, vídeos)
- `screens` - Pantallas físicas conectadas
- `screen_media` - Asignación pantalla-contenido
- `connection_events` - Log de conexiones
- `media_views` - Estadísticas de visualización
- `system_metrics` - Monitoreo del sistema

### Datos iniciales
```sql
-- Admin por defecto
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', bcrypt('admin'), 'admin')

-- Carpetas por defecto
INSERT INTO folders (name) VALUES 
('promociones'), ('eventos'), ('productos'), ('temporadas')
```

---

## 🔍 Verificar que todo se creó

### Opción 1: Terminal MySQL

```bash
# Abrir shell MySQL dentro del contenedor
docker-compose exec db mysql -u cms_user -p

# Cuando pida password: pru5e@hu

# Dentro del shell:
SHOW DATABASES;
USE cms_usuarios_julius;
SHOW TABLES;
SELECT * FROM users;
SELECT * FROM folders;
EXIT;
```

### Opción 2: Herramienta visual

Instala **MySQL Workbench** o **DBeaver**:

```
Servidor: localhost:3306
Usuario: cms_user
Contraseña: pru5e@hu
Base de datos: cms_usuarios_julius
```

---

## 🛠️ Modificar la inicialización

Si necesitas cambiar qué se crea:

### 1. Edita `database/full-schema.sql`

```sql
-- Agregar nueva tabla
CREATE TABLE mi_tabla (
    id INT PRIMARY KEY,
    nombre VARCHAR(100)
);

-- Edita lo que ya existe
-- Por ejemplo, cambiar usuario admin, contraseña, etc.
```

### 2. Rebuilda los contenedores

```bash
# Opción A: Primero limpia el volumen
docker-compose down -v
docker-compose up -d

# Opción B: O sin limpiar (si no cambió estructura)
docker-compose restart db
```

---

## ⚠️ Problemas Comunes

### "Base de datos no se inicializa"

```bash
# Ver logs
docker-compose logs db

# Si hay error SQL, intenta:
# 1. Abre database/full-schema.sql
# 2. Busca la línea del error
# 3. Verifica sintaxis SQL
# 4. Prueba primero en MySQL Workbench
```

### "Error al conectar: Access denied"

```bash
# Verifica credenciales en .env
grep MYSQL .env

# Si están mal, edita:
nano .env

# Cambia:
MYSQL_USER=cms_user
MYSQL_PASSWORD=pru5e@hu
MYSQL_DATABASE=cms_usuarios_julius

# Limpia y reinicia:
docker-compose down -v
docker-compose up -d
```

### "Usuario o BD no se crean"

El archivo `setup-database.sql` debe ejecutarse ANTES que `full-schema.sql`.

Véase en `docker-compose.yml`:
```yaml
volumes:
  - ./database/setup-database.sql:/docker-entrypoint-initdb.d/01-setup.sql
  - ./database/full-schema.sql:/docker-entrypoint-initdb.d/02-schema.sql
```

El `01-` y `02-` aseguran el orden.

---

## 🔄 Reinicializar solo la BD (destructivo)

Si necesitas borrar TODO y empezar de nuevo:

```bash
# ADVERTENCIA: Borra todo incluyendo datos
docker-compose down -v

# Luego reinicia
docker-compose up -d
```

La BD se reinicializará automáticamente.

---

## 📝 Scripts utilizados

Ver [database/README.md](./database/README.md) para detalles de cada script SQL.

---

## ✅ Verificación rápida

Después de `./init-docker.sh`, verifica:

```bash
# 1. Contenedores corriendo
docker-compose ps

# 2. MySQL respondiendo
docker-compose exec db ping localhost

# 3. BD creada
docker-compose exec db mysql -u cms_user -p'pru5e@hu' -e "SHOW DATABASES;"

# 4. Tablas creadas
docker-compose exec db mysql -u cms_user -p'pru5e@hu' cms_usuarios_julius -e "SHOW TABLES;"

# 5. Datos iniciales
docker-compose exec db mysql -u cms_user -p'pru5e@hu' cms_usuarios_julius -e "SELECT * FROM users;"
```

Si todo dice `OK` o muestra datos, **¡estás listo!** ✅

---

**Resumen:** Docker + archivo al volumen = inicialización automática sin intervención manual. 🚀
