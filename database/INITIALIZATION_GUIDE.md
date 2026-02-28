# 🎯 Guía de Inicialización de Base de Datos - CMS HLAURE

## 📌 Resumen de Cambios

Este documento explica la arquitectura simplificada de inicialización de base de datos, enfocada en eliminar redundancias y establecer responsabilidades claras.

## 🔄 Cambios Realizados

### 1. Simplificación de `database-mysql.ts`

**Antes:** El método `initialize()` creaba datos redundantes
```typescript
// ❌ CÓDIGO ANTIGUO (ELIMINADO)
async initialize(): Promise<void> {
  // Crear usuario admin si no existe
  const adminUser = await this.get('SELECT * FROM users WHERE username = ?', ['admin']);
  if (!adminUser) {
    const hash = bcrypt.hashSync('admin', 10);
    await this.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', 
                   ['admin', hash, 'admin']);
  }
  
  // Crear pantalla de ejemplo si no existe
  const screenCount = await this.get('SELECT COUNT(*) as count FROM screens');
  if (screenCount && screenCount.count === 0) {
    await this.run('INSERT INTO screens (...) VALUES (...)', [...]);
  }
}
```

**Después:** Solo verifica conexión y existencia de tablas
```typescript
// ✅ CÓDIGO NUEVO
async initialize(): Promise<void> {
  // Verificar conexión a la base de datos
  await this.query('SELECT 1');
  
  // Verificar que las tablas necesarias existen
  const tables = await this.query(`
    SELECT TABLE_NAME 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('users', 'media', 'screens', 'folders')
  `, [this.config.database]);
  
  if (!Array.isArray(tables) || tables.length < 4) {
    console.warn('⚠️ Warning: Some required tables are missing. Please run database initialization scripts:');
    console.warn('   1. mysql -u root -p < database/setup-database.sql');
    console.warn('   2. mysql -u cms_user -p cms_usuarios_jules < database/full-schema.sql');
  }
}
```

**Beneficios:**
- ✅ No hay redundancia entre código y SQL
- ✅ El código TypeScript no necesita bcrypt
- ✅ Más fácil de mantener
- ✅ Mensajes de error más útiles

### 2. Dependencia Eliminada

```typescript
// ❌ ELIMINADO
import bcrypt from 'bcrypt';
```

**Razón:** La creación de usuarios debe hacerse a través de la API o scripts SQL, no en la capa de conexión.

## 🏗️ Arquitectura de Tres Niveles

### Nivel 1: Base de Datos (SQL)
**Archivo:** `database/full-schema.sql`  
**Responsabilidad:** Estructura y datos iniciales esenciales

```sql
-- ✅ Lo que DEBE estar aquí:
CREATE TABLE users (...);
CREATE TABLE screens (...);
INSERT INTO users (username, password_hash, role) VALUES ('admin', '$2b$10$...', 'admin');
INSERT INTO folders (name) VALUES ('promociones'), ('eventos'), ('productos'), ('temporadas');
```

**Criterio:** Si es necesario para que la aplicación funcione básicamente, va aquí.

### Nivel 2: Conexión (TypeScript)
**Archivo:** `src/server/database-mysql.ts`  
**Responsabilidad:** Verificar conectividad y validar estructura

```typescript
// ✅ Lo que DEBE estar aquí:
- Verificar conexión MySQL
- Validar existencia de tablas
- Mostrar advertencias útiles
```

**Criterio:** Solo código de verificación, NO creación de datos.

### Nivel 3: Aplicación (TypeScript)
**Archivo:** `src/server/index.ts`  
**Responsabilidad:** Datos específicos del entorno de ejecución

```typescript
// ✅ Lo que DEBE estar aquí:
async function initializeDefaultData() {
  // Crear carpetas adicionales (horizontales, verticales)
  // Crear pantallas según configuración
  // Crear directorios físicos de uploads
}
```

**Criterio:** Datos que dependen del entorno o configuración de la aplicación.

## 📋 Matriz de Decisiones

| Tipo de Dato | ¿Dónde va? | Ejemplo |
|--------------|-----------|---------|
| Tabla de base de datos | `full-schema.sql` | `CREATE TABLE users` |
| Usuario admin inicial | `full-schema.sql` | `INSERT INTO users` |
| Carpetas base del sistema | `full-schema.sql` | `INSERT INTO folders` |
| Verificación de conexión | `database-mysql.ts` | `await this.query('SELECT 1')` |
| Validación de estructura | `database-mysql.ts` | Verificar tablas existen |
| Carpetas adicionales | `index.ts` | horizontales, verticales |
| Pantallas de ejemplo | `index.ts` | Pantallas según config |
| Directorios físicos | `index.ts` | `fs.mkdirSync(...)` |

## 🎓 Principio Fundamental

> **Los datos deben crearse en el nivel más bajo posible.**

1. ¿Es estructura de datos? → SQL
2. ¿Es verificación/validación? → Capa de conexión
3. ¿Depende del entorno? → Capa de aplicación

## 🚀 Uso Correcto

### Para Nueva Instalación

```bash
# Opción 1: Manual
mysql -u root -p < database/setup-database.sql
mysql -u cms_user -p cms_usuarios_jules < database/full-schema.sql

# Opción 2: Automática
node init-db.js
```

### Para Agregar Datos Iniciales Nuevos

❌ **INCORRECTO** - No agregar en `database-mysql.ts`:
```typescript
// NO HACER ESTO
async initialize() {
  await this.run('INSERT INTO nueva_tabla VALUES (...)');
}
```

✅ **CORRECTO** - Agregar en `full-schema.sql`:
```sql
-- Agregar al final de full-schema.sql
INSERT INTO nueva_tabla (campo1, campo2) VALUES ('valor1', 'valor2');
```

### Para Datos Específicos de la Aplicación

✅ **CORRECTO** - Agregar en `index.ts`:
```typescript
async function initializeDefaultData() {
  // Verificar si existen
  const existing = await db.get('SELECT id FROM mi_tabla WHERE nombre = ?', ['ejemplo']);
  
  if (!existing) {
    await db.run('INSERT INTO mi_tabla (nombre) VALUES (?)', ['ejemplo']);
  }
}
```

## 📝 Checklist de Mantenimiento

Al agregar nueva funcionalidad que requiere datos iniciales:

- [ ] ¿Es estructura de base de datos? → Actualizar `full-schema.sql`
- [ ] ¿Es verificación necesaria? → Actualizar `database-mysql.ts`
- [ ] ¿Depende del entorno/config? → Actualizar `index.ts`
- [ ] ¿Documenté el cambio? → Actualizar `database/README.md`
- [ ] ¿Probé desde cero? → Ejecutar `init-db.js`

## 🔍 Resumen de Archivos

```
database/
├── setup-database.sql        # Crea DB y usuario (nivel root)
├── full-schema.sql           # ⭐ Fuente única de verdad
├── add-hls-path.sql          # Migración opcional
└── README.md                 # Documentación principal

src/server/
├── database-mysql.ts         # Solo verificación de conexión
├── database.ts               # Selector de base de datos
└── index.ts                  # Lógica de aplicación

init-db.js                    # Script automático de instalación
```

## ✨ Beneficios de Este Enfoque

1. **Claridad**: Cada nivel tiene una responsabilidad clara
2. **Mantenibilidad**: Fácil encontrar dónde cambiar algo
3. **Sin redundancia**: Los datos no se duplican
4. **Testeable**: Cada nivel se puede probar independientemente
5. **Documentado**: Arquitectura explícita y documentada
