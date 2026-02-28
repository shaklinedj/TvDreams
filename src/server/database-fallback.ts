// Minimal database fallback for development testing
class MockDatabase {
  constructor() {
    console.log('🔧 Using mock database for development');
  }

  async initialize() {
    console.log('✅ Mock database initialized');
  }

  async query(sql, params = []) {
    // Mock basic queries
    if (sql.includes('connection_events')) {
      // For cleanup queries, return empty array
      if (sql.includes('DISTINCT c1.screen_id')) {
        return [];
      }
      // For analytics queries
      return [
        { screen_id: 1, event_type: 'connect', timestamp: new Date() },
        { screen_id: 1, event_type: 'disconnect', timestamp: new Date(Date.now() + 60000) }
      ];
    }
    if (sql.includes('folders')) {
      return [
        { id: 1, name: 'test-folder' },
        { id: 2, name: 'sample-folder' }
      ];
    }
    if (sql.includes('screens')) {
      return [
        { id: 1, name: 'Test Screen', assignedFolder: 'test-folder', location: 'Test Location' }
      ];
    }
    if (sql.includes('media')) {
      return [
        { 
          id: 1, 
          name: 'test-image.jpg', 
          type: 'image/jpeg', 
          path: '/test/path.jpg',
          thumbnail: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
          size: 12345,
          folder: 'test-folder'
        }
      ];
    }
    return [];
  }

  async get(sql, params = []) {
    if (sql.includes('AVG(duration_minutes)')) {
      return { avg_minutes: 30 }; // Mock 30 minutes average
    }
    if (sql.includes('COUNT(*)') && sql.includes('connection_events')) {
      return { total_connections: 5, connects: 3, disconnects: 2 };
    }
    if (sql.includes('username') && sql.includes('users')) {
      // Return mock user data with bcrypt hash for 'admin'
      return { 
        id: 1, 
        username: 'admin', 
        password_hash: '$2b$10$emYu8/OgxMLm1EEI6u53yevQ6QE7ly2UTPKHPA4M0rvw7OX2Hxx9.', // hash for 'admin'
        role: 'admin' 
      };
    }
    return null;
  }

  async run(sql, params = []) {
    return { insertId: 1, changes: 1 };
  }

  close() {
    console.log('Mock database closed');
  }
}

export default new MockDatabase();