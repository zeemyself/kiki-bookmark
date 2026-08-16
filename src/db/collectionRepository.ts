import type { SQLiteDatabase } from 'expo-sqlite';
import { Collection, CreateCollectionInput, UpdateCollectionInput, CURRENT_USER } from './schema';

export async function getCollections(
  db: SQLiteDatabase,
  options?: { ownerId?: string; search?: string }
): Promise<Collection[]> {
  const ownerId = options?.ownerId ?? CURRENT_USER.id;
  const search = options?.search ? `%${options.search.trim()}%` : null;

  if (search) {
    return await db.getAllAsync<Collection>(
      `SELECT 
        c.*, 
        COUNT(b.id) AS bookmarkCount
       FROM collections c
       LEFT JOIN bookmarks b ON b.collectionId = c.id
       WHERE c.ownerId = ? AND (c.name LIKE ? OR c.description LIKE ?)
       GROUP BY c.id
       ORDER BY c.createdAt DESC;`,
      [ownerId, search, search]
    );
  }

  return await db.getAllAsync<Collection>(
    `SELECT 
      c.*, 
      COUNT(b.id) AS bookmarkCount
     FROM collections c
     LEFT JOIN bookmarks b ON b.collectionId = c.id
     WHERE c.ownerId = ?
     GROUP BY c.id
     ORDER BY c.createdAt DESC;`,
    [ownerId]
  );
}

export async function getCollectionById(
  db: SQLiteDatabase,
  id: string
): Promise<Collection | null> {
  const collection = await db.getFirstAsync<Collection>(
    `SELECT 
      c.*, 
      COUNT(b.id) AS bookmarkCount
     FROM collections c
     LEFT JOIN bookmarks b ON b.collectionId = c.id
     WHERE c.id = ?
     GROUP BY c.id;`,
    [id]
  );
  return collection ?? null;
}

export async function createCollection(
  db: SQLiteDatabase,
  input: CreateCollectionInput
): Promise<Collection> {
  const id = `col_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const ownerId = input.ownerId ?? CURRENT_USER.id;
  const color = input.color ?? '#4F46E5';
  const desc = input.description?.trim() ?? null;

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
    `INSERT INTO collections (id, name, description, color, ownerId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [id, input.name.trim(), desc, color, ownerId, now, now]
  );

  const created = await getCollectionById(db, id);
  if (!created) {
    throw new Error(`Failed to retrieve newly created collection with id: ${id}`);
  }
  return created;
}

export async function updateCollection(
  db: SQLiteDatabase,
  id: string,
  input: UpdateCollectionInput
): Promise<Collection> {
  const current = await getCollectionById(db, id);
  if (!current) {
    throw new Error(`Collection not found with id: ${id}`);
  }

  const updatedName = input.name !== undefined ? input.name.trim() : current.name;
  const updatedDesc =
    input.description !== undefined
      ? (input.description?.trim() ?? null)
      : (current.description ?? null);
  const updatedColor =
    input.color !== undefined ? (input.color ?? null) : (current.color ?? null);
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE collections 
     SET name = ?, description = ?, color = ?, updatedAt = ?
     WHERE id = ?;`,
    [updatedName, updatedDesc, updatedColor, now, id]
  );

  const updated = await getCollectionById(db, id);
  if (!updated) {
    throw new Error(`Failed to retrieve updated collection with id: ${id}`);
  }
  return updated;
}

export async function deleteCollection(
  db: SQLiteDatabase,
  id: string
): Promise<boolean> {
  const result = await db.runAsync(
    `DELETE FROM collections WHERE id = ?;`,
    [id]
  );
  return result.changes > 0;
}
