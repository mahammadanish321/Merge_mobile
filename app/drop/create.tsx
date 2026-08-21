import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Flame,
  Image as ImageIcon,
  X,
  Send,
  Sparkles,
  Users,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';

export default function CreateDropScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('All'); // 'All' or 'My Year'
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const pickImages = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow photo gallery permissions to attach images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImages((prev) => [...prev, ...result.assets]);
      }
    } catch (err) {
      console.error('Image picking error:', err);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title for your notice.');
      return;
    }

    setSubmitting(true);
    try {
      let uploadedMedia: any[] = [];

      // If images selected, upload them first
      if (selectedImages.length > 0) {
        const formData = new FormData();
        selectedImages.forEach((img, idx) => {
          const uri = img.uri;
          const name = uri.split('/').pop() || `drop_media_${idx}.jpg`;
          const match = /\.(\w+)$/.exec(name);
          const type = match ? `image/${match[1]}` : 'image/jpeg';

          // @ts-ignore
          formData.append('files', {
            uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
            name,
            type,
          });
        });

        const uploadRes = await api.post('/drops/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (uploadRes.data?.files) {
          uploadedMedia = uploadRes.data.files;
        } else if (uploadRes.data?.url) {
          uploadedMedia = [{ url: uploadRes.data.url, fileName: uploadRes.data.fileName || '' }];
        }
      }

      // Create Drop
      await api.post('/drops', {
        title: title.trim(),
        body: description.trim(),
        description: description.trim(),
        media_urls: uploadedMedia.length > 0 ? uploadedMedia : undefined,
        year: targetAudience === 'My Year' ? user?.year : undefined,
        stream: targetAudience === 'My Year' ? user?.stream : undefined,
      });

      Alert.alert('Success', 'Drop published to notice board!', [
        {
          text: 'OK',
          onPress: () => {
            router.replace('/(tabs)/drop' as any);
          },
        },
      ]);
    } catch (err: any) {
      console.error('Create drop error:', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to publish drop.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>New Drop</Text>
          <Text style={styles.headerSubtitle}>Publish to campus feed</Text>
        </View>
        <TouchableOpacity
          style={[styles.publishBtn, submitting && styles.publishBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Send size={16} color="#fff" />
              <Text style={styles.publishBtnText}>Post</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Audience Selector (if student has year/stream) */}
        {user?.year && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Audience</Text>
            <View style={styles.audienceRow}>
              <TouchableOpacity
                style={[styles.audienceChip, targetAudience === 'All' && styles.audienceChipActive]}
                onPress={() => setTargetAudience('All')}
              >
                <Users size={14} color={targetAudience === 'All' ? '#fff' : '#64748b'} />
                <Text
                  style={[
                    styles.audienceChipText,
                    targetAudience === 'All' && styles.audienceChipTextActive,
                  ]}
                >
                  Entire Campus
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.audienceChip, targetAudience === 'My Year' && styles.audienceChipActive]}
                onPress={() => setTargetAudience('My Year')}
              >
                <Sparkles size={14} color={targetAudience === 'My Year' ? '#fff' : '#64748b'} />
                <Text
                  style={[
                    styles.audienceChipText,
                    targetAudience === 'My Year' && styles.audienceChipTextActive,
                  ]}
                >
                  Year {user.year} • {user.stream || 'Class'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Title Input */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Title *</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="Give your notice a clear, concise headline..."
            placeholderTextColor="#94a3b8"
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
        </View>

        {/* Description Input */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Details & Info</Text>
          <TextInput
            style={styles.descInput}
            placeholder="Share full details, dates, venues, instructions, or links..."
            placeholderTextColor="#94a3b8"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Media Attachments Section */}
        <View style={styles.section}>
          <View style={styles.mediaHeaderRow}>
            <Text style={styles.sectionLabel}>Attached Images</Text>
            <TouchableOpacity style={styles.addMediaBtn} onPress={pickImages}>
              <ImageIcon size={16} color="#105934" />
              <Text style={styles.addMediaBtnText}>Add Photo</Text>
            </TouchableOpacity>
          </View>

          {selectedImages.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaPreviewScroll}>
              {selectedImages.map((img, idx) => (
                <View key={idx} style={styles.previewImageContainer}>
                  <Image source={{ uri: img.uri }} style={styles.previewThumbnail} />
                  <TouchableOpacity style={styles.removeMediaChip} onPress={() => removeImage(idx)}>
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity style={styles.mediaUploadPlaceholder} onPress={pickImages}>
              <ImageIcon size={28} color="#94a3b8" />
              <Text style={styles.mediaUploadPlaceholderText}>Attach campus posters, schedules, or photos</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  publishBtn: {
    backgroundColor: '#105934',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  publishBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  publishBtnText: {
    color: '#fff',
    fontSize: 13.5,
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  audienceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  audienceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  audienceChipActive: {
    backgroundColor: '#105934',
    borderColor: '#105934',
  },
  audienceChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  audienceChipTextActive: {
    color: '#fff',
  },
  titleInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  descInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#334155',
    minHeight: 120,
  },
  mediaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addMediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
  },
  addMediaBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#105934',
  },
  mediaPreviewScroll: {
    marginTop: 6,
  },
  previewImageContainer: {
    position: 'relative',
    marginRight: 10,
  },
  previewThumbnail: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  removeMediaChip: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  mediaUploadPlaceholder: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
  },
  mediaUploadPlaceholderText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
});
