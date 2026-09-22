import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Platform, RefreshControl, Dimensions, Image, StatusBar, Modal, Animated, PanResponder } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import {
  Users, Calendar, CheckCircle, TrendingUp, Clock,
  MapPin, User, Activity, AlertCircle, ChevronRight,
  BookOpen, Plus, Camera, MonitorPlay, XCircle, Bell,
  WifiOff, RefreshCw, Info
} from 'lucide-react-native';
import { SwipeWrapper } from '../../src/components/SwipeWrapper';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useNotifications } from '../../src/context/NotificationContext';
import api from '../../src/api/client';

const { width } = Dimensions.get('window');
const LOGO_ASSET = require('../../assets/images/icon.png');
const AVATAR_COLORS = ['#4ade80', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#22d3ee'];

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAllReadNotifications } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [aiStatus, setAiStatus] = useState<any>({ online: false, displayStatus: 'Connecting...', isError: false });
  const isTeacher = user?.role === 'teacher';

  const [activeSession, setActiveSession] = useState<any>(null);
  const [upcomingSession, setUpcomingSession] = useState<any>(null);
  const [presentStudents, setPresentStudents] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [recentArrivals, setRecentArrivals] = useState<any[]>([]);
  const [studentClasses, setStudentClasses] = useState<any[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isNotifFull, setIsNotifFull] = useState(false);
  const [filterTab, setFilterTab] = useState('all');

  const notifAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showNotifications) {
      setIsNotifFull(false);
      notifAnim.setValue(0);
    }
  }, [showNotifications]);

  const toggleNotifExpand = () => {
    const nextState = !isNotifFull;
    setIsNotifFull(nextState);
    Animated.spring(notifAnim, {
      toValue: nextState ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 65,
    }).start();
  };

  const notifPanResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -20) {
          if (!isNotifFull) toggleNotifExpand();
        } else if (gestureState.dy > 20) {
          if (isNotifFull) toggleNotifExpand();
          else setShowNotifications(false);
        } else {
          toggleNotifExpand();
        }
      }
    })
  ).current;

  const { height: screenHeight } = Dimensions.get('window');
  const notifModalHeight = notifAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight * 0.60, screenHeight * 0.94]
  });
  const notifModalRadius = notifAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [32, 18]
  });

  const filteredNotifs = React.useMemo(() => {
    if (filterTab === 'unread') return notifications.filter(n => !n.is_read);
    return notifications;
  }, [notifications, filterTab]);

  const formatTime = (time: any) => {
    if (!time) return '--:--';
    const timeStr = String(time);
    if (timeStr.includes('Z')) return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let t = timeStr;
    if (timeStr.includes('T')) t = timeStr.split('T')[1].split('.')[0];
    if (t.includes(':')) {
      const parts = t.split(':');
      if (parts.length >= 2) {
        let hours = parseInt(parts[0]);
        const minutes = parts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes} ${ampm}`;
      }
    }
    return timeStr;
  };

  const getTimeRemaining = (startTime: any) => {
    if (!startTime) return '';
    const now = new Date();
    let target = new Date();

    if (String(startTime).includes('T')) {
      target = new Date(startTime);
    } else if (String(startTime).includes(':')) {
      const [h, m] = startTime.split(':');
      target.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    }

    const diff = target.getTime() - now.getTime();
    if (diff <= 0) return 'Starting soon';

    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `in ${mins} mins`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `in ${hours}h ${remMins}m`;
  };

  const fetchDashboardData = async () => {
    try {
      if (isTeacher) {
        // Fetch AI status from backend
        try {
          const statusRes = await api.get('/recognition/status');
          setAiStatus(statusRes.data);
        } catch (e) {
          console.warn("Failed to fetch AI status in mobile:", e);
        }

        const sessionRes = await api.get('/sessions');
        let sessions = sessionRes.data.filter((s: any) => s.status === 'active' || s.status === 'scheduled');
        sessions = sessions.filter((s: any) => String(s.teacher_name).trim().toLowerCase() === String(user?.name || '').trim().toLowerCase());
        
        const currentActive = sessions.find((s: any) => s.status === 'active') || null;
        setActiveSession(currentActive);

        const scheduledSessions = sessions.filter((s: any) => s.status === 'scheduled').sort((a: any, b: any) => {
          return (a.start_time || '').localeCompare(b.start_time || '');
        });
        setUpcomingSession(scheduledSessions[0] || null);

        const statsRes = await api.get('/students');
        setAllStudents(statsRes.data);

        if (currentActive) {
          const attendanceRes = await api.get(`/attendance/session/${currentActive.id}`);
          const students = (attendanceRes.data || []).filter((item: any) => {
            const status = String(item.status || 'present').toLowerCase();
            return ['present', 'detected', 'processing'].includes(status);
          });
          setPresentStudents(students);

          const sortedArrivals = [...students].sort((a: any, b: any) => 
            new Date(b.timestamp || b.marked_at).getTime() - new Date(a.timestamp || a.marked_at).getTime()
          ).slice(0, 10);
          
          setRecentArrivals(sortedArrivals.map((s: any, idx: number) => ({
            id: s.id || String(idx),
            name: s.student_name || s.name || 'Student',
            roll: s.roll_number || 'N/A',
            email: s.email || 'student@college.edu',
            batch: `Year ${currentActive.year} • ${currentActive.stream}`,
            time: formatTime(s.timestamp || s.marked_at),
            status: s.status === 'late' ? 'Late' : 'On Time',
            avatar: s.image_url || `https://i.pravatar.cc/150?u=${s.student_id || s.id || s.roll_number || s.name}`
          })));
        } else {
          setPresentStudents([]);
          setRecentArrivals([]);
        }
      } else {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = dayNames[new Date().getDay()];
        
        const [scheduleRes, attendanceRes, sessionRes] = await Promise.all([
          api.get(`/schedules?year=${user?.year || 3}&stream=${user?.stream || 'CSE'}`),
          api.get('/students/my-attendance'),
          api.get('/sessions')
        ]);

        const finalYear = user?.year || 3;
        const finalStream = user?.stream || 'CSE';

        const todayRegular = (scheduleRes.data || []).filter((s: any) => s.day_of_week === currentDay).map((s: any) => ({ ...s, is_custom: false, is_cancelled: s.is_cancelled }));
        
        const todaySessions = (sessionRes.data || []).filter((s: any) => {
          if (!s.start_time) return false;
          const sessDate = new Date(s.start_time);
          const isToday = sessDate.toDateString() === new Date().toDateString();
          const isMyBatch = String(s.year) === String(finalYear) && String(s.stream).toLowerCase() === String(finalStream).toLowerCase();
          return isToday && isMyBatch;
        }).map((s: any) => {
          const formatSTime = (isoStr: string) => {
            if (!isoStr) return '00:00:00';
            if (isoStr.includes('Z')) {
              return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            }
            return isoStr.includes('T') ? isoStr.split('T')[1].split('.')[0] : isoStr;
          };

          return {
            ...s,
            id: s.id,
            session_id: s.id,
            isSessionRecord: true,
            subject_id: s.subject_id,
            subject_name: s.subject_name,
            teacher_name: s.teacher_name,
            classroom_name: s.classroom_name,
            start_time: formatSTime(s.start_time),
            end_time: formatSTime(s.end_time),
            status: s.status,
            is_custom: s.is_custom,
            is_cancelled: s.status === 'cancelled'
          };
        });

        const toMins = (t: string) => { 
          const p = (t || '00:00').split(':'); 
          return parseInt(p[0]) * 60 + parseInt(p[1]); 
        };

        const filteredRegular = todayRegular.filter((reg: any) =>
          !todaySessions.some((sess: any) => 
            (String(sess.schedule_id) === String(reg.id) || 
            (String(sess.subject_id) === String(reg.subject_id) && Math.abs(toMins(sess.start_time) - toMins(reg.start_time)) < 15))
            && sess.status !== 'cancelled'
          )
        );

        const combinedSchedules = [...todaySessions, ...filteredRegular].sort((a: any, b: any) => toMins(a.start_time) - toMins(b.start_time));

        setStudentClasses(combinedSchedules);
        setStudentAttendance(attendanceRes.data || []);

        const activeBatchSession = (sessionRes.data || []).find((s: any) => 
          s.status === 'active' && 
          String(s.year) === String(finalYear) && 
          String(s.stream).toLowerCase() === String(finalStream).toLowerCase()
        );
        setActiveSession(activeBatchSession);
      }
    } catch (err) {
      console.warn("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusInfo = (item: any) => {
    const isCustom = item.is_custom || item.isCustom || String(item.id).startsWith('sess_');
    
    if (item.is_cancelled || item.status === 'cancelled') {
      return { 
        status: 'cancelled', 
        batchLabel: isCustom ? 'Custom Cancelled' : 'Ended', 
        statusLabel: 'Cancelled', 
        color: '#ef4444', 
        priority: 6,
        theme: 'red'
      };
    }
    
    const isLive = activeSession && (Number(activeSession.schedule_id) === Number(item.id) || Number(activeSession.id) === Number(item.session_id));
    const att = studentAttendance.find(a => {
      if (a.schedule_id && Number(a.schedule_id) === Number(item.id)) return true;
      if (item.session_id && a.session_id && Number(a.session_id) === Number(item.session_id)) return true;
      const isSameSubject = Number(a.subject_id) === Number(item.subject_id);
      const isToday = new Date(a.start_time).toDateString() === new Date().toDateString();
      
      if (isSameSubject && isToday) {
        const [h, m] = (item.start_time || '00:00').split(':');
        const classStart = new Date();
        classStart.setHours(parseInt(h), parseInt(m), 0);
        const attStart = new Date(a.start_time);
        const diff = Math.abs(attStart.getTime() - classStart.getTime()) / (1000 * 60);
        return diff < 45;
      }
      return false;
    });

    if (isLive) {
      let subStatus = 'Not Detected Yet';
      let subColor = '#94a3b8';
      
      if (att) {
        if (att.status === 'detected') { subStatus = 'Found You'; subColor = '#22c55e'; }
        else if (att.status === 'processing') { subStatus = 'Processing You'; subColor = '#0284c7'; }
        else if (att.status === 'present') { subStatus = 'Present'; subColor = '#105934'; }
      }

      return { 
        status: 'live', 
        batchLabel: isCustom ? 'CUSTOM LIVE' : 'LIVE', 
        statusLabel: subStatus, 
        color: subColor, 
        priority: 1, 
        isLive: true,
        theme: isCustom ? 'yellow' : 'emerald'
      };
    }

    const [h2, m2] = (item.end_time || item.raw_end || '23:59').split(':');
    const endTime = new Date();
    endTime.setHours(parseInt(h2), parseInt(m2), 0);
    const isPast = new Date() > endTime || item.status === 'ended';

    if (isPast || (att && (att.status === 'present' || att.status === 'absent'))) {
      const isPresent = att && ['present', 'detected'].includes(att.status);
      return { 
        status: 'ended', 
        batchLabel: isCustom ? 'Custom Ended' : 'Ended', 
        statusLabel: isPresent ? 'Present' : 'Absent', 
        color: isPresent ? '#105934' : '#ef4444', 
        priority: 5,
        theme: 'ash'
      };
    }

    return { 
      status: 'upcoming', 
      batchLabel: 'Upcoming', 
      statusLabel: isCustom ? 'Custom' : 'Regular', 
      color: isCustom ? '#b45309' : '#1d4ed8', 
      priority: 2,
      theme: isCustom ? 'yellow' : 'blue'
    };
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, [user, isTeacher]);

  const activeClassesToday = studentClasses.filter(cls => !cls.is_cancelled && cls.status !== 'cancelled');
  const presentCount = activeClassesToday.filter(cls => 
    studentAttendance.some(att => {
      const isMatch = (att.schedule_id && Number(att.schedule_id) === Number(cls.id)) ||
                      (Number(att.subject_id) === Number(cls.subject_id) && 
                       new Date(att.start_time).toDateString() === new Date().toDateString() &&
                       Math.abs(new Date(att.start_time).getTime() - (new Date().setHours(parseInt(cls.start_time?.split(':')[0]), parseInt(cls.start_time?.split(':')[1]), 0))) / 60000 < 45);
      return isMatch && ['present', 'detected', 'processing'].includes(att.status);
    })
  ).length;
  const totalClassesToday = activeClassesToday.length;
  const attendanceRate = totalClassesToday > 0 ? Math.round((presentCount / totalClassesToday) * 100) : 0;

  let groupTotal = 0;
  const currentBatchSession = activeSession || upcomingSession;
  if (isTeacher && currentBatchSession) {
    groupTotal = allStudents.filter(s => 
      String(s.year).trim() === String(currentBatchSession.year).trim() &&
      String(s.stream).trim().toLowerCase() === String(currentBatchSession.stream).toLowerCase()
    ).length;
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // Status colors & labels for Active Session
  const isCustomActive = activeSession?.is_custom || activeSession?.session_type === 'custom';
  const activeBgColor = isCustomActive ? '#ca8a04' : '#105934';
  const activeLabel = isCustomActive ? 'CUSTOM LIVE' : 'REGULAR LIVE';

  // Status colors & labels for Upcoming Session
  const isCustomUpcoming = upcomingSession?.is_custom || upcomingSession?.session_type === 'custom';
  const upcomingBgColor = isCustomUpcoming ? '#b45309' : '#1e3a8a';
  const upcomingDotColor = isCustomUpcoming ? '#fef08a' : '#60a5fa';
  const upcomingPillBg = isCustomUpcoming ? 'rgba(254, 240, 138, 0.2)' : 'rgba(59, 130, 246, 0.2)';
  const upcomingPillBorder = isCustomUpcoming ? 'rgba(254, 240, 138, 0.3)' : 'rgba(59, 130, 246, 0.3)';
  const upcomingLabel = isCustomUpcoming ? 'CUSTOM UPCOMING' : 'REGULAR UPCOMING';

  return (
    <SwipeWrapper>
      <View style={styles.mainContainer}>
        <StatusBar barStyle="dark-content" />
        
        {/* Unified Navbar */}
        <View style={styles.navbarStandalone}>
          <View style={styles.navbarLeft}>
            <Image source={LOGO_ASSET} style={styles.logo} />
            <Text style={styles.appName} numberOfLines={1}>Merge</Text>
          </View>
          <View style={styles.navbarRight}>
            <TouchableOpacity style={styles.notifBtn} onPress={() => setShowNotifications(true)}>
              <Bell size={22} color="#0f172a" strokeWidth={2.2} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications Modal */}
        <Modal
          visible={showNotifications}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowNotifications(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.overlayDismiss} activeOpacity={1} onPress={() => setShowNotifications(false)} />
            <Animated.View style={[styles.notifModal, { height: notifModalHeight, maxHeight: undefined, borderTopLeftRadius: notifModalRadius as any, borderTopRightRadius: notifModalRadius as any }]}>
              {/* Top Drag Pull Pill */}
              <View {...notifPanResponder.panHandlers} style={styles.dragPillWrapper}>
                <View style={styles.dragPill} />
              </View>

              <View style={styles.notifHeader}>
                <View>
                  <Text style={styles.notifTitle}>Notifications</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Real-time updates & alerts</Text>
                </View>
                <TouchableOpacity onPress={() => setShowNotifications(false)} style={styles.closeBtn}>
                  <XCircle size={26} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.notifSubbar}>
                <View style={styles.notifTabs}>
                  <TouchableOpacity 
                    style={[styles.notifTabBtn, filterTab === 'all' && styles.notifTabBtnActive]} 
                    onPress={() => setFilterTab('all')}
                  >
                    <Text style={[styles.notifTabBtnText, filterTab === 'all' && styles.notifTabBtnTextActive]}>
                      All ({notifications.length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.notifTabBtn, filterTab === 'unread' && styles.notifTabBtnActive]} 
                    onPress={() => setFilterTab('unread')}
                  >
                    <Text style={[styles.notifTabBtnText, filterTab === 'unread' && styles.notifTabBtnTextActive]}>
                      Unread ({unreadCount})
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.notifActions}>
                  {unreadCount > 0 && (
                    <TouchableOpacity onPress={markAllAsRead}>
                      <Text style={styles.notifActionText}>Mark all read</Text>
                    </TouchableOpacity>
                  )}
                  {notifications.some(n => n.is_read) && (
                    <TouchableOpacity onPress={clearAllReadNotifications}>
                      <Text style={[styles.notifActionText, { color: '#94a3b8' }]}>Clear read</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {filteredNotifs.length === 0 ? (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                    <Bell size={40} color="#cbd5e1" style={{ marginBottom: 12 }} />
                    <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '700' }}>
                      {filterTab === 'unread' ? 'No unread notifications' : 'No new notifications'}
                    </Text>
                  </View>
                ) : (
                  filteredNotifs.map((notif) => (
                    <TouchableOpacity 
                      key={notif.id} 
                      style={[styles.notifItem, !notif.is_read && styles.unreadItem]}
                      activeOpacity={notif.redirect_url ? 0.7 : 1}
                      onPress={() => {
                        if (!notif.is_read) markAsRead(notif.id);
                        if (notif.redirect_url) {
                          setShowNotifications(false);
                          const mobileUrl = notif.redirect_url.replace(/^\/routine/, '/schedule');
                          router.push(mobileUrl as any);
                        }
                      }}
                    >
                      {notif.sender_image ? (
                        <Image source={{ uri: notif.sender_image }} style={styles.notifAvatar} />
                      ) : (
                        <View style={[styles.notifIcon, { 
                          backgroundColor: notif.priority === 'critical' ? '#fee2e2' : '#f1f5f9' 
                        }]}>
                          {notif.priority === 'critical' ? <AlertCircle size={20} color="#ef4444" /> : <Info size={20} color="#105934" />}
                        </View>
                      )}

                      <View style={styles.notifContent}>
                        <View style={styles.notifRow}>
                          <View style={[styles.notifPriorityBadge, notif.priority === 'critical' ? styles.criticalBadge : { backgroundColor: '#dcfce7' }]}>
                            <Text style={notif.priority === 'critical' ? styles.criticalBadgeText : styles.normalBadgeText}>
                              {String(notif.session_type || notif.priority || 'system').toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.notifTime}>
                            {new Date(notif.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        {notif.title && <Text style={styles.notifItemTitle}>{notif.title}</Text>}
                        <Text style={styles.notifMessage}>{notif.message}</Text>
                      </View>

                      <TouchableOpacity style={{ padding: 8 }} onPress={() => deleteNotification(notif.id)}>
                        <XCircle size={16} color="#cbd5e1" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>

        <ScrollView 
          style={styles.container} 
          contentContainerStyle={[styles.scrollContent]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#105934" />}
        >
          {/* Hero Section with Floating Card for Teacher */}
          {isTeacher && (
            <View style={styles.heroWrapper}>
              <View style={styles.headerContainer}>
                <LinearGradient
                  colors={['#ffffff', '#ffffff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.masterHeader}
                />
              </View>

              <View style={styles.heroCardPositioner}>
                <View style={[
                  styles.heroCard,
                  activeSession 
                    ? { backgroundColor: activeBgColor } 
                    : upcomingSession 
                    ? { backgroundColor: upcomingBgColor, borderColor: 'rgba(255, 255, 255, 0.15)' }
                    : { backgroundColor: '#105934' }
                ]}>
                  {activeSession ? (
                    <>
                      {isCustomActive && (
                        <View style={styles.customBadgeTop}>
                          <Text style={styles.customBadgeTextTop}>★ CUSTOM SESSION</Text>
                        </View>
                      )}
                      <View style={styles.cardTopRow}>
                        <Text style={styles.heroSubjectCard} numberOfLines={1}>{activeSession.subject_name}</Text>
                        <View style={styles.badgeRow}>
                          <View style={[styles.liveIndicatorCard, isCustomActive && { backgroundColor: 'rgba(254, 240, 138, 0.25)', borderColor: 'rgba(254, 240, 138, 0.4)' }]}>
                            <View style={[styles.liveDot, isCustomActive && { backgroundColor: '#fef08a' }]} />
                            <Text style={styles.liveTextCard}>{activeLabel}</Text>
                          </View>
                        </View>
                      </View>
                      
                      <View style={styles.heroMetaRowCard}>
                        <Text style={styles.heroMetaCard}>
                          {activeSession.classroom_name} • {activeSession.camera_name || 'Camera'}
                        </Text>
                      </View>

                      <View style={styles.heroFooterCard}>
                        <View style={styles.heroTagCard}><Text style={styles.heroTagTextCard}>Year {activeSession.year}</Text></View>
                        <View style={styles.heroTagCard}><Text style={styles.heroTagTextCard}>{activeSession.stream}</Text></View>
                        <View style={styles.heroTimeCard}>
                          <Clock size={15} color="#fff" strokeWidth={2.5} />
                          <Text style={styles.heroTimeTextCard}>{formatTime(activeSession.start_time)} – {formatTime(activeSession.end_time)}</Text>
                        </View>
                      </View>

                      {aiStatus && (
                        <View style={[
                          styles.heroAiStatus, 
                          aiStatus.isError ? styles.heroAiStatusError : styles.heroAiStatusActive
                        ]}>
                          <Activity size={12} color={aiStatus.isError ? '#fca5a5' : '#ffffff'} />
                          <Text style={aiStatus.isError ? styles.heroAiStatusTextError : styles.heroAiStatusText}>
                            AI Scanner: {aiStatus.displayStatus}
                          </Text>
                        </View>
                      )}
                    </>
                  ) : upcomingSession ? (
                    <>
                      {isCustomUpcoming && (
                        <View style={styles.customBadgeTop}>
                          <Text style={styles.customBadgeTextTop}>★ CUSTOM SESSION</Text>
                        </View>
                      )}
                      <View style={styles.cardTopRow}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={{ fontSize: 11, fontWeight: '900', color: isCustomUpcoming ? '#fef08a' : '#fbbf24', letterSpacing: 0.5, marginBottom: 4 }}>
                            YOU HAVE NO CLASS RIGHT NOW
                          </Text>
                          <Text style={styles.heroSubjectCard} numberOfLines={1}>
                            Next: {upcomingSession.subject_name}
                          </Text>
                        </View>
                        <View style={styles.badgeRow}>
                          <View style={[styles.liveIndicatorCard, { backgroundColor: upcomingPillBg, borderColor: upcomingPillBorder }]}>
                            <View style={[styles.liveDot, { backgroundColor: upcomingDotColor }]} />
                            <Text style={styles.liveTextCard}>{upcomingLabel}</Text>
                          </View>
                        </View>
                      </View>
                      
                      <View style={styles.heroMetaRowCard}>
                        <Text style={styles.heroMetaCard}>
                          {upcomingSession.classroom_name} • {getTimeRemaining(upcomingSession.start_time)}
                        </Text>
                      </View>

                      <View style={styles.heroFooterCard}>
                        <View style={styles.heroTagCard}><Text style={styles.heroTagTextCard}>Year {upcomingSession.year}</Text></View>
                        <View style={styles.heroTagCard}><Text style={styles.heroTagTextCard}>{upcomingSession.stream}</Text></View>
                        <View style={styles.heroTimeCard}>
                          <Clock size={15} color="#fff" strokeWidth={2.5} />
                          <Text style={styles.heroTimeTextCard}>{formatTime(upcomingSession.start_time)} – {formatTime(upcomingSession.end_time)}</Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 }}>
                      <CheckCircle size={40} color="#fff" style={{ marginBottom: 10, opacity: 0.8 }} />
                      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>No Active Session</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 5 }}>You have no classes currently running.</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Stats Section */}
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              {isTeacher ? (
                <>
                  <View style={[styles.statCard, { flex: 1.5 }]}>
                    <Text style={styles.statLabel}>STUDENTS IN CLASS</Text>
                    <Text style={styles.statValue}>{currentBatchSession ? groupTotal : 0}</Text>
                    <View style={styles.statFooter}>
                      <Users size={12} color="#64748b" />
                      <Text style={styles.statFooterText}>{currentBatchSession ? `Year ${currentBatchSession.year} • ${currentBatchSession.stream}` : 'No Session'}</Text>
                    </View>
                  </View>
                  <View style={[styles.statCard, { flex: 1 }]}>
                    <Text style={styles.statLabel}>PRESENT</Text>
                    <Text style={styles.statValue}>{activeSession ? presentStudents.length : 0}</Text>
                    <Text style={styles.statFooterText}>Identified</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={[styles.statCard, { flex: 1 }]}>
                    <Text style={styles.statLabel}>CLASSES TODAY</Text>
                    <Text style={styles.statValue}>{totalClassesToday}</Text>
                    <View style={styles.statFooter}>
                      <Clock size={12} color="#105934" />
                      <Text style={styles.statFooterText}>Done: {presentCount}</Text>
                    </View>
                  </View>
                  <View style={[styles.statCard, { flex: 1.3, backgroundColor: '#f8fafc', overflow: 'hidden' }]}>
                    <View style={[styles.cardProgressFill, { width: `${attendanceRate}%` }]}>
                      <LinearGradient
                        colors={['rgba(16, 89, 52, 0.12)', 'rgba(34, 197, 94, 0.08)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ flex: 1 }}
                      />
                    </View>

                    <View style={styles.progressHeader}>
                      <Text style={styles.statLabel}>PACE</Text>
                      <TrendingUp size={12} color="#105934" />
                    </View>
                    
                    <View style={styles.fullProgressWrapper}>
                      <View style={styles.fullProgressLabelRow}>
                        <Text style={styles.fullProgressValue}>{attendanceRate}%</Text>
                        <Text style={styles.fullProgressSub}>Rate</Text>
                      </View>
                    </View>
                    <Text style={styles.statFooterText}>Today's Pace</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Sections */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{isTeacher ? "Recent Arrivals" : "Classes"}</Text>
              {!isTeacher && <Text style={styles.viewAll}>Today</Text>}
            </View>

            {(!isTeacher && studentClasses.length === 0) ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No class today</Text>
              </View>
            ) : (isTeacher ? recentArrivals : [...studentClasses].sort((a, b) => {
              const aInfo = getStatusInfo(a);
              const bInfo = getStatusInfo(b);
              if (aInfo.priority !== bInfo.priority) return aInfo.priority - bInfo.priority;
              return (a.start_time || '').localeCompare(b.start_time || '');
            })).map((item: any, idx: number) => {
              const isArrival = isTeacher;
              const ringColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              
              const sInfo = !isTeacher ? getStatusInfo(item) : { 
                status: '', 
                batchLabel: '', 
                statusLabel: '', 
                color: '#64748b', 
                isLive: false,
                theme: 'emerald'
              };
              const status = sInfo.status;
              const statusLabel = sInfo.statusLabel;
              const statusColor = sInfo.color;
              const batchLabel = sInfo.batchLabel;
              const isClassLive = sInfo.isLive;
              const theme = sInfo.theme;

              const themeColors = {
                emerald: { border: '#105934', bg: '#f0fdf4', text: '#105934' },
                blue: { border: '#1d4ed8', bg: '#eff6ff', text: '#1d4ed8' },
                yellow: { border: '#b45309', bg: '#fffbeb', text: '#b45309' },
                ash: { border: '#94a3b8', bg: '#f8fafc', text: '#64748b' },
                red: { border: '#ef4444', bg: '#fef2f2', text: '#ef4444' },
              };
              const activeTheme = themeColors[theme as keyof typeof themeColors] || themeColors.ash;

              return (
                <View 
                  key={idx} 
                  style={[
                    styles.activityCard, 
                    !isTeacher && isClassLive && { borderColor: activeTheme.border, borderWidth: 1.5, backgroundColor: activeTheme.bg },
                    !isTeacher && !isClassLive && theme === 'blue' && { borderColor: activeTheme.border + '30', borderWidth: 1, backgroundColor: '#fff' },
                    !isTeacher && !isClassLive && theme === 'yellow' && { borderColor: '#facc15', borderWidth: 1.5, backgroundColor: '#fefce8' },
                    !isTeacher && theme === 'ash' && { opacity: 0.8, backgroundColor: '#f9fafb' },
                    !isTeacher && theme === 'red' && { backgroundColor: '#fff5f5', borderColor: '#feb2b2', borderWidth: 1 }
                  ]}
                >
                  {isArrival && (
                    <View style={[styles.avatarRing, { borderColor: ringColor }]}>
                      <Image source={{ uri: item.avatar }} style={styles.avatar} />
                    </View>
                  )}
                  <View style={styles.activityInfo}>
                    <View style={styles.subjectRowHeader}>
                      <Text 
                        style={[
                          styles.activitySubject, 
                          !isTeacher && theme === 'red' && { textDecorationLine: 'line-through', color: '#ef4444' },
                          !isTeacher && theme === 'ash' && { color: '#64748b' }
                        ]} 
                        numberOfLines={1}
                      >
                        {isArrival ? item.name : item.subject_name}
                      </Text>
                      {!isTeacher && batchLabel !== '' && (
                        <View style={[styles.liveTagMini, { backgroundColor: activeTheme.border }]}>
                          {isClassLive && <View style={styles.liveDot} />}
                          <Text style={styles.liveTagTextMini}>{batchLabel}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.activityMeta} numberOfLines={1}>
                      {isArrival ? `Roll: ${item.roll} • ${item.batch}` : `${item.teacher_name} • ${item.classroom_name}`}
                    </Text>
                    <View style={styles.timeRow}>
                      <Clock size={12} color={!isTeacher ? activeTheme.text : '#64748b'} />
                      <Text style={[styles.activityTime, { color: !isTeacher ? activeTheme.text : '#64748b' }]}>
                        {isArrival ? item.time : `${formatTime(item.start_time)} - ${formatTime(item.end_time)}`}
                      </Text>
                    </View>
                  </View>
                  
                  {isArrival && (
                    <View style={styles.arrivalRight}>
                      <View style={styles.timeBadge}>
                        <Clock size={12} color="#105934" />
                        <Text style={styles.timeBadgeText}>{item.time}</Text>
                      </View>
                    </View>
                  )}
                  {!isArrival && (
                    <View style={[styles.statusBadgeFull, { backgroundColor: statusColor + '15' }]}>
                      <Text style={[styles.statusTextFull, { color: statusColor }]}>
                        {statusLabel}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      </View>
    </SwipeWrapper>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  navbarStandalone: {
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  heroWrapper: {
    height: 250,
    backgroundColor: '#fff',
    marginBottom: 15,
  },
  headerContainer: {
    width: width * 1.8,
    height: 180,
    alignSelf: 'center',
    borderBottomLeftRadius: width * 0.9,
    borderBottomRightRadius: width * 0.9,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  masterHeader: {
    flex: 1,
  },
  navbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  appName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#105934',
    letterSpacing: -0.5,
  },
  navbarRight: {
    alignItems: 'flex-end',
  },
  notifBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  notifDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
  },
  heroCardPositioner: {
    position: 'absolute',
    top: 5,
    width: width,
    paddingHorizontal: 20,
    zIndex: 2,
  },
  heroCard: {
    backgroundColor: '#105934',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#105934',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  customBadgeTop: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(254, 240, 138, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(254, 240, 138, 0.4)',
  },
  customBadgeTextTop: {
    color: '#fef08a',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroSubjectCard: {
    flex: 1,
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    marginRight: 10,
  },
  heroMetaRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  heroMetaCard: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveIndicatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  liveTextCard: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroFooterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  heroTagCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  heroTagTextCard: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  heroTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  heroTimeTextCard: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  statsContainer: {
    paddingHorizontal: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    marginVertical: 4,
  },
  statFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statFooterText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  viewAll: {
    color: '#105934',
    fontSize: 12,
    fontWeight: '900',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    letterSpacing: 0.5,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  avatarRing: {
    padding: 2,
    borderRadius: 30,
    borderWidth: 2,
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  activityInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  activitySubject: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  activityMeta: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 1,
  },
  activityTime: {
    fontSize: 11,
    color: '#105934',
    fontWeight: '700',
    marginTop: 4,
  },
  arrivalRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  timeBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  timeBadgeText: {
    fontSize: 13,
    color: '#105934',
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  subjectRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  liveTagMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#105934',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveTagTextMini: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  statusBadgeFull: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 85,
    alignItems: 'center',
  },
  statusTextFull: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  overlayDismiss: {
    ...StyleSheet.absoluteFill,
  },
  dragPillWrapper: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: -12,
    marginBottom: 12,
    width: '100%',
  },
  dragPill: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  notifModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  notifTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 4,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  notifContent: {
    flex: 1,
  },
  notifRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  notifItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  notifTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  notifMessage: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    lineHeight: 18,
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  notifBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  notifSubbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 16,
  },
  notifTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  notifTabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  notifTabBtnActive: {
    backgroundColor: '#105934',
  },
  notifTabBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
  },
  notifTabBtnTextActive: {
    color: '#ffffff',
  },
  notifActions: {
    flexDirection: 'row',
    gap: 12,
  },
  notifActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#105934',
  },
  notifAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 16,
  },
  unreadItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 12,
  },
  notifPriorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  criticalBadge: { backgroundColor: '#fee2e2' },
  criticalBadgeText: { color: '#ef4444', fontSize: 9, fontWeight: '900' },
  normalBadgeText: { color: '#105934', fontSize: 9, fontWeight: '900' },
  fullProgressValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  fullProgressSub: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginLeft: 4,
  },
  fullProgressWrapper: {
    alignItems: 'center',
    marginVertical: 12,
  },
  fullProgressLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  cardProgressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 89, 52, 0.05)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroAiStatus: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  heroAiStatusActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroAiStatusError: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  heroAiStatusText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  heroAiStatusTextError: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '800',
  },
});



