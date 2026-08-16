import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth0 } from 'react-native-auth0';
import type { RootStackScreenProps } from '../navigation/types';
import {
  Bookmark,
  Collection,
  UserProfile,
  getBookmarks,
  getCollections,
  getUserProfile,
  upsertUserProfile,
  createBookmark,
  createCollection,
  CreateBookmarkInput,
  CreateCollectionInput,
  CURRENT_USER,
} from '../db';
import { AddEditBookmarkModal, AddEditCollectionModal } from '../components';

type TabType = 'bookmarks' | 'collections';

export const HomeScreen: React.FC<RootStackScreenProps<'Home'>> = ({
  navigation,
}) => {
  const db = useSQLiteContext();
  const { user: auth0User } = useAuth0();

  const [activeTab, setActiveTab] = useState<TabType>('bookmarks');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<string | 'all' | 'unassigned'>('all');

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [isAddBookmarkModalVisible, setIsAddBookmarkModalVisible] = useState(false);
  const [isAddCollectionModalVisible, setIsAddCollectionModalVisible] = useState(false);

  const activeUserId = auth0User?.sub || CURRENT_USER.id;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      let colFilter: string | null | undefined = undefined;
      if (selectedCollectionFilter === 'unassigned') {
        colFilter = null;
      } else if (selectedCollectionFilter !== 'all') {
        colFilter = selectedCollectionFilter;
      }

      const [bms, cols, userRecord] = await Promise.all([
        getBookmarks(db, {
          search: searchQuery,
          collectionId: colFilter,
          ownerId: activeUserId,
        }),
        getCollections(db, {
          search: activeTab === 'collections' ? searchQuery : undefined,
          ownerId: activeUserId,
        }),
        getUserProfile(db, activeUserId),
      ]);

      setBookmarks(bms);
      setCollections(cols);

      if (userRecord) {
        setProfile(userRecord);
      } else if (auth0User) {
        const newProfile: UserProfile = {
          id: auth0User.sub,
          name: auth0User.name || auth0User.nickname || 'Auth0 User',
          email: auth0User.email || '',
          role: 'Auth0 Member',
          avatarColor: '#10B981',
          joinedAt: new Date().toISOString(),
        };
        await upsertUserProfile(db, newProfile);
        setProfile(newProfile);
      } else {
        setProfile(CURRENT_USER);
      }
    } catch (err) {
      console.error('Error loading home screen data from SQLite:', err);
    } finally {
      setLoading(false);
    }
  }, [db, searchQuery, selectedCollectionFilter, activeTab, activeUserId, auth0User]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleCreateBookmark = async (data: CreateBookmarkInput) => {
    await createBookmark(db, { ...data, ownerId: activeUserId });
    await loadData();
  };

  const handleCreateCollection = async (data: CreateCollectionInput) => {
    await createCollection(db, { ...data, ownerId: activeUserId });
    await loadData();
  };

  const initials = (auth0User?.name || profile?.name || 'KU')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  const renderBookmarkItem = ({ item }: { item: Bookmark }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() =>
        navigation.navigate('BookmarkDetails', {
          bookmarkId: item.id,
        })
      }
    >
      <View style={styles.cardHeader}>
        {item.collectionName ? (
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: `${item.collectionColor || '#4F46E5'}1A` },
            ]}
          >
            <View
              style={[
                styles.badgeDot,
                { backgroundColor: item.collectionColor || '#4F46E5' },
              ]}
            />
            <Text
              style={[
                styles.categoryBadgeText,
                { color: item.collectionColor || '#4F46E5' },
              ]}
            >
              {item.collectionName}
            </Text>
          </View>
        ) : (
          <View style={styles.unassignedBadge}>
            <Text style={styles.unassignedBadgeText}>Unassigned</Text>
          </View>
        )}
        <Text style={styles.dateLabel}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>

      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardUrl} numberOfLines={1}>
        {item.url}
      </Text>

      {item.notes ? (
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.notes}
        </Text>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.viewMoreText}>View details →</Text>
      </View>
    </TouchableOpacity>
  );

  const renderCollectionItem = ({ item }: { item: Collection }) => {
    const colColor = item.color || '#4F46E5';
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('CollectionDetails', {
            collectionId: item.id,
          })
        }
      >
        <View style={styles.cardHeader}>
          <View style={styles.collectionTitleRow}>
            <View style={[styles.colorPill, { backgroundColor: colColor }]} />
            <Text style={styles.collectionCardTitle}>{item.name}</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {item.bookmarkCount ?? 0} {item.bookmarkCount === 1 ? 'link' : 'links'}
            </Text>
          </View>
        </View>

        {item.description ? (
          <Text style={styles.cardDescription} numberOfLines={2}>
            {item.description}
          </Text>
        ) : (
          <Text style={styles.cardNoDescription}>No description provided.</Text>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.dateLabel}>
            Created {new Date(item.createdAt).toLocaleDateString()}
          </Text>
          <Text style={styles.viewMoreText}>Manage →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.title}>{profile?.name || 'Kiki Vance'}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.profileAvatarButton,
            { backgroundColor: auth0User ? '#10B981' : (profile?.avatarColor || '#4F46E5') },
          ]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Profile')}
        >
          {auth0User?.picture ? (
            <Image
              source={{ uri: auth0User.picture }}
              style={styles.profileAvatarImage}
            />
          ) : (
            <Text style={styles.profileAvatarText}>{initials}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bookmarks' && styles.tabActive]}
          onPress={() => setActiveTab('bookmarks')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'bookmarks' && styles.tabTextActive,
            ]}
          >
            Bookmarks ({bookmarks.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'collections' && styles.tabActive]}
          onPress={() => setActiveTab('collections')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'collections' && styles.tabTextActive,
            ]}
          >
            Collections ({collections.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={
            activeTab === 'bookmarks'
              ? 'Search by title, url, or notes...'
              : 'Search collections...'
          }
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter Chips for Bookmarks */}
      {activeTab === 'bookmarks' ? (
        <View style={styles.filtersWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsContainer}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedCollectionFilter === 'all' && styles.filterChipActive,
              ]}
              onPress={() => setSelectedCollectionFilter('all')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCollectionFilter === 'all' &&
                    styles.filterChipTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedCollectionFilter === 'unassigned' &&
                  styles.filterChipActive,
              ]}
              onPress={() => setSelectedCollectionFilter('unassigned')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCollectionFilter === 'unassigned' &&
                    styles.filterChipTextActive,
                ]}
              >
                Unassigned
              </Text>
            </TouchableOpacity>

            {collections.map((col) => {
              const isSelected = selectedCollectionFilter === col.id;
              return (
                <TouchableOpacity
                  key={col.id}
                  style={[
                    styles.filterChip,
                    isSelected && {
                      backgroundColor: col.color || '#4F46E5',
                      borderColor: col.color || '#4F46E5',
                    },
                  ]}
                  onPress={() => setSelectedCollectionFilter(col.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextActive,
                    ]}
                  >
                    {col.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Action Header Banner */}
      <View style={styles.subHeader}>
        <Text style={styles.subHeaderTitle}>
          {activeTab === 'bookmarks' ? 'Saved Bookmarks' : 'Your Collections'}
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.8}
          onPress={() => {
            if (activeTab === 'bookmarks') {
              setIsAddBookmarkModalVisible(true);
            } else {
              setIsAddCollectionModalVisible(true);
            }
          }}
        >
          <Text style={styles.addButtonText}>
            {activeTab === 'bookmarks' ? '+ New Bookmark' : '+ New Collection'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading && (bookmarks.length === 0 && collections.length === 0) ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : activeTab === 'bookmarks' ? (
        <FlatList
          data={bookmarks}
          keyExtractor={(item) => item.id}
          renderItem={renderBookmarkItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Bookmarks Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'No results match your search query.'
                  : 'Start saving links on-device by tapping "+ New Bookmark".'}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id}
          renderItem={renderCollectionItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Collections Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'No collections match your search query.'
                  : 'Organize your bookmarks by creating a collection.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Modals */}
      <AddEditBookmarkModal
        visible={isAddBookmarkModalVisible}
        onClose={() => setIsAddBookmarkModalVisible(false)}
        onSave={handleCreateBookmark}
        collections={collections}
        defaultCollectionId={
          selectedCollectionFilter !== 'all' && selectedCollectionFilter !== 'unassigned'
            ? selectedCollectionFilter
            : undefined
        }
      />

      <AddEditCollectionModal
        visible={isAddCollectionModalVisible}
        onClose={() => setIsAddCollectionModalVisible(false)}
        onSave={handleCreateCollection}
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
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  profileAvatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0F172A',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  filtersWrapper: {
    marginTop: 10,
  },
  filterChipsContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  subHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  addButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  unassignedBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unassignedBadgeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  collectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  colorPill: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  collectionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  countBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  cardUrl: {
    fontSize: 13,
    color: '#0284C7',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 8,
  },
  cardNoDescription: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    paddingTop: 8,
  },
  dateLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
