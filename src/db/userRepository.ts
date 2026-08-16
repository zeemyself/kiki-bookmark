import type { SQLiteDatabase } from 'expo-sqlite';
import { UserProfile, CURRENT_USER } from './schema';

export async function getUserProfile(
  db: SQLiteDatabase,
  userId: string = CURRENT_USER.id
): Promise<UserProfile | null> {
  const user = await db.getFirstAsync<UserProfile>(
    `SELECT * FROM users WHERE id = ?;`,
    [userId]
  );
  return user ?? null;
}

export async function getUserStats(
  db: SQLiteDatabase,
  userId: string = CURRENT_USER.id
): Promise<{ collectionsCount: number; bookmarksCount: number }> {
  const collectionsRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM collections WHERE ownerId = ?;`,
    [userId]
  );
  const bookmarksRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM bookmarks WHERE ownerId = ?;`,
    [userId]
  );

  return {
    collectionsCount: collectionsRow?.count ?? 0,
    bookmarksCount: bookmarksRow?.count ?? 0,
  };
}

export async function updateUserProfile(
  db: SQLiteDatabase,
  userId: string,
  data: Partial<UserProfile>
): Promise<UserProfile> {
  const current = await getUserProfile(db, userId);
  if (!current) {
    throw new Error(`User not found with id: ${userId}`);
  }

  const name = data.name !== undefined ? data.name : current.name;
  const email = data.email !== undefined ? data.email : current.email;
  const role = data.role !== undefined ? data.role : current.role;
  const avatarColor = data.avatarColor !== undefined ? data.avatarColor : current.avatarColor;

  await db.runAsync(
    `UPDATE users
     SET name = ?, email = ?, role = ?, avatarColor = ?
     WHERE id = ?;`,
    [name, email, role, avatarColor, userId]
  );

  const updated = await getUserProfile(db, userId);
  if (!updated) {
    throw new Error(`Failed to retrieve updated user with id: ${userId}`);
  }
  return updated;
}

export async function upsertUserProfile(
  db: SQLiteDatabase,
  profile: UserProfile
): Promise<UserProfile> {
  await db.runAsync(
    `INSERT INTO users (id, name, email, role, avatarColor, joinedAt)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       email = excluded.email,
       role = excluded.role,
       avatarColor = excluded.avatarColor;`,
    [
      profile.id,
      profile.name,
      profile.email,
      profile.role,
      profile.avatarColor,
      profile.joinedAt,
    ]
  );

  const saved = await getUserProfile(db, profile.id);
  if (!saved) {
    throw new Error(`Failed to save user profile for: ${profile.id}`);
  }
  return saved;
}

