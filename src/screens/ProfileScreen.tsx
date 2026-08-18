import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth0 } from 'react-native-auth0';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RootStackScreenProps } from '../navigation/types';
import {
  UserProfile,
  getUserProfile,
  getUserStats,
  upsertUserProfile,
  CURRENT_USER,
  migrateDbIfNeeded,
} from '../db';
import {
  AUTH0_CONFIG,
  fetchUserInfo,
  clearUserInfoSession,
  UserInfoResponse,
  UserInfoFetchResult,
  getBiometricCapabilities,
  authenticateWithBiometrics,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
} from '../auth';

export const ProfileScreen: React.FC<RootStackScreenProps<'Profile'>> = () => {
  const db = useSQLiteContext();
  const queryClient = useQueryClient();
  const { authorize, clearSession, user, getCredentials } = useAuth0();

  const currentUserId = user?.sub || CURRENT_USER.id;

  // Query: User Profile
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['userProfile', currentUserId],
    queryFn: async () => {
      const userRecord = await getUserProfile(db, currentUserId);
      if (userRecord) {
        return userRecord;
      }
      if (user) {
        const newProfile: UserProfile = {
          id: user.sub,
          name: user.name || user.nickname || 'Auth0 User',
          email: user.email || '',
          role: 'Auth0 Verified Member',
          avatarColor: '#10B981',
          joinedAt: new Date().toISOString(),
        };
        await upsertUserProfile(db, newProfile);
        return newProfile;
      }
      return CURRENT_USER;
    },
  });

  // Query: User Stats
  const { data: stats = { collectionsCount: 0, bookmarksCount: 0 } } = useQuery({
    queryKey: ['userStats', currentUserId],
    queryFn: async () => {
      return getUserStats(db, currentUserId);
    },
  });

  // Query: Biometric Status & Capabilities
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
  const biometricEnabled = !!biometricStatus?.isEnabled;

  // Query: OIDC /userinfo with automatic SQLite claims sync (non-sensitive profile sync)
  const {
    data: userInfoResult,
    isFetching: isUserInfoLoading,
    refetch: refetchUserInfo,
  } = useQuery<UserInfoFetchResult | null>({
    queryKey: ['userInfo', user?.sub],
    enabled: !!user?.sub,
    queryFn: async (): Promise<UserInfoFetchResult | null> => {
      if (!user) return null;
      try {
        const credentials = await getCredentials(
          AUTH0_CONFIG.scope,
          0,
          { audience: AUTH0_CONFIG.audience }
        );

        if (credentials?.accessToken) {
          const result: UserInfoFetchResult = await fetchUserInfo(
            credentials.accessToken,
            false
          );

          if (result.data) {
            // Sync verified claims from /userinfo into local SQLite
            const synced: UserProfile = {
              id: result.data.sub || user.sub,
              name: result.data.name || result.data.nickname || user.name || 'Auth0 User',
              email: result.data.email || user.email || '',
              role: 'Auth0 Verified Member',
              avatarColor: '#10B981',
              joinedAt: profile?.joinedAt || new Date().toISOString(),
            };
            await upsertUserProfile(db, synced);
            queryClient.setQueryData(['userProfile', currentUserId], synced);
          }
          return result;
        }
      } catch (err: any) {
        console.warn('Failed to fetch /userinfo:', err);
        return {
          data: null,
          fromCache: false,
          error: err?.message || 'Remote /userinfo call failed.',
        };
      }
      return null;
    },
  });

  const userInfoData: UserInfoResponse | null = userInfoResult?.data || null;
  const userInfoMeta = userInfoResult
    ? {
        fromCache: userInfoResult.fromCache,
        status: userInfoResult.status ?? 200,
        lastFetchedAt: new Date().toLocaleTimeString(),
        error: userInfoResult.error,
      }
    : null;

  // Mutation: Auth0 Login
  const auth0LoginMutation = useMutation({
    mutationFn: async () => {
      await authorize({
        scope: AUTH0_CONFIG.scope,
        audience: AUTH0_CONFIG.audience,
        redirectUrl: AUTH0_CONFIG.redirectUri,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['userInfo'] });
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
    },
    onError: (e: any) => {
      console.log('Auth0 login result / error:', e);
      if (e?.message && !e.message.includes('cancelled') && !e.message.includes('User cancelled')) {
        Alert.alert('Authentication Info', e.message || 'Login was not completed.');
      }
    },
  });

  // Mutation: Auth0 Logout
  const auth0LogoutMutation = useMutation({
    mutationFn: async () => {
      clearUserInfoSession();
      await setBiometricUnlockEnabled(db, false);
      await clearSession({
        returnToUrl: AUTH0_CONFIG.logoutUri,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['userInfo'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
    onError: (e: any) => {
      console.log('Auth0 logout result / error:', e);
      if (e?.message && !e.message.includes('cancelled')) {
        Alert.alert('Sign Out Info', e.message || 'Session cleared.');
      }
    },
  });

  // Mutation: Toggle Biometrics
  const toggleBiometricMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      if (!biometrics?.isAvailable && newValue) {
        throw new Error('Biometric authentication is not enrolled or available on this hardware.');
      }

      if (newValue) {
        // Require immediate biometric verification before enabling
        const result = await authenticateWithBiometrics({
          promptMessage: `Authorize ${biometrics?.biometricName || 'Biometrics'} for Kiki Bookmark`,
        });

        if (!result.success) {
          if (result.error && !result.error.includes('user_cancel')) {
            throw new Error(result.error);
          }
          return { cancelled: true, newValue };
        }
      }

      await setBiometricUnlockEnabled(db, newValue);
      return { cancelled: false, newValue };
    },
    onSuccess: (res) => {
      if (res?.cancelled) return;
      queryClient.invalidateQueries({ queryKey: ['biometrics', 'status'] });
      Alert.alert(
        res.newValue ? 'Biometric Unlock Enabled' : 'Biometric Unlock Disabled',
        res.newValue
          ? `${biometrics?.biometricName || 'Biometrics'} is now active for quick unlock.`
          : 'Biometric unlock has been disabled.'
      );
    },
    onError: (err: any) => {
      console.error('Failed to update biometric preference:', err);
      Alert.alert('Verification / Setup Notice', err?.message || 'Failed to save biometric preference.');
    },
  });

  // Mutation: Test Biometrics
  const testBiometricMutation = useMutation({
    mutationFn: async () => {
      if (!biometrics?.hasHardware) {
        throw new Error('This device does not have biometric hardware sensors (Face ID / Fingerprint).');
      }

      if (!biometrics?.isEnrolled) {
        throw new Error('No biometrics are currently enrolled in your device settings. Please register Face ID or Fingerprint in device settings.');
      }

      const result = await authenticateWithBiometrics({
        promptMessage: `Test ${biometrics.biometricName} Sensor`,
        fallbackLabel: 'Use Passcode',
      });

      if (!result.success && result.error && !result.error.includes('user_cancel')) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: (result) => {
      if (result.success) {
        Alert.alert(
          'Biometric Verification Passed 🎉',
          `Successfully verified via ${biometrics?.biometricName}. Hardware sensors and native permissions are working properly.`
        );
      }
    },
    onError: (e: any) => {
      Alert.alert('Biometric Test Notice', e?.message || 'Biometric test failed.');
    },
  });

  const handleResetDatabase = () => {
    Alert.alert(
      'Reset Local SQLite Data',
      'This will drop all local tables and clear all collections, bookmarks, and local data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Database',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.execAsync(`
                DROP TABLE IF EXISTS bookmarks;
                DROP TABLE IF EXISTS collections;
                DROP TABLE IF EXISTS users;
                PRAGMA user_version = 0;
              `);
              await migrateDbIfNeeded(db);
              queryClient.invalidateQueries();
              Alert.alert('Success', 'SQLite database has been cleared and reset.');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to reset database.');
            }
          },
        },
      ]
    );
  };

  const authActionLoading = auth0LoginMutation.isPending || auth0LogoutMutation.isPending;
  const biometricTesting = testBiometricMutation.isPending;
  const userInfoLoading = isUserInfoLoading;

  if (isProfileLoading && !profile) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['bottom', 'left', 'right']}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </SafeAreaView>
    );
  }

  const initials = (profile?.name || user?.name || 'KU')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  const isAuthenticated = !!user;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarSection}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatarImage} />
            ) : (
              <View

                style={[
                  styles.avatarCircle,
                  { backgroundColor: isAuthenticated ? '#10B981' : (profile?.avatarColor || '#4F46E5') },
                ]}
              >
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}

            <View
              style={[
                styles.badgePill,
                isAuthenticated ? styles.badgePillAuth : styles.badgePillOffline,
              ]}
            >
              <Text
                style={[
                  styles.badgePillText,
                  isAuthenticated ? styles.badgePillAuthText : styles.badgePillOfflineText,
                ]}
              >
                {isAuthenticated ? '● Auth0 Authenticated' : '○ Local / Offline User'}
              </Text>
            </View>
          </View>

          <Text style={styles.userName}>{user?.name || profile?.name}</Text>
          <Text style={styles.userRole}>{isAuthenticated ? 'Auth0 Account' : profile?.role}</Text>
          <Text style={styles.userEmail}>{user?.email || profile?.email}</Text>

          {/* Primary Auth Action Button */}
          <View style={styles.authButtonsRow}>
            {isAuthenticated ? (
              <TouchableOpacity
                style={[styles.authActionButton, styles.logoutButton]}
                activeOpacity={0.8}
                onPress={() => auth0LogoutMutation.mutate()}
                disabled={authActionLoading}
              >
                {authActionLoading ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <Text style={styles.logoutButtonText}>🚪 Sign Out from Auth0</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.authActionButton, styles.loginButton]}
                activeOpacity={0.8}
                onPress={() => auth0LoginMutation.mutate()}
                disabled={authActionLoading}
              >
                {authActionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>🔐 Sign In with Auth0</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats Grid */}
        <Text style={styles.sectionHeader}>On-Device SQL Storage</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.collectionsCount}</Text>
            <Text style={styles.statLabel}>Collections</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.bookmarksCount}</Text>
            <Text style={styles.statLabel}>Bookmarks</Text>
          </View>
        </View>

        {/* Biometrics & Hardware Security */}
        <Text style={styles.sectionHeader}>Biometric Authentication & Security</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Biometric Modality</Text>
            <View style={styles.biometricTypeChip}>
              <Text style={styles.biometricTypeIcon}>{biometrics?.biometricIcon || '🔒'}</Text>
              <Text style={styles.biometricTypeText}>{biometrics?.biometricName || 'Detecting...'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Sensor Hardware</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: biometrics?.hasHardware ? '#10B981' : '#EF4444' },
                ]}
              />
              <Text style={styles.infoVal}>
                {biometrics?.hasHardware ? 'Detected & Supported' : 'Hardware Not Present'}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Device Enrollment</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: biometrics?.isEnrolled ? '#10B981' : '#F59E0B' },
                ]}
              />
              <Text style={styles.infoVal}>
                {biometrics?.isEnrolled ? 'Enrolled & Active' : 'No Biometrics Enrolled'}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.infoKey}>Require Biometric Unlock</Text>
              <Text style={styles.infoSubtext}>
                Prompt {biometrics?.biometricName || 'biometrics'} for quick app access
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={(val) => toggleBiometricMutation.mutate(val)}
              trackColor={{ false: '#E2E8F0', true: '#818CF8' }}
              thumbColor={biometricEnabled ? '#4F46E5' : '#94A3B8'}
              disabled={!biometrics?.isAvailable}
            />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity
            style={[
              styles.testBiometricButton,
              (!biometrics?.isAvailable || biometricTesting) && styles.buttonDisabled,
            ]}
            activeOpacity={0.8}
            onPress={() => testBiometricMutation.mutate()}
            disabled={!biometrics?.isAvailable || biometricTesting}
          >
            {biometricTesting ? (
              <ActivityIndicator size="small" color="#4F46E5" />
            ) : (
              <Text style={styles.testBiometricButtonText}>
                {biometrics?.biometricIcon || '🔒'} Test {biometrics?.biometricName || 'Biometric'} Prompt
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Account & Session Info */}
        <Text style={styles.sectionHeader}>Account & Authentication</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Authentication Provider</Text>
            <Text style={styles.infoVal}>Auth0 (OpenID Connect)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Account Status</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isAuthenticated ? '#10B981' : '#F59E0B' },
                ]}
              />
              <Text style={styles.infoVal}>
                {isAuthenticated ? 'Connected & Verified' : 'Offline / Guest Mode'}
              </Text>
            </View>
          </View>
          {isAuthenticated && userInfoData?.email_verified !== undefined && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Email Verification</Text>
                <Text
                  style={[
                    styles.infoVal,
                    { color: userInfoData.email_verified ? '#059669' : '#DC2626' },
                  ]}
                >
                  {userInfoData.email_verified ? '✓ Verified' : '✗ Unverified'}
                </Text>
              </View>
            </>
          )}
          {isAuthenticated && userInfoMeta?.lastFetchedAt && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Last Profile Sync</Text>
                <Text style={styles.infoValSmall}>{userInfoMeta.lastFetchedAt}</Text>
              </View>
            </>
          )}

          {isAuthenticated && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.syncButton}
                activeOpacity={0.8}
                onPress={() => refetchUserInfo()}
                disabled={userInfoLoading}
              >
                {userInfoLoading ? (
                  <ActivityIndicator size="small" color="#4F46E5" />
                ) : (
                  <Text style={styles.syncButtonText}>🔄 Sync Profile Data</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Database & Storage */}
        <Text style={styles.sectionHeader}>Local Database & Storage</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Storage Engine</Text>
            <Text style={styles.infoVal}>expo-sqlite (SDK 57)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Database File</Text>
            <Text style={styles.infoVal}>kiki_bookmarks.db</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Journal Mode</Text>
            <Text style={styles.infoVal}>WAL (Write-Ahead Logging)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Member Since</Text>
            <Text style={styles.infoVal}>
              {profile?.joinedAt
                ? new Date(profile.joinedAt).toLocaleDateString()
                : '2025'}
            </Text>
          </View>
        </View>

        {/* Danger Zone / Reset */}
        <TouchableOpacity
          style={styles.dangerButton}
          activeOpacity={0.8}
          onPress={handleResetDatabase}
        >
          <Text style={styles.dangerButtonText}>🔄 Reset Local SQLite Database</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 1,
  },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgePillAuth: {
    backgroundColor: '#ECFDF5',
  },
  badgePillOffline: {
    backgroundColor: '#EEF2FF',
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  badgePillAuthText: {
    color: '#059669',
  },
  badgePillOfflineText: {
    color: '#4F46E5',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16,
  },
  authButtonsRow: {
    width: '100%',
    gap: 8,
  },
  authActionButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButton: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutButtonText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#4F46E5',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoKey: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  infoValSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    maxWidth: '55%',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  syncButton: {
    marginTop: 10,
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
  },
  biometricTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  biometricTypeIcon: {
    fontSize: 13,
    marginRight: 4,
  },
  biometricTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338CA',
  },
  infoSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  testBiometricButton: {
    marginTop: 10,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBiometricButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4338CA',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  dangerButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 14,
  },
});

