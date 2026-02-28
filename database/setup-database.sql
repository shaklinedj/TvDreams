-- ====================================================
-- CMS HLAURE - Creación de Usuario y Base de Datos
-- Ejecutar como usuario root de MySQL
-- ====================================================

-- Crear base de datos
CREATE DATABASE IF NOT EXISTS cms_usuarios_jules CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Crear usuario (cambiar contraseña en producción)
CREATE USER IF NOT EXISTS 'cms_user'@'localhost' IDENTIFIED BY 'pru5e@hu';

-- Otorgar permisos
GRANT ALL PRIVILEGES ON cms_usuarios_jules.* TO 'cms_user'@'localhost';
FLUSH PRIVILEGES;

-- Verificar creación
SELECT 'Usuario y base de datos creados correctamente' as status;
SHOW DATABASES LIKE 'cms_usuarios_jules';
