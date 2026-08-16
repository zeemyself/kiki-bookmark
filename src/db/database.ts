import type { SQLiteDatabase } from 'expo-sqlite';
import { CURRENT_USER } from './schema';

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

    // Seed default user
    await db.runAsync(
      `INSERT OR REPLACE INTO users (id, name, email, role, avatarColor, joinedAt)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [
        CURRENT_USER.id,
        CURRENT_USER.name,
        CURRENT_USER.email,
        CURRENT_USER.role,
        CURRENT_USER.avatarColor,
        CURRENT_USER.joinedAt,
      ]
    );

    // Seed sample collections
    const now = new Date().toISOString();
    const colDev = 'col_dev_01';
    const colDesign = 'col_design_02';
    const colNews = 'col_news_03';

    await db.runAsync(
      `INSERT OR IGNORE INTO collections (id, name, description, color, ownerId, createdAt, updatedAt)
       VALUES 
        (?, 'Development', 'Frameworks, SDKs, and developer tooling', '#4F46E5', ?, ?, ?),
        (?, 'UI & Design', 'Inspiration, design tokens, and aesthetic libraries', '#EC4899', ?, ?, ?),
        (?, 'Articles & Reading', 'Deep dives, system design, and newsletters', '#0EA5E9', ?, ?, ?);`,
      [
        colDev, CURRENT_USER.id, now, now,
        colDesign, CURRENT_USER.id, now, now,
        colNews, CURRENT_USER.id, now, now,
      ]
    );

    // Seed initial bookmarks
    await db.runAsync(
      `INSERT OR IGNORE INTO bookmarks (id, url, title, notes, collectionId, ownerId, createdAt, updatedAt)
       VALUES 
        ('bm_01', 'https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/', 'Expo SQLite Documentation (v57)', 'Modern typed SQLite API with async hooks and prepared statement support.', ?, ?, ?, ?),
        ('bm_02', 'https://reactnavigation.org/docs/getting-started', 'React Navigation v7 Docs', 'Native stack navigation guide for TypeScript React Native apps.', ?, ?, ?, ?),
        ('bm_03', 'https://dribbble.com/tags/mobile-app-design', 'Mobile App UI Inspirations', 'Curated aesthetic mobile concepts, gradients, and micro-interactions.', ?, ?, ?, ?),
        ('bm_04', 'https://martinfowler.com/articles/patterns-of-distributed-systems/', 'Patterns of Distributed Systems', 'Foundational architectures and patterns by Martin Fowler.', ?, ?, ?, ?);`,
      [
        colDev, CURRENT_USER.id, now, now,
        colDev, CURRENT_USER.id, now, now,
        colDesign, CURRENT_USER.id, now, now,
        colNews, CURRENT_USER.id, now, now,
      ]
    );

    currentDbVersion = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
}
