import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Animated, StyleSheet, View, Text, TouchableOpacity, Image, Dimensions, Platform, LogBox } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Bell, CheckCircle, AlertCircle, Info, X, Clock } from 'lucide-react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import apiClient, { SOCKET_URL } from '../api/client';
import { useAuth } from './AuthContext';

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'expo-notifications: Push notifications',
]);

const isExpoGo = Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';
// SDK 53 Expo Go throws while loading expo-notifications for remote push.
// Load the module only in a development/production native build.
const Notifications = isExpoGo
  ? null
  : (require('expo-notifications') as typeof import('expo-notifications'));

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web' || isExpoGo || !Device.isDevice || !Notifications) {
    console.log('[Mobile Push] Push notifications require physical device and native build.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#105934',
    });
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[Mobile Push] Permission not granted for push notifications.');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'd28e3ba3-59f6-46bb-9184-606256cec543';
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (err) {
    console.warn('[Mobile Push Token Error]:', err);
    return null;
  }
}

const { width } = Dimensions.get('window');
const BASE_SOCKET_URL = SOCKET_URL;

interface NotificationItem {
  id: number;
  title?: string;
  message: string;
  priority?: string;
  session_type?: string;
  sender_image?: string;
  redirect_url?: string;
  is_read?: boolean;
  created_at?: string;
  [key: string]: any;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  clearAllReadNotifications: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [socket, setSocket] = useState<Socket | null>(null);

  // In-app Floating Toast Banner State
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const slideAnim = useRef(new Animated.Value(-150)).current;

  const showToast = useCallback((notif: NotificationItem) => {
    setToast(notif);
    Animated.spring(slideAnim, {
      toValue: Platform.OS === 'ios' ? 55 : 35,
      useNativeDriver: true,
      speed: 14,
      bounciness: 10
    }).start();

    // Auto dismiss after 4s unless critical
    if (notif.priority !== 'critical') {
      setTimeout(() => {
        hideToast();
      }, 4500);
    }
  }, [slideAnim]);

  const hideToast = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -150,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [slideAnim]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const response = await apiClient.get('/notifications');
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
    } catch (err) {
      console.warn('[Mobile NotificationContext] Fetch error:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      if (socket) socket.close();
      return;
    }

    fetchNotifications();

    let notifSubscription: any = null;
    if (Platform.OS !== 'web' && !isExpoGo && Device.isDevice && Notifications) {
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          console.log('[Mobile Push Token]: Retrieved Expo push token:', token);
          apiClient.post('/notifications/push-token', { pushToken: token })
            .catch(err => console.warn('[Mobile Push Storage Error]:', err));
        }
      });

      notifSubscription = Notifications.addNotificationResponseReceivedListener(response => {
        const url = response.notification.request.content.data?.redirect_url;
        if (url) {
          router.push(url as any);
        }
      });
    }

    AsyncStorage.getItem('userToken').then(token => {
      const newSocket = io(BASE_SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        auth: { token }
      });

      newSocket.on('connect', () => {
        console.log('[Mobile Socket] Connected. Authenticating user:', user.id);
        newSocket.emit('authenticate', {
          id: user.id,
          role: user.role,
          organization_id: user.organization_id,
          year: user.year,
          stream: user.stream
        });
      });

      newSocket.on('unread_sync', (data: any) => {
        console.log('[Mobile Socket] Unread Sync Received');
        if (data && data.notifications) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount || 0);
        }
      });

      const handleIncoming = (notif: NotificationItem) => {
        console.log('[Mobile Socket] New Notification Arrived:', notif);

        setNotifications(prev => {
          if (prev.some(n => n.id === notif.id)) return prev;
          return [notif, ...prev];
        });

        setUnreadCount(prev => prev + 1);

        if (notif.priority !== 'silent') {
          // Trigger Haptic Feedback
          if (notif.priority === 'critical') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } else if (notif.priority === 'important') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }

          showToast(notif);

          // Schedule local OS notification only if not in Expo Go
          if (!isExpoGo && Notifications) {
            Notifications.scheduleNotificationAsync({
              content: {
                title: notif.title || 'Merge Notification',
                body: notif.message,
                data: { redirect_url: notif.redirect_url },
              },
              trigger: null, // Send immediately
            }).catch(err => console.warn('[Mobile OS Notification] Schedule error:', err));
          }
        }
      };

      newSocket.on('notification', handleIncoming);
      newSocket.on('cohort_notification', handleIncoming);
      newSocket.on('role_notification', handleIncoming);

      newSocket.on('ai_status_update', (status: any) => {
        if (status.isError && user?.role === 'admin') {
          showToast({
            id: Date.now(),
            title: 'AI System Alert',
            message: status.displayStatus,
            priority: 'critical',
            session_type: 'system'
          });
        }
      });

      setSocket(newSocket);
    });

    return () => {
      if (socket) socket.close();
      if (notifSubscription) notifSubscription.remove();
    };
  }, [user, fetchNotifications]);

  const markAsRead = async (id: number) => {
    try {
      await apiClient.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('[Mobile NotificationContext] Mark as read error:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('[Mobile NotificationContext] Mark all as read error:', err);
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      const notifToDelete = notifications.find(n => n.id === id);
      await apiClient.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (notifToDelete && !notifToDelete.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.warn('[Mobile NotificationContext] Delete notification error:', err);
    }
  };

  const clearAllReadNotifications = async () => {
    try {
      await apiClient.delete('/notifications/clear-read');
      setNotifications(prev => prev.filter(n => !n.is_read));
    } catch (err) {
      console.warn('[Mobile NotificationContext] Clear read notifications error:', err);
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAllReadNotifications,
      refreshNotifications: fetchNotifications
    }}>
      {children}

      {/* Floating In-App Banner */}
      {toast && (
        <Animated.View style={[styles.toastContainer, { transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity 
            style={[styles.toastCard, toast.priority === 'critical' && styles.criticalCard]}
            activeOpacity={0.8}
            onPress={() => {
              hideToast();
              if (toast.id && !toast.is_read) markAsRead(toast.id);
              if (toast.redirect_url) router.push(toast.redirect_url as any);
            }}
          >
            {toast.sender_image ? (
              <Image source={{ uri: toast.sender_image }} style={styles.toastAvatar} />
            ) : (
              <View style={[styles.iconWrapper, toast.priority === 'critical' && styles.criticalIcon]}>
                {toast.priority === 'critical' ? <AlertCircle size={22} color="#ef4444" /> : <Info size={22} color="#105934" />}
              </View>
            )}

            <View style={styles.toastContent}>
              <View style={styles.toastHeader}>
                <Text style={[styles.tagText, toast.priority === 'critical' && styles.criticalTag]}>
                  {String(toast.session_type || toast.priority || 'notification').toUpperCase()}
                </Text>
                <Text style={styles.timeText}>Just now</Text>
              </View>

              {toast.title && <Text style={styles.titleText} numberOfLines={1}>{toast.title}</Text>}
              <Text style={styles.messageText} numberOfLines={2}>{toast.message}</Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={hideToast}>
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 999999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  criticalCard: {
    backgroundColor: '#fffefc',
    borderColor: '#fca5a5',
    borderLeftWidth: 6,
    borderLeftColor: '#ef4444',
  },
  toastAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 14,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  criticalIcon: {
    backgroundColor: '#fee2e2',
  },
  toastContent: {
    flex: 1,
    marginRight: 8,
  },
  toastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#105934',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  criticalTag: {
    color: '#ef4444',
    backgroundColor: '#fee2e2',
  },
  timeText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  closeBtn: {
    padding: 6,
  },
});
