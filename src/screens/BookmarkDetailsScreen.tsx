import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth0 } from 'react-native-auth0';
import type { RootStackScreenProps } from '../navigation/types';
import {
  Bookmark,
  Collection,
  getBookmarkById,
  updateBookmark,
  deleteBookmark,
  getCollections,
  UpdateBookmarkInput,
  CURRENT_USER,
} from '../db';
import { AddEditBookmarkModal } from '../components';

export const BookmarkDetailsScreen: React.FC<
  RootStackScreenProps<'BookmarkDetails'>
> = ({ route, navigation }) => {
  const { bookmarkId } = route.params;
  const db = useSQLiteContext();
  const { user: auth0User } = useAuth0();

  const [bookmark, setBookmark] = useState<Bookmark | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  const activeUserId = auth0User?.sub || CURRENT_USER.id;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [bm, cols] = await Promise.all([
        getBookmarkById(db, bookmarkId),
        getCollections(db, { ownerId: activeUserId }),
      ]);
      setBookmark(bm);
      setCollections(cols);
    } catch (error) {
      console.error('Error loading bookmark details:', error);
    } finally {
      setLoading(false);
    }
  }, [db, bookmarkId, activeUserId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleOpenUrl = async () => {
    if (!bookmark?.url) return;
    try {
      const supported = await Linking.canOpenURL(bookmark.url);
      if (supported) {
        await Linking.openURL(bookmark.url);
      } else {
        Alert.alert('Cannot Open URL', `Unable to handle URL: ${bookmark.url}`);
      }
    } catch (err) {
      Alert.alert('Error', 'An error occurred while opening the link.');
    }
  };

  const handleUpdateBookmark = async (data: UpdateBookmarkInput) => {
    await updateBookmark(db, bookmarkId, data);
    await loadData();
  };

  const handleDeleteBookmark = () => {
    Alert.alert(
      'Delete Bookmark',
      `Are you sure you want to delete "${bookmark?.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteBookmark(db, bookmarkId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  if (loading && !bookmark) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </SafeAreaView>
    );
  }

  if (!bookmark) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>Bookmark not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.badgeRow}>
            {bookmark.collectionName ? (
              <View
                style={[
                  styles.collectionBadge,
                  { backgroundColor: `${bookmark.collectionColor || '#4F46E5'}1A` },
                ]}
              >
                <View
                  style={[
                    styles.collectionDot,
                    { backgroundColor: bookmark.collectionColor || '#4F46E5' },
                  ]}
                />
                <Text
                  style={[
                    styles.collectionBadgeText,
                    { color: bookmark.collectionColor || '#4F46E5' },
                  ]}
                >
                  {bookmark.collectionName}
                </Text>
              </View>
            ) : (
              <View style={styles.unassignedBadge}>
                <Text style={styles.unassignedBadgeText}>Unassigned Collection</Text>
              </View>
            )}

            <Text style={styles.idLabel}>ID: {bookmark.id}</Text>
          </View>

          <Text style={styles.title}>{bookmark.title}</Text>

          <TouchableOpacity
            style={styles.urlContainer}
            activeOpacity={0.7}
            onPress={handleOpenUrl}
          >
            <Text style={styles.urlText} numberOfLines={2}>
              🌐 {bookmark.url}
            </Text>
          </TouchableOpacity>

          {bookmark.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes & Context</Text>
              <Text style={styles.notesText}>{bookmark.notes}</Text>
            </View>
          ) : null}

          <View style={styles.metaContainer}>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Owner ID</Text>
              <Text style={styles.metaVal}>{bookmark.ownerId}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Created At</Text>
              <Text style={styles.metaVal}>
                {new Date(bookmark.createdAt).toLocaleString()}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Last Updated</Text>
              <Text style={styles.metaVal}>
                {new Date(bookmark.updatedAt).toLocaleString()}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={handleOpenUrl}
          >
            <Text style={styles.primaryButtonText}>Open in Browser ↗</Text>
          </TouchableOpacity>

          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.editBtn]}
              onPress={() => setIsEditModalVisible(true)}
            >
              <Text style={styles.editBtnText}>✏️ Edit Bookmark</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={handleDeleteBookmark}
            >
              <Text style={styles.deleteBtnText}>🗑️ Delete Bookmark</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <AddEditBookmarkModal
        visible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        onSave={handleUpdateBookmark}
        bookmarkToEdit={bookmark}
        collections={collections}
        defaultCollectionId={bookmark.collectionId}
      />
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
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  collectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 6,
  },
  collectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  collectionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  unassignedBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  unassignedBadgeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  idLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 28,
    marginBottom: 12,
  },
  urlContainer: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 16,
  },
  urlText: {
    fontSize: 14,
    color: '#0284C7',
    fontWeight: '500',
  },
  notesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  metaContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    gap: 8,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaKey: {
    fontSize: 12,
    color: '#64748B',
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  editBtn: {
    backgroundColor: '#EEF2FF',
  },
  editBtnText: {
    color: '#4F46E5',
    fontWeight: '600',
    fontSize: 14,
  },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
  },
  deleteBtnText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  backButton: {
    marginTop: 16,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
