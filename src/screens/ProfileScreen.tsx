import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth0 } from 'react-native-auth0';
import type { RootStackScreenProps } from '../navigation/types';
import {
  UserProfile,
  getUserProfile,
  getUserStats,
  updateUserProfile,
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
  BiometricCapabilities,
} from '../auth';

export const ProfileScreen: React.FC<RootStackScreenProps<'Profile'>> = ({
  navigation,
}) => {
  const db = useSQLiteContext();
  const { authorize, clearSession, user, error: auth0Error, isLoading: auth0Loading, getCredentials } = useAuth0();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<{ collectionsCount: number; bookmarksCount: number }>({
    collectionsCount: 0,
    bookmarksCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [authActionLoading, setAuthActionLoading] = useState(false);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);

  // OIDC /userinfo state (one-shot per session guarantee)
  const [userInfoData, setUserInfoData] = useState<UserInfoResponse | null>(null);
  const [userInfoMeta, setUserInfoMeta] = useState<{
    fromCache: boolean;
    status?: number;
    lastFetchedAt?: string;
    error?: string;
  } | null>(null);
  const [userInfoLoading, setUserInfoLoading] = useState(false);

  const [tokensInfo, setTokensInfo] = useState<{
    accessToken?: string;
    idToken?: string;
    expiresIn?: number;
    tokenType?: string;
    scope?: string;
  } | null>(null);
  const [isTokenModalVisible, setIsTokenModalVisible] = useState(false);

  // Biometric authentication state
  const [biometrics, setBiometrics] = useState<BiometricCapabilities | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricTesting, setBiometricTesting] = useState(false);

  const currentUserId = user?.sub || CURRENT_USER.id;

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const [userRecord, userStats] = await Promise.all([
        getUserProfile(db, currentUserId),
        getUserStats(db, currentUserId),
      ]);

      if (userRecord) {
        setProfile(userRecord);
      } else if (user) {
        const newProfile: UserProfile = {
          id: user.sub,
          name: user.name || user.nickname || 'Auth0 User',
          email: user.email || '',
          role: 'Auth0 Verified Member',
          avatarColor: '#10B981',
          joinedAt: new Date().toISOString(),
        };
        await upsertUserProfile(db, newProfile);
        setProfile(newProfile);
      } else {
        setProfile(CURRENT_USER);
      }
      setStats(userStats);
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  }, [db, currentUserId, user]);

  const loadBiometrics = useCallback(async () => {
    try {
      setBiometricLoading(true);
      const [caps, enabled] = await Promise.all([
        getBiometricCapabilities(),
        isBiometricUnlockEnabled(db),
      ]);
      setBiometrics(caps);
      setBiometricEnabled(enabled);
    } catch (e) {
      console.error('Error querying biometrics on ProfileScreen:', e);
    } finally {
      setBiometricLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadBiometrics();
    }, [loadProfile, loadBiometrics])
  );

  // One-shot /userinfo fetch using Access Token as credential
  const loadUserInfo = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setUserInfoData(null);
      setUserInfoMeta(null);
      return;
    }

    try {
      setUserInfoLoading(true);
      const credentials = await getCredentials(
        AUTH0_CONFIG.scope,
        0,
        { audience: AUTH0_CONFIG.audience }
      );

      if (credentials?.accessToken) {
        const result: UserInfoFetchResult = await fetchUserInfo(
          credentials.accessToken,
          forceRefresh
        );

        if (result.data) {
          setUserInfoData(result.data);
          setUserInfoMeta({
            fromCache: result.fromCache,
            status: result.status ?? 200,
            lastFetchedAt: new Date().toLocaleTimeString(),
          });

          // Sync verified claims from /userinfo into local SQLite
          const synced: UserProfile = {
            id: result.data.sub || user.sub,
            name: result.data.name || result.data.nickname || user.name || 'Auth0 User',
            email: result.data.email || user.email || '',
            role: 'Auth0 Verified Member (OIDC /userinfo)',
            avatarColor: '#10B981',
            joinedAt: profile?.joinedAt || new Date().toISOString(),
          };
          await upsertUserProfile(db, synced);
          setProfile(synced);
        } else if (result.error) {
          setUserInfoMeta({
            fromCache: result.fromCache,
            status: result.status,
            error: result.error,
          });
        }
      }
    } catch (err: any) {
      console.warn('Failed to fetch /userinfo:', err);
      setUserInfoMeta({
        fromCache: false,
        error: err?.message || 'Remote /userinfo call failed.',
      });
    } finally {
      setUserInfoLoading(false);
    }
  }, [user, getCredentials, db, profile?.joinedAt]);

  // Execute /userinfo one-shot fetch upon authentication
  useEffect(() => {
    if (user) {
      loadUserInfo();
    } else {
      setUserInfoData(null);
      setUserInfoMeta(null);
    }
  }, [user, loadUserInfo]);

  const handleAuth0Login = async () => {
    try {
      setAuthActionLoading(true);
      await authorize({
        scope: AUTH0_CONFIG.scope,
        audience: AUTH0_CONFIG.audience,
        redirectUrl: AUTH0_CONFIG.redirectUri,
      });
      await loadProfile();
      await loadUserInfo();
    } catch (e: any) {
      console.log('Auth0 login result / error:', e);
      if (e?.message && !e.message.includes('cancelled') && !e.message.includes('User cancelled')) {
        Alert.alert('Authentication Info', e.message || 'Login was not completed.');
      }
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleAuth0Logout = async () => {
    try {
      setAuthActionLoading(true);
      clearUserInfoSession();
      setUserInfoData(null);
      setUserInfoMeta(null);
      await clearSession({
        returnToUrl: AUTH0_CONFIG.logoutUri,
      });
      setTokensInfo(null);
      await loadProfile();
    } catch (e: any) {
      console.log('Auth0 logout result / error:', e);
      if (e?.message && !e.message.includes('cancelled')) {
        Alert.alert('Sign Out Info', e.message || 'Session cleared.');
      }
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleInspectTokens = async () => {
    try {
      setAuthActionLoading(true);
      const credentials = await getCredentials(
        AUTH0_CONFIG.scope,
        0,
        { audience: AUTH0_CONFIG.audience }
      );
      if (credentials) {
        setTokensInfo({
          accessToken: credentials.accessToken,
          idToken: credentials.idToken,
          expiresIn: credentials.expiresIn,
          tokenType: credentials.tokenType,
          scope: credentials.scope,
        });
        setIsTokenModalVisible(true);
      } else {
        Alert.alert('No Active Session', 'Please sign in with Auth0 first to view tokens.');
      }
    } catch (err: any) {
      Alert.alert('Token Retrieval', err?.message || 'No valid credentials found. Please sign in.');
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleToggleBiometric = async (newValue: boolean) => {
    if (!biometrics?.isAvailable && newValue) {
      Alert.alert(
        'Biometrics Not Available',
        'Biometric authentication is not enrolled or available on this hardware.'
      );
      return;
    }

    if (newValue) {
      // Require immediate biometric verification before enabling
      const result = await authenticateWithBiometrics({
        promptMessage: `Authorize ${biometrics?.biometricName || 'Biometrics'} for Kiki Bookmark`,
      });

      if (!result.success) {
        if (result.error && !result.error.includes('user_cancel')) {
          Alert.alert('Verification Failed', result.error);
        }
        return;
      }
    }

    try {
      await setBiometricUnlockEnabled(db, newValue);
      setBiometricEnabled(newValue);
      Alert.alert(
        newValue ? 'Biometric Unlock Enabled' : 'Biometric Unlock Disabled',
        newValue
          ? `${biometrics?.biometricName || 'Biometrics'} is now active for quick unlock.`
          : 'Biometric unlock has been disabled.'
      );
    } catch (e: any) {
      console.error('Failed to update biometric preference:', e);
      Alert.alert('Error', 'Failed to save biometric preference.');
    }
  };

  const handleTestBiometric = async () => {
    if (!biometrics?.hasHardware) {
      Alert.alert(
        'Hardware Not Found',
        'This device does not have biometric hardware sensors (Face ID / Fingerprint).'
      );
      return;
    }

    if (!biometrics?.isEnrolled) {
      Alert.alert(
        'Not Enrolled',
        'No biometrics are currently enrolled in your device settings. Please register Face ID or Fingerprint in device settings.'
      );
      return;
    }

    try {
      setBiometricTesting(true);
      const result = await authenticateWithBiometrics({
        promptMessage: `Test ${biometrics.biometricName} Sensor`,
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        Alert.alert(
          'Biometric Verification Passed 🎉',
          `Successfully verified via ${biometrics.biometricName}. Hardware sensors and native permissions are working properly.`
        );
      } else if (result.error && !result.error.includes('user_cancel')) {
        Alert.alert('Verification Result', result.error);
      }
    } catch (e: any) {
      Alert.alert('Biometric Test Error', e?.message || 'Biometric test failed.');
    } finally {
      setBiometricTesting(false);
    }
  };

  const openEditModal = () => {
    if (!profile) return;
    setEditName(profile.name);
    setEditEmail(profile.email);
    setEditRole(profile.role);
    setIsEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      await updateUserProfile(db, profile.id, {
        name: editName.trim() || profile.name,
        email: editEmail.trim() || profile.email,
        role: editRole.trim() || profile.role,
      });
      setIsEditModalVisible(false);
      await loadProfile();
    } catch (err) {
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

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
              setLoading(true);
              await db.execAsync(`
                DROP TABLE IF EXISTS bookmarks;
                DROP TABLE IF EXISTS collections;
                DROP TABLE IF EXISTS users;
                PRAGMA user_version = 0;
              `);
              await migrateDbIfNeeded(db);
              await loadProfile();
              Alert.alert('Success', 'SQLite database has been cleared and reset.');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to reset database.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if ((loading || auth0Loading) && !profile) {
    return (
      <SafeAreaView style={styles.centerContainer}>
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
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
          <Text style={styles.userRole}>{isAuthenticated ? 'Auth0 OpenID Connect Account' : profile?.role}</Text>
          <Text style={styles.userEmail}>{user?.email || profile?.email}</Text>

          {/* Primary Auth Action Button */}
          <View style={styles.authButtonsRow}>
            {isAuthenticated ? (
              <TouchableOpacity
                style={[styles.authActionButton, styles.logoutButton]}
                activeOpacity={0.8}
                onPress={handleAuth0Logout}
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
                onPress={handleAuth0Login}
                disabled={authActionLoading}
              >
                {authActionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>🔐 Sign In with Auth0</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.editProfileBtn}
              activeOpacity={0.8}
              onPress={openEditModal}
            >
              <Text style={styles.editProfileBtnText}>✏️ Edit Profile Info</Text>
            </TouchableOpacity>
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

        {/* OIDC & Auth0 Configuration Spec */}
        <Text style={styles.sectionHeader}>Auth0 OIDC Configuration</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Auth Status</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isAuthenticated ? '#10B981' : '#F59E0B' },
                ]}
              />
              <Text style={styles.infoVal}>
                {isAuthenticated ? 'Authenticated' : 'Unauthenticated / Guest'}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Discovery Endpoint</Text>
            <Text style={styles.infoValSmall} numberOfLines={1} ellipsizeMode="middle">
              {AUTH0_CONFIG.discoveryEndpoint}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Auth0 Domain</Text>
            <Text style={styles.infoVal}>{AUTH0_CONFIG.domain}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Client ID</Text>
            <Text style={styles.infoValSmall}>{AUTH0_CONFIG.clientId}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Application ID</Text>
            <Text style={styles.infoVal}>{AUTH0_CONFIG.bundleId}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Redirect URI</Text>
            <Text style={styles.infoValSmall}>{AUTH0_CONFIG.redirectUri}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Logout URI</Text>
            <Text style={styles.infoValSmall}>{AUTH0_CONFIG.logoutUri}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Scope</Text>
            <Text style={styles.infoValSmall}>{AUTH0_CONFIG.scope}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>API Audience</Text>
            <Text style={styles.infoValSmall}>{AUTH0_CONFIG.audience}</Text>
          </View>

          {isAuthenticated && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.inspectTokenButton}
                activeOpacity={0.8}
                onPress={handleInspectTokens}
              >
                <Text style={styles.inspectTokenButtonText}>🔍 Inspect Auth Tokens & Claims</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Remote /userinfo OIDC Verification */}
        <Text style={styles.sectionHeader}>Remote Credential Call (GET /userinfo)</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Endpoint</Text>
            <Text style={styles.infoValSmall} numberOfLines={1} ellipsizeMode="middle">
              {AUTH0_CONFIG.userinfoEndpoint}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Credential</Text>
            <Text style={styles.infoVal}>Bearer Access Token</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Policy</Text>
            <Text style={styles.infoVal}>One-shot per session (Rate limit guard)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Call Status</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: userInfoData
                      ? '#10B981'
                      : userInfoMeta?.error
                      ? '#EF4444'
                      : '#F59E0B',
                  },
                ]}
              />
              <Text style={styles.infoVal}>
                {userInfoLoading
                  ? 'Fetching...'
                  : userInfoData
                  ? userInfoMeta?.fromCache
                    ? 'Served from Session Cache'
                    : 'Verified Live from IdP'
                  : userInfoMeta?.error
                  ? 'Fallback to Cached Profile'
                  : 'Awaiting Login'}
              </Text>
            </View>
          </View>

          {userInfoData && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>Subject Claim (sub)</Text>
                <Text style={styles.infoValSmall} numberOfLines={1} ellipsizeMode="middle">
                  {userInfoData.sub}
                </Text>
              </View>
              {userInfoData.email_verified !== undefined && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Email Verified</Text>
                    <Text
                      style={[
                        styles.infoVal,
                        { color: userInfoData.email_verified ? '#059669' : '#DC2626' },
                      ]}
                    >
                      {userInfoData.email_verified ? '✓ Verified (true)' : '✗ Unverified (false)'}
                    </Text>
                  </View>
                </>
              )}
              {userInfoMeta?.lastFetchedAt && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.infoRow}>
                    <Text style={styles.infoKey}>Last Synced</Text>
                    <Text style={styles.infoValSmall}>{userInfoMeta.lastFetchedAt}</Text>
                  </View>
                </>
              )}
            </>
          )}

          {isAuthenticated && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={[styles.inspectTokenButton, { backgroundColor: '#F0FDF4' }]}
                activeOpacity={0.8}
                onPress={() => loadUserInfo(true)}
                disabled={userInfoLoading}
              >
                {userInfoLoading ? (
                  <ActivityIndicator size="small" color="#059669" />
                ) : (
                  <Text style={[styles.inspectTokenButtonText, { color: '#059669' }]}>
                    🔄 Refresh /userinfo (One-shot)
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
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
              onValueChange={handleToggleBiometric}
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
            onPress={handleTestBiometric}
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

        {/* Identity & Database Meta */}
        <Text style={styles.sectionHeader}>Database & Device Storage</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Active User ID / Sub</Text>
            <Text style={styles.infoValSmall} numberOfLines={1} ellipsizeMode="middle">
              {profile?.id}
            </Text>
          </View>
          <View style={styles.divider} />
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

        {/* Developer Actions */}
        <TouchableOpacity
          style={styles.dangerButton}
          activeOpacity={0.8}
          onPress={handleResetDatabase}
        >
          <Text style={styles.dangerButtonText}>🔄 Reset Local SQLite Database</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Edit Local Profile</Text>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Full Name"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="Email"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Role / Title</Text>
            <TextInput
              style={styles.input}
              value={editRole}
              onChangeText={setEditRole}
              placeholder="Role or Title"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setIsEditModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSaveBtn]}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                <Text style={styles.modalSaveBtnText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Inspect Tokens Modal */}
      <Modal
        visible={isTokenModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsTokenModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Auth0 Tokens & Claims</Text>

            <ScrollView style={{ maxHeight: 350 }}>
              <Text style={styles.inputLabel}>Token Type</Text>
              <Text style={styles.tokenValueText}>{tokensInfo?.tokenType || 'Bearer'}</Text>

              <Text style={styles.inputLabel}>Expires In</Text>
              <Text style={styles.tokenValueText}>
                {tokensInfo?.expiresIn ? `${tokensInfo.expiresIn} seconds` : 'N/A'}
              </Text>

              <Text style={styles.inputLabel}>Granted Scopes</Text>
              <Text style={styles.tokenValueText}>{tokensInfo?.scope || AUTH0_CONFIG.scope}</Text>

              <Text style={styles.inputLabel}>Access Token</Text>
              <View style={styles.tokenBox}>
                <Text style={styles.tokenMonoText} selectable>
                  {tokensInfo?.accessToken || 'Not retrieved'}
                </Text>
              </View>

              {tokensInfo?.idToken && (
                <>
                  <Text style={styles.inputLabel}>ID Token</Text>
                  <View style={styles.tokenBox}>
                    <Text style={styles.tokenMonoText} selectable>
                      {tokensInfo.idToken}
                    </Text>
                  </View>
                </>
              )}

              {userInfoData && (
                <>
                  <Text style={styles.inputLabel}>Decoded /userinfo Claims (Remote Call Result)</Text>
                  <View style={styles.tokenBox}>
                    <Text style={styles.tokenMonoText} selectable>
                      {JSON.stringify(userInfoData, null, 2)}
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalBtn, styles.modalSaveBtn, { marginTop: 16 }]}
              onPress={() => setIsTokenModalVisible(false)}
            >
              <Text style={styles.modalSaveBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    padding: 20,
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
  editProfileBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  editProfileBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
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
  inspectTokenButton: {
    marginTop: 10,
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  inspectTokenButtonText: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 14,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelBtn: {
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    color: '#475569',
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: '#4F46E5',
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tokenValueText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1E293B',
    marginBottom: 12,
  },
  tokenBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  tokenMonoText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#334155',
  },
});
