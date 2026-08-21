import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  Platform,
  Share,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Flame,
  Plus,
  ArrowBigUp,
  ArrowBigDown,
  MessageCircle,
  Clock,
  Trash2,
  Paperclip,
  Share2,
  Check,
  MoreVertical,
  Bookmark,
  BookmarkCheck,
  RotateCcw,
  EyeOff,
  Eye,
  Globe,
  User,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { SwipeWrapper } from '../../src/components/SwipeWrapper';

const { width } = Dimensions.get('window');

export const timeAgo = (dateString: string) => {
  if (!dateString) return 'just now';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

export const parseMediaItems = (item: any) => {
  if (!item) return [];
  let items: any[] = [];
  if (item.media_urls) {
    let parsed = item.media_urls;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch (e) {
        parsed = [];
      }
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      items = parsed.map((m) => (typeof m === 'string' ? { url: m, fileName: '' } : m));
    }
  }
  if (items.length === 0 && item.media_url) {
    items.push({ url: item.media_url, fileName: item.file_name || '' });
  }
  return items;
};

export default function DropScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [drops, setDrops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewFilter, setViewFilter] = useState<'all' | 'my_posts' | 'saved' | 'deleted' | 'hidden'>('all');

  // Saved Drop IDs locally
  const [savedDropIds, setSavedDropIds] = useState<string[]>([]);

  // Menu Sheet State
  const [activeMenuDrop, setActiveMenuDrop] = useState<any>(null);

  // Load Saved Drops from Storage
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('saved_drop_ids');
        if (saved) setSavedDropIds(JSON.parse(saved));
      } catch (e) {}
    })();
  }, []);

  const fetchDrops = async () => {
    try {
      const params: any = {};

      if (viewFilter === 'my_posts') {
        params.my_posts = 'true';
      } else if (viewFilter === 'deleted') {
        params.deleted = 'true';
      } else if (viewFilter === 'hidden') {
        params.hidden_admin = 'true';
      }

      const res = await api.get('/drops', { params });
      let list = res.data?.drops || (Array.isArray(res.data) ? res.data : []);

      if (viewFilter === 'saved') {
        list = list.filter((d: any) => savedDropIds.includes(String(d.id)));
      }

      setDrops(list);
    } catch (error) {
      console.error('Failed to load drops:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDrops();
  }, [viewFilter, savedDropIds.length]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDrops();
  }, [viewFilter]);

  const handleVote = async (dropId: string | number, voteType: 'up' | 'down') => {
    try {
      let targetVote = 0;

      setDrops((prev) =>
        prev.map((drop) => {
          if (String(drop.id) !== String(dropId)) return drop;

          const currentVote = Number(drop.user_vote) || 0;
          let newVote = 0;
          let scoreDiff = 0;

          if (voteType === 'up') {
            if (currentVote === 1) {
              newVote = 0;
              scoreDiff = -1;
            } else {
              newVote = 1;
              scoreDiff = currentVote === -1 ? 2 : 1;
            }
          } else {
            if (currentVote === -1) {
              newVote = 0;
              scoreDiff = 1;
            } else {
              newVote = -1;
              scoreDiff = currentVote === 1 ? -2 : -1;
            }
          }
          targetVote = newVote;

          const currentScore = parseInt(drop.score ?? drop.vote_score, 10) || 0;
          return {
            ...drop,
            user_vote: newVote,
            score: currentScore + scoreDiff,
            vote_score: currentScore + scoreDiff,
          };
        })
      );

      await api.post(`/drops/${dropId}/vote`, { vote: targetVote });
    } catch (err) {
      console.error('Vote failed:', err);
      fetchDrops(); // Rollback on failure
    }
  };

  const handleToggleSave = async (drop: any) => {
    try {
      const dropIdStr = String(drop.id);
      let updated: string[] = [];
      if (savedDropIds.includes(dropIdStr)) {
        updated = savedDropIds.filter((id) => id !== dropIdStr);
      } else {
        updated = [...savedDropIds, dropIdStr];
      }
      setSavedDropIds(updated);
      await AsyncStorage.setItem('saved_drop_ids', JSON.stringify(updated));
      setActiveMenuDrop(null);
    } catch (err) {
      console.error('Failed to save drop:', err);
    }
  };

  const handleShare = async (drop: any) => {
    try {
      setActiveMenuDrop(null);
      await Share.share({
        title: drop.title,
        message: `📢 *${drop.title}*\n\n${drop.body || drop.description || ''}`,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleDelete = async (dropId: string | number) => {
    setActiveMenuDrop(null);
    Alert.alert('Delete Drop', 'Are you sure you want to delete this notice?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/drops/${dropId}`);
            setDrops((prev) => prev.filter((d) => String(d.id) !== String(dropId)));
          } catch (err) {
            Alert.alert('Error', 'Failed to delete drop');
          }
        },
      },
    ]);
  };

  const handleRestore = async (dropId: string | number) => {
    setActiveMenuDrop(null);
    try {
      await api.post(`/drops/${dropId}/restore`);
      setDrops((prev) => prev.filter((d) => String(d.id) !== String(dropId)));
      Alert.alert('Restored', 'Notice restored successfully!');
    } catch (err) {
      Alert.alert('Error', 'Failed to restore drop');
    }
  };

  const handleToggleHideAdmin = async (dropId: string | number) => {
    setActiveMenuDrop(null);
    try {
      await api.post(`/drops/${dropId}/hide-admin`);
      fetchDrops();
    } catch (err) {
      Alert.alert('Error', 'Failed to toggle visibility');
    }
  };

  const viewTabs: Array<{ id: 'all' | 'my_posts' | 'saved' | 'deleted' | 'hidden'; label: string; icon: any }> = [
    { id: 'all', label: 'Feed', icon: Globe },
    { id: 'my_posts', label: 'My Drops', icon: User },
    { id: 'saved', label: 'Saved', icon: Bookmark },
    { id: 'deleted', label: 'Trash', icon: Trash2 },
  ];

  if (isAdmin) {
    viewTabs.push({ id: 'hidden', label: 'Hidden', icon: EyeOff });
  }

  const renderDropCard = ({ item }: { item: any }) => {
    const isOwner = item.author_id === user?.id || item.user_id === user?.id || item.author_student_id === user?.id || item.author_teacher_id === user?.id;
    const canDelete = isOwner || user?.role === 'teacher' || isAdmin;
    const isSaved = savedDropIds.includes(String(item.id));
    const attachments = parseMediaItems(item);
    const images = attachments.filter((a) => {
      const url = a.url?.toLowerCase() || '';
      return url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/) || url.includes('/image/upload/');
    });

    const isUpvoted = Number(item.user_vote) === 1;
    const isDownvoted = Number(item.user_vote) === -1;
    const voteScore = parseInt(item.score ?? item.vote_score, 10) || 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/drop/${item.id}` as any)}
        activeOpacity={0.9}
      >
        {/* Card Header: Author info & 3-dot Menu */}
        <View style={styles.cardHeader}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item.author_name || item.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorName}>{item.author_name || item.name || 'Anonymous'}</Text>
                {item.author_role && (
                  <View style={[styles.roleBadge, item.author_role === 'teacher' ? styles.teacherBadge : item.author_role === 'admin' ? styles.adminBadge : styles.studentBadge]}>
                    <Text style={styles.roleBadgeText}>{item.author_role}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.timestamp}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>

          <TouchableOpacity 
            onPress={(e) => {
              e.stopPropagation();
              setActiveMenuDrop(item);
            }} 
            style={styles.moreBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MoreVertical size={18} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Title & Body Content */}
        <Text style={styles.title}>{item.title}</Text>
        {(item.body || item.description) ? (
          <Text style={styles.description} numberOfLines={3}>
            {item.body || item.description}
          </Text>
        ) : null}

        {/* Image Attachment Preview */}
        {images.length > 0 && (
          <View style={styles.imageGallery}>
            <Image source={{ uri: images[0].url }} style={styles.previewImage} resizeMode="cover" />
            {images.length > 1 && (
              <View style={styles.multiImageBadge}>
                <Text style={styles.multiImageText}>+{images.length - 1}</Text>
              </View>
            )}
          </View>
        )}

        {/* Action Bar */}
        <View style={styles.actionBar}>
          <View style={styles.voteContainer}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                handleVote(item.id, 'up');
              }}
              style={[styles.voteBtn, isUpvoted && styles.votedUpBtn]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ArrowBigUp
                size={22}
                color={isUpvoted ? '#105934' : '#64748b'}
                fill={isUpvoted ? '#105934' : 'transparent'}
              />
            </TouchableOpacity>

            <Text
              style={[
                styles.voteScore,
                isUpvoted && styles.voteScoreUp,
                isDownvoted && styles.voteScoreDown,
              ]}
            >
              {voteScore}
            </Text>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                handleVote(item.id, 'down');
              }}
              style={[styles.voteBtn, isDownvoted && styles.votedDownBtn]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ArrowBigDown
                size={22}
                color={isDownvoted ? '#ef4444' : '#64748b'}
                fill={isDownvoted ? '#ef4444' : 'transparent'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.rightActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={(e) => {
                e.stopPropagation();
                handleShare(item);
              }}
            >
              <Share2 size={17} color="#64748b" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={(e) => {
                e.stopPropagation();
                handleToggleSave(item);
              }}
            >
              {isSaved ? (
                <BookmarkCheck size={17} color="#105934" />
              ) : (
                <Bookmark size={17} color="#64748b" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push(`/drop/${item.id}` as any)}
            >
              <MessageCircle size={17} color="#64748b" />
              <Text style={styles.actionText}>{item.comment_count || item.comments_count || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SwipeWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.brandTitleRow}>
              <Flame size={24} color="#105934" />
              <Text style={styles.headerTitle}>Drop</Text>
            </View>
            <Text style={styles.headerSubtitle}>Campus & class notices</Text>
          </View>

          <TouchableOpacity
            style={styles.newDropBtn}
            onPress={() => router.push('/drop/create' as any)}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#fff" />
            <Text style={styles.newDropBtnText}>Drop</Text>
          </TouchableOpacity>
        </View>

        {/* View Mode Navigation Tabs (Feed, My Drops, Saved, Trash) */}
        <View style={styles.viewTabsContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={viewTabs}
            keyExtractor={(t) => t.id}
            contentContainerStyle={styles.viewTabsList}
            renderItem={({ item: tab }) => {
              const isSelected = viewFilter === tab.id;
              const IconComp = tab.icon;
              return (
                <TouchableOpacity
                  style={[styles.viewTabBtn, isSelected && styles.viewTabBtnActive]}
                  onPress={() => setViewFilter(tab.id)}
                  activeOpacity={0.7}
                >
                  <IconComp size={14} color={isSelected ? '#105934' : '#64748b'} />
                  <Text style={[styles.viewTabText, isSelected && styles.viewTabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Feed List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#105934" />
            <Text style={styles.loadingText}>Loading notices...</Text>
          </View>
        ) : drops.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Flame size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No notices found</Text>
            <Text style={styles.emptySubtitle}>
              {viewFilter === 'my_posts'
                ? "You haven't posted any notices yet."
                : viewFilter === 'saved'
                ? "You haven't saved any notices."
                : viewFilter === 'deleted'
                ? 'No deleted notices in trash.'
                : 'Be the first one to post a campus notice!'}
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => router.push('/drop/create' as any)}
            >
              <Plus size={16} color="#fff" />
              <Text style={styles.emptyActionBtnText}>Post a Notice</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={drops}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderDropCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#105934" />
            }
          />
        )}

        {/* 3-Dot Options Action Modal */}
        <Modal
          visible={activeMenuDrop !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveMenuDrop(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setActiveMenuDrop(null)}
          >
            <View style={styles.actionSheet}>
              <View style={styles.sheetHandle} />

              <Text style={styles.sheetTitle} numberOfLines={1}>
                {activeMenuDrop?.title}
              </Text>

              <TouchableOpacity
                style={styles.sheetOption}
                onPress={() => handleShare(activeMenuDrop)}
              >
                <Share2 size={18} color="#0f172a" />
                <Text style={styles.sheetOptionText}>Share Notice</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOption}
                onPress={() => handleToggleSave(activeMenuDrop)}
              >
                {savedDropIds.includes(String(activeMenuDrop?.id)) ? (
                  <>
                    <BookmarkCheck size={18} color="#105934" />
                    <Text style={[styles.sheetOptionText, { color: '#105934' }]}>Remove from Saved</Text>
                  </>
                ) : (
                  <>
                    <Bookmark size={18} color="#0f172a" />
                    <Text style={styles.sheetOptionText}>Save / Bookmark</Text>
                  </>
                )}
              </TouchableOpacity>

              {isAdmin && (
                <TouchableOpacity
                  style={styles.sheetOption}
                  onPress={() => handleToggleHideAdmin(activeMenuDrop?.id)}
                >
                  {activeMenuDrop?.is_hidden_by_admin ? (
                    <>
                      <Eye size={18} color="#0f172a" />
                      <Text style={styles.sheetOptionText}>Unhide Notice (Admin)</Text>
                    </>
                  ) : (
                    <>
                      <EyeOff size={18} color="#d97706" />
                      <Text style={[styles.sheetOptionText, { color: '#d97706' }]}>Hide Notice (Admin)</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {viewFilter === 'deleted' ? (
                <TouchableOpacity
                  style={styles.sheetOption}
                  onPress={() => handleRestore(activeMenuDrop?.id)}
                >
                  <RotateCcw size={18} color="#105934" />
                  <Text style={[styles.sheetOptionText, { color: '#105934', fontWeight: '800' }]}>
                    Restore Notice
                  </Text>
                </TouchableOpacity>
              ) : (
                (isAdmin ||
                  activeMenuDrop?.author_id === user?.id ||
                  activeMenuDrop?.user_id === user?.id ||
                  activeMenuDrop?.author_student_id === user?.id ||
                  activeMenuDrop?.author_teacher_id === user?.id) && (
                  <TouchableOpacity
                    style={[styles.sheetOption, styles.sheetOptionDestructive]}
                    onPress={() => handleDelete(activeMenuDrop?.id)}
                  >
                    <Trash2 size={18} color="#ef4444" />
                    <Text style={styles.sheetOptionDestructiveText}>Delete Notice</Text>
                  </TouchableOpacity>
                )
              )}

              <TouchableOpacity
                style={styles.sheetCancelBtn}
                onPress={() => setActiveMenuDrop(null)}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </SwipeWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
  newDropBtn: {
    backgroundColor: '#105934',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    shadowColor: '#105934',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  newDropBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  viewTabsContainer: {
    marginBottom: 14,
  },
  viewTabsList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  viewTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  viewTabBtnActive: {
    backgroundColor: '#f0fdf4',
    borderColor: 'rgba(16, 89, 52, 0.3)',
  },
  viewTabText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748b',
  },
  viewTabTextActive: {
    color: '#105934',
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
    gap: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  teacherBadge: {
    backgroundColor: '#fef3c7',
  },
  adminBadge: {
    backgroundColor: '#e0e7ff',
  },
  studentBadge: {
    backgroundColor: '#f1f5f9',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'capitalize',
  },
  timestamp: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  moreBtn: {
    padding: 6,
    borderRadius: 8,
  },
  title: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    lineHeight: 22,
  },
  description: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 12,
  },
  imageGallery: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
    height: 180,
    backgroundColor: '#f1f5f9',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  multiImageBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  multiImageText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: 10,
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    paddingHorizontal: 4,
  },
  voteBtn: {
    padding: 4,
  },
  votedUpBtn: {
    borderRadius: 8,
  },
  votedDownBtn: {
    borderRadius: 8,
  },
  voteScore: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    paddingHorizontal: 6,
  },
  voteScoreUp: {
    color: '#105934',
  },
  voteScoreDown: {
    color: '#ef4444',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 10,
  },
  emptyActionBtn: {
    backgroundColor: '#105934',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyActionBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
    gap: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
  },
  sheetOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  sheetOptionDestructive: {
    backgroundColor: '#fef2f2',
  },
  sheetOptionDestructiveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
  sheetCancelBtn: {
    marginTop: 6,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  sheetCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
});
