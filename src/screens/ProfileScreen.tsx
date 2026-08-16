import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import type { RootStackScreenProps } from '../navigation/types';
import {
  UserProfile,
  getUserProfile,
  getUserStats,
  updateUserProfile,
  CURRENT_USER,
  migrateDbIfNeeded,
} from '../db';

export const ProfileScreen: React.FC<RootStackScreenProps<'Profile'>> = ({
  navigation,
}) => {
  const db = useSQLiteContext();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<{ collectionsCount: number; bookmarksCount: number }>({
    collectionsCount: 0,
    bookmarksCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const [user, userStats] = await Promise.all([
        getUserProfile(db, CURRENT_USER.id),
        getUserStats(db, CURRENT_USER.id),
      ]);
      setProfile(user || CURRENT_USER);
      setStats(userStats);
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

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
      'This will drop all local tables and reseed initial sample collections and bookmarks.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset & Reseed',
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
              Alert.alert('Success', 'SQLite database reset and re-seeded.');
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

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </SafeAreaView>
    );
  }

  const initials = profile?.name
    ? profile.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)
    : 'KV';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarSection}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: profile?.avatarColor || '#4F46E5' },
              ]}
            >
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>Signed-in Person</Text>
            </View>
          </View>

          <Text style={styles.userName}>{profile?.name}</Text>
          <Text style={styles.userRole}>{profile?.role}</Text>
          <Text style={styles.userEmail}>{profile?.email}</Text>

          <TouchableOpacity
            style={styles.editProfileBtn}
            activeOpacity={0.8}
            onPress={openEditModal}
          >
            <Text style={styles.editProfileBtnText}>✏️ Edit Profile Info</Text>
          </TouchableOpacity>
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

        {/* Identity & Database Meta */}
        <Text style={styles.sectionHeader}>Authentication & Database Info</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>User / Owner ID</Text>
            <Text style={styles.infoVal}>{profile?.id}</Text>
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
            <Text style={styles.modalTitle}>Edit Profile</Text>

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
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 1,
  },
  badgePill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    textTransform: 'uppercase',
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
  editProfileBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
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
    paddingVertical: 8,
  },
  infoKey: {
    fontSize: 13,
    color: '#64748B',
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
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
});
