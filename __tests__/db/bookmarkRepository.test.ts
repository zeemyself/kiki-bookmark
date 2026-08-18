import { DatabaseSync } from 'node:sqlite';
import {
  getBookmarks,
  searchBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  sanitizeFtsQuery,
} from '../../src/db/bookmarkRepository';
import { migrateDbIfNeeded } from '../../src/db/database';
import { createCollection } from '../../src/db/collectionRepository';
import type { SQLiteDatabase } from 'expo-sqlite';

function createTestDatabase(): SQLiteDatabase {
  const syncDb = new DatabaseSync(':memory:');

  const testDb = {
    execAsync: async (sql: string) => {
      syncDb.exec(sql);
    },
    runAsync: async (sql: string, params: any[] = []) => {
      const stmt = syncDb.prepare(sql);
      const result = stmt.run(...params);
      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowid),
      };
    },
    getAllAsync: async <T>(sql: string, params: any[] = []): Promise<T[]> => {
      const stmt = syncDb.prepare(sql);
      return (stmt.all(...params) as unknown) as T[];
    },
    getFirstAsync: async <T>(sql: string, params: any[] = []): Promise<T | null> => {
      const stmt = syncDb.prepare(sql);
      const row = stmt.get(...params);
      return (row as unknown as T) ?? null;
    },
  };

  return (testDb as unknown) as SQLiteDatabase;
}

