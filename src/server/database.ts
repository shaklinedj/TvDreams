import mysqlDb from './database-mysql';

// Initialize MySQL connection with fallback
let db;
try {
  await mysqlDb.initialize();
  db = mysqlDb;
  console.log('✅ MySQL database connected successfully');
} catch (error) {
  console.log('⚠️ MySQL connection failed, using fallback database');
  const { default: fallbackDb } = await import('./database-fallback');
  await fallbackDb.initialize();
  db = fallbackDb;
}

export default db;
