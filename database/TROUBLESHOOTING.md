# 🔧 Solución de Problemas - Credenciales Admin

## 📌 Resumen Rápido

**Problema**: No puedes entrar con `admin`/`admin` - dice "credenciales inválidas"  
**Causa**: Hash de contraseña inválido en la base de datos  
**Solución**: Actualizar el hash de contraseña (ver abajo)

---

## ❌ Problema: "Credenciales inválidas" con admin/admin

Si instalaste el sistema y no puedes entrar con `admin`/`admin`, sigue estos pasos:

### 🚀 Solución Rápida (Recomendada)

**Opción 1: Ejecutar el script de corrección**

```bash
mysql -u cms_user -p cms_usuarios_jules < database/fix-admin-password.sql
```

Cuando te pida la contraseña, usa: `pru5e@hu` (o la contraseña que configuraste para cms_user)

**Opción 2: Como usuario root de MySQL**

```bash
mysql -u root -p cms_usuarios_jules < database/fix-admin-password.sql
```

Después de ejecutar cualquiera de estos comandos, podrás iniciar sesión con:
- **Usuario**: `admin`
- **Contraseña**: `admin`

---

### 🔍 Verificación Manual (Opción Avanzada)

Si prefieres hacerlo manualmente o usar phpMyAdmin:

#### Usando línea de comandos MySQL:

```bash
# Conectar a la base de datos
mysql -u cms_user -p cms_usuarios_jules

# O como root
mysql -u root -p cms_usuarios_jules
```

Luego ejecuta este comando SQL:

```sql
UPDATE users 
SET password_hash = '$2b$10$C5JbBp6cC4ZXvlerkKFmK.LNAGldz/VsKX6ibzCDiNIsBSuRq1DXi'
WHERE username = 'admin';
```

#### Usando phpMyAdmin:

1. **Abre phpMyAdmin** en tu navegador (usualmente `http://localhost/phpmyadmin`)
2. **Selecciona la base de datos** `cms_usuarios_jules` en el panel izquierdo
3. **Haz clic en la tabla** `users`
4. **Busca el registro** con `username = 'admin'`
5. **Haz clic en "Editar"** (icono de lápiz ✏️)
6. **En el campo `password_hash`**, reemplaza el valor existente con:
   ```
   $2b$10$C5JbBp6cC4ZXvlerkKFmK.LNAGldz/VsKX6ibzCDiNIsBSuRq1DXi
   ```
7. **Guarda los cambios** haciendo clic en "Continuar" o "Go"

**Nota importante**: Asegúrate de copiar el hash completo, son exactamente 60 caracteres.

---

### ✅ Verificar que Funcionó

Después de aplicar la corrección, verifica:

```sql
-- Conectar a MySQL
mysql -u cms_user -p cms_usuarios_jules

-- Verificar el usuario
SELECT id, username, role, LENGTH(password_hash) as hash_length
FROM users 
WHERE username = 'admin';
```

El `hash_length` debe ser **60 caracteres**. Si ves un número diferente, el hash no es válido.

---

### 🆕 Para Instalaciones Nuevas

Si estás haciendo una instalación nueva desde cero:

```bash
# 1. Crear la base de datos y usuario
mysql -u root -p < database/setup-database.sql

# 2. Crear las tablas y datos iniciales (VERSIÓN CORREGIDA)
mysql -u cms_user -p cms_usuarios_jules < database/full-schema.sql
```

La versión actualizada de `full-schema.sql` ya incluye el hash correcto.

---

### 📝 Crear Usuario Adicional desde SQL

Si necesitas crear usuarios adicionales directamente en la base de datos:

```sql
-- Generar un hash válido primero (en Node.js):
-- node -e "const bcrypt = require('bcrypt'); console.log(bcrypt.hashSync('tu_contraseña', 10));"

-- Luego insertar el usuario:
INSERT INTO users (username, email, password_hash, role, first_login) 
VALUES (
  'nuevo_usuario',
  'email@ejemplo.com',
  '$2b$10$...[hash generado]...',
  'user',  -- o 'admin' para administrador
  TRUE     -- TRUE = debe cambiar contraseña en primer login
);
```

---

### 🔒 Cambiar Contraseña desde la API

Una vez que puedas entrar, es recomendable cambiar la contraseña del admin:

1. Inicia sesión en el sistema con admin/admin
2. Ve a "Gestión de Usuarios"
3. Edita el usuario admin
4. Cambia la contraseña a una segura

---

### ⚠️ Notas Importantes

- **Longitud del hash**: Un hash bcrypt válido tiene exactamente **60 caracteres**
- **Formato**: Debe empezar con `$2b$10$` o `$2a$10$`
- **Seguridad**: Cambia la contraseña por defecto en producción
- **Primera instalación**: El flag `first_login = TRUE` obligará al usuario a cambiar su contraseña

---

### 🆘 Aún No Funciona?

Si después de estos pasos aún tienes problemas:

1. **Verifica la conexión a la base de datos**: Revisa el archivo `.env`
   ```env
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=cms_user
   MYSQL_PASSWORD=pru5e@hu
   MYSQL_DATABASE=cms_usuarios_jules
   ```

2. **Verifica que la tabla users existe**:
   ```sql
   SHOW TABLES;
   DESCRIBE users;
   ```

3. **Verifica que hay datos en users**:
   ```sql
   SELECT * FROM users;
   ```

4. **Revisa los logs del servidor**: 
   ```bash
   npm run dev
   ```
   Los errores aparecerán en la consola.

---

### 📚 Documentación Adicional

- Ver `database/README.md` para más información sobre la estructura de la base de datos
- Ver `database/INITIALIZATION_GUIDE.md` para entender la arquitectura de inicialización
