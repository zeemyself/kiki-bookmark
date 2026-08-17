import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookmarkDetailsScreen } from '../../src/screens/BookmarkDetailsScreen';

const mockUser = {
  sub: 'auth0|12345',
  name: 'Kiki Tester',
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

const mockBookmark = {
  id: 'bm-1',
  title: 'React Native Docs',
  url: 'https://reactnative.dev',
  notes: 'Official docs for React Native',
  collectionId: 'col-1',
  collectionName: 'Mobile Dev',
  collectionColor: '#4F46E5',
  createdAt: '2026-08-16T12:00:00.000Z',
  updatedAt: '2026-08-16T12:00:00.000Z',
  ownerId: 'auth0|12345',
};

const mockGetBookmarkById = jest.fn();
const mockGetCollections = jest.fn();
const mockUpdateBookmark = jest.fn();
const mockDeleteBookmark = jest.fn();

jest.mock('../../src/db', () => ({
  CURRENT_USER: { id: 'guest' },
  getBookmarkById: (...args: any[]) => mockGetBookmarkById(...args),
  getCollections: (...args: any[]) => mockGetCollections(...args),
  updateBookmark: (...args: any[]) => mockUpdateBookmark(...args),
  deleteBookmark: (...args: any[]) => mockDeleteBookmark(...args),
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

describe('BookmarkDetailsScreen (React Query)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBookmarkById.mockResolvedValue(mockBookmark);
    mockGetCollections.mockResolvedValue([]);
  });

  it('renders bookmark details', async () => {
    await renderWithClient(
      <BookmarkDetailsScreen
        navigation={{} as any}
        route={{ params: { bookmarkId: 'bm-1' } } as any}
      />
    );

    expect(await screen.findByText('React Native Docs')).toBeTruthy();
    expect(await screen.findByText(/https:\/\/reactnative\.dev/)).toBeTruthy();
    expect(await screen.findByText('Official docs for React Native')).toBeTruthy();
  });
});
