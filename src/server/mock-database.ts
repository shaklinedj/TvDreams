// Simple SQLite-based mock for testing
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

class MockDatabase {
  private db: Database.Database;

  constructor() {
    // Create a temporary SQLite database
    this.db = new Database(':memory:');
    this.initialize();
  }

  initialize() {
    // Create basic tables for testing
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS connection_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        screen_id INTEGER NOT NULL,
        session_id TEXT,
        event_type TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS screens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT,
        resolution TEXT,
        orientation TEXT,
        assignedFolder TEXT,
        transitionType TEXT,
        duration INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT,
        path TEXT,
        size INTEGER,
        folder TEXT,
        thumbnail TEXT
      );

      -- Insert test data
      INSERT INTO screens (name, assignedFolder, location) VALUES ('Test Screen', 'test-folder', 'Test Location');
      INSERT INTO media (name, type, path, size, folder, thumbnail) VALUES 
        ('test-image.jpg', 'image/jpeg', '/test/path.jpg', 12345, 'test-folder', 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=');
      INSERT INTO connection_events (screen_id, event_type) VALUES (1, 'connect');
    `);
  }

  async query(sql: string, params = []) {
    try {
      return this.db.prepare(sql).all(params);
    } catch (error) {
      console.error('Mock DB Query Error:', error);
      return [];
    }
  }

  async get(sql: string, params = []) {
    try {
      return this.db.prepare(sql).get(params) || null;
    } catch (error) {
      console.error('Mock DB Get Error:', error);
      return null;
    }
  }

  async run(sql: string, params = []) {
    try {
      const result = this.db.prepare(sql).run(params);
      return { insertId: result.lastInsertRowid, affectedRows: result.changes };
    } catch (error) {
      console.error('Mock DB Run Error:', error);
      return { insertId: 0, affectedRows: 0 };
    }
  }

  close() {
    this.db.close();
  }
}

export default new MockDatabase();