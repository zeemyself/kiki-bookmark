import type { SQLiteDatabase } from 'expo-sqlite';

export interface AppSetting {
  key: string;
  value: string;
  updatedAt: string;
}

export async function getSetting(
  db: SQLiteDatabase,
  key: string,
  defaultValue: string = ''
): Promise<string> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?;',
      [key]
    );
    return row?.value ?? defaultValue;
  } catch (error) {
    console.error(`Error getting setting for key "${key}":`, error);
    return defaultValue;
  }
}

export async function setSetting(
  db: SQLiteDatabase,
  key: string,
  value: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO app_settings (key, value, updatedAt)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updatedAt = excluded.updatedAt;`,
    [key, value, now]
  );
}

export async function getBooleanSetting(
  db: SQLiteDatabase,
  key: string,
  defaultValue: boolean = false
): Promise<boolean> {
  const str = await getSetting(db, key, defaultValue ? 'true' : 'false');
  return str === 'true';
}

export async function setBooleanSetting(
  db: SQLiteDatabase,
  key: string,
  value: boolean
): Promise<void> {
  await setSetting(db, key, value ? 'true' : 'false');
}
