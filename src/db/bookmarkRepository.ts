import type { SQLiteDatabase } from 'expo-sqlite';
import { Bookmark, CreateBookmarkInput, UpdateBookmarkInput, CURRENT_USER } from './schema';

export async function getBookmarks(
  db: SQLiteDatabase,
  options?: {
    collectionId?: string | null;
    search?: string;
    ownerId?: string;
  }
): Promise<Bookmark[]> {
  const ownerId = options?.ownerId ?? CURRENT_USER.id;
  const search = options?.search ? `%${options.search.trim()}%` : null;
  const collectionId = options?.collectionId;

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

  if (search) {
    query += ' AND (b.title LIKE ? OR b.url LIKE ? OR b.notes LIKE ?)';
    params.push(search, search, search);
  }

  query += ' ORDER BY b.createdAt DESC;';

  return await db.getAllAsync<Bookmark>(query, params);
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
