import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
} from 'react-native';
import type { RootStackScreenProps } from '../navigation/types';

interface BookmarkItem {
  id: string;
  title: string;
  category: string;
  description: string;
}

const SAMPLE_BOOKMARKS: BookmarkItem[] = [
  {
    id: '1',
    title: 'React Navigation Documentation',
    category: 'Development',
    description: 'Learn how to route and navigate across native screens seamlessly.',
  },
  {
    id: '2',
    title: 'Expo SDK Guides',
    category: 'Ecosystem',
    description: 'Comprehensive guides for modern React Native development.',
  },
  {
    id: '3',
    title: 'TypeScript Deep Dive',
    category: 'Language',
    description: 'Master type-safe React Native components and navigation params.',
  },
];

export const HomeScreen: React.FC<RootStackScreenProps<'Home'>> = ({
  navigation,
}) => {
  const renderItem = ({ item }: { item: BookmarkItem }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() =>
        navigation.navigate('Details', {
          itemId: item.id,
          title: item.title,
          description: item.description,
        })
      }
    >
      <View style={styles.cardHeader}>
        <Text style={styles.categoryBadge}>{item.category}</Text>
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardDescription} numberOfLines={2}>
        {item.description}
      </Text>
      <Text style={styles.viewMoreText}>View details →</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={SAMPLE_BOOKMARKS}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.greeting}>Welcome to</Text>
            <Text style={styles.title}>Kiki Bookmark</Text>
            <Text style={styles.subtitle}>
              React Native + TypeScript + React Navigation
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    padding: 20,
    gap: 16,
  },
  header: {
    marginBottom: 12,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  categoryBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  viewMoreText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
});
