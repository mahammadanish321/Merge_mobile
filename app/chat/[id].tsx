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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Send, Paperclip, CheckCheck } from 'lucide-react-native';
import { io, Socket } from 'socket.io-client';
import api, { SOCKET_URL } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';

export default function ChatScreen() {
  const router = useRouter();
  const { id, name, year, stream } = useLocalSearchParams();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [groupStats, setGroupStats] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [typingUsers, setTypingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
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
        if (msg.senderId !== user?.id && !msg.isLocal) {
          const hasSeen = msg.seenBy && msg.seenBy.find((s: any) => s.userId === user?.id);
          if (!hasSeen) {
            socket.emit('mark_seen', { messageId: msg._id || msg.id, groupId: id });
          }
        }
      });
    }
  }, [messages, socket, id, user?.id]);

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
    const isOwn = item.senderId === user?.id;
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
            <Text style={styles.avatarText}>{item.senderName?.charAt(0).toUpperCase() || 'U'}</Text>
          </View>
        )}
        <View style={styles.messageContentBox}>
          {!isOwn && (
            <Text style={styles.senderName}>{item.senderName} • {item.senderType}</Text>
          )}
          
          <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther, item.isLocal && { opacity: 0.6 }]}>
            {/* Quoted Message display (Read Only) */}
            {item.replyTo && (
              <View style={styles.quotedBox}>
                <Text style={styles.quotedSender}>{item.replyTo.senderName}</Text>
                <Text style={styles.quotedText} numberOfLines={2}>
                  {item.replyTo.content || 'Attachment'}
                </Text>
              </View>
            )}
            
            <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>{item.content}</Text>
            
            {/* Attachments (Read Only) */}
            {item.attachmentUrls && item.attachmentUrls.map((url: string, idx: number) => (
              <View key={idx} style={styles.attachmentWrapper}>
                <Image source={{ uri: url }} style={styles.attachmentImage} />
              </View>
            ))}
          </View>
          
          <View style={styles.messageFooter}>
            <Text style={styles.timeText}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isOwn && !item.isLocal && (
              <View style={[styles.readReceipt, { backgroundColor: dotColor }]} />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{name}</Text>
          <Text style={styles.headerSubtitle}>
            Year {year} • {stream}
            {onlineUsers > 0 && ` • 🟢 ${onlineUsers} Online`}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoid} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#22c55e" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id || item._id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>
              {typingUsers.map(u => u.name).join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
            </Text>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton}>
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
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
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
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  readReceipt: {
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
});
