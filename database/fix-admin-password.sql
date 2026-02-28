-- ====================================================
-- FIX ADMIN PASSWORD - CMS HLAURE
-- ====================================================
-- Este script corrige el hash de contraseña del usuario admin
-- para usuarios que experimentan el error "credenciales inválidas"
-- 
-- Uso:
--   mysql -u cms_user -p cms_usuarios_jules < database/fix-admin-password.sql
--
-- O como root:
--   mysql -u root -p cms_usuarios_jules < database/fix-admin-password.sql
-- ====================================================

USE cms_usuarios_jules;

-- Actualizar el hash de contraseña del usuario admin con un hash válido
-- Contraseña: admin
UPDATE users 
SET password_hash = '$2b$10$C5JbBp6cC4ZXvlerkKFmK.LNAGldz/VsKX6ibzCDiNIsBSuRq1DXi'
WHERE username = 'admin';

-- Verificar que el usuario fue actualizado correctamente
SELECT 
    id,
    username,
    role,
    LENGTH(password_hash) as hash_length,
    'Contraseña actualizada correctamente. Use: admin/admin para entrar' as mensaje
FROM users 
WHERE username = 'admin';
