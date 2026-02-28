#!/usr/bin/env node
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDatabase() {
  let connection;
  try {
    // Connect to MySQL without specifying database
    connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
    });

    console.log('Connected to MySQL successfully');

    // Create database
    await connection.execute('CREATE DATABASE IF NOT EXISTS cms_usuarios_jules');
    console.log('Database created or already exists');

    // Create user and grant privileges
    try {
      await connection.execute("CREATE USER IF NOT EXISTS 'cms_user'@'localhost' IDENTIFIED BY 'pru5e@hu'");
      await connection.execute('GRANT ALL PRIVILEGES ON cms_usuarios_jules.* TO "cms_user"@"localhost"');
      await connection.execute('FLUSH PRIVILEGES');
      console.log('User created and privileges granted');
    } catch (error) {
      console.log('User setup failed, but continuing...');
    }

    // Switch to the database
    await connection.execute('USE cms_usuarios_jules');

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'database/full-schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      const statements = schema.split(';').filter(s => s.trim().length > 0);
      
      for (const statement of statements) {
        try {
          await connection.execute(statement);
        } catch (error) {
          console.log(`Warning: ${error.message}`);
        }
      }
      console.log('Schema executed successfully');
    }

  } catch (error) {
    console.error('Database initialization failed:', error);
    
    // Fallback: try with empty password for root
    try {
      if (connection) await connection.end();
      connection = await mysql.createConnection({
        host: 'localhost',
        port: 3306,
        user: 'root'
      });
      
      await connection.execute('CREATE DATABASE IF NOT EXISTS cms_usuarios_jules');
      console.log('Fallback: Database created');
    } catch (fallbackError) {
      console.error('Both primary and fallback methods failed:', fallbackError);
    }
  } finally {
    if (connection) await connection.end();
  }
}

initDatabase();