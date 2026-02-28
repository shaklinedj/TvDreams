# 🎯 SOLUCIÓN COMPLETA - Problema con Credenciales Admin

## 📝 Resumen del Problema

**Problema reportado**: 
> "hice todo en una instalcion nueva, pero el usuario admin - admin no me esta dejando entrar dice creenciales inavalidas. no se como crear un usuario directo en phpmyadmin"

## 🔍 Causa Raíz Identificada

El hash de contraseña bcrypt en el archivo `database/full-schema.sql` era **inválido**:
- ❌ **Hash antiguo**: 54 caracteres (inválido)
- ✅ **Hash nuevo**: 60 caracteres (válido)

Un hash bcrypt válido debe tener exactamente **60 caracteres** y seguir el formato `$2b$10$...`

## 🛠️ Solución Implementada

### 1. Para Instalaciones Nuevas

Si estás haciendo una instalación nueva, el problema ya está corregido en el código:

```bash
# Opción 1: Instalación automática
node init-db.js

# Opción 2: Instalación manual
mysql -u root -p < database/setup-database.sql
mysql -u cms_user -p cms_usuarios_jules < database/full-schema.sql
```

**Credenciales**: `admin` / `admin`

---

### 2. Para Instalaciones Existentes (Ya Instaladas)

Si ya instalaste el sistema y no puedes entrar, usa el script de corrección:

```bash
mysql -u cms_user -p cms_usuarios_jules < database/fix-admin-password.sql
```

Contraseña de cms_user: `pru5e@hu` (o la que configuraste)

---

### 3. Usando phpMyAdmin

Si prefieres usar la interfaz gráfica de phpMyAdmin:

1. Abre phpMyAdmin en tu navegador: `http://localhost/phpmyadmin`
2. Selecciona la base de datos `cms_usuarios_jules`
3. Haz clic en la tabla `users`
4. Busca el registro con `username = 'admin'`
5. Haz clic en "Editar" (✏️)
6. En el campo `password_hash`, pega este hash:
   ```
   $2b$10$C5JbBp6cC4ZXvlerkKFmK.LNAGldz/VsKX6ibzCDiNIsBSuRq1DXi
   ```
7. Guarda los cambios

---

## 📚 Documentación Completa

Para más detalles y opciones adicionales, consulta:

- **[database/TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Guía completa de solución de problemas
- **[database/README.md](./README.md)** - Documentación de la base de datos
- **[README.md](../README.md)** - Documentación principal del proyecto

---

## ✅ Verificación

Para verificar que la corrección funcionó:

```sql
-- Conectar a MySQL
mysql -u cms_user -p cms_usuarios_jules

-- Verificar el usuario
SELECT id, username, role, LENGTH(password_hash) as hash_length
FROM users 
WHERE username = 'admin';
```

El `hash_length` debe ser **60**.

---

## 🔒 Crear Usuario Adicional

Si necesitas crear más usuarios directamente en la base de datos:

```sql
-- 1. Generar el hash (fuera de MySQL, en terminal)
node -e "const bcrypt = require('bcrypt'); console.log(bcrypt.hashSync('tu_contraseña', 10));"

-- 2. Insertar el usuario en MySQL
INSERT INTO users (username, email, password_hash, role, first_login) 
VALUES (
  'nombre_usuario',
  'email@ejemplo.com',
  '$2b$10$...[hash generado]...',
  'user',  -- o 'admin' para administrador
  TRUE     -- Obligar cambio de contraseña en primer login
);
```

---

## 🎯 Archivos Modificados en esta Corrección

1. **database/full-schema.sql** - Corregido el hash de contraseña inválido
2. **database/fix-admin-password.sql** - Script para corregir bases existentes
3. **database/TROUBLESHOOTING.md** - Guía completa de solución de problemas
4. **README.md** - Añadido enlace a guía de solución de problemas
5. **database/README.md** - Añadido enlace a guía de solución de problemas

---

## 📞 Soporte Adicional

Si después de aplicar estas correcciones aún tienes problemas:

1. Verifica que MySQL esté corriendo
2. Verifica las credenciales en el archivo `.env`
3. Revisa los logs del servidor: `npm run dev`
4. Consulta la guía completa en `database/TROUBLESHOOTING.md`

---

**Última actualización**: 2025-10-11  
**Estado**: ✅ Problema resuelto
