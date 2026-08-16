// Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([1, 2]),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    withTransactionAsync: jest.fn((callback) => callback()),
  })),
}));

// Mock react-native-auth0
jest.mock('react-native-auth0', () => {
  return {
    useAuth0: jest.fn(() => ({
      authorize: jest.fn().mockResolvedValue({
        accessToken: 'mock-token',
        idToken: 'mock-id-token',
      }),
      clearSession: jest.fn().mockResolvedValue(undefined),
      user: null,
      error: null,
      isLoading: false,
    })),
    Auth0Provider: ({ children }) => children,
    default: jest.fn().mockImplementation(() => ({
      auth: {
        userInfo: jest.fn().mockResolvedValue({
          sub: 'auth0|123456',
          name: 'Test User',
          email: 'test@example.com',
        }),
      },
    })),
  };
});
