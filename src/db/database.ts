import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'kiki_bookmarks.db';

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const DATABASE_VERSION = 1;

  await db.execAsync(`
    PRAGMA journal_mode = 'wal';
    PRAGMA foreign_keys = ON;
  `);

  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version;'
  );
  let currentDbVersion = result?.user_version ?? 0;

  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentDbVersion === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        avatarColor TEXT NOT NULL,
        joinedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        ownerId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        notes TEXT,
        collectionId TEXT,
        ownerId TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (collectionId) REFERENCES collections(id) ON DELETE SET NULL,
        FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_bookmarks_collectionId ON bookmarks(collectionId);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_ownerId ON bookmarks(ownerId);
      CREATE INDEX IF NOT EXISTS idx_collections_ownerId ON collections(ownerId);
    `);

    currentDbVersion = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
}
