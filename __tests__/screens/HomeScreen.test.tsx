import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomeScreen } from '../../src/screens/HomeScreen';

// Mock dependencies
const mockUser = {
  sub: 'auth0|12345',
  name: 'Kiki Tester',
  email: 'kiki@example.com',
};

jest.mock('react-native-auth0', () => ({
  useAuth0: () => ({
    user: mockUser,
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => inset,
  };
});

const mockDb = {};
jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => mockDb,
}));

const mockBookmarks = [
  {
    id: 'bm-1',
    title: 'Expo Docs',
    url: 'https://docs.expo.dev',
    notes: 'Documentation for Expo SDK 57',
    collectionId: 'col-1',
    collectionName: 'Dev Tools',
    collectionColor: '#4F46E5',
    createdAt: '2026-08-16T12:00:00.000Z',
    updatedAt: '2026-08-16T12:00:00.000Z',
    ownerId: 'auth0|12345',
  },
];

const mockCollections = [
  {
    id: 'col-1',
    name: 'Dev Tools',
    description: 'Tools for development',
    color: '#4F46E5',
    bookmarkCount: 1,
    createdAt: '2026-08-16T12:00:00.000Z',
    updatedAt: '2026-08-16T12:00:00.000Z',
    ownerId: 'auth0|12345',
  },
];

const mockGetUserProfile = jest.fn();
const mockGetBookmarks = jest.fn();
const mockGetCollections = jest.fn();
const mockCreateBookmark = jest.fn();
const mockCreateCollection = jest.fn();
const mockUpsertUserProfile = jest.fn();

jest.mock('../../src/db', () => ({
  CURRENT_USER: {
    id: 'guest',
    name: 'Guest',
    email: 'guest@example.com',
    role: 'Guest Member',
    avatarColor: '#4F46E5',
    joinedAt: '2026-01-01',
  },
  getUserProfile: (...args: any[]) => mockGetUserProfile(...args),
  getBookmarks: (...args: any[]) => mockGetBookmarks(...args),
  getCollections: (...args: any[]) => mockGetCollections(...args),
  createBookmark: (...args: any[]) => mockCreateBookmark(...args),
  createCollection: (...args: any[]) => mockCreateCollection(...args),
  upsertUserProfile: (...args: any[]) => mockUpsertUserProfile(...args),
}));

async function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  return await render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('HomeScreen (React Query)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserProfile.mockResolvedValue({
      id: 'auth0|12345',
      name: 'Kiki Tester',
      email: 'kiki@example.com',
      role: 'Member',
      avatarColor: '#10B981',
      joinedAt: '2026-08-16T12:00:00.000Z',
    });
    mockGetBookmarks.mockResolvedValue(mockBookmarks);
    mockGetCollections.mockResolvedValue(mockCollections);
  });

  it('renders bookmarks list from React Query', async () => {
    await renderWithClient(<HomeScreen navigation={{} as any} route={{} as any} />);

    expect(await screen.findByText('Expo Docs')).toBeTruthy();
    expect(await screen.findByText('https://docs.expo.dev')).toBeTruthy();
    expect(screen.getAllByText('Dev Tools').length).toBeGreaterThanOrEqual(1);
  });

  it('switches to collections tab and displays collections', async () => {
    await renderWithClient(<HomeScreen navigation={{} as any} route={{} as any} />);

    const collectionsTab = await screen.findByText(/Collections/);
    fireEvent.press(collectionsTab);

    expect(await screen.findByText('Dev Tools')).toBeTruthy();
    expect(await screen.findByText('Tools for development')).toBeTruthy();
  });
});
