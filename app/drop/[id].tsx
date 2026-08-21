import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Linking,
  Dimensions,
  Share,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Flame,
  ArrowBigUp,
  ArrowBigDown,
  MessageCircle,
  Clock,
  Trash2,
  Paperclip,
  Send,
  Download,
  Share2,
  MoreVertical,
  Bookmark,
  BookmarkCheck,
  EyeOff,
  Eye,
  RotateCcw,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { timeAgo, parseMediaItems } from '../(tabs)/drop';

const { width } = Dimensions.get('window');

export default function DropDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [drop, setDrop] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [savedDropIds, setSavedDropIds] = useState<string[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('saved_drop_ids');
        if (saved) setSavedDropIds(JSON.parse(saved));
      } catch (e) {}
    })();
  }, []);

  const fetchDropDetails = async () => {
    try {
      const res = await api.get(`/drops/${id}`);
      setDrop(res.data?.drop || res.data);
      setComments(res.data?.comments || res.data?.drop?.comments || []);
    } catch (err) {
      console.error('Failed to load drop details:', err);
      Alert.alert('Error', 'Unable to load this drop.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDropDetails();
  }, [id]);

  const handleVoteDrop = async (voteType: 'up' | 'down') => {
    if (!drop) return;
    try {
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

      const currentScore = parseInt(drop.score ?? drop.vote_score, 10) || 0;
      setDrop((prev: any) => ({
        ...prev,
        user_vote: newVote,
        score: currentScore + scoreDiff,
        vote_score: currentScore + scoreDiff,
      }));

      await api.post(`/drops/${id}/vote`, { vote: newVote });
    } catch (err) {
      console.error('Vote failed:', err);
      fetchDropDetails();
    }
  };

  const handleVoteComment = async (commentId: string | number, voteType: 'up' | 'down') => {
    try {
      let numericVote = 0;
      setComments((prev) =>
        prev.map((c) => {
          if (String(c.id) !== String(commentId)) return c;
          const currentVote = Number(c.user_vote) || 0;
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
          numericVote = newVote;

          const currentScore = parseInt(c.score ?? c.vote_score, 10) || 0;
          return {
            ...c,
            user_vote: newVote,
            score: currentScore + scoreDiff,
            vote_score: currentScore + scoreDiff,
          };
        })
      );

      await api.post(`/drops/comments/${commentId}/vote`, { vote: numericVote });
    } catch (err) {
      console.error('Comment vote failed:', err);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim()) return;

    setPostingComment(true);
    try {
      const res = await api.post(`/drops/${id}/comments`, {
        body: commentText.trim(),
        content: commentText.trim(),
      });

      setCommentText('');
      if (res.data?.comment) {
        setComments((prev) => [res.data.comment, ...prev]);
      } else {
        fetchDropDetails();
      }
    } catch (err: any) {
      console.error('Post comment error:', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  const handleToggleSave = async () => {
    if (!drop) return;
    try {
      const dropIdStr = String(drop.id);
      let updated: string[] = [];
      if (savedDropIds.includes(dropIdStr)) {
        updated = savedDropIds.filter((dId) => dId !== dropIdStr);
      } else {
        updated = [...savedDropIds, dropIdStr];
      }
      setSavedDropIds(updated);
      await AsyncStorage.setItem('saved_drop_ids', JSON.stringify(updated));
      setShowMenu(false);
    } catch (err) {
      console.error('Failed to toggle save:', err);
    }
  };

  const handleShare = async () => {
    if (!drop) return;
    try {
      setShowMenu(false);
      await Share.share({
        title: drop.title,
        message: `📢 *${drop.title}*\n\n${drop.body || drop.description || ''}`,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleDeleteDrop = () => {
    setShowMenu(false);
    Alert.alert('Delete Drop', 'Are you sure you want to delete this notice?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/drops/${id}`);
            router.replace('/(tabs)/drop' as any);
          } catch (err) {
            Alert.alert('Error', 'Failed to delete drop');
          }
        },
      },
    ]);
  };

  const handleRestoreDrop = async () => {
    setShowMenu(false);
    try {
      await api.post(`/drops/${id}/restore`);
      Alert.alert('Restored', 'Notice restored successfully!');
      fetchDropDetails();
    } catch (err) {
      Alert.alert('Error', 'Failed to restore drop');
    }
  };

  const handleToggleHideAdmin = async () => {
    setShowMenu(false);
    try {
      await api.post(`/drops/${id}/hide-admin`);
      fetchDropDetails();
    } catch (err) {
      Alert.alert('Error', 'Failed to toggle visibility');
    }
  };

  const handleDeleteComment = async (commentId: string | number) => {
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/drops/comments/${commentId}`);
            setComments((prev) => prev.filter((c) => String(c.id) !== String(commentId)));
          } catch (err) {
            Alert.alert('Error', 'Failed to delete comment');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#105934" />
        <Text style={styles.loadingText}>Loading notice...</Text>
      </View>
    );
  }

  if (!drop) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Drop not found</Text>
        <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.back()}>
          <Text style={styles.backHomeBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const attachments = parseMediaItems(drop);
  const images = attachments.filter((a) => {
    const url = a.url?.toLowerCase() || '';
    return url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/) || url.includes('/image/upload/');
  });
  const files = attachments.filter((a) => !images.includes(a));

  const isOwner =
    drop.author_id === user?.id ||
    drop.user_id === user?.id ||
    drop.author_student_id === user?.id ||
    drop.author_teacher_id === user?.id;
  const canDelete = isOwner || user?.role === 'teacher' || isAdmin;
  const isSaved = savedDropIds.includes(String(drop.id));

  const isUpvoted = Number(drop.user_vote) === 1;
  const isDownvoted = Number(drop.user_vote) === -1;
  const voteScore = parseInt(drop.score ?? drop.vote_score, 10) || 0;

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
        <Text style={styles.headerTitle} numberOfLines={1}>
          Notice Details
        </Text>
        <TouchableOpacity style={styles.moreHeaderBtn} onPress={() => setShowMenu(true)}>
          <MoreVertical size={20} color="#0f172a" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Author Details Card */}
        <View style={styles.authorCard}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(drop.author_name || drop.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorName}>{drop.author_name || drop.name || 'Anonymous'}</Text>
                {drop.author_role && (
                  <View
                    style={[
                      styles.roleBadge,
                      drop.author_role === 'teacher'
                        ? styles.teacherBadge
                        : drop.author_role === 'admin'
                        ? styles.adminBadge
                        : styles.studentBadge,
                    ]}
                  >
                    <Text style={styles.roleBadgeText}>{drop.author_role}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.timestamp}>{timeAgo(drop.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* Title & Body */}
        <Text style={styles.title}>{drop.title}</Text>
        {(drop.body || drop.description) ? (
          <Text style={styles.description}>{drop.body || drop.description}</Text>
        ) : null}

        {/* Full Image Gallery */}
        {images.length > 0 && (
          <View style={styles.imagesSection}>
            {images.map((img, idx) => (
              <Image
                key={idx}
                source={{ uri: img.url }}
                style={styles.fullImage}
                resizeMode="cover"
              />
            ))}
          </View>
        )}

        {/* File Attachments */}
        {files.length > 0 && (
          <View style={styles.filesSection}>
            <Text style={styles.sectionHeading}>Attachments</Text>
            {files.map((file, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.fileCard}
                onPress={() => Linking.openURL(file.url)}
              >
                <Paperclip size={18} color="#105934" />
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.fileName || `Attachment ${idx + 1}`}
                </Text>
                <Download size={16} color="#64748b" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Vote & Comment Counters */}
        <View style={styles.actionSection}>
          <View style={styles.voteContainer}>
            <TouchableOpacity
              onPress={() => handleVoteDrop('up')}
              style={[styles.voteBtn, isUpvoted && styles.votedUpBtn]}
            >
              <ArrowBigUp
                size={24}
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
              onPress={() => handleVoteDrop('down')}
              style={[styles.voteBtn, isDownvoted && styles.votedDownBtn]}
            >
              <ArrowBigDown
                size={24}
                color={isDownvoted ? '#ef4444' : '#64748b'}
                fill={isDownvoted ? '#ef4444' : 'transparent'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.commentCountBadge}>
            <MessageCircle size={18} color="#64748b" />
            <Text style={styles.commentCountText}>{comments.length} Comments</Text>
          </View>
        </View>

        {/* Comments List */}
        <View style={styles.commentsContainer}>
          <Text style={styles.sectionHeading}>Discussion</Text>
          {comments.length === 0 ? (
            <View style={styles.noCommentsBox}>
              <MessageCircle size={32} color="#cbd5e1" />
              <Text style={styles.noCommentsText}>No comments yet. Join the conversation!</Text>
            </View>
          ) : (
            comments.map((comment) => {
              const isCommentUp = Number(comment.user_vote) === 1;
              const isCommentDown = Number(comment.user_vote) === -1;
              const commentScore = parseInt(comment.score ?? comment.vote_score, 10) || 0;
              const isCommentAuthor =
                comment.author_id === user?.id ||
                comment.author_student_id === user?.id ||
                comment.author_teacher_id === user?.id;

              return (
                <View key={comment.id} style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <View style={styles.commentAuthorRow}>
                      <View style={styles.commentAvatar}>
                        <Text style={styles.commentAvatarText}>
                          {(comment.author_name || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.commentAuthorName}>
                          {comment.author_name || 'Anonymous'}
                        </Text>
                        <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
                      </View>
                    </View>

                    {(isCommentAuthor || isAdmin) && (
                      <TouchableOpacity
                        onPress={() => handleDeleteComment(comment.id)}
                        style={styles.commentDeleteBtn}
                      >
                        <Trash2 size={14} color="#94a3b8" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.commentBody}>{comment.body || comment.content}</Text>

                  {/* Comment Action Footer */}
                  <View style={styles.commentFooter}>
                    <View style={styles.commentVoteGroup}>
                      <TouchableOpacity
                        onPress={() => handleVoteComment(comment.id, 'up')}
                        style={styles.commentVoteBtn}
                      >
                        <ArrowBigUp
                          size={18}
                          color={isCommentUp ? '#105934' : '#64748b'}
                          fill={isCommentUp ? '#105934' : 'transparent'}
                        />
                      </TouchableOpacity>
                      <Text
                        style={[
                          styles.commentVoteScore,
                          isCommentUp && styles.voteScoreUp,
                          isCommentDown && styles.voteScoreDown,
                        ]}
                      >
                        {commentScore}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleVoteComment(comment.id, 'down')}
                        style={styles.commentVoteBtn}
                      >
                        <ArrowBigDown
                          size={18}
                          color={isCommentDown ? '#ef4444' : '#64748b'}
                          fill={isCommentDown ? '#ef4444' : 'transparent'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Sticky Comment Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Add a comment to notice..."
          placeholderTextColor="#94a3b8"
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
          onPress={handlePostComment}
          disabled={!commentText.trim() || postingComment}
        >
          {postingComment ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Send size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* 3-Dot Options Action Sheet Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.actionSheet}>
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle} numberOfLines={1}>
              {drop?.title}
            </Text>

            <TouchableOpacity style={styles.sheetOption} onPress={handleShare}>
              <Share2 size={18} color="#0f172a" />
              <Text style={styles.sheetOptionText}>Share Notice</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetOption} onPress={handleToggleSave}>
              {isSaved ? (
                <>
                  <BookmarkCheck size={18} color="#105934" />
                  <Text style={[styles.sheetOptionText, { color: '#105934' }]}>
                    Remove from Saved
                  </Text>
                </>
              ) : (
                <>
                  <Bookmark size={18} color="#0f172a" />
                  <Text style={styles.sheetOptionText}>Save / Bookmark</Text>
                </>
              )}
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity style={styles.sheetOption} onPress={handleToggleHideAdmin}>
                {drop?.is_hidden_by_admin ? (
                  <>
                    <Eye size={18} color="#0f172a" />
                    <Text style={styles.sheetOptionText}>Unhide Notice (Admin)</Text>
                  </>
                ) : (
                  <>
                    <EyeOff size={18} color="#d97706" />
                    <Text style={[styles.sheetOptionText, { color: '#d97706' }]}>
                      Hide Notice (Admin)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {drop?.is_deleted ? (
              <TouchableOpacity style={styles.sheetOption} onPress={handleRestoreDrop}>
                <RotateCcw size={18} color="#105934" />
                <Text style={[styles.sheetOptionText, { color: '#105934', fontWeight: '800' }]}>
                  Restore Notice
                </Text>
              </TouchableOpacity>
            ) : (
              canDelete && (
                <TouchableOpacity
                  style={[styles.sheetOption, styles.sheetOptionDestructive]}
                  onPress={handleDeleteDrop}
                >
                  <Trash2 size={18} color="#ef4444" />
                  <Text style={styles.sheetOptionDestructiveText}>Delete Notice</Text>
                </TouchableOpacity>
              )
            )}

            <TouchableOpacity style={styles.sheetCancelBtn} onPress={() => setShowMenu(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  moreHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  authorCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  roleBadge: {
    paddingHorizontal: 8,
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
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'capitalize',
  },
  timestamp: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 2,
  },
  categoryBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#105934',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 28,
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
    marginBottom: 20,
  },
  imagesSection: {
    gap: 12,
    marginBottom: 20,
  },
  fullImage: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  filesSection: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 10,
    marginBottom: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 24,
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  voteBtn: {
    padding: 6,
  },
  votedUpBtn: {
    borderRadius: 8,
  },
  votedDownBtn: {
    borderRadius: 8,
  },
  voteScore: {
    fontSize: 14,
    fontWeight: '900',
    color: '#475569',
    paddingHorizontal: 8,
  },
  voteScoreUp: {
    color: '#105934',
  },
  voteScoreDown: {
    color: '#ef4444',
  },
  commentCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  commentCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  commentsContainer: {
    gap: 14,
  },
  noCommentsBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noCommentsText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  commentItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  commentAuthorName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  commentTime: {
    fontSize: 10.5,
    color: '#94a3b8',
  },
  commentDeleteBtn: {
    padding: 4,
  },
  commentBody: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 8,
  },
  commentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentVoteGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentVoteBtn: {
    padding: 2,
  },
  commentVoteScore: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    paddingHorizontal: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fff',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 90,
    fontSize: 14,
    color: '#0f172a',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#105934',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  backHomeBtn: {
    backgroundColor: '#105934',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 10,
  },
  backHomeBtnText: {
    color: '#fff',
    fontWeight: '800',
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