describe('bookmarkRepository - Full-Text Search (FTS5)', () => {
  describe('sanitizeFtsQuery', () => {
    it('returns null for empty or whitespace-only queries', () => {
      expect(sanitizeFtsQuery('')).toBeNull();
      expect(sanitizeFtsQuery('   ')).toBeNull();
    });

    it('returns null for queries containing only punctuation and symbols', () => {
      expect(sanitizeFtsQuery(':::---***')).toBeNull();
      expect(sanitizeFtsQuery('!@#$%^&()')).toBeNull();
    });

    it('formats single word with quotes and prefix wildcard', () => {
      expect(sanitizeFtsQuery('react')).toBe('"react"*');
      expect(sanitizeFtsQuery('  expo  ')).toBe('"expo"*');
    });

    it('formats multi-word queries with quotes and prefix wildcards', () => {
      expect(sanitizeFtsQuery('react native performance')).toBe(
        '"react"* "native"* "performance"*'
      );
    });

    it('sanitizes special characters, punctuation, and unclosed quotes', () => {
      expect(sanitizeFtsQuery('auth0 (oidc): "login')).toBe(
        '"auth0"* "oidc"* "login"*'
      );
    });

    it('supports unicode word tokens in multiple languages', () => {
      expect(sanitizeFtsQuery('café résumé 日本語')).toBe(
        '"café"* "résumé"* "日本語"*'
      );
    });
  });

  describe('Database FTS search and operations', () => {
    let db: SQLiteDatabase;
    const testOwner = 'usr_tester_1';

    beforeEach(async () => {
      db = createTestDatabase();
      await migrateDbIfNeeded(db);
    });

    it('searches bookmarks by title with full-text search', async () => {
      await createBookmark(db, {
        title: 'Expo Router Documentation',
        url: 'https://docs.expo.dev/router',
        notes: 'File-based routing for React Native and web',
        ownerId: testOwner,
      });

      await createBookmark(db, {
        title: 'React Navigation v7',
        url: 'https://reactnavigation.org',
        notes: 'Routing and navigation for React Native apps',
        ownerId: testOwner,
      });

      const results = await getBookmarks(db, {
        ownerId: testOwner,
        search: 'Expo Router',
      });

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Expo Router Documentation');
    });

    it('searches bookmarks by notes with full-text search', async () => {
      await createBookmark(db, {
        title: 'Hermes Engine Deep Dive',
        url: 'https://hermesengine.dev',
        notes: 'Optimized JavaScript engine for React Native mobile apps bytecode',
        ownerId: testOwner,
      });

      await createBookmark(db, {
        title: 'V8 Engine Internals',
        url: 'https://v8.dev',
        notes: 'Google open source high-performance JavaScript and WebAssembly engine',
        ownerId: testOwner,
      });

      const results = await searchBookmarks(db, 'bytecode', {
        ownerId: testOwner,
      });

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Hermes Engine Deep Dive');
    });

    it('matches across both title and notes in a multi-word search', async () => {
      await createBookmark(db, {
        title: 'Auth0 Universal Login',
        url: 'https://auth0.com/docs/authenticate',
        notes: 'OIDC biometric authentication workflow integration',
        ownerId: testOwner,
      });

      await createBookmark(db, {
        title: 'Biometric Security Guide',
        url: 'https://developer.apple.com/documentation/localauthentication',
        notes: 'Face ID and Touch ID integration on iOS and Android',
        ownerId: testOwner,
      });

      // Matches 'Auth0' from title and 'biometric' from notes
      const results = await getBookmarks(db, {
        ownerId: testOwner,
        search: 'Auth0 biometric',
      });

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Auth0 Universal Login');
    });

    it('performs prefix matching as the user types', async () => {
      await createBookmark(db, {
        title: 'TypeScript Generics Tutorial',
        url: 'https://typescriptlang.org',
        notes: 'Deep dive into utility types and type inference',
        ownerId: testOwner,
      });

      // 'TypeSc' prefix matches 'TypeScript'
      const prefixResults = await getBookmarks(db, {
        ownerId: testOwner,
        search: 'TypeSc',
      });

      expect(prefixResults.length).toBe(1);
      expect(prefixResults[0].title).toBe('TypeScript Generics Tutorial');

      // 'infer' prefix matches 'inference' in notes
      const notePrefixResults = await getBookmarks(db, {
        ownerId: testOwner,
        search: 'infer',
      });

      expect(notePrefixResults.length).toBe(1);
      expect(notePrefixResults[0].title).toBe('TypeScript Generics Tutorial');
    });

    it('updates FTS index when bookmark title or notes are updated', async () => {
      const created = await createBookmark(db, {
        title: 'Original Title',
        url: 'https://example.com',
        notes: 'Original Notes with keyword alpha',
        ownerId: testOwner,
      });

      // Search before update
      const initialSearch = await searchBookmarks(db, 'alpha', { ownerId: testOwner });
      expect(initialSearch.length).toBe(1);

      // Update bookmark notes to keyword beta
      await updateBookmark(db, created.id, {
        title: 'Updated Title',
        notes: 'Updated Notes with keyword beta',
      });

      // Old keyword should no longer match
      const oldSearch = await searchBookmarks(db, 'alpha', { ownerId: testOwner });
      expect(oldSearch.length).toBe(0);

      // New keywords should match
      const newSearchNotes = await searchBookmarks(db, 'beta', { ownerId: testOwner });
      expect(newSearchNotes.length).toBe(1);
      expect(newSearchNotes[0].title).toBe('Updated Title');

      const newSearchTitle = await searchBookmarks(db, 'Updated', { ownerId: testOwner });
      expect(newSearchTitle.length).toBe(1);
    });

    it('removes bookmark from FTS index when deleted', async () => {
      const created = await createBookmark(db, {
        title: 'Ephemeral Bookmark',
        url: 'https://example.com/ephemeral',
        notes: 'Transient search target',
        ownerId: testOwner,
      });

      const beforeDelete = await searchBookmarks(db, 'Transient', { ownerId: testOwner });
      expect(beforeDelete.length).toBe(1);

      await deleteBookmark(db, created.id);

      const afterDelete = await searchBookmarks(db, 'Transient', { ownerId: testOwner });
      expect(afterDelete.length).toBe(0);
    });

    it('combines full-text search with collection and owner filters', async () => {
      const col1 = await createCollection(db, {
        name: 'Mobile Engineering',
        ownerId: testOwner,
      });

      const col2 = await createCollection(db, {
        name: 'Backend Engineering',
        ownerId: testOwner,
      });

      await createBookmark(db, {
        title: 'React Native Architecture',
        url: 'https://reactnative.dev/architecture',
        notes: 'TurboModules and Fabric renderer',
        collectionId: col1.id,
        ownerId: testOwner,
      });

      await createBookmark(db, {
        title: 'Node.js Architecture',
        url: 'https://nodejs.org/architecture',
        notes: 'Event loop and libuv workers',
        collectionId: col2.id,
        ownerId: testOwner,
      });

      // Search 'Architecture' filtered by col1
      const col1Results = await getBookmarks(db, {
        ownerId: testOwner,
        search: 'Architecture',
        collectionId: col1.id,
      });
      expect(col1Results.length).toBe(1);
      expect(col1Results[0].title).toBe('React Native Architecture');

      // Search 'Architecture' under unassigned
      const unassignedResults = await getBookmarks(db, {
        ownerId: testOwner,
        search: 'Architecture',
        collectionId: null,
      });
      expect(unassignedResults.length).toBe(0);

      // Search with different owner
      const otherOwnerResults = await getBookmarks(db, {
        ownerId: 'different_user',
        search: 'Architecture',
      });
      expect(otherOwnerResults.length).toBe(0);
    });

    it('returns empty array when search query contains only symbols or no matching tokens', async () => {
      await createBookmark(db, {
        title: 'Normal Title',
        url: 'https://example.com',
        notes: 'Normal notes',
        ownerId: testOwner,
      });

      const results = await getBookmarks(db, {
        ownerId: testOwner,
        search: '*** ::: ---',
      });
      expect(results).toEqual([]);
    });

    it('returns all bookmarks when search query is empty string or undefined', async () => {
      await createBookmark(db, {
        title: 'Item 1',
        url: 'https://example.com/1',
        ownerId: testOwner,
      });
      await createBookmark(db, {
        title: 'Item 2',
        url: 'https://example.com/2',
        ownerId: testOwner,
      });

      const allResults = await getBookmarks(db, { ownerId: testOwner });
      expect(allResults.length).toBe(2);

      const emptySearch = await getBookmarks(db, { ownerId: testOwner, search: '   ' });
      expect(emptySearch.length).toBe(2);
    });
  });
});
