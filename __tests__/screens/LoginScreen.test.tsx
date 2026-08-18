import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
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
    mockGetCredentials.mockRejectedValue(new Error('No credentials'));
  });

  it('renders branding elements and Auth0 login button when no biometrics', async () => {
    await renderWithClient(<LoginScreen navigation={{} as any} route={{} as any} />);

    // After auto-check resolves (biometrics unavailable), shows normal login
    expect(await screen.findByText('Kiki Bookmark')).toBeTruthy();
    expect(await screen.findByText('Save, organize, and sync your favorite links.')).toBeTruthy();
    expect(await screen.findByText('Log In with Auth0')).toBeTruthy();
  });

  it('handles Auth0 login mutation on button press', async () => {
    mockAuthorize.mockResolvedValueOnce({ accessToken: 'test-token' });

    await renderWithClient(<LoginScreen navigation={{} as any} route={{} as any} />);
    const loginButton = await screen.findByText('Log In with Auth0');

    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(mockAuthorize).toHaveBeenCalledWith({
        scope: 'openid profile email',
        audience: 'https://test.auth0.com/api/v2/',
        redirectUrl: 'com.bbl.bookmarks://oauth/callback',
      });
    });
  });

  it('auto-triggers biometric when credentials exist and biometric is enabled', async () => {
    mockGetBiometricCapabilities.mockResolvedValue({
      isAvailable: true,
      biometricType: 'FACIAL_RECOGNITION',
      biometricName: 'Face ID',
      biometricIcon: '👤',
    });
    mockIsBiometricUnlockEnabled.mockResolvedValue(true);
    mockGetCredentials.mockResolvedValue({ accessToken: 'stored-token' });
    mockAuthenticateWithBiometrics.mockResolvedValue({ success: true });

    await renderWithClient(<LoginScreen navigation={{} as any} route={{} as any} />);

    // Biometric should auto-fire without any button press
    await waitFor(() => {
      expect(mockAuthenticateWithBiometrics).toHaveBeenCalledWith(
        expect.objectContaining({
          promptMessage: 'Unlock Kiki Bookmark with Face ID',
        })
      );
      expect(mockGetCredentials).toHaveBeenCalled();
    });
  });

  it('shows only Auth0 login button after biometric auto-prompt is cancelled', async () => {
    mockGetBiometricCapabilities.mockResolvedValue({
      isAvailable: true,
      biometricType: 'FINGERPRINT',
      biometricName: 'Touch ID',
      biometricIcon: '👆',
    });
    mockIsBiometricUnlockEnabled.mockResolvedValue(true);
    mockGetCredentials.mockResolvedValue({ accessToken: 'stored-token' });
    // Biometric fails/cancelled
    mockAuthenticateWithBiometrics.mockResolvedValue({ success: false, error: 'user_cancel' });

    await renderWithClient(<LoginScreen navigation={{} as any} route={{} as any} />);

    // After auto-prompt fails, only Auth0 login button should appear (no biometric button)
    expect(await screen.findByText('Log In with Auth0')).toBeTruthy();
    expect(screen.queryByText('Retry Touch ID')).toBeNull();
  });

  it('does not show biometric UI when no stored credentials', async () => {
    mockGetBiometricCapabilities.mockResolvedValue({
      isAvailable: true,
      biometricType: 'FACIAL_RECOGNITION',
      biometricName: 'Face ID',
      biometricIcon: '👤',
    });
    mockIsBiometricUnlockEnabled.mockResolvedValue(true);
    // No stored credentials
    mockGetCredentials.mockRejectedValue(new Error('No credentials'));

    await renderWithClient(<LoginScreen navigation={{} as any} route={{} as any} />);

    // Should skip biometric and show normal login
    expect(await screen.findByText('Log In with Auth0')).toBeTruthy();
    expect(mockAuthenticateWithBiometrics).not.toHaveBeenCalled();
  });

  it('does not display "No credentials were found in the store." error banner', async () => {
    mockError = new Error('No credentials were found in the store.');

    await renderWithClient(<LoginScreen navigation={{} as any} route={{} as any} />);

    expect(await screen.findByText('Log In with Auth0')).toBeTruthy();
    expect(screen.queryByText('No credentials were found in the store.')).toBeNull();
  });

  it('does not display cancelled error banner', async () => {
    mockError = new Error('User cancelled');

    await renderWithClient(<LoginScreen navigation={{} as any} route={{} as any} />);

    expect(await screen.findByText('Log In with Auth0')).toBeTruthy();
    expect(screen.queryByText('User cancelled')).toBeNull();
  });

  it('displays legitimate authentication errors', async () => {
    mockError = new Error('Invalid authorization code.');

    await renderWithClient(<LoginScreen navigation={{} as any} route={{} as any} />);

    expect(await screen.findByText('Log In with Auth0')).toBeTruthy();
    expect(await screen.findByText('Invalid authorization code.')).toBeTruthy();
  });
});


