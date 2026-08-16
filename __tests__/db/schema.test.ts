import { DATABASE_NAME, migrateDbIfNeeded } from '../../src/db/database';

describe('Database Schema and Migrations', () => {
  it('defines correct database name', () => {
    expect(DATABASE_NAME).toBe('kiki_bookmarks.db');
  });

  it('executes schema creation when user_version is 0', async () => {
    const mockExecAsync = jest.fn().mockResolvedValue(undefined);
    const mockGetFirstAsync = jest.fn().mockResolvedValue({ user_version: 0 });

    const mockDb: any = {
      execAsync: mockExecAsync,
      getFirstAsync: mockGetFirstAsync,
    };

    await migrateDbIfNeeded(mockDb);

    // Checks WAL mode and foreign keys
    expect(mockExecAsync).toHaveBeenCalledWith(
      expect.stringContaining("PRAGMA journal_mode = 'wal';")
    );

    // Checks user version check
    expect(mockGetFirstAsync).toHaveBeenCalledWith('PRAGMA user_version;');

    // Checks table creation
    expect(mockExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS users')
    );
    expect(mockExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS collections')
    );
    expect(mockExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS bookmarks')
    );
    expect(mockExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS app_settings')
    );

    // Checks final version pragma
    expect(mockExecAsync).toHaveBeenCalledWith('PRAGMA user_version = 2;');
  });

  it('skips schema migration when user_version is already at current version', async () => {
    const mockExecAsync = jest.fn().mockResolvedValue(undefined);
    const mockGetFirstAsync = jest.fn().mockResolvedValue({ user_version: 2 });

    const mockDb: any = {
      execAsync: mockExecAsync,
      getFirstAsync: mockGetFirstAsync,
    };

    await migrateDbIfNeeded(mockDb);

    // Should only set pragmas and read user_version, but not recreate tables
    expect(mockExecAsync).toHaveBeenCalledTimes(1);
    expect(mockGetFirstAsync).toHaveBeenCalledTimes(1);
  });
});
