import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SwipeWrapper } from '../src/components/SwipeWrapper';
import {
  Clock,
  Plus,
  CalendarDays,
  Star,
  User,
  MapPin,
  ChevronDown,
  XCircle,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  Folder,
  ArrowLeft,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import api from '../src/api/client';
import { useAuth } from '../src/context/AuthContext';
import { AttendanceModal } from '../src/components/AttendanceModal';
import { AddCustomSessionModal } from '../src/components/AddCustomSessionModal';

export default function SessionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';

  const [sessions, setSessions] = useState<any[]>([]);
  const [teacherSchedules, setTeacherSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Group expansion state
  const todayDefaultStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date());
  const [expandedDates, setExpandedDates] = useState<{ [key: string]: boolean }>({
    [todayDefaultStr]: true,
  });

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [attModal, setAttModal] = useState({
    visible: false,
    loading: false,
    session: null as any,
    records: [] as any[],
    title: '',
  });

  const fetchSessionsData = async () => {
    try {
      // allCustom=true → historical custom sessions across all dates
      const res = await api.get('/sessions?allCustom=true');
      let dbSessions = res.data || [];
      if (isTeacher) {
        dbSessions = dbSessions.filter(
          (s: any) =>
            String(s.teacher_name).trim().toLowerCase() ===
            String(user?.name || '').trim().toLowerCase()
        );
        const schRes = await api.get('/schedules/my');
        setTeacherSchedules(schRes.data || []);
      } else if (isStudent) {
        const studentYear = user?.year || '1';
        const studentStream = user?.stream || 'CSE';
        dbSessions = dbSessions.filter(
          (s: any) =>
            String(s.year) === String(studentYear) &&
            String(s.stream) === String(studentStream)
        );
        const schRes = await api.get(`/schedules?year=${studentYear}&stream=${studentStream}`);
        setTeacherSchedules(schRes.data || []);
      } else {
        // admin
        const schRes = await api.get('/schedules');
        setTeacherSchedules(schRes.data || []);
      }
      setSessions(dbSessions);
    } catch (err) {
      console.warn('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSessionsData();
  }, [user, isTeacher]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSessionsData();
  };

  const [passwordModal, setPasswordModal] = useState({
    visible: false,
    id: null as any,
    isCustom: false,
    password: '',
    loading: false,
    title: '',
    subtitle: '',
  });

  const handleCancelRoutine = (id: any) => {
    setPasswordModal({
      visible: true,
      id,
      isCustom: false,
      password: '',
      loading: false,
      title: 'Cancel Routine Class',
      subtitle: 'Enter your account password to cancel this routine class:',
    });
  };

  const handleShareNoteFolder = async (item: any) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const formData = new FormData();
      result.assets.forEach((asset, index) => {
        const filename = asset.uri.split('/').pop() || `upload_${index}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        formData.append('files', { uri: asset.uri, name: filename, type } as any);
      });

      if (item.isCustom) {
        formData.append('session_id', item.originalId);
      } else {
        formData.append('schedule_id', item.originalId);
      }
      
      const dateParts = item.date.split('/');
      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : item.date;
      formData.append('upload_date', formattedDate);

      const token = await AsyncStorage.getItem('userToken');
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://merge-backend.onrender.com/api';
      
      const res = await fetch(`${BASE_URL}/notes/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      
      if (res.ok) {
        Alert.alert("Success", "Class notes uploaded and shared with the chat node successfully!");
      } else {
        const errorData = await res.json();
        Alert.alert("Error", errorData.message || "Failed to upload notes.");
      }
    } catch (error) {
      console.error("Note Folder Upload error:", error);
      Alert.alert("Folder Share Failed", "Could not upload the notes.");
    }
  };

  const handleCancelCustomSession = (id: any) => {
    setPasswordModal({
      visible: true,
      id,
      isCustom: true,
      password: '',
      loading: false,
      title: 'Cancel Custom Class',
      subtitle: 'Enter your account password to cancel this custom session:',
    });
  };

  const submitCancelSession = async () => {
    if (!passwordModal.password) {
      Alert.alert('Required', 'Please enter your password.');
      return;
    }
    setPasswordModal((prev) => ({ ...prev, loading: true }));
    try {
      if (passwordModal.isCustom) {
        await api.post('/sessions/cancel', { id: passwordModal.id, password: passwordModal.password });
      } else {
        await api.post(`/schedules/${passwordModal.id}/cancel`, { password: passwordModal.password });
      }
      setPasswordModal((prev) => ({ ...prev, visible: false, loading: false }));
      fetchSessionsData();
    } catch (err: any) {
      Alert.alert('Failed', err.response?.data?.message || err.message);
      setPasswordModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const openAttendance = async (session: any, titleStr?: string) => {
    const sId = session.scheduleId || session.id;
    if (String(sId).startsWith('sched_')) {
      Alert.alert('Not Available', 'No attendance record exists for this upcoming class yet.');
      return;
    }

    setAttModal({
      visible: true,
      loading: true,
      session,
      records: [],
      title: titleStr || session.subject_name || 'Class Attendance',
    });

    try {
      const r = await api.get(`/attendance/session/${sId}?include_absent=true`);
      setAttModal((prev) => ({
        ...prev,
        loading: false,
        records: r.data || [],
      }));
    } catch (err) {
      setAttModal((prev) => ({
        ...prev,
        loading: false,
        records: [],
      }));
    }
  };

  // Build Combined Sessions list matching desktop
  const buildCombined = () => {
    const today = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date());
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const currentDayIdx = now.getDay();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const getScheduleInfo = (s: any) => {
      const targetIdx = days.indexOf(s.day_of_week);
      const diff = targetIdx - currentDayIdx;
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + diff);
      const dateStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(targetDate);

      let status = 'scheduled';
      let done = false;

      if (s.is_cancelled) {
        status = 'cancelled';
        done = true;
      } else if (diff < 0) {
        status = 'ended';
        done = true;
      } else if (diff === 0) {
        const [eh, em] = (s.end_time || '00:00').split(':');
        const endMin = parseInt(eh, 10) * 60 + parseInt(em, 10);
        if (nowMin > endMin) {
          status = 'ended';
          done = true;
        }
      }
      return { dateStr, status, done };
    };

    const fromSchedules = teacherSchedules
      .filter((s) => {
        const { dateStr } = getScheduleInfo(s);
        if (dateStr !== today) return false;
        // Exclude if already in DB
        return !sessions.some(
          (db) =>
            !db.is_custom &&
            String(db.subject_id) === String(s.subject_id) &&
            (() => {
              const dObj = new Date(db.start_time);
              return new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              }).format(dObj);
            })() === dateStr
        );
      })
      .map((s) => {
        const { dateStr, status, done } = getScheduleInfo(s);
        return {
          id: `sched_${s.id}_${dateStr}`,
          originalId: s.id,
          subject_name: s.subject_name,
          type: 'Regular',
          year: s.year,
          stream: s.stream || 'N/A',
          room: `${s.classroom_name}`,
          time_range: `${(s.start_time || '').substring(0, 5)} – ${(s.end_time || '').substring(0, 5)}`,
          status,
          isCustom: false,
          isDone: done,
          date: dateStr,
          raw: s,
        };
      });

    const formatWallTime = (isoStr: string) => {
      if (!isoStr) return '--:--';
      try {
        const d = new Date(isoStr);
        if (!isNaN(d.getTime())) {
          // Always display in IST regardless of device locale
          return new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }).format(d);
        }
      } catch {}
      // Fallback: parse raw time string (for routine slots like "13:35:00+05:30")
      const timePart = isoStr.includes('T') ? isoStr.split('T')[1].split('.')[0] : isoStr;
      const [h, m] = timePart.split(':');
      const hh = parseInt(h, 10);
      const ampm = hh >= 12 ? 'PM' : 'AM';
      const h12 = hh % 12 || 12;
      return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
    };

    const fromSessions = sessions.map((s) => ({
      id: `db_${s.id}`,
      originalId: s.id,
      scheduleId: s.schedule_id || s.id,
      subject_name: s.subject_name,
      type: s.is_custom ? 'Custom' : 'Regular',
      year: s.year,
      stream: s.stream || 'N/A',
      room: s.classroom_name || s.camera_url || '—',
      time_range: `${formatWallTime(s.start_time)} – ${formatWallTime(s.end_time)}`,
      status: s.status,
      isCustom: !!s.is_custom,
      isDone: s.status === 'ended' || s.status === 'completed' || s.status === 'inactive',
      date: (() => {
        if (!s.start_time) {
          return new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }).format(new Date());
        }
        const dObj = new Date(s.start_time);
        return new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).format(dObj);
      })(),
      raw: s,
    }));

    return [...fromSchedules, ...fromSessions];
  };

  const combined = buildCombined();

  // Group by date
  const groups = combined.reduce<{ [key: string]: any[] }>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  const todayStr = new Date().toLocaleDateString('en-GB');
  const sortedDates = Object.keys(groups).sort((a, b) => {
    if (a === todayStr) return -1;
    if (b === todayStr) return 1;
    return new Date(b.split('/').reverse().join('-')).getTime() - new Date(a.split('/').reverse().join('-')).getTime();
  });

  // Calculate live stats
  const activeCount = combined.filter((s) => s.status === 'active').length;
  const upcomingCount = combined.filter((s) => s.status === 'scheduled').length;
  const completedCount = combined.filter((s) => s.isDone && s.status !== 'cancelled').length;
  const cancelledCount = combined.filter((s) => s.status === 'cancelled').length;
  const customCount = combined.filter((s) => s.isCustom).length;
  const totalCount = combined.length;

  const stats = [
    { label: 'Live', val: activeCount, color: '#105934', icon: Clock },
    { label: 'Upcoming', val: upcomingCount, color: '#2563eb', icon: CalendarDays },
    { label: 'Completed', val: completedCount, color: '#105934', icon: CheckCircle2 },
    { label: 'Cancelled', val: cancelledCount, color: '#ef4444', icon: XCircle },
    { label: 'Custom', val: customCount, color: '#d97706', icon: Star },
    { label: 'Total', val: totalCount, color: '#64748b', icon: User },
  ];

  return (
    <SwipeWrapper>
      <View style={styles.mainContainer}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.replace('/(tabs)/schedule' as any)} 
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color="#0f172a" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.title}>Sessions</Text>
            <Text style={styles.subtitle} numberOfLines={1}>Monitor and manage all class sessions</Text>
          </View>

          {(isTeacher || isAdmin) ? (
            <TouchableOpacity 
              style={styles.newBtn} 
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#fff" />
              <Text style={styles.newBtnText}>New</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Stats Row (Matching Desktop Pills) */}
        <View style={styles.statsRow}>
          {stats.map((stat, idx) => (
            <View
              key={idx}
              style={[
                styles.statPill,
                stat.label === 'Cancelled' && { backgroundColor: '#fef2f2', borderColor: '#fee2e2' },
                stat.label === 'Live' && stat.val > 0 && { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' },
              ]}
            >
              <stat.icon size={12} color={stat.color} />
              <Text style={[styles.statVal, { color: stat.color }]}>{stat.val}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#105934" />}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#105934" />
            </View>
          ) : sortedDates.length === 0 ? (
            <View style={styles.centerBox}>
              <ShieldAlert size={40} color="#cbd5e1" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No sessions or scheduled classes found.</Text>
            </View>
          ) : (
            sortedDates.map((dateKey) => {
              const isToday = dateKey === todayStr;
              const isExpanded = !!expandedDates[dateKey];
              const dateItems = groups[dateKey] || [];

              return (
                <View key={dateKey} style={styles.dateGroup}>
                  <TouchableOpacity
                    style={styles.dateHeader}
                    onPress={() =>
                      setExpandedDates((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }))
                    }
                  >
                    <View style={styles.dateHeaderLeft}>
                      {isToday && (
                        <View style={styles.todayChip}>
                          <Text style={styles.todayChipText}>TODAY</Text>
                        </View>
                      )}
                      <Text style={styles.dateText}>{isToday ? 'Today, ' + dateKey : dateKey}</Text>
                      <Text style={styles.countBadge}>({dateItems.length})</Text>
                    </View>
                    {isExpanded ? (
                      <ChevronDown size={18} color="#64748b" />
                    ) : (
                      <ChevronRight size={18} color="#64748b" />
                    )}
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.itemsList}>
                      {dateItems.map((item) => {
                        const isLive = item.status === 'active';
                        const isCancelled = item.status === 'cancelled';
                        const isDone = item.isDone;

                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.sessionCard,
                              isLive && styles.activeCard,
                              isCancelled && styles.cancelledCard,
                            ]}
                            activeOpacity={isDone ? 0.7 : 1}
                            onPress={() => {
                              if (isDone || isCancelled) {
                                openAttendance(item, `${item.subject_name} (${item.date})`);
                              }
                            }}
                          >
                            <View
                              style={[
                                styles.typeBar,
                                {
                                  backgroundColor: item.isCustom
                                    ? '#f59e0b'
                                    : isCancelled
                                    ? '#ef4444'
                                    : isLive
                                    ? '#105934'
                                    : '#2563eb',
                                },
                              ]}
                            />
                            <View style={styles.cardContent}>
                              <View style={styles.cardMain}>
                                <Text
                                  style={[
                                    styles.subjectText,
                                    isCancelled && { textDecorationLine: 'line-through', color: '#94a3b8' },
                                  ]}
                                >
                                  {item.subject_name}
                                </Text>
                                <View
                                  style={[
                                    styles.statusBadge,
                                    {
                                      backgroundColor: isLive
                                        ? '#f0fdf4'
                                        : isCancelled
                                        ? '#fef2f2'
                                        : isDone
                                        ? '#f1f5f9'
                                        : '#eff6ff',
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.statusText,
                                      {
                                        color: isLive
                                          ? '#105934'
                                          : isCancelled
                                          ? '#ef4444'
                                          : isDone
                                          ? '#64748b'
                                          : '#2563eb',
                                      },
                                    ]}
                                  >
                                    {isLive
                                      ? 'Live'
                                      : isCancelled
                                      ? 'Cancelled'
                                      : isDone
                                      ? 'Completed'
                                      : 'Upcoming'}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.metaRow}>
                                <View style={styles.metaItem}>
                                  <User size={12} color="#94a3b8" />
                                  <Text style={styles.metaText}>
                                    Year {item.year} · {item.stream}
                                  </Text>
                                </View>
                                <View style={styles.metaItem}>
                                  <MapPin size={12} color="#94a3b8" />
                                  <Text style={styles.metaText}>{item.room}</Text>
                                </View>
                              </View>

                              <View style={styles.footerRow}>
                                <View style={styles.metaItem}>
                                  <Clock size={12} color="#94a3b8" />
                                  <Text style={styles.metaText}>{item.time_range}</Text>
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.cardActions}>
                                  {isTeacher && (item.status === 'ended' || item.status === 'scheduled' || item.status === 'active') && (
                                    <TouchableOpacity
                                      style={styles.actionBtnShare}
                                      onPress={(e) => {
                                        e.stopPropagation();
                                        handleShareNoteFolder(item);
                                      }}
                                    >
                                      <Folder size={12} color="#059669" />
                                      <Text style={styles.actionBtnShareText}>Share Note</Text>
                                    </TouchableOpacity>
                                  )}
                                  {(isDone || isCancelled) && (
                                    <Text style={styles.checkAttLink}>Check Attendance</Text>
                                  )}
                                  {!isDone && !isCancelled && item.status === 'scheduled' && (
                                    <TouchableOpacity
                                      style={styles.actionBtnCancel}
                                      onPress={(e) => {
                                        e.stopPropagation();
                                        if (item.isCustom) handleCancelCustomSession(item.originalId);
                                        else handleCancelRoutine(item.originalId);
                                      }}
                                    >
                                      <Text style={styles.actionBtnCancelText}>Cancel Class</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
          <View style={{ height: 60 }} />
        </ScrollView>

        {/* Modals */}
        <AddCustomSessionModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchSessionsData}
        />

        <AttendanceModal
          visible={attModal.visible}
          onClose={() => setAttModal((prev) => ({ ...prev, visible: false }))}
          session={attModal.session}
          loading={attModal.loading}
          records={attModal.records}
          title={attModal.title}
        />

        {/* Custom Password Modal */}
        <Modal
          visible={passwordModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setPasswordModal((prev) => ({ ...prev, visible: false }))}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{passwordModal.title}</Text>
              <Text style={styles.modalSubtitle}>{passwordModal.subtitle}</Text>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter password..."
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={passwordModal.password}
                onChangeText={(text) => setPasswordModal((prev) => ({ ...prev, password: text }))}
                editable={!passwordModal.loading}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => setPasswordModal((prev) => ({ ...prev, visible: false }))}
                  disabled={passwordModal.loading}
                >
                  <Text style={styles.modalBtnCancelText}>Abort</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnConfirm]}
                  onPress={submitCancelSession}
                  disabled={passwordModal.loading}
                >
                  {passwordModal.loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalBtnConfirmText}>Confirm Cancel</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SwipeWrapper>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
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
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  newBtn: {
    backgroundColor: '#105934',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#105934',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  newBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
    marginTop: 14,
    marginBottom: 16,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 6,
  },
  statVal: {
    fontSize: 13,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  centerBox: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '700',
  },
  dateGroup: {
    marginBottom: 16,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 12,
  },
  dateHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayChip: {
    backgroundColor: '#105934',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  todayChipText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  countBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
  },
  itemsList: {
    gap: 12,
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  activeCard: {
    borderColor: '#105934',
    backgroundColor: '#f0fdf4',
  },
  cancelledCard: {
    backgroundColor: '#fafafa',
    opacity: 0.85,
  },
  typeBar: {
    width: 5,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  subjectText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1e293b',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 7,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: 10,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkAttLink: {
    fontSize: 12,
    fontWeight: '800',
    color: '#105934',
  },
  actionBtnShare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  actionBtnShareText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  actionBtnCancel: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  actionBtnCancelText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
    lineHeight: 20,
  },
  passwordInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#f1f5f9',
  },
  modalBtnCancelText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 15,
  },
  modalBtnConfirm: {
    backgroundColor: '#ef4444',
    minWidth: 120,
  },
  modalBtnConfirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
