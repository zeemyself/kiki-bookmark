import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth0 } from 'react-native-auth0';
import { useSQLiteContext } from 'expo-sqlite';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { RootStackScreenProps } from '../navigation/types';
import {
  AUTH0_CONFIG,
  getBiometricCapabilities,
  authenticateWithBiometrics,
  isBiometricUnlockEnabled,
} from '../auth';
import { upsertUserProfile, UserProfile } from '../db';

export const LoginScreen: React.FC<RootStackScreenProps<'Login'>> = () => {
  const db = useSQLiteContext();
  const {
    authorize,
    user,
    error: auth0Error,
    isLoading: auth0Loading,
    getCredentials,
  } = useAuth0();

  // Query: Device biometric capabilities & SQLite settings
  const { data: biometricStatus } = useQuery({
    queryKey: ['biometrics', 'status'],
    queryFn: async () => {
      const [capabilities, isEnabled] = await Promise.all([
        getBiometricCapabilities(),
        isBiometricUnlockEnabled(db),
      ]);
      return { capabilities, isEnabled };
    },
  });

  const biometrics = biometricStatus?.capabilities;

  // Query: Sync Auth0 authenticated user into local SQLite declaratively
  useQuery({
    queryKey: ['userProfileSync', user?.sub],
    enabled: !!user?.sub,
    queryFn: async () => {
      if (!user) return null;
      const profile: UserProfile = {
        id: user.sub,
        name: user.name || user.nickname || 'Auth0 User',
        email: user.email || '',
        role: 'Auth0 Authenticated Member',
        avatarColor: '#4F46E5',
        joinedAt: new Date().toISOString(),
      };
      await upsertUserProfile(db, profile);
      return profile;
    },
  });

  // Mutation: Auth0 Universal Login
  const loginMutation = useMutation({
    mutationFn: async () => {
      await authorize({
        scope: AUTH0_CONFIG.scope,
        audience: AUTH0_CONFIG.audience,
        redirectUrl: AUTH0_CONFIG.redirectUri,
      });
    },
    onError: (err: any) => {
      console.log('Auth0 Authorize error/cancel:', err);
      if (
        err?.message &&
        !err.message.includes('cancelled') &&
        !err.message.includes('User cancelled')
      ) {
        Alert.alert(
          'Authentication Notice',
          err.message || 'Authentication flow was not completed.'
        );
      }
    },
  });

  // Mutation: Biometric Unlock & Credential Restoration
  const biometricUnlockMutation = useMutation({
    mutationFn: async () => {
      if (!biometrics?.isAvailable) {
        Alert.alert(
          'Biometric Unavailable',
          'Biometric authentication is not enrolled or available on this device.'
        );
        return { handled: true };
      }

      const result = await authenticateWithBiometrics({
        promptMessage: `Unlock Kiki Bookmark with ${biometrics.biometricName}`,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Device Passcode',
      });

      if (!result.success) {
        if (result.error && !result.error.includes('user_cancel')) {
          Alert.alert('Biometric Authentication', result.error);
        }
        return { handled: true };
      }

      // Biometric verified! Attempt to restore credentials from secure storage
      try {
        const creds = await getCredentials(
          AUTH0_CONFIG.scope,
          0,
          { audience: AUTH0_CONFIG.audience }
        );

        if (creds?.accessToken) {
          // Credentials retrieved; Auth0 context will update
          return { handled: true, success: true };
        }
      } catch {
        // No stored tokens yet in Keychain; prompt standard login
      }

      // If no credentials found or expired, prompt login
      Alert.alert(
        'Biometrics Verified',
        'Biometric check succeeded. Please complete initial Auth0 login to seed your secure tokens.',
        [
          {
            text: 'Log In Now',
            onPress: () => loginMutation.mutate(),
          },
        ]
      );
      return { handled: true, success: false };
    },
    onError: (err: any) => {
      console.error('Error during biometric unlock:', err);
      Alert.alert('Biometric Error', err?.message || 'Biometric authentication failed.');
    },
  });

  const isLoading =
    loginMutation.isPending || auth0Loading || biometricUnlockMutation.isPending;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Branding Hero */}
        <View style={styles.heroSection}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>🔖</Text>
          </View>
          <Text style={styles.brandTitle}>Kiki Bookmark</Text>
          <Text style={styles.brandSubtitle}>
            Save, organize, and sync your favorite links.
          </Text>

          {/* Biometric Capability Status Chip */}
          {biometrics?.isAvailable && (
            <View style={styles.biometricBadge}>
              <Text style={styles.biometricBadgeIcon}>{biometrics.biometricIcon}</Text>
              <Text style={styles.biometricBadgeText}>
                {biometrics.biometricName} Enabled
              </Text>
            </View>
          )}
        </View>

        {/* Error notice if present */}
        {auth0Error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {auth0Error.message || 'Authentication error encountered.'}
            </Text>
          </View>
        )}

        {/* Action Area */}
        <View style={styles.actionSection}>
          {biometrics?.isAvailable && (
            <TouchableOpacity
              style={[styles.biometricButton, isLoading && styles.buttonDisabled]}
              onPress={() => biometricUnlockMutation.mutate()}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {biometricUnlockMutation.isPending ? (
                <ActivityIndicator color="#4F46E5" size="small" />
              ) : (
                <View style={styles.biometricButtonContent}>
                  <Text style={styles.biometricButtonIcon}>{biometrics.biometricIcon}</Text>
                  <Text style={styles.biometricButtonText}>
                    Unlock with {biometrics.biometricName}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.buttonDisabled]}
            onPress={() => loginMutation.mutate()}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {loginMutation.isPending || auth0Loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Log In with Auth0</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoIcon: {
    fontSize: 40,
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  brandSubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 24,
    width: '100%',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
  },
  actionSection: {
    width: '100%',
    maxWidth: 320,
    gap: 12,
  },
  biometricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  biometricBadgeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  biometricBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4338CA',
  },
  biometricButton: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#6366F1',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  biometricButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  biometricButtonText: {
    color: '#4338CA',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  loginButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

