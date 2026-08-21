import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ChevronLeft, Send, Paperclip, CheckCheck, Folder, Edit, X } from 'lucide-react-native';
import { io, Socket } from 'socket.io-client';
import api, { SOCKET_URL } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';

export default function ChatScreen() {
  const router = useRouter();
  const { id, name, year, stream, attachmentUri } = useLocalSearchParams();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [groupStats, setGroupStats] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [typingUsers, setTypingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Note Folder Edit State
  const [editingFolder, setEditingFolder] = useState<any>(null);
  const [editedAttachments, setEditedAttachments] = useState<string[]>([]);
  const [isEditingFolderLoading, setIsEditingFolderLoading] = useState(false);
  const [folderModal, setFolderModal] = useState<{ open: boolean; title: string; loading: boolean; notes: any[] }>({
    open: false,
    title: '',
    loading: false,
    notes: [],
  });

  const openNoteFolder = async (item: any) => {
    setFolderModal({
      open: true,
      title: item.noteFolderName || 'Note Folder',
      loading: true,
      notes: [],
    });
    try {
      const res = await api.get(`/notes/folders/${item.noteFolderId || item.id}`);
      setFolderModal((p) => ({ ...p, loading: false, notes: res.data || [] }));
    } catch (e) {
      setFolderModal((p) => ({ ...p, loading: false }));
    }
  };
  
  const typingTimeoutRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [msgsRes, statsRes] = await Promise.all([
          api.get(`/chat/messages/${id}`),
          api.get(`/chat/groups/${id}/stats`)
        ]);
        setMessages(msgsRes.data);
        setGroupStats(statsRes.data);
      } catch (error) {
        console.error("Failed to load chat data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();

    // Socket Setup
    const newSocket = io(`${SOCKET_URL}/chat`, { auth: { token: user?.token } });
    
    newSocket.on('connect', () => {
      newSocket.emit('join_group', id);
    });

    newSocket.on("receive_message", (msg) => {
      setMessages(prev => {
        const index = prev.findIndex(m => m.isLocal && m.content === msg.content);
        if (index !== -1) {
          const newMsgs = [...prev];
          newMsgs[index] = msg;
          return newMsgs;
        }
        return [...prev, msg];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    newSocket.on("user_typing", ({ userId, name: typistName }) => {
      setTypingUsers(prev => {
        if (!prev.find(u => u.userId === userId)) return [...prev, { userId, name: typistName }];
        return prev;
      });
    });

    newSocket.on("user_stop_typing", ({ userId }) => {
      setTypingUsers(prev => prev.filter(u => u.userId !== userId));
    });

    newSocket.on("presence_update", ({ onlineClassmates }) => {
      setOnlineUsers(onlineClassmates.length);
    });

    newSocket.on("message_seen", ({ messageId, seenBy }) => {
      setMessages(prev => prev.map(m => (m._id === messageId || m.id === messageId) ? { ...m, seenBy } : m));
    });

    newSocket.on("message_updated", (updatedMsg) => {
      setMessages(prev => prev.map(m => (m._id === updatedMsg._id || m.id === updatedMsg._id) ? updatedMsg : m));
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave_group', id);
      newSocket.disconnect();
    };
  }, [id, user?.token]);

  // Mark seen logic
  useEffect(() => {
    if (socket && messages.length > 0) {
      messages.forEach(msg => {
        const isMsgOwn = msg.senderId === user?.id && msg.senderType === user?.role;
        if (!isMsgOwn && !msg.isLocal) {
          const hasSeen = msg.seenBy && msg.seenBy.find((s: any) => s.userId === user?.id);
          if (!hasSeen) {
            socket.emit('mark_seen', { messageId: msg._id || msg.id, groupId: id });
          }
        }
      });
    }
  }, [messages, socket, id, user?.id]);

  useEffect(() => {
    if (attachmentUri) {
      const uri = attachmentUri as string;
      uploadAttachment(uri);
      router.setParams({ attachmentUri: '' });
    }
  }, [attachmentUri]);

  const uploadAttachment = async (uri: string) => {
    // Optimistic UI for attachment
    const tempId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: tempId,
      _id: tempId,
      content: '',
      senderId: user?.id,
      senderType: user?.role,
      senderName: user?.name,
      createdAt: new Date().toISOString(),
      isLocal: true,
      seenBy: [],
      attachmentUrls: [uri], // show the local uri for now
      uploading: true
    }]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'upload.jpg';
      const match = /\.(\w+)$/.exec(filename);
      let type = match ? `image/${match[1]}` : `image/jpeg`;
      if (match && (match[1] === 'mp4' || match[1] === 'mov' || match[1] === 'avi')) {
        type = `video/${match[1]}`;
      }

      formData.append('attachments', { uri, name: filename, type } as any);

      // React Native FormData + Axios has known issues. 
      // Using native fetch here fixes the Network Error / Infinite hang.
      const token = await AsyncStorage.getItem('userToken');
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://merge-backend.onrender.com/api';
      
      const res = await fetch(`${BASE_URL}/chat/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      
      const data = await res.json();
      const uploadedUrls = data.urls;

      if (uploadedUrls && uploadedUrls.length > 0 && socket) {
        // Send real message with uploaded url
        socket.emit('send_message', {
          groupId: id,
          content: '',
          attachmentUrls: uploadedUrls,
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert("Upload Failed", "Could not upload the attachment.");
    }
  };


  const saveEditedFolder = async () => {
    if (!editingFolder) return;
    setIsEditingFolderLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://merge-backend.onrender.com/api';
      
      const res = await fetch(`${BASE_URL}/chat/messages/${editingFolder._id || editingFolder.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attachmentUrls: editedAttachments,
          isEdited: true
        }),
      });

      if (!res.ok) throw new Error('Failed to save');
      
      setEditingFolder(null);
    } catch (error) {
      console.error("Save edit error:", error);
      Alert.alert("Error", "Could not save edits.");
    } finally {
      setIsEditingFolderLoading(false);
    }
  };

  const handleAttachment = () => {
    Alert.alert(
      "Attach Media",
      "Choose an option",
      [
        { text: "Camera", onPress: () => router.push({ pathname: '/chat/camera', params: { id, name, year, stream } }) },
        { text: "Gallery", onPress: pickImage },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      uploadAttachment(result.assets[0].uri);
    }
  };

  const handleTyping = (text: string) => {
    setNewMessage(text);
    if (socket) {
      socket.emit('typing', { groupId: id, name: user?.name });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing', { groupId: id });
      }, 2000);
    }
  };

  const handleSend = () => {
    if (!newMessage.trim() || !socket) return;

    const msgData = {
      groupId: id,
      content: newMessage.trim(),
      attachmentUrls: [],
    };

    // Optimistic UI
    const tempId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: tempId,
      _id: tempId,
      content: msgData.content,
      senderId: user?.id,
      senderType: user?.role,
      senderName: user?.name,
      createdAt: new Date().toISOString(),
      isLocal: true,
      seenBy: []
    }]);

    socket.emit("send_message", msgData);
    socket.emit("stop_typing", { groupId: id });
    setNewMessage('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isOwn = item.senderId === user?.id && item.senderType === user?.role;
    const totalMembers = groupStats?.totalMembers || 0;
    
    // Read receipt dot logic
    const seenCount = item.seenBy?.length || 0;
    let dotColor = '#ef4444'; // Red
    if (totalMembers > 0 && seenCount / totalMembers >= 0.9) {
      dotColor = '#22c55e'; // Green
    } else if (seenCount > 0) {
      dotColor = '#eab308'; // Yellow
    }

    return (
      <View style={[styles.messageWrapper, isOwn ? styles.messageRight : styles.messageLeft]}>
        {!isOwn && (
          <View style={styles.avatar}>
            {item.senderAvatar ? (
              <Image source={{ uri: item.senderAvatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{item.senderName?.[0]?.toUpperCase()}</Text>
            )}
          </View>
        )}
        <View>
          {!isOwn && (
            <Text style={styles.senderName}>{item.senderName} • {item.senderType}</Text>
          )}
          <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther, item.isLocal && { opacity: 0.6 }]}>
            
            {item.isNoteFolder ? (
              <TouchableOpacity style={styles.noteFolderContainer} onPress={() => openNoteFolder(item)}>
                <View style={styles.noteFolderHeader}>
                  <Folder size={20} color={isOwn ? "#fff" : "#0f172a"} />
                  <Text style={[styles.noteFolderTitle, isOwn ? {color: '#fff'} : {}]}>{item.noteFolderName}</Text>
                </View>
                <Text style={{color: isOwn ? '#e2e8f0' : '#64748b', fontSize: 12, marginTop: 4, marginLeft: 2}}>Click to view latest files</Text>
              </TouchableOpacity>
            ) : (

              <>
                {item.replyTo && (
                  <View style={styles.quotedBox}>
                    <Text style={styles.quotedSender}>{item.replyTo.senderName}</Text>
                    <Text style={styles.quotedText} numberOfLines={2}>
                      {item.replyTo.content || 'Attachment'}
                    </Text>
                  </View>
                )}
                
                {!!item.content && (
                  <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>{item.content}</Text>
                )}
                
                {item.attachmentUrls && item.attachmentUrls.map((url: string, idx: number) => (
                  <View key={idx} style={styles.attachmentWrapper}>
                    <Image source={{ uri: url }} style={styles.attachmentImage} />
                    {item.uploading && (
                      <ActivityIndicator style={styles.uploadingSpinner} color="#fff" />
                    )}
                  </View>
                ))}
              </>
            )}
            
            <View style={styles.inlineMessageFooter}>
              <Text style={[styles.timeText, isOwn && styles.timeTextOwn]}>
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {isOwn && !item.isLocal && (
                <View style={[styles.inlineReadReceipt, { backgroundColor: dotColor }]} />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{name}</Text>
          <View style={styles.headerSubtitleContainer}>
            <Text style={styles.headerSubtitle}>
              Yr {year} • {stream} • {groupStats?.totalMembers || 0} Members
            </Text>
            {onlineUsers > 0 && (
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>{onlineUsers} Online</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoid} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id || item._id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>
              {typingUsers.map(u => u.name).join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
            </Text>
          </View>
        )}

        {/* Edit Folder Modal */}
        {editingFolder && (
          <View style={styles.editFolderOverlay}>
            <View style={styles.editFolderModal}>
              <View style={styles.editFolderHeader}>
                <Text style={styles.editFolderTitle}>Edit Note Folder</Text>
                <TouchableOpacity onPress={() => setEditingFolder(null)}>
                  <X size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              
              <FlatList
                data={editedAttachments}
                keyExtractor={(item, index) => index.toString()}
                numColumns={3}
                renderItem={({ item, index }) => (
                  <View style={styles.editAttachmentWrapper}>
                    <Image source={{ uri: item }} style={styles.editAttachmentImage} />
                    <TouchableOpacity 
                      style={styles.removeAttachmentButton}
                      onPress={() => setEditedAttachments(prev => prev.filter((_, i) => i !== index))}
                    >
                      <X size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
                ListEmptyComponent={<Text style={{padding: 20, textAlign: 'center'}}>No files in this folder.</Text>}
              />
              
              <View style={styles.editFolderActions}>
                <TouchableOpacity 
                  style={styles.addFilesButton}
                  onPress={async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      allowsMultipleSelection: true,
                      quality: 0.8,
                    });
                    if (result.canceled || !result.assets) return;
                    setIsEditingFolderLoading(true);
                    try {
                      const formData = new FormData();
                      result.assets.forEach((asset, index) => {
                        const filename = asset.uri.split('/').pop() || `upload_${index}.jpg`;
                        const match = /\.(\w+)$/.exec(filename);
                        const type = match ? `image/${match[1]}` : `image/jpeg`;
                        formData.append('attachments', { uri: asset.uri, name: filename, type } as any);
                      });
                      const token = await AsyncStorage.getItem('userToken');
                      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://merge-backend.onrender.com/api';
                      const res = await fetch(`${BASE_URL}/chat/upload`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData,
                      });
                      const data = await res.json();
                      if (data.urls) {
                        setEditedAttachments(prev => [...prev, ...data.urls]);
                      }
                    } catch (e) {
                      Alert.alert("Failed", "Could not upload new files");
                    } finally {
                      setIsEditingFolderLoading(false);
                    }
                  }}
                >
                  <Text style={styles.addFilesText}>+ Add Files</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.saveFolderButton}
                  onPress={saveEditedFolder}
                  disabled={isEditingFolderLoading}
                >
                  {isEditingFolderLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveFolderText}>Save Folder</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>

          <TouchableOpacity style={styles.attachButton} onPress={handleAttachment}>
            <Paperclip size={20} color="#64748b" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
            value={newMessage}
            onChangeText={handleTyping}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, newMessage.trim() ? styles.sendButtonActive : null]}
            onPress={handleSend}
            disabled={!newMessage.trim()}
          >
            <Send size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Note Folder Modal */}
      <Modal visible={folderModal.open} animationType="slide" transparent={true} onRequestClose={() => setFolderModal((p: any) => ({ ...p, open: false }))}>
        <View style={{flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <View style={{backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '80%'}}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
              <Text style={{fontSize: 18, fontWeight: 'bold', color: '#0f172a'}}>{folderModal.title || 'Note Folder'}</Text>
              <TouchableOpacity onPress={() => setFolderModal((p: any) => ({ ...p, open: false }))}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {folderModal.loading ? (
                <ActivityIndicator size="large" color="#10b981" style={{marginVertical: 40}} />
              ) : folderModal.notes.length === 0 ? (
                <Text style={{textAlign: 'center', color: '#64748b', marginVertical: 40}}>No files found.</Text>
              ) : (
                folderModal.notes.map((note: any) => (
                  <View key={note.id} style={{flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 10}}>
                    {note.file_url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                      <Image source={{ uri: note.file_url }} style={{width: 40, height: 40, borderRadius: 6, marginRight: 12}} />
                    ) : (
                      <View style={{width: 40, height: 40, borderRadius: 6, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginRight: 12}}>
                        <Folder size={20} color="#64748b" />
                      </View>
                    )}
                    <View style={{flex: 1}}>
                      <Text style={{fontWeight: '500', color: '#0f172a', fontSize: 14}} numberOfLines={1}>{note.file_name}</Text>
                      <Text style={{color: '#64748b', fontSize: 12}}>{new Date(note.created_at).toLocaleDateString()}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingTop: Platform.OS === 'android' ? 40 : 12,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    padding: 16,
    paddingBottom: 24,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '100%',
  },
  messageLeft: {
    justifyContent: 'flex-start',
  },
  messageRight: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 12,
  },
  messageContentBox: {
    maxWidth: '80%',
  },
  senderName: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
  },
  bubbleOwn: {
    backgroundColor: '#22c55e',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  messageText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  messageTextOwn: {
    color: '#fff',
  },
  quotedBox: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(0,0,0,0.2)',
    marginBottom: 8,
  },
  quotedSender: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  quotedText: {
    fontSize: 13,
    color: '#475569',
  },
  attachmentWrapper: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  attachmentImage: {
    width: 200,
    height: 150,
    resizeMode: 'cover',
  },
  uploadingSpinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  inlineMessageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  timeTextOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  readReceipt: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
  },
  inlineReadReceipt: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
  },
  typingContainer: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingBottom: Platform.OS === 'ios' ? 32 : 12,
  },
  attachButton: {
    padding: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    marginHorizontal: 8,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#22c55e',
  },
  noteFolderContainer: {
    width: '100%',
    padding: 4,
  },
  noteFolderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  noteFolderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  noteFolderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  noteFolderImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  editedTag: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  editFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    gap: 4,
  },
  editFolderButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  editFolderOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  editFolderModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  editFolderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editFolderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  editAttachmentWrapper: {
    width: '31%',
    aspectRatio: 1,
    margin: '1%',
    position: 'relative',
  },
  editAttachmentImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editFolderActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  addFilesButton: {
    flex: 1,
    padding: 14,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    alignItems: 'center',
  },
  addFilesText: {
    fontWeight: '600',
    color: '#0f172a',
  },
  saveFolderButton: {
    flex: 2,
    padding: 14,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    alignItems: 'center',
  },
  saveFolderText: {
    fontWeight: '600',
    color: '#fff',
  }
});
