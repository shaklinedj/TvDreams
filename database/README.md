# 📁 Database Scripts - CMS HLAURE

Esta carpeta contiene todos los scripts SQL necesarios para configurar la base de datos del sistema.

## 🗂️ Archivos incluidos:

### `setup-database.sql`
**Propósito**: Crear la base de datos y usuario MySQL  
**Ejecutar como**: Usuario root de MySQL  
**Comando**:
```bash
mysql -u root -p < database/setup-database.sql
```

### `full-schema.sql` 
**Propósito**: Crear todas las tablas, índices y datos iniciales  
**Ejecutar como**: Usuario cms_user  
**Comando**:
```bash
mysql -u cms_user -p < database/full-schema.sql
```

**Este archivo es la fuente única de verdad para:**
- Estructura de todas las tablas
- Índices y relaciones
- Usuario administrador inicial (admin/admin)
- Carpetas por defecto (promociones, eventos, productos, temporadas)
- Métricas iniciales del sistema

### `add-hls-path.sql`
**Propósito**: Migración opcional para añadir soporte HLS a bases de datos existentes  
**Ejecutar como**: Usuario cms_user  
**Nota**: Solo necesario si actualizas desde una versión anterior. Las nuevas instalaciones ya incluyen este campo en `full-schema.sql`

## 🚀 Instalación Rápida

**Opción 1: Instalación manual**
```bash
# 1. Crear base de datos y usuario (como root)
mysql -u root -p < database/setup-database.sql

# 2. Crear tablas y datos iniciales 
mysql -u cms_user -p cms_usuarios_jules < database/full-schema.sql
```

**Opción 2: Usar script automático**
```bash
# Ejecutar el script de inicialización
node init-db.js
```

## 📊 Estructura de Tablas

- **users**: Usuarios del sistema (admin/user)
- **media**: Archivos multimedia subidos  
- **screens**: Configuración de pantallas
- **folders**: Organización de contenido
- **screen_media**: Asignación pantalla-contenido
- **connection_events**: Log de conexiones con session_id
- **media_views**: Analytics de reproducciones
- **system_metrics**: Métricas del sistema
- **file_operations**: Historial de operaciones de archivos

## 🏗️ Arquitectura de Inicialización

El sistema tiene tres niveles de inicialización:

### 1. **Nivel de Base de Datos** (SQL Scripts)
- **Responsabilidad**: Crear estructura y datos iniciales mínimos
- **Ubicación**: `database/full-schema.sql`
- **Contenido**:
  - Todas las tablas y relaciones
  - Usuario admin por defecto
  - Carpetas base (promociones, eventos, productos, temporadas)
  - Métricas iniciales del sistema

### 2. **Nivel de Conexión** (database-mysql.ts)
- **Responsabilidad**: Verificar conectividad y validar estructura
- **Ubicación**: `src/server/database-mysql.ts` método `initialize()`
- **Contenido**:
  - Verificar conexión MySQL
  - Validar existencia de tablas requeridas
  - Mostrar advertencias si faltan tablas

### 3. **Nivel de Aplicación** (index.ts)
- **Responsabilidad**: Crear datos específicos de la aplicación en tiempo de ejecución
- **Ubicación**: `src/server/index.ts` función `initializeDefaultData()`
- **Contenido**:
  - Carpetas adicionales (horizontales, verticales)
  - Pantallas de ejemplo según configuración
  - Directorios físicos de uploads

**Principio**: Los datos deben crearse en el nivel más bajo posible. Los datos estructurales van en SQL, la lógica de aplicación en el código de la app.

## 🔒 Seguridad

- Cambiar la contraseña por defecto en producción
- El usuario administrador inicial es: `admin` / `admin`
- Configurar variables de entorno apropiadas en `.env`

> ⚠️ **Problema con credenciales admin/admin?** Ver [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) para soluciones

## ⚠️ Notas Importantes

- Los archivos `database-schema.sql` y `scripts/mysql-schema.sql` están **OBSOLETOS**
- Use únicamente los archivos de esta carpeta `database/`
- El script `full-schema.sql` incluye la migración de `session_id` automaticamente