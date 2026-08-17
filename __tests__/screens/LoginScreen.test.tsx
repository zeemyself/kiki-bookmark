import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginScreen } from '../../src/screens/LoginScreen';

// Mock dependencies
const mockAuthorize = jest.fn();
const mockGetCredentials = jest.fn();
let mockUser: any = null;
let mockIsLoading = false;
let mockError: any = null;

jest.mock('react-native-auth0', () => ({
  useAuth0: () => ({
    authorize: mockAuthorize,
    getCredentials: mockGetCredentials,
    user: mockUser,
    isLoading: mockIsLoading,
    error: mockError,
  }),
}));

import { SafeAreaProvider } from 'react-native-safe-area-context';

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

const mockGetBiometricCapabilities = jest.fn();
const mockAuthenticateWithBiometrics = jest.fn();
const mockIsBiometricUnlockEnabled = jest.fn();

jest.mock('../../src/auth', () => ({
  AUTH0_CONFIG: {
    domain: 'test.auth0.com',
    clientId: 'test-client-id',
    scope: 'openid profile email',
    redirectUri: 'com.bbl.bookmarks://oauth/callback',
    audience: 'https://test.auth0.com/api/v2/',
  },
  getBiometricCapabilities: () => mockGetBiometricCapabilities(),
  authenticateWithBiometrics: (args: any) => mockAuthenticateWithBiometrics(args),
  isBiometricUnlockEnabled: (db: any) => mockIsBiometricUnlockEnabled(db),
}));

const mockUpsertUserProfile = jest.fn();
jest.mock('../../src/db', () => ({
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

describe('LoginScreen (React Query)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
    mockIsLoading = false;
    mockError = null;
    mockGetBiometricCapabilities.mockResolvedValue({
      isAvailable: false,
      biometricType: 'NONE',
      biometricName: 'Biometrics',
      biometricIcon: '🔒',
    });
    mockIsBiometricUnlockEnabled.mockResolvedValue(false);
  });

  it('renders branding elements and Auth0 login button', async () => {
    await renderWithClient(<LoginScreen navigation={{} as any} route={{} as any} />);

    expect(screen.getByText('Kiki Bookmark')).toBeTruthy();
    expect(screen.getByText('Save, organize, and sync your favorite links.')).toBeTruthy();
    expect(screen.getByText('Log In with Auth0')).toBeTruthy();
  });

  it('handles Auth0 login mutation on button press', async () => {
    mockAuthorize.mockResolvedValueOnce({ accessToken: 'test-token' });

    await renderWithClient(<LoginScreen navigation={{} as any} route={{} as any} />);
    const loginButton = screen.getByText('Log In with Auth0');

    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(mockAuthorize).toHaveBeenCalledWith({
        scope: 'openid profile email',
        audience: 'https://test.auth0.com/api/v2/',
        redirectUrl: 'com.bbl.bookmarks://oauth/callback',
      });
    });
  });

  it('renders biometric button when biometrics are available', async () => {
    mockGetBiometricCapabilities.mockResolvedValueOnce({
      isAvailable: true,
      biometricType: 'FACIAL_RECOGNITION',
      biometricName: 'Face ID',
      biometricIcon: '👤',
    });

    await renderWithClient(<LoginScreen navigation={{} as any} route={{} as any} />);

    expect(await screen.findByText('Face ID Enabled')).toBeTruthy();
    expect(await screen.findByText('Unlock with Face ID')).toBeTruthy();
  });

  it('handles biometric unlock flow via mutation', async () => {
    mockGetBiometricCapabilities.mockResolvedValueOnce({
      isAvailable: true,
      biometricType: 'FINGERPRINT',
      biometricName: 'Touch ID',
      biometricIcon: '👆',
    });
    mockAuthenticateWithBiometrics.mockResolvedValueOnce({ success: true });
    mockGetCredentials.mockResolvedValueOnce({ accessToken: 'stored-token' });

    await renderWithClient(<LoginScreen navigation={{} as any} route={{} as any} />);
    const biometricButton = await screen.findByText('Unlock with Touch ID');

    fireEvent.press(biometricButton);

    await waitFor(() => {
      expect(mockAuthenticateWithBiometrics).toHaveBeenCalled();
      expect(mockGetCredentials).toHaveBeenCalled();
    });
  });
});

