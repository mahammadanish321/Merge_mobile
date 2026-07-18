import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MessageSquare, ChevronRight } from 'lucide-react-native';
import api from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { SwipeWrapper } from '../../src/components/SwipeWrapper';

export default function NodesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGroups = async () => {
    try {
      const res = await api.get('/chat/groups');
      setGroups(res.data);
    } catch (error) {
      console.error("Failed to load groups:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGroups();
  }, []);

  const renderGroup = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity 
        style={styles.groupCard}
        onPress={() => router.push(`/chat/${item.id}?name=${encodeURIComponent(item.name)}&year=${item.year}&stream=${item.stream}`)}
        activeOpacity={0.7}
      >
        <View style={styles.groupAvatar}>
          <Text style={styles.groupAvatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupMeta}>Year {item.year} • {item.stream}</Text>
          {item.recentMessage && (
            <Text style={styles.recentMessage} numberOfLines={1}>
              {item.recentMessage.senderId === user?.id ? 'You: ' : ''}
              {item.recentMessage.content}
            </Text>
          )}
        </View>
        <ChevronRight size={20} color="#94a3b8" />
      </TouchableOpacity>
    );
  };

  return (
    <SwipeWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Nodes</Text>
          <Text style={styles.headerSubtitle}>Real-time class discussions</Text>
        </View>

        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading Nodes...</Text>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MessageSquare size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>No Nodes Found</Text>
            <Text style={styles.emptyText}>You haven't been assigned to any classes yet.</Text>
          </View>
        ) : (
          <FlatList
            data={groups}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderGroup}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
            }
          />
        )}
      </View>
    </SwipeWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Space for tab bar
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  groupAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  groupMeta: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  recentMessage: {
    fontSize: 14,
    color: '#94a3b8',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
