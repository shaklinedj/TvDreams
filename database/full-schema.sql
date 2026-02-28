-- ====================================================
-- CMS HLAURE - Sistema de Gestión de Contenido 
-- Esquema completo de base de datos MySQL
-- ====================================================
-- Incluye todas las tablas, índices y datos iniciales

-- Crear la base de datos si no existe
CREATE DATABASE IF NOT EXISTS cms_usuarios_jules CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cms_usuarios_jules;

-- ====================================================
-- TABLAS PRINCIPALES
-- ====================================================

-- Tabla de usuarios
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    first_login BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de carpetas
CREATE TABLE folders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de medios
CREATE TABLE media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    path VARCHAR(500) NOT NULL,
    size BIGINT NOT NULL,
    folder VARCHAR(100),
    thumbnail TEXT,
    hls_path VARCHAR(500) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_folder (folder),
    INDEX idx_type (type),
    INDEX idx_created_at (created_at),
    INDEX idx_hls_path (hls_path)
);

-- Tabla de pantallas
CREATE TABLE screens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    location VARCHAR(255),
    resolution VARCHAR(20),
    orientation VARCHAR(20),
    assignedFolder VARCHAR(100),
    transitionType VARCHAR(20),
    duration INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de asignación pantalla-media
CREATE TABLE screen_media (
    screen_id INT,
    media_id INT,
    display_order INT,
    PRIMARY KEY (screen_id, media_id),
    FOREIGN KEY (screen_id) REFERENCES screens(id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
);

-- Tabla de eventos de conexión (incluye session_id)
CREATE TABLE connection_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    screen_id INT NOT NULL,
    session_id VARCHAR(36) DEFAULT NULL,
    event_type ENUM('connect', 'disconnect') NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (screen_id) REFERENCES screens(id) ON DELETE CASCADE,
    INDEX idx_screen_timestamp (screen_id, timestamp),
    INDEX idx_session_id (session_id)
);

-- Tabla de visualizaciones de media
CREATE TABLE media_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    screen_id INT NOT NULL,
    media_id INT NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INT,
    FOREIGN KEY (screen_id) REFERENCES screens(id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
    INDEX idx_screen_media (screen_id, media_id),
    INDEX idx_started_at (started_at)
);

-- Tabla de métricas del sistema
CREATE TABLE system_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_metric_time (metric_name, recorded_at)
);

-- Tabla de operaciones de archivos
CREATE TABLE file_operations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    operation_type ENUM('upload', 'delete') NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    folder VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_operation_date (operation_type, created_at),
    INDEX idx_folder (folder)
);

-- ====================================================
-- DATOS INICIALES
-- ====================================================

-- Insertar carpetas por defecto
INSERT INTO folders (name) VALUES 
('promociones'),
('eventos'), 
('productos'),
('temporadas');

-- Insertar usuario administrador por defecto
-- Contraseña: admin (en producción cambiar inmediatamente)
INSERT INTO users (username, password_hash, role, first_login) VALUES 
('admin', '$2b$10$C5JbBp6cC4ZXvlerkKFmK.LNAGldz/VsKX6ibzCDiNIsBSuRq1DXi', 'admin', TRUE);

-- Insertar métrica inicial del sistema
INSERT INTO system_metrics (metric_name, metric_value) 
VALUES ('system_start_time', UNIX_TIMESTAMP() * 1000);

-- ====================================================
-- VERIFICACIÓN DE INSTALACIÓN
-- ====================================================

SELECT 'Base de datos CMS HLAURE instalada correctamente' as status;
SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'cms_usuarios_jules';