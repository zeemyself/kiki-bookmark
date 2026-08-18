import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
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
  setBiometricUnlockEnabled,
  BiometricCapabilities,
} from '../auth';
import { upsertUserProfile, UserProfile } from '../db';

type BiometricAutoState =
  | 'checking'     // checking for stored credentials + biometric setting
  | 'prompting'    // biometric prompt is active
  | 'unavailable'; // no stored creds, biometric not enabled, or biometric failed; show normal login

export const LoginScreen: React.FC<RootStackScreenProps<'Login'>> = () => {
  const db = useSQLiteContext();
  const {
    authorize,
    user,
    error: auth0Error,
    isLoading: auth0Loading,
    getCredentials,
  } = useAuth0();

  const [autoState, setAutoState] = useState<BiometricAutoState>('checking');
  const [biometrics, setBiometrics] = useState<BiometricCapabilities | null>(null);
  const hasAttemptedAutoRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in content after initial check
  const fadeIn = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

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

  // Auto-biometric: check for stored credentials + biometric enabled, then prompt
  const attemptAutoBiometric = useCallback(async () => {
    try {
      const [caps, isEnabled] = await Promise.all([
        getBiometricCapabilities(),
        isBiometricUnlockEnabled(db),
      ]);
      setBiometrics(caps);

      // If biometric not enabled in settings, or hardware not available, skip
      if (!isEnabled || !caps.isAvailable) {
        setAutoState('unavailable');
        fadeIn();
        return;
      }

      // Check if we have stored Auth0 credentials in the Keychain
      let hasStoredCredentials = false;
      try {
        const creds = await getCredentials(
          AUTH0_CONFIG.scope,
          0,
          { audience: AUTH0_CONFIG.audience }
        );
        hasStoredCredentials = !!creds?.accessToken;
      } catch {
        // No stored credentials
      }

      if (!hasStoredCredentials) {
        // No previous session to restore — show normal login
        setAutoState('unavailable');
        fadeIn();
        return;
      }

      // We have credentials + biometric enabled → auto-prompt
      setAutoState('prompting');

      const result = await authenticateWithBiometrics({
        promptMessage: `Unlock Kiki Bookmark with ${caps.biometricName}`,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Device Passcode',
      });

      if (result.success) {
        // Restore credentials — Auth0 context will re-hydrate automatically
        // via getCredentials. The RootNavigator will see `user` and switch screens.
        try {
          await getCredentials(
            AUTH0_CONFIG.scope,
            0,
            { audience: AUTH0_CONFIG.audience }
          );
        } catch {
          // Token might have expired; fall through to normal login
          setAutoState('unavailable');
          fadeIn();
        }
        // If getCredentials succeeded, Auth0 context updates and we navigate away
        return;
      }

      // Biometric was cancelled or failed — show normal login
      setAutoState('unavailable');
      fadeIn();
    } catch (err) {
      console.error('Auto biometric check error:', err);
      setAutoState('unavailable');
      fadeIn();
    }
  }, [db, getCredentials, fadeIn]);

  // Run auto-biometric once on mount
  useEffect(() => {
    if (hasAttemptedAutoRef.current) return;
    hasAttemptedAutoRef.current = true;
    attemptAutoBiometric();
  }, [attemptAutoBiometric]);

  // Mutation: Auth0 Universal Login
  const loginMutation = useMutation({
    mutationFn: async () => {
      await authorize({
        scope: AUTH0_CONFIG.scope,
        audience: AUTH0_CONFIG.audience,
        redirectUrl: AUTH0_CONFIG.redirectUri,
      });
    },
    onSuccess: async () => {
      // After first login, offer biometric setup if device supports it
      try {
        const [caps, alreadyEnabled] = await Promise.all([
          getBiometricCapabilities(),
          isBiometricUnlockEnabled(db),
        ]);

        if (caps.isAvailable && !alreadyEnabled) {
          Alert.alert(
            `Enable ${caps.biometricName}?`,
            `Use ${caps.biometricName} to quickly unlock Kiki Bookmark next time.`,
            [
              { text: 'Skip', style: 'cancel' },
              {
                text: 'Enable',
                onPress: async () => {
                  const result = await authenticateWithBiometrics({
                    promptMessage: `Set up ${caps.biometricName} for Kiki Bookmark`,
                  });
                  if (result.success) {
                    await setBiometricUnlockEnabled(db, true);
                  }
                },
              },
            ]
          );
        }
      } catch (err) {
        console.log('Biometric setup prompt skipped:', err);
      }
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

  const isLoading = loginMutation.isPending || auth0Loading;

  // Show a minimal loading state while checking for stored credentials
  if (autoState === 'checking' || autoState === 'prompting') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.heroSection}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoIcon}>🔖</Text>
            </View>
            <Text style={styles.brandTitle}>Kiki Bookmark</Text>
            {autoState === 'prompting' && biometrics ? (
              <Text style={styles.brandSubtitle}>
                Verifying with {biometrics.biometricName}…
              </Text>
            ) : (
              <Text style={styles.brandSubtitle}>Checking session…</Text>
            )}
          </View>
          <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 24 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Branding Hero */}
        <View style={styles.heroSection}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>🔖</Text>
          </View>
          <Text style={styles.brandTitle}>Kiki Bookmark</Text>
          <Text style={styles.brandSubtitle}>
            Save, organize, and sync your favorite links.
          </Text>
        </View>

        {/* Error notice if present */}
        {(() => {
          const rawErrorMessage =
            typeof auth0Error === 'string' ? auth0Error : auth0Error?.message;
          const isIgnoredError =
            !rawErrorMessage ||
            rawErrorMessage.toLowerCase().includes('no credentials') ||
            rawErrorMessage.toLowerCase().includes('cancelled');

          if (isIgnoredError || !rawErrorMessage) return null;

          return (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{rawErrorMessage}</Text>
            </View>
          );
        })()}

        {/* Action Area */}
        <View style={styles.actionSection}>

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
      </Animated.View>
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

