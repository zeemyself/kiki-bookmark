export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor: string;
  joinedAt: string;
}

export const CURRENT_USER: UserProfile = {
  id: 'usr_kiki_01',
  name: 'Kiki Vance',
  email: 'kiki.vance@example.com',
  role: 'Software Architect & Collector',
  avatarColor: '#4F46E5',
  joinedAt: '2025-01-15T08:00:00.000Z',
};

export interface Collection {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  bookmarkCount?: number;
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  notes?: string | null;
  collectionId?: string | null;
  collectionName?: string | null;
  collectionColor?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  color?: string;
  ownerId?: string;
}

export interface UpdateCollectionInput {
  name?: string;
  description?: string;
  color?: string;
}

export interface CreateBookmarkInput {
  url: string;
  title: string;
  notes?: string;
  collectionId?: string | null;
  ownerId?: string;
}

export interface UpdateBookmarkInput {
  url?: string;
  title?: string;
  notes?: string | null;
  collectionId?: string | null;
}
