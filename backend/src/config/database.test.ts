import { connectDatabase, disconnectDatabase } from './database';
import mongoose from 'mongoose';

describe('Database Configuration', () => {
  afterEach(async () => {
    if (mongoose.connection.readyState !== 0) {
      await disconnectDatabase();
    }
  });

  it('should have connectDatabase function', () => {
    expect(connectDatabase).toBeDefined();
    expect(typeof connectDatabase).toBe('function');
  });

  it('should have disconnectDatabase function', () => {
    expect(disconnectDatabase).toBeDefined();
    expect(typeof disconnectDatabase).toBe('function');
  });
});
