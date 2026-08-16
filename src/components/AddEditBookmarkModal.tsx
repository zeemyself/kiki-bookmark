import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Bookmark, Collection } from '../db';

export interface BookmarkFormData {
  url: string;
  title: string;
  notes?: string;
  collectionId?: string | null;
}

interface AddEditBookmarkModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: BookmarkFormData) => Promise<void>;
  bookmarkToEdit?: Bookmark | null;
  collections: Collection[];
  defaultCollectionId?: string | null;
}

export const AddEditBookmarkModal: React.FC<AddEditBookmarkModalProps> = ({
  visible,
  onClose,
  onSave,
  bookmarkToEdit,
  collections,
  defaultCollectionId,
}) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (bookmarkToEdit) {
      setTitle(bookmarkToEdit.title);
      setUrl(bookmarkToEdit.url);
      setNotes(bookmarkToEdit.notes || '');
      setSelectedCollectionId(bookmarkToEdit.collectionId || null);
    } else {
      setTitle('');
      setUrl('');
      setNotes('');
      setSelectedCollectionId(defaultCollectionId || null);
    }
    setError('');
  }, [bookmarkToEdit, defaultCollectionId, visible]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!url.trim()) {
      setError('URL is required.');
      return;
    }

    // Basic URL normalization
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      setLoading(true);
      setError('');
      await onSave({
        title: title.trim(),
        url: normalizedUrl,
        notes: notes.trim() || undefined,
        collectionId: selectedCollectionId,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save bookmark.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.modalTitle}>
              {bookmarkToEdit ? 'Edit Bookmark' : 'New Bookmark'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., SQLite Documentation"
              placeholderTextColor="#94A3B8"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>URL *</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor="#94A3B8"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.label}>Collection</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.collectionPicker}
            >
              <TouchableOpacity
                style={[
                  styles.collectionChip,
                  selectedCollectionId === null && styles.collectionChipSelected,
                ]}
                onPress={() => setSelectedCollectionId(null)}
              >
                <Text
                  style={[
                    styles.collectionChipText,
                    selectedCollectionId === null && styles.collectionChipTextSelected,
                  ]}
                >
                  Unassigned
                </Text>
              </TouchableOpacity>
              {collections.map((col) => {
                const isSelected = selectedCollectionId === col.id;
                return (
                  <TouchableOpacity
                    key={col.id}
                    style={[
                      styles.collectionChip,
                      isSelected && {
                        backgroundColor: col.color || '#4F46E5',
                        borderColor: col.color || '#4F46E5',
                      },
                    ]}
                    onPress={() => setSelectedCollectionId(col.id)}
                  >
                    <Text
                      style={[
                        styles.collectionChipText,
                        isSelected && styles.collectionChipTextSelected,
                      ]}
                    >
                      {col.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add key takeaways, shortcuts, or notes..."
              placeholderTextColor="#94A3B8"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Saving...' : bookmarkToEdit ? 'Update' : 'Save Bookmark'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeButton: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
  form: {
    marginTop: 16,
  },
  errorBanner: {
    color: '#EF4444',
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 16,
  },
  collectionPicker: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 16,
  },
  collectionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  collectionChipSelected: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  collectionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  collectionChipTextSelected: {
    color: '#FFFFFF',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: '#4F46E5',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
