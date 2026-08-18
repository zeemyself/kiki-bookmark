import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth0 } from 'react-native-auth0';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RootStackScreenProps } from '../navigation/types';
import {
  Collection,
  Bookmark,
  getCollectionById,
  getBookmarks,
  updateCollection,
  deleteCollection,
  createBookmark,
  UpdateCollectionInput,
  CreateBookmarkInput,
  getCollections,
  CURRENT_USER,
} from '../db';
import { AddEditCollectionModal, AddEditBookmarkModal } from '../components';

export const CollectionDetailsScreen: React.FC<
  RootStackScreenProps<'CollectionDetails'>
> = ({ route, navigation }) => {
  const { collectionId } = route.params;
  const db = useSQLiteContext();
  const queryClient = useQueryClient();
  const { user: auth0User } = useAuth0();

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isAddBookmarkModalVisible, setIsAddBookmarkModalVisible] = useState(false);

  const activeUserId = auth0User?.sub || CURRENT_USER.id;

  // Query: Collection details
  const {
    data: collection,
    isLoading: isCollectionLoading,
  } = useQuery({
    queryKey: ['collection', collectionId],
    queryFn: async () => {
      return getCollectionById(db, collectionId);
    },
  });

  // Query: Bookmarks within this collection
  const {
    data: bookmarks = [],
    isLoading: isBookmarksLoading,
  } = useQuery({
    queryKey: ['bookmarks', { collectionId, ownerId: activeUserId }],
    queryFn: async () => {
      return getBookmarks(db, { collectionId, ownerId: activeUserId });
    },
  });

  // Query: All collections (for modal/navigation)
  const { data: allCollections = [] } = useQuery({
    queryKey: ['collections', { ownerId: activeUserId }],
    queryFn: async () => {
      return getCollections(db, { ownerId: activeUserId });
    },
  });

  // Mutation: Update Collection
  const updateCollectionMutation = useMutation({
    mutationFn: async (data: UpdateCollectionInput) => {
      return updateCollection(db, collectionId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });

  // Mutation: Delete Collection
  const deleteCollectionMutation = useMutation({
    mutationFn: async () => {
      return deleteCollection(db, collectionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
      navigation.goBack();
    },
  });

  // Mutation: Create Bookmark in this collection
  const createBookmarkMutation = useMutation({
    mutationFn: async (data: CreateBookmarkInput) => {
      return createBookmark(db, {
        ...data,
        collectionId,
        ownerId: activeUserId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['collection', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
    },
  });

  const handleUpdateCollection = async (data: UpdateCollectionInput) => {
    await updateCollectionMutation.mutateAsync(data);
  };

  const handleDeleteCollection = () => {
    Alert.alert(
      'Delete Collection',
      `Are you sure you want to delete "${collection?.name}"? Bookmarks inside will remain as unassigned.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteCollectionMutation.mutate();
          },
        },
      ]
    );
  };

  const handleCreateBookmark = async (data: CreateBookmarkInput) => {
    await createBookmarkMutation.mutateAsync(data);
  };

  const renderBookmarkItem = ({ item }: { item: Bookmark }) => (
    <TouchableOpacity
      style={styles.bookmarkCard}
      activeOpacity={0.7}
      onPress={() =>
        navigation.navigate('BookmarkDetails', {
          bookmarkId: item.id,
        })
      }
    >
      <Text style={styles.bookmarkTitle}>{item.title}</Text>
      <Text style={styles.bookmarkUrl} numberOfLines={1}>
        {item.url}
      </Text>
      {item.notes ? (
        <Text style={styles.bookmarkNotes} numberOfLines={2}>
          {item.notes}
        </Text>
      ) : null}
      <View style={styles.bookmarkFooter}>
        <Text style={styles.dateText}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
        <Text style={styles.viewMoreText}>Details →</Text>
      </View>
    </TouchableOpacity>
  );

  const loading = isCollectionLoading || isBookmarksLoading;

  if (loading && !collection) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['bottom', 'left', 'right']}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </SafeAreaView>
    );
  }

  if (!collection) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['bottom', 'left', 'right']}>
        <Text style={styles.emptyTitle}>Collection not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const collectionColor = collection.color || '#4F46E5';

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={bookmarks}
        keyExtractor={(item) => item.id}
        renderItem={renderBookmarkItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.topInfo}>
              <View
                style={[
                  styles.colorIndicator,
                  { backgroundColor: collectionColor },
                ]}
              />
              <Text style={styles.collectionName}>{collection.name}</Text>
            </View>

            {collection.description ? (
              <Text style={styles.description}>{collection.description}</Text>
            ) : null}

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Owner</Text>
                <Text style={styles.metaValue}>{collection.ownerId}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Bookmarks</Text>
                <Text style={styles.metaValue}>{bookmarks.length}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Created</Text>
                <Text style={styles.metaValue}>
                  {new Date(collection.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[styles.btn, styles.editBtn]}
                onPress={() => setIsEditModalVisible(true)}
              >
                <Text style={styles.editBtnText}>✏️ Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.deleteBtn]}
                onPress={handleDeleteCollection}
              >
                <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.addBmBtn]}
                onPress={() => setIsAddBookmarkModalVisible(true)}
              >
                <Text style={styles.addBmBtnText}>+ Bookmark</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>
              Bookmarks in this Collection ({bookmarks.length})
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No bookmarks yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap '+ Bookmark' above to save your first link to this collection.
            </Text>
          </View>
        }
      />

      <AddEditCollectionModal
        visible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        onSave={handleUpdateCollection}
        collectionToEdit={collection}
      />

      <AddEditBookmarkModal
        visible={isAddBookmarkModalVisible}
        onClose={() => setIsAddBookmarkModalVisible(false)}
        onSave={handleCreateBookmark}
        collections={allCollections}
        defaultCollectionId={collectionId}
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
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  topInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  colorIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  collectionName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  description: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: {
    backgroundColor: '#EEF2FF',
  },
  editBtnText: {
    color: '#4F46E5',
    fontWeight: '600',
    fontSize: 13,
  },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
  },
  deleteBtnText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 13,
  },
  addBmBtn: {
    backgroundColor: '#4F46E5',
  },
  addBmBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 20,
    marginBottom: 4,
  },
  bookmarkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  bookmarkTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  bookmarkUrl: {
    fontSize: 13,
    color: '#0EA5E9',
    marginBottom: 8,
  },
  bookmarkNotes: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 10,
  },
  bookmarkFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
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
