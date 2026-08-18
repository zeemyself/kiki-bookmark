import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileScreen } from '../../src/screens/ProfileScreen';

const mockAuthorize = jest.fn();
const mockClearSession = jest.fn();
const mockGetCredentials = jest.fn();
let mockUser: any = {
  sub: 'auth0|12345',
  name: 'Kiki Vance',
  email: 'kiki@example.com',
};

jest.mock('react-native-auth0', () => ({
  useAuth0: () => ({
    authorize: mockAuthorize,
    clearSession: mockClearSession,
    getCredentials: mockGetCredentials,
    user: mockUser,
    isLoading: false,
    error: null,
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

const mockDb = {
  execAsync: jest.fn(),
};
jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => mockDb,
}));

const mockGetUserProfile = jest.fn();
const mockGetUserStats = jest.fn();
const mockUpdateUserProfile = jest.fn();
const mockUpsertUserProfile = jest.fn();
const mockMigrateDbIfNeeded = jest.fn();

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
  getUserStats: (...args: any[]) => mockGetUserStats(...args),
  updateUserProfile: (...args: any[]) => mockUpdateUserProfile(...args),
  upsertUserProfile: (...args: any[]) => mockUpsertUserProfile(...args),
  migrateDbIfNeeded: (...args: any[]) => mockMigrateDbIfNeeded(...args),
}));

jest.mock('../../src/auth', () => ({
  AUTH0_CONFIG: {
    domain: 'test.auth0.com',
    clientId: 'test-client-id',
    bundleId: 'com.bbl.bookmarks',
    scope: 'openid profile email',
    redirectUri: 'com.bbl.bookmarks://oauth/callback',
    logoutUri: 'com.bbl.bookmarks://oauth/callback',
    audience: 'https://test.auth0.com/api/v2/',
    discoveryEndpoint: 'https://test.auth0.com/.well-known/openid-configuration',
    userinfoEndpoint: 'https://test.auth0.com/userinfo',
  },
  fetchUserInfo: jest.fn().mockResolvedValue({
    data: { sub: 'auth0|12345', name: 'Kiki Vance', email: 'kiki@example.com' },
    fromCache: false,
    status: 200,
  }),
  clearUserInfoSession: jest.fn(),
  getBiometricCapabilities: jest.fn().mockResolvedValue({
    isAvailable: true,
    hasHardware: true,
    isEnrolled: true,
    biometricType: 'FACIAL_RECOGNITION',
    biometricName: 'Face ID',
    biometricIcon: '👤',
  }),
  authenticateWithBiometrics: jest.fn().mockResolvedValue({ success: true }),
  isBiometricUnlockEnabled: jest.fn().mockResolvedValue(true),
  setBiometricUnlockEnabled: jest.fn().mockResolvedValue(undefined),
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

describe('ProfileScreen (React Query)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserProfile.mockResolvedValue({
      id: 'auth0|12345',
      name: 'Kiki Vance',
      email: 'kiki@example.com',
      role: 'Auth0 Verified Member',
      avatarColor: '#10B981',
      joinedAt: '2026-08-16T12:00:00.000Z',
    });
    mockGetUserStats.mockResolvedValue({
      collectionsCount: 3,
      bookmarksCount: 12,
    });
    mockGetCredentials.mockResolvedValue({
      accessToken: 'test-access-token',
      idToken: 'test-id-token',
      expiresIn: 86400,
      tokenType: 'Bearer',
      scope: 'openid profile email',
    });
  });

  it('renders user profile and stats from React Query', async () => {
    await renderWithClient(<ProfileScreen navigation={{} as any} route={{} as any} />);

    expect(await screen.findByText('Kiki Vance')).toBeTruthy();
    expect(await screen.findByText('kiki@example.com')).toBeTruthy();
    expect(await screen.findByText('12')).toBeTruthy();
    expect(await screen.findByText('3')).toBeTruthy();
  });

  it('renders Auth0 sign out button for authenticated user', async () => {
    await renderWithClient(<ProfileScreen navigation={{} as any} route={{} as any} />);

    expect(await screen.findByText('🚪 Sign Out from Auth0')).toBeTruthy();
  });

  it('does not render Edit Profile button or modal', async () => {
    await renderWithClient(<ProfileScreen navigation={{} as any} route={{} as any} />);

    expect(screen.queryByText(/edit profile/i)).toBeNull();
    expect(screen.queryByText('✏️ Edit Profile Info')).toBeNull();
  });

  it('does not display sensitive tokens or token inspection controls', async () => {
    await renderWithClient(<ProfileScreen navigation={{} as any} route={{} as any} />);

    expect(screen.queryByText(/inspect auth tokens/i)).toBeNull();
    expect(screen.queryByText('test-access-token')).toBeNull();
    expect(screen.queryByText('test-id-token')).toBeNull();
    expect(screen.queryByText('test-client-id')).toBeNull();
  });
});

