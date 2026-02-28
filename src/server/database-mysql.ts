import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';

interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

class MySQLDatabase {
  private pool: mysql.Pool;
  private config: MySQLConfig;

  constructor(config: MySQLConfig) {
    this.config = config;
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
      connectTimeout: 60000
    });
  }

  async query(sql: string, params?: unknown[]): Promise<unknown> {
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('MySQL Query Error:', error);
      throw error;
    }
  }

  async get(sql: string, params?: unknown[]): Promise<unknown> {
    const rows = await this.query(sql, params);
    return Array.isArray(rows) ? rows[0] : rows;
  }

  async run(sql: string, params?: unknown[]): Promise<mysql.ResultSetHeader> {
    try {
      const [result] = await this.pool.execute(sql, params);
      return result as mysql.ResultSetHeader;
    } catch (error) {
      console.error('MySQL Run Error:', error);
      throw error;
    }
  }

  // Método para preparar statements (compatible con SQLite)
  prepare(sql: string) {
    return {
      get: async (params?: unknown[] | unknown, ...restParams: unknown[]) => {
        // Handle both array format and multiple parameters
        const paramArray = Array.isArray(params) ? params : 
                         (params !== undefined ? [params, ...restParams] : []);
        return this.get(sql, paramArray);
      },
      all: async (params?: unknown[] | unknown, ...restParams: unknown[]) => {
        // Handle both array format and multiple parameters
        const paramArray = Array.isArray(params) ? params : 
                         (params !== undefined ? [params, ...restParams] : []);
        return this.query(sql, paramArray);
      },
      run: async (params?: unknown[] | unknown, ...restParams: unknown[]) => {
        // Handle both array format and multiple parameters
        const paramArray = Array.isArray(params) ? params : 
                         (params !== undefined ? [params, ...restParams] : []);
        try {
          const [result] = await this.pool.execute(sql, paramArray);
          return result as mysql.ResultSetHeader;
        } catch (error) {
          console.error('MySQL Prepared Run Error:', error);
          throw error;
        }
      }
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // Método para inicializar la base de datos
  async initialize(): Promise<void> {
    try {
      // Verificar conexión a la base de datos
      await this.query('SELECT 1');
      // console.log('✅ MySQL connection established');

      // Verificar que las tablas necesarias existen
      const tables = await this.query(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('users', 'media', 'screens', 'folders')
      `, [this.config.database]) as unknown[];
      
      if (!Array.isArray(tables) || tables.length < 4) {
        console.warn('⚠️ Warning: Some required tables are missing. Please run database initialization scripts:');
        console.warn('   1. mysql -u root -p < database/setup-database.sql');
        console.warn('   2. mysql -u cms_user -p cms_usuarios_jules < database/full-schema.sql');
      }

    } catch (error) {
      console.error('❌ MySQL initialization failed:', error);
      console.error('Make sure MySQL server is running and credentials are correct in .env file');
      console.error('Required environment variables: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE');
      throw error;
    }
  }
}

// Configuración desde variables de entorno
const config: MySQLConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'cms_user',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'cms_usuarios_jules'
};

    // console.log('MySQL Config:', {
    //   host: config.host,
    //   port: config.port,
    //   user: config.user,
    //   database: config.database,
    //   password: config.password ? '[REDACTED]' : 'undefined'
    // });

const mysqlDb = new MySQLDatabase(config);

export default mysqlDb;