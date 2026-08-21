import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Platform,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ChevronDown,
  User,
  Plus,
  CheckCircle2,
  XCircle,
} from 'lucide-react-native';
import { SwipeWrapper } from '../../src/components/SwipeWrapper';
import api from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { AttendanceModal } from '../../src/components/AttendanceModal';
import { useLocalSearchParams, useRouter } from 'expo-router';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS: { [key: string]: string } = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const STREAMS = ['CSE', 'CSBS', 'ECE', 'ME'];

const getWeekStart = (offset = 0) => {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const formatISODate = (date: any) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getCurrentDayName = () => {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return dayNames[new Date().getDay()];
};

export default function ScheduleScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  const canManage = isTeacher || user?.role === 'admin';

  const { week_start, highlight } = useLocalSearchParams<{ week_start?: string; highlight?: string }>();

  const [selectedDay, setSelectedDay] = useState(getCurrentDayName());
  const [selectedYear, setSelectedYear] = useState(
    user?.year
      ? `${user.year}${
          user.year === 1 ? 'st' : user.year === 2 ? 'nd' : user.year === 3 ? 'rd' : 'th'
        } Year`
      : '2nd Year'
  );
  const [selectedStream, setSelectedStream] = useState(user?.stream || 'CSE');
  const [showYearModal, setShowYearModal] = useState(false);
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [customSessions, setCustomSessions] = useState<any[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  const [attModal, setAttModal] = useState({
    visible: false,
    loading: false,
    session: null as any,
    records: [] as any[],
    title: '',
  });

  useEffect(() => {
    if (week_start) {
      const targetDate = new Date(week_start);
      if (!isNaN(targetDate.getTime())) {
        const currentMonday = getWeekStart(0);
        const diffWeeks = Math.round((targetDate.getTime() - currentMonday.getTime()) / (7 * 24 * 3600 * 1000));
        setWeekOffset(diffWeeks);

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        setSelectedDay(dayNames[targetDate.getDay()] || 'Mon');
      }
    }
  }, [week_start, highlight]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const yearVal = selectedYear.split('')[0];
      const weekStartParam = formatISODate(getWeekStart(weekOffset));

      const [slotRes, schedRes, sessRes, attRes] = await Promise.all([
        api.get(`/time_slots?week_start=${weekStartParam}`),
        api.get(`/schedules?year=${yearVal}&stream=${selectedStream}&week_start=${weekStartParam}`),
        api.get(`/sessions?week_start=${weekStartParam}`), // Fetch all sessions for this week exactly like desktop
        isStudent ? api.get('/students/my-attendance') : Promise.resolve({ data: [] }),
      ]);

      const sortedSlots = (slotRes.data || []).sort((a: any, b: any) =>
        (a.raw_start || '').localeCompare(b.raw_start || '')
      );
      const combinedSchedules = (schedRes.data || []).sort((a: any, b: any) => {
        if (a.is_snapshot_history && !b.is_snapshot_history) return -1;
        if (!a.is_snapshot_history && b.is_snapshot_history) return 1;
        return 0;
      });

      const allSess = sessRes.data || [];
      const filteredCustom = allSess.filter((s: any) => {
        if (!s.is_custom) return false;
        if (String(s.year) !== String(yearVal)) return false;
        if (String(s.stream).toLowerCase() !== String(selectedStream).toLowerCase()) return false;
        return true;
      });

      setTimeSlots(sortedSlots);
      setSchedules(combinedSchedules);
      setCustomSessions(filteredCustom);
      setAllSessions(allSess);
      setStudentAttendance(attRes.data || []);
    } catch (err) {
      console.warn('Failed to fetch timetable data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedStream, weekOffset]);

  const weekStart = getWeekStart(weekOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekText = `${weekStart.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })} - ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const isCurrentTimeSlot = (slot: any) => {
    if (weekOffset !== 0 || selectedDay !== getCurrentDayName()) return false;
    if (!slot.raw_start || !slot.raw_end) return false;

    const [h1, m1] = slot.raw_start.split(':');
    const [h2, m2] = slot.raw_end.split(':');

    const start = new Date(now);
    start.setHours(parseInt(h1, 10), parseInt(m1, 10), 0, 0);

    const end = new Date(now);
    end.setHours(parseInt(h2, 10), parseInt(m2, 10), 0, 0);

    return now >= start && now <= end;
  };

  const isPastOrEnded = (slot: any, dayName: string, matchingSession: any) => {
    if (matchingSession && (matchingSession.status === 'ended' || matchingSession.status === 'completed' || matchingSession.status === 'cancelled')) {
      return true;
    }
    if (weekOffset < 0) return true;
    if (weekOffset > 0) return false;

    const academicDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const jsDay = new Date().getDay();
    const todayAcademicIdx = (jsDay + 6) % 7; // Convert JS (0=Sun, 1=Mon) to Academic (0=Mon, 6=Sun)
    const targetAcademicIdx = academicDays.indexOf(dayName);

    if (targetAcademicIdx < todayAcademicIdx) return true;
    if (targetAcademicIdx > todayAcademicIdx) return false;

    const nowMin = now.getHours() * 60 + now.getMinutes();
    const [eh, em] = (slot.raw_end || slot.end_time || '00:00').split(':');
    return nowMin >= parseInt(eh, 10) * 60 + parseInt(em, 10);
  };

  const openCardAttendance = async (item: any, matchingSession: any, dayName: string) => {
    let targetSessionId = null;
    if (item.is_custom || item.session_id) {
      targetSessionId = item.session_id || item.id;
    } else if (matchingSession) {
      targetSessionId = matchingSession.id;
    }

    if (!targetSessionId) {
      Alert.alert('No Session Record', 'No session record exists in the database for this class.');
      return;
    }

    setAttModal({
      visible: true,
      loading: true,
      session: item,
      records: [],
      title: `${item.subject_name || 'Class'} (${dayName})`,
    });

    try {
      const r = await api.get(`/attendance/session/${targetSessionId}?include_absent=true`);
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

  const SelectionModal = ({ visible, options, onSelect, onClose, title }: any) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          {options.map((opt: any) => (
            <TouchableOpacity
              key={opt}
              style={styles.modalOption}
              onPress={() => {
                onSelect(opt);
                onClose();
              }}
            >
              <Text style={styles.modalOptionText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <SwipeWrapper>
      <View style={styles.mainContainer}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Routine</Text>
            
            {canManage && (
              <View style={styles.dropdowns}>
                <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowYearModal(true)}>
                  <Text style={styles.dropdownText}>{selectedYear.split(' ')[0]}</Text>
                  <ChevronDown size={12} color="#64748b" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowStreamModal(true)}>
                  <Text style={styles.dropdownText}>{selectedStream}</Text>
                  <ChevronDown size={12} color="#64748b" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Teacher Sessions Quick Access Banner */}
          {canManage && (
            <TouchableOpacity 
              style={styles.sessionsBanner} 
              onPress={() => router.push('/sessions' as any)}
              activeOpacity={0.8}
            >
              <View style={styles.sessionsBannerLeft}>
                <View style={styles.sessionsIconWrapper}>
                  <Clock size={16} color="#105934" strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionsBannerTitle}>Manage Class Sessions</Text>
                  <Text style={styles.sessionsBannerSubtitle}>Take attendance, upload notes & custom classes</Text>
                </View>
              </View>
              <ChevronRight size={18} color="#105934" />
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <View style={[styles.weekSelector, { flex: 1 }]}>
              <TouchableOpacity style={styles.navBtn} onPress={() => setWeekOffset((prev) => prev - 1)}>
                <ChevronLeft size={20} color="#105934" />
              </TouchableOpacity>
              <View style={styles.dateInfo}>
                <CalendarIcon size={14} color="#105934" style={{ marginRight: 6 }} />
                <Text style={styles.weekText}>{weekText}</Text>
              </View>
              <TouchableOpacity style={styles.navBtn} onPress={() => setWeekOffset((prev) => prev + 1)}>
                <ChevronRight size={20} color="#105934" />
              </TouchableOpacity>
            </View>

            {weekOffset !== 0 && (
              <TouchableOpacity
                style={styles.todayBtn}
                onPress={() => {
                  setWeekOffset(0);
                  setSelectedDay(getCurrentDayName());
                }}
              >
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.daysRowWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysRow}>
            {DAYS.map((day) => (
              <TouchableOpacity
                key={day}
                style={[styles.dayButton, selectedDay === day && styles.dayButtonActive]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[styles.dayText, selectedDay === day && styles.dayTextActive]}>{day}</Text>
                {selectedDay === day && <View style={styles.activeDot} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#105934" />
          </View>
        ) : (
          <FlatList
            data={timeSlots}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: slot }) => {
              const fullDayName = FULL_DAYS[selectedDay as keyof typeof FULL_DAYS];
              const slotPrefix = String(slot.raw_start || slot.start_time || '').substring(0, 5);

              const matches = schedules.filter((d) => {
                const isSameDay = String(d.day_of_week || '').trim().toLowerCase() === String(fullDayName).trim().toLowerCase();
                const schedPrefix = String(d.start_time || '').substring(0, 5);
                return isSameDay && slotPrefix === schedPrefix;
              });

              const targetDateObj = new Date(weekStart);
              const dayOffset = (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(selectedDay) + 7) % 7;
              targetDateObj.setDate(targetDateObj.getDate() + dayOffset);
              const targetDateStr = formatISODate(targetDateObj);

              const customMatches = customSessions.filter((c) => {
                if (!c.start_time) return false;
                const d = new Date(c.start_time);
                if (isNaN(d.getTime())) return false;
                // Extract date and time parts in IST to correctly match the slot
                const istParts = new Intl.DateTimeFormat('en-CA', {
                  timeZone: 'Asia/Kolkata',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }).formatToParts(d);
                const getPart = (t: string) => istParts.find(p => p.type === t)?.value || '00';
                const cDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
                const cHour = getPart('hour').padStart(2, '0');
                const cMinute = getPart('minute').padStart(2, '0');
                const cPrefix = `${cHour}:${cMinute}`;
                return cDate === targetDateStr && cPrefix === slotPrefix;
              });

              const allMatches = [...matches, ...customMatches];
              const isCurrent = isCurrentTimeSlot(slot);
              const [startFull, startAmpm] = (slot.start_time || '').split(' ');

              return (
                <View style={[styles.scheduleItem, isCurrent && styles.currentScheduleItem]}>
                  {isCurrent && <View style={styles.currentIndicator} />}
                  <View style={styles.timeColumn}>
                    <Text style={[styles.timeStart, isCurrent && { color: '#105934' }]}>{startFull}</Text>
                    <Text style={styles.timeAmPm}>{startAmpm}</Text>
                    <View style={[styles.timeSeparator, isCurrent && { backgroundColor: '#10593450' }]} />
                    <Text style={styles.timeEnd}>{slot.end_time}</Text>
                  </View>

                  <View style={styles.cardContainer}>
                    {allMatches.length > 0 ? (
                      allMatches.map((item, mIdx) => {
                        let statusColor = '#cbd5e1';
                        let statusLabel = 'FREE';

                        const isCancelled = item.is_cancelled || item.status === 'cancelled';

                        if (isCancelled) {
                          statusColor = '#ef4444';
                          statusLabel = 'CANCELLED';
                        } else if (item.session_type === 'custom' || item.is_custom) {
                          statusColor = '#eab308';
                          statusLabel = 'CUSTOM';
                        } else {
                          statusColor = '#105934';
                          statusLabel = 'REGULAR';
                        }

                        // Matching historical database session for regular routine schedules
                        const matchingSession = item.is_custom
                          ? item
                          : allSessions.find((sess) => {
                              if (sess.is_custom) return false;
                              if (String(sess.schedule_id) === String(item.id)) return true;
                              if (String(sess.subject_id) !== String(item.subject_id)) return false;
                              if (!sess.start_time) return false;
                              const sDate = new Date(sess.start_time);
                              // Use IST for date/hour comparison
                              const sIstParts = new Intl.DateTimeFormat('en-CA', {
                                timeZone: 'Asia/Kolkata',
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              }).formatToParts(sDate);
                              const sGetP = (t: string) => sIstParts.find(p => p.type === t)?.value || '00';
                              const sDateStr = `${sGetP('year')}-${sGetP('month')}-${sGetP('day')}`;
                              if (sDateStr !== targetDateStr) return false;
                              const sPrefix = `${sGetP('hour').padStart(2, '0')}:${sGetP('minute').padStart(2, '0')}`;
                              return sPrefix === slotPrefix;
                            });

                        const isCompletedOrPast = isPastOrEnded(slot, selectedDay, matchingSession);
                        const canCheck = canManage && isCompletedOrPast && !isStudent && matchingSession;

                        let studentAttStatus: string | null = null;
                        if (isStudent && isCompletedOrPast && !isCancelled) {
                          const isPres = studentAttendance.some(att => {
                            const targetSessId = item.is_custom ? item.id : (matchingSession ? matchingSession.id : null);
                            if (targetSessId && (String(att.session_id) === String(targetSessId) || String(att.schedule_id) === String(item.id))) {
                              return att.status === 'present';
                            }
                            if (!att.start_time && !att.marked_at) return false;
                            const attDate = new Date(att.start_time || att.marked_at);
                            if (formatISODate(attDate) !== targetDateStr) return false;
                            if (String(att.subject_id) !== String(item.subject_id)) return false;
                            if (att.status !== 'present') return false;
                            const [slotH, slotM] = slotPrefix.split(':');
                            const slotMins = parseInt(slotH, 10) * 60 + parseInt(slotM, 10);
                            const attMins = attDate.getHours() * 60 + attDate.getMinutes();
                            return Math.abs(slotMins - attMins) < 45;
                          });
                          studentAttStatus = isPres ? 'present' : 'absent';
                        }

                        const targetId = item.is_custom ? item.id : (matchingSession ? matchingSession.id : item.id);
                        const isHighlighted = highlight && String(targetId) === String(highlight);

                        return (
                          <View
                            key={item.id + '_' + mIdx}
                            style={[
                              styles.card,
                              {
                                borderColor: statusColor + '20',
                                marginBottom: mIdx < allMatches.length - 1 ? 8 : 0,
                              },
                              isCancelled && styles.cancelledCardBg,
                              isHighlighted && {
                                borderWidth: 2.5,
                                borderColor: '#eab308',
                                backgroundColor: '#fefce8',
                              }
                            ]}
                          >
                            <View style={[styles.typeBar, { backgroundColor: isHighlighted ? '#eab308' : statusColor }]} />
                            <View style={styles.cardHeader}>
                              {isHighlighted && (
                                <View style={{ backgroundColor: '#fef08a', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 6, borderWidth: 1, borderColor: '#facc15' }}>
                                  <Text style={{ color: '#854d0e', fontSize: 10, fontWeight: '900' }}>★ HIGHLIGHTED CLASS</Text>
                                </View>
                              )}
                              <View style={styles.subjectRow}>
                                <Text style={[styles.subjectText, isCancelled && styles.cancelledText]}>
                                  {item.subject_name}
                                </Text>
                                {studentAttStatus ? (
                                  <View style={[styles.attendanceChip, studentAttStatus === 'present' ? styles.chipPresent : styles.chipAbsent]}>
                                    {studentAttStatus === 'present' ? (
                                      <CheckCircle2 size={12} color="#105934" />
                                    ) : (
                                      <XCircle size={12} color="#ef4444" />
                                    )}
                                    <Text style={[styles.chipText, { color: studentAttStatus === 'present' ? '#105934' : '#ef4444' }]}>
                                      {studentAttStatus === 'present' ? 'Attended' : 'Absent'}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>

                              <View style={styles.badgesContainer}>
                                <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                                  <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                                </View>
                              </View>

                              <View style={styles.cardFooter}>
                                <View style={styles.footerItem}>
                                  <MapPin size={12} color="#64748b" />
                                  <Text style={styles.footerText}>{item.classroom_name || item.room || 'Room'}</Text>
                                </View>
                                <View style={styles.footerItem}>
                                  <User size={12} color="#64748b" />
                                  <Text style={styles.footerText}>{item.teacher_name}</Text>
                                </View>
                              </View>

                              {/* Prominent Check Attendance Button */}
                              {canCheck ? (
                                <TouchableOpacity
                                  style={styles.checkAttBtn}
                                  activeOpacity={0.7}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    openCardAttendance(item, matchingSession, fullDayName);
                                  }}
                                >
                                  <CheckCircle2 size={13} color="#105934" style={{ marginRight: 6 }} />
                                  <Text style={styles.checkAttBtnText}>Check Attendance</Text>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          </View>
                        );
                      })
                    ) : (
                      <View style={[styles.card, styles.cardEmpty]}>
                        <View style={[styles.typeBar, { backgroundColor: '#cbd5e1' }]} />
                        <View style={styles.emptyContent}>
                          <Text style={styles.emptyLabel}>FREE</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
            ListFooterComponent={<View style={{ height: 140 }} />}
          />
        )}

        <SelectionModal
          visible={showYearModal}
          options={YEARS}
          onSelect={setSelectedYear}
          onClose={() => setShowYearModal(false)}
          title="Select Academic Year"
        />
        <SelectionModal
          visible={showStreamModal}
          options={STREAMS}
          onSelect={setSelectedStream}
          onClose={() => setShowStreamModal(false)}
          title="Select Department"
        />

        <AttendanceModal
          visible={attModal.visible}
          onClose={() => setAttModal((prev) => ({ ...prev, visible: false }))}
          session={attModal.session}
          loading={attModal.loading}
          records={attModal.records}
          title={attModal.title}
        />
      </View>
    </SwipeWrapper>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 15,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
  },
  sessionsBanner: {
    marginTop: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 89, 52, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#105934',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sessionsBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  sessionsIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionsBannerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#105934',
  },
  sessionsBannerSubtitle: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '500',
    marginTop: 1,
  },
  dropdowns: {
    flexDirection: 'row',
    gap: 8,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 4,
  },
  dropdownText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  todayBtn: {
    marginLeft: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 89, 52, 0.2)',
  },
  todayBtnText: {
    color: '#105934',
    fontWeight: '800',
    fontSize: 14,
  },
  weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  navBtn: {
    padding: 4,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#105934',
  },
  daysRowWrapper: {
    marginBottom: 20,
  },
  daysRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  dayButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  dayButtonActive: {
    backgroundColor: '#105934',
    borderColor: '#105934',
  },
  dayText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '700',
  },
  dayTextActive: {
    color: '#fff',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    marginTop: 4,
    position: 'absolute',
    bottom: 6,
  },
  listContent: {
    paddingHorizontal: 24,
  },
  scheduleItem: {
    flexDirection: 'row',
    marginBottom: 20,
    position: 'relative',
  },
  currentScheduleItem: {
    backgroundColor: '#f0fdf4',
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(16, 89, 52, 0.1)',
  },
  currentIndicator: {
    position: 'absolute',
    left: -2,
    top: '30%',
    bottom: '30%',
    width: 4,
    backgroundColor: '#105934',
    borderRadius: 4,
  },
  timeColumn: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeStart: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  timeAmPm: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '800',
    marginBottom: 2,
  },
  timeSeparator: {
    width: 1,
    height: 10,
    backgroundColor: '#e2e8f0',
    marginVertical: 4,
  },
  timeEnd: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  cardContainer: {
    flex: 1,
    marginLeft: 15,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
  },
  cancelledCardBg: {
    backgroundColor: '#fafafa',
    opacity: 0.85,
  },
  cardEmpty: {
    backgroundColor: '#f8fafc',
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    opacity: 0.8,
  },
  typeBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  cardHeader: {
    flex: 1,
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  subjectText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    flex: 1,
  },
  cancelledText: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  checkAttBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dcfce7',
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  checkAttBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#105934',
  },
  attendanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    marginLeft: 10,
  },
  chipPresent: {
    backgroundColor: '#f0fdf4',
    borderColor: '#dcfce7',
  },
  chipAbsent: {
    backgroundColor: '#fef2f2',
    borderColor: '#fee2e2',
  },
  chipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  emptyContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 10,
  },
  emptyLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#cbd5e1',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
  },
});
