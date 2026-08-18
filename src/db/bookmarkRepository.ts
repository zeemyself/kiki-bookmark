import type { SQLiteDatabase } from 'expo-sqlite';
import { Bookmark, CreateBookmarkInput, UpdateBookmarkInput, CURRENT_USER } from './schema';

export function sanitizeFtsQuery(query: string): string | null {
  if (!query || !query.trim()) {
    return null;
  }
  // Match word tokens across Unicode scripts (letters, numbers, underscores)
  const tokens = query.trim().match(/[\p{L}\p{N}_]+/gu);
  if (!tokens || tokens.length === 0) {
    return null;
  }
  // Wrap each token in double quotes and append prefix wildcard for incremental matching
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"*`).join(' ');
}

export async function getBookmarks(
  db: SQLiteDatabase,
  options?: {
    collectionId?: string | null;
    search?: string;
    ownerId?: string;
  }
): Promise<Bookmark[]> {
  const ownerId = options?.ownerId ?? CURRENT_USER.id;
  const rawSearch = options?.search?.trim();
  const collectionId = options?.collectionId;

  if (rawSearch) {
    const ftsQuery = sanitizeFtsQuery(rawSearch);
    if (!ftsQuery) {
      return [];
    }

    let query = `
      SELECT 
        b.*,
        c.name AS collectionName,
        c.color AS collectionColor
      FROM bookmarks_fts fts
      JOIN bookmarks b ON b.rowid = fts.rowid
      LEFT JOIN collections c ON b.collectionId = c.id
      WHERE b.ownerId = ? AND bookmarks_fts MATCH ?
    `;
    const params: (string | number | null)[] = [ownerId, ftsQuery];

    if (collectionId !== undefined) {
      if (collectionId === null) {
        query += ' AND b.collectionId IS NULL';
      } else {
        query += ' AND b.collectionId = ?';
        params.push(collectionId);
      }
    }

    query += ' ORDER BY fts.rank ASC, b.createdAt DESC;';

    return await db.getAllAsync<Bookmark>(query, params);
  }

  let query = `
    SELECT 
      b.*,
      c.name AS collectionName,
      c.color AS collectionColor
    FROM bookmarks b
    LEFT JOIN collections c ON b.collectionId = c.id
    WHERE b.ownerId = ?
  `;
  const params: (string | number | null)[] = [ownerId];

  if (collectionId !== undefined) {
    if (collectionId === null) {
      query += ' AND b.collectionId IS NULL';
    } else {
      query += ' AND b.collectionId = ?';
      params.push(collectionId);
    }
  }

  query += ' ORDER BY b.createdAt DESC;';

  return await db.getAllAsync<Bookmark>(query, params);
}

export async function searchBookmarks(
  db: SQLiteDatabase,
  query: string,
  options?: {
    collectionId?: string | null;
    ownerId?: string;
  }
): Promise<Bookmark[]> {
  return getBookmarks(db, {
    search: query,
    collectionId: options?.collectionId,
    ownerId: options?.ownerId,
  });
}

export async function getBookmarkById(
  db: SQLiteDatabase,
  id: string
): Promise<Bookmark | null> {
  const bookmark = await db.getFirstAsync<Bookmark>(
    `SELECT 
      b.*,
      c.name AS collectionName,
      c.color AS collectionColor
     FROM bookmarks b
     LEFT JOIN collections c ON b.collectionId = c.id
     WHERE b.id = ?;`,
    [id]
  );
  return bookmark ?? null;
}

export async function createBookmark(
  db: SQLiteDatabase,
  input: CreateBookmarkInput
): Promise<Bookmark> {
  const id = `bm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const ownerId = input.ownerId ?? CURRENT_USER.id;
  const collectionId = input.collectionId ?? null;
  const notes = input.notes?.trim() ?? null;

  // Ensure owner exists in users table to satisfy foreign key constraint
  const existingUser = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM users WHERE id = ?;`,
    [ownerId]
  );
  if (!existingUser) {
    await db.runAsync(
      `INSERT OR IGNORE INTO users (id, name, email, role, avatarColor, joinedAt)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [
        ownerId,
        ownerId === CURRENT_USER.id ? CURRENT_USER.name : 'User',
        ownerId === CURRENT_USER.id ? CURRENT_USER.email : '',
        ownerId === CURRENT_USER.id ? CURRENT_USER.role : 'Member',
        ownerId === CURRENT_USER.id ? CURRENT_USER.avatarColor : '#4F46E5',
        now,
      ]
    );
  }

  await db.runAsync(
    `INSERT INTO bookmarks (id, url, title, notes, collectionId, ownerId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      input.url.trim(),
      input.title.trim(),
      notes,
      collectionId,
      ownerId,
      now,
      now,
    ]
  );

  const created = await getBookmarkById(db, id);
  if (!created) {
    throw new Error(`Failed to retrieve newly created bookmark with id: ${id}`);
  }
  return created;
}

export async function updateBookmark(
  db: SQLiteDatabase,
  id: string,
  input: UpdateBookmarkInput
): Promise<Bookmark> {
  const current = await getBookmarkById(db, id);
  if (!current) {
    throw new Error(`Bookmark not found with id: ${id}`);
  }

  const updatedUrl = input.url !== undefined ? input.url.trim() : current.url;
  const updatedTitle = input.title !== undefined ? input.title.trim() : current.title;
  const updatedNotes =
    input.notes !== undefined ? (input.notes?.trim() ?? null) : (current.notes ?? null);
  const updatedCollectionId =
    input.collectionId !== undefined ? (input.collectionId ?? null) : (current.collectionId ?? null);
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE bookmarks
     SET url = ?, title = ?, notes = ?, collectionId = ?, updatedAt = ?
     WHERE id = ?;`,
    [updatedUrl, updatedTitle, updatedNotes, updatedCollectionId, now, id]
  );

  const updated = await getBookmarkById(db, id);
  if (!updated) {
    throw new Error(`Failed to retrieve updated bookmark with id: ${id}`);
  }
  return updated;
}

export async function deleteBookmark(
  db: SQLiteDatabase,
  id: string
): Promise<boolean> {
  const result = await db.runAsync(`DELETE FROM bookmarks WHERE id = ?;`, [id]);
  return result.changes > 0;
}
