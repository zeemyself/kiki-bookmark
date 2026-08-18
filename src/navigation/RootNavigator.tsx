import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth0 } from 'react-native-auth0';
import { useSQLiteContext } from 'expo-sqlite';
import {
  LoginScreen,
  HomeScreen,
  BookmarkDetailsScreen,
  CollectionDetailsScreen,
  ProfileScreen,
} from '../screens';
import { BiometricLockOverlay } from '../components';
import {
  AUTH0_CONFIG,
  getBiometricCapabilities,
  authenticateWithBiometrics,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
  clearUserInfoSession,
  BiometricCapabilities,
} from '../auth';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const db = useSQLiteContext();
  const { user, isLoading, clearSession } = useAuth0();

  // Biometric lock states
  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometrics, setBiometrics] = useState<BiometricCapabilities | null>(null);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const wasBackgroundedRef = useRef<boolean>(false);
  const isPromptingRef = useRef<boolean>(false);
  const initialCheckDoneRef = useRef<boolean>(false);

  // Trigger biometric prompt to unlock
  const triggerUnlock = useCallback(async (caps?: BiometricCapabilities) => {
    if (isPromptingRef.current) return;
    const currentCaps = caps || biometrics;
    if (!currentCaps?.isAvailable) {
      setIsLocked(false);
      return;
    }

    try {
      isPromptingRef.current = true;
      setIsAuthenticating(true);

      const result = await authenticateWithBiometrics({
        promptMessage: `Unlock Kiki Bookmark with ${currentCaps.biometricName}`,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Device Passcode',
      });

      if (result.success) {
        setIsLocked(false);
        wasBackgroundedRef.current = false;
      }
    } catch (err) {
      console.error('Error during resume biometric unlock:', err);
    } finally {
      setIsAuthenticating(false);
      isPromptingRef.current = false;
    }
  }, [biometrics]);

  // Initial cold-boot biometric check only if user is logged in and feature is enabled
  useEffect(() => {
    if (!user) {
      setIsLocked(false);
      initialCheckDoneRef.current = false;
      return;
    }

    if (initialCheckDoneRef.current) return;
    initialCheckDoneRef.current = true;

    const checkInitialLock = async () => {
      try {
        const [caps, enabled] = await Promise.all([
          getBiometricCapabilities(),
          isBiometricUnlockEnabled(db),
        ]);
        setBiometrics(caps);

        if (enabled && caps.isAvailable) {
          setIsLocked(true);
          setTimeout(() => {
            triggerUnlock(caps);
          }, 300);
        } else {
          setIsLocked(false);
        }
      } catch (err) {
        console.error('Failed to check initial biometric state:', err);
        setIsLocked(false);
      }
    };

    checkInitialLock();
  }, [user, db, triggerUnlock]);

  // AppState listener: ONLY lock when app was truly in 'background' and returns to 'active'
  useEffect(() => {
    if (!user) {
      setIsLocked(false);
      return;
    }

    const subscription = AppState.addEventListener(
      'change',
      async (nextAppState: AppStateStatus) => {
        const prevAppState = appStateRef.current;
        appStateRef.current = nextAppState;

        // User actually left the app to background / home screen
        if (nextAppState === 'background') {
          // Do not flag backgrounded if caused by system dialog during an active biometric prompt
          if (!isPromptingRef.current) {
            wasBackgroundedRef.current = true;
          }
          return;
        }

        // App returned to foreground / active from true background
        if (prevAppState === 'background' || wasBackgroundedRef.current) {
          if (nextAppState === 'active') {
            wasBackgroundedRef.current = false;

            // If a prompt is already in progress, ignore
            if (isPromptingRef.current) {
              return;
            }

            try {
              const [caps, enabled] = await Promise.all([
                getBiometricCapabilities(),
                isBiometricUnlockEnabled(db),
              ]);
              setBiometrics(caps);

              if (enabled && caps.isAvailable) {
                setIsLocked(true);
                triggerUnlock(caps);
              }
            } catch (e) {
              console.error('Error checking biometrics on app resume:', e);
            }
          }
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [user, db, triggerUnlock]);

  // Handle fallback sign out from lock screen
  const handleLockSignOut = async () => {
    try {
      setIsAuthenticating(true);
      clearUserInfoSession();
      await setBiometricUnlockEnabled(db, false);
      setIsLocked(false);
      await clearSession({
        returnToUrl: AUTH0_CONFIG.logoutUri,
      });
    } catch (e) {
      console.error('Error signing out from lock overlay:', e);
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerTintColor: '#0F172A',
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: '#F8FAFC',
          },
        }}
      >
        {!user ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              headerShown: false,
            }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="BookmarkDetails"
              component={BookmarkDetailsScreen}
              options={{
                title: 'Bookmark Details',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen
              name="CollectionDetails"
              component={CollectionDetailsScreen}
              options={{
                title: 'Collection Details',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{
                title: 'Profile & Settings',
                headerBackTitle: 'Back',
              }}
            />
          </>
        )}
      </Stack.Navigator>

      {/* App Resume Biometric Lock Overlay */}
      {user && isLocked && (
        <BiometricLockOverlay
          visible={isLocked}
          biometricName={biometrics?.biometricName || 'Biometrics'}
          biometricIcon={biometrics?.biometricIcon || '🔒'}
          isAuthenticating={isAuthenticating}
          onUnlock={() => triggerUnlock()}
          onSignOut={handleLockSignOut}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
});

