#!/bin/bash
# Temporary database setup script

# Kill any existing MySQL processes
sudo pkill -f mysql

# Reset MySQL data directory
sudo rm -rf /var/lib/mysql/*
sudo mysqld --initialize-insecure --user=mysql --datadir=/var/lib/mysql

# Start MySQL
sudo systemctl start mysql

# Set up database and user
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS cms_usuarios_jules;
CREATE USER IF NOT EXISTS 'cms_user'@'localhost' IDENTIFIED BY 'pru5e@hu';
GRANT ALL PRIVILEGES ON cms_usuarios_jules.* TO 'cms_user'@'localhost';
FLUSH PRIVILEGES;
EOF

echo "Database setup completed"