import React, { useState, useEffect } from 'react';
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
import type { RootStackScreenProps } from '../navigation/types';
import { AUTH0_CONFIG } from '../auth';
import { upsertUserProfile, UserProfile } from '../db';

export const LoginScreen: React.FC<RootStackScreenProps<'Login'>> = () => {
  const db = useSQLiteContext();
  const {
    authorize,
    user,
    error: auth0Error,
    isLoading: auth0Loading,
  } = useAuth0();

  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Sync Auth0 authenticated user into local SQLite
  useEffect(() => {
    if (user) {
      const syncProfile = async () => {
        try {
          const profile: UserProfile = {
            id: user.sub,
            name: user.name || user.nickname || 'Auth0 User',
            email: user.email || '',
            role: 'Auth0 Authenticated Member',
            avatarColor: '#4F46E5',
            joinedAt: new Date().toISOString(),
          };
          await upsertUserProfile(db, profile);
        } catch (e) {
          console.error('Failed to sync Auth0 profile to SQLite:', e);
        }
      };
      syncProfile();
    }
  }, [user, db]);

  const handleLogin = async () => {
    try {
      setIsAuthenticating(true);
      await authorize({
        scope: AUTH0_CONFIG.scope,
        audience: AUTH0_CONFIG.audience,
        redirectUrl: AUTH0_CONFIG.redirectUri,
      });
    } catch (err: any) {
      console.log('Auth0 Authorize error/cancel:', err);
      if (
        err?.message &&
        !err.message.includes('cancelled') &&
        !err.message.includes('User cancelled')
      ) {
        Alert.alert('Authentication Notice', err.message || 'Authentication flow was not completed.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const isLoading = isAuthenticating || auth0Loading;

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
        </View>

        {/* Error notice if present */}
        {auth0Error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {auth0Error.message || 'Authentication error encountered.'}
            </Text>
          </View>
        )}

        {/* Minimal Action Area */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
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
