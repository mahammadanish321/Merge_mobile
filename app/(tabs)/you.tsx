import React, { useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { SwipeWrapper } from '../../src/components/SwipeWrapper';
import {
  LogOut, ChevronRight, Bell, ShieldCheck, Mail, Phone, MapPin,
  QrCode, Fingerprint, Hash, Building
} from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Accelerometer } from 'expo-sensors';

const { width, height } = Dimensions.get('window');
const LOGO_ASSET = require('../../assets/images/icon.png');

// Premium Color System
const COLORS = {
  emerald: '#105934',
  graphite: '#1e293b',
  slate: '#64748b',
  border: 'rgba(226, 232, 240, 0.6)',
};

// Dimensions
const CARD_WIDTH = Math.min(width * 0.78, 330);
const CARD_HEIGHT = CARD_WIDTH * 1.58;
const STRAP_HEIGHT = Math.min(Math.max(height * 0.12, 92), 118);
const PIVOT_OFFSET = -(STRAP_HEIGHT + 84);

export default function YouScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);

  useEffect(() => {
    // Realistic weighted pendulum motion with 3D perspective depth
    Accelerometer.setUpdateInterval(30);
    const subscription = Accelerometer.addListener(data => {
      tiltX.value = withSpring(data.x * 16, { damping: 16, stiffness: 45 });
      tiltY.value = withSpring(data.y * 10, { damping: 16, stiffness: 45 });
    });
    return () => subscription.remove();
  }, [tiltX, tiltY]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const contactDetails = [
    { icon: Mail, label: user?.email || 'anish@merge.ai' },
    { icon: Phone, label: user?.phone || '+91 98765 43210' },
    { icon: Building, label: user?.organization || 'Merge Institute of Technology' },
    { icon: Hash, label: `ID: ${user?.college_id || 'M-' + (user?.id || '41')}` },
  ];

  // Unified Physics
  const unifiedHangingStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 1000 },
        { translateY: PIVOT_OFFSET },
        { rotateZ: `${tiltX.value}deg` },
        { rotateY: `${tiltX.value * 0.6}deg` },
        { rotateX: `${tiltY.value * 0.4}deg` },
        { translateY: -PIVOT_OFFSET }
      ],
    };
  });

  return (
    <SwipeWrapper>
      <View style={styles.mainContainer}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Immersive Identity Presentation */}
          <View style={styles.presentationArea}>

            <Animated.View style={[styles.pendulumAssembly, unifiedHangingStyle]}>
              {/* Invisible top spacing keeps the clip/card placement stable after removing the ribbon. */}
              <View style={styles.strapContainer} />

              {/* 2. Unified Identity Block */}
              <View style={styles.identityBlock}>

                {/* ID Card Scene */}
                <View style={styles.cardScene}>
                  {/* Back Card Peek */}
                  <View style={styles.backCard}>
                    <LinearGradient colors={['#064e3b', '#105934']} style={StyleSheet.absoluteFill} />
                    <View style={styles.peekBranding}>
                      <Image source={LOGO_ASSET} style={styles.peekLogo} />
                      <Text style={styles.peekWordmark}>MERGE</Text>
                    </View>
                  </View>

                  {/* Front Card Surface */}
                  <View style={styles.frontCard}>
                    {/* The slot lip visually captures the inserted clip tip. */}
                    <View style={styles.slotContainer}>
                      <View style={styles.slot}>
                        <View style={styles.slotCavity} />
                        <View style={styles.slotLip} />
                      </View>
                    </View>

                    <View style={styles.portraitArea}>
                      <View style={styles.imageFrame}>
                        <Image source={{ uri: user?.image_url || user?.avatar || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=105934&color=fff&bold=true&size=500` }} style={styles.portrait} />
                      </View>
                    </View>

                    <View style={styles.nameHeader}>
                      <Text style={styles.name}>{user?.name || 'Anish Kumar'}</Text>
                      <Text style={styles.role}>{user?.role === 'admin' ? 'Administrator' : user?.role === 'teacher' ? 'Teacher' : 'Student'}</Text>
                    </View>

                    <View style={styles.detailsBlock}>
                      <View style={styles.infoCol}>
                        {contactDetails.map((detail, index) => (
                          <View key={index} style={styles.row}>
                            <detail.icon size={11} color={COLORS.slate} />
                            <Text style={styles.label}>{detail.label}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={styles.qrSide}>
                        <View style={styles.qrHousing}><QrCode size={36} color={COLORS.graphite} strokeWidth={1.2} /></View>
                        <Text style={styles.qrCaption}>SCAN TO VERIFY</Text>
                      </View>
                    </View>

                    <View style={styles.footer}>
                      <Text style={styles.footerNote}>SECURED BY MERGE</Text>
                      <Fingerprint size={12} color="#cbd5e1" />
                    </View>
                  </View>
                </View>

                {/* 3. Compact clip inserted into the card slot */}
                <View style={styles.clipAssembly} pointerEvents="none">
                  <View style={styles.hardwareStack}>
                    <View style={styles.webbingTab}>
                      <LinearGradient
                        colors={['#10100f', '#242321', '#10100f']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.webbingGrain} />
                      <View style={styles.webbingPress} />
                    </View>
                    <View style={styles.triangleRing}>
                      <View style={styles.triangleRingLeft} />
                      <View style={styles.triangleRingRight} />
                      <View style={styles.triangleRingBottom} />
                    </View>
                    <View style={styles.swivelKnob}>
                      <LinearGradient
                        colors={['#090909', '#30302d', '#090909']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                    <View style={styles.swivelCollar}>
                      <LinearGradient
                        colors={['#070707', '#2b2a27', '#080808']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                    <View style={styles.clipBody}>
                      <LinearGradient
                        colors={['#080808', '#252421', '#070707']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.clipBodySheen} />
                      <View style={styles.thumbLatch} />
                    </View>
                    <View style={styles.hookCurve}>
                      <View style={styles.hookInnerMask} />
                    </View>
                    <View style={styles.hookSlotTip}>
                      <LinearGradient
                        colors={['#050505', '#262522', '#050505']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                  </View>
                </View>

              </View>
            </Animated.View>

            {/* Stable Layout Elements */}
            <View style={styles.stableUI}>
              <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.7} onPress={handleLogout}>
                <LogOut size={18} color="#ef4444" />
                <Text style={styles.logoutText}>Sign Out from Account</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.actionsBox}>
            <View style={styles.actionGroup}>
              <TouchableOpacity style={styles.actionItem}>
                <View style={[styles.iconFrame, { backgroundColor: '#f0fdf4' }]}>
                  <ShieldCheck size={20} color={COLORS.emerald} />
                </View>
                <Text style={styles.actionText}>Security & Privacy</Text>
                <ChevronRight size={18} color="#94a3b8" />
              </TouchableOpacity>
              <View style={styles.line} />
              <TouchableOpacity style={styles.actionItem}>
                <View style={[styles.iconFrame, { backgroundColor: '#fff7ed' }]}>
                  <Bell size={20} color="#f59e0b" />
                </View>
                <Text style={styles.actionText}>Notifications</Text>
                <ChevronRight size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* App Version */}
          <View style={styles.versionContainer}>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>Merge  ·  v {Constants.expoConfig?.version ?? '1.0.2'}</Text>
            </View>
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
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  presentationArea: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 18,
  },

  // --- COMPACT HANGING ARCHITECTURE ---
  pendulumAssembly: {
    alignItems: 'center',
    width: '100%',
    paddingTop: STRAP_HEIGHT + 18,
    marginTop: -(STRAP_HEIGHT + 18),
  },
  strapContainer: {
    width: 38,
    height: STRAP_HEIGHT,
    alignItems: 'center',
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.11,
    shadowRadius: 14,
  },
  strap: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  strapTexture: {
    ...StyleSheet.absoluteFill,
    opacity: 0.45,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  strapHighlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 8,
    width: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    opacity: 0.5,
  },

  identityBlock: {
    alignItems: 'center',
    width: width,
  },

  // --- CARD SCENE ---
  cardScene: {
    marginTop: -7,
    zIndex: 10,
    alignItems: 'center',
    width: width,
    height: CARD_HEIGHT + 8
  },
  backCard: { position: 'absolute', width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 20, overflow: 'hidden', transform: [{ translateY: -(CARD_HEIGHT / 2) + 26 }, { rotate: '-2.6deg' }, { translateY: (CARD_HEIGHT / 2) - 26 }, { translateX: -3 }, { translateY: 6 }] },
  peekBranding: { position: 'absolute', right: 5, top: '50%', height: 190, width: 34, marginTop: -95, alignItems: 'center', justifyContent: 'center', opacity: 0.28 },
  peekLogo: { width: 12, height: 12, tintColor: '#000', marginBottom: 8 },
  peekWordmark: { color: '#000', fontSize: 8, fontWeight: '900', letterSpacing: 2, transform: [{ rotate: '90deg' }] },
  frontCard: { width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: '#ffffff', borderRadius: 20, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 22 }, shadowOpacity: 0.09, shadowRadius: 34, elevation: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  slotContainer: { height: 39, alignItems: 'center', justifyContent: 'center', zIndex: 120 },
  slot: { width: 56, height: 9, backgroundColor: '#c8c0f7', borderRadius: 6, borderWidth: 1, borderColor: '#ddd8ff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  slotCavity: { position: 'absolute', left: 5, right: 5, top: 2, height: 3, borderRadius: 2, backgroundColor: 'rgba(15,23,42,0.1)' },
  slotLip: { position: 'absolute', left: 1, right: 1, top: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.72)' },
  portraitArea: { paddingHorizontal: 34, paddingTop: 0, alignItems: 'center' },
  imageFrame: { width: '84%', aspectRatio: 1, borderRadius: 16, backgroundColor: '#f8fafc', overflow: 'hidden', borderWidth: 1, borderColor: '#eef2f7' },
  portrait: { width: '100%', height: '100%', resizeMode: 'cover' },
  nameHeader: { paddingHorizontal: 32, marginTop: 16, alignItems: 'center' },
  name: { fontSize: 24, fontWeight: '700', color: COLORS.graphite, letterSpacing: 0, textAlign: 'center' },
  role: { fontSize: 10, fontWeight: '700', color: COLORS.emerald, letterSpacing: 1.4, marginTop: 4, textTransform: 'uppercase' },
  detailsBlock: { flexDirection: 'row', paddingHorizontal: 32, marginTop: 18, alignItems: 'center', justifyContent: 'space-between' },
  infoCol: { flex: 1, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontSize: 10, fontWeight: '600', color: COLORS.slate, letterSpacing: 0 },
  qrSide: { alignItems: 'center', marginLeft: 16 },
  qrHousing: { padding: 8, backgroundColor: '#fbfcfd', borderRadius: 12, borderWidth: 1, borderColor: '#eef2f7' },
  qrCaption: { fontSize: 7, fontWeight: '800', color: COLORS.graphite, marginTop: 6, letterSpacing: 0.4, opacity: 0.6 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, borderTopWidth: 1, borderTopColor: '#f8fafc', flexDirection: 'row', justifyContent: 'center', gap: 8, alignItems: 'center', paddingHorizontal: 32, opacity: 0.7 },
  footerNote: { fontSize: 8, fontWeight: '700', color: '#94a3b8', letterSpacing: 1 },

  // --- REFERENCE-STYLE CLIP ---
  clipAssembly: {
    position: 'absolute',
    top: -116,
    alignItems: 'center',
    zIndex: 100,
  },
  hardwareStack: {
    alignItems: 'center',
    width: 78,
  },
  webbingTab: { width: 42, height: 30, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, overflow: 'hidden', borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: 'rgba(0,0,0,0.9)', zIndex: 5 },
  webbingGrain: { ...StyleSheet.absoluteFill, borderLeftWidth: 2, borderRightWidth: 2, borderColor: 'rgba(255,255,255,0.035)', opacity: 0.9 },
  webbingPress: { position: 'absolute', bottom: 7, alignSelf: 'center', width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.24)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  triangleRing: { width: 66, height: 42, marginTop: -7, zIndex: 3 },
  triangleRingLeft: { position: 'absolute', left: 8, top: 0, width: 38, height: 38, borderLeftWidth: 4, borderBottomWidth: 4, borderColor: '#171716', borderBottomLeftRadius: 14, transform: [{ rotate: '28deg' }], shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 3 },
  triangleRingRight: { position: 'absolute', right: 8, top: 0, width: 38, height: 38, borderRightWidth: 4, borderBottomWidth: 4, borderColor: '#171716', borderBottomRightRadius: 14, transform: [{ rotate: '-28deg' }], shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 3 },
  triangleRingBottom: { position: 'absolute', left: 24, right: 24, bottom: 1, height: 5, borderRadius: 3, backgroundColor: '#171716' },
  swivelKnob: { width: 18, height: 7, marginTop: -9, borderRadius: 4, overflow: 'hidden', borderWidth: 0.5, borderColor: '#050505', zIndex: 6 },
  swivelCollar: { width: 34, height: 12, marginTop: -1, borderRadius: 5, overflow: 'hidden', borderWidth: 0.5, borderColor: '#050505', zIndex: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 4 },
  clipBody: { width: 25, height: 38, marginTop: -2, borderTopLeftRadius: 5, borderTopRightRadius: 5, borderBottomLeftRadius: 10, borderBottomRightRadius: 5, overflow: 'hidden', borderWidth: 0.5, borderColor: '#050505', zIndex: 4, transform: [{ skewX: '-4deg' }] },
  clipBodySheen: { position: 'absolute', top: 5, bottom: 8, left: 5, width: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  thumbLatch: { position: 'absolute', right: -12, top: 17, width: 24, height: 10, borderRadius: 5, backgroundColor: '#181716', borderWidth: 0.5, borderColor: '#050505' },
  hookCurve: { width: 31, height: 34, marginTop: -11, marginLeft: 7, borderRightWidth: 6, borderBottomWidth: 6, borderColor: '#151514', borderBottomRightRadius: 19, borderTopRightRadius: 17, zIndex: 3, transform: [{ rotate: '8deg' }] },
  hookInnerMask: { position: 'absolute', right: 5, bottom: 5, width: 17, height: 18, borderBottomRightRadius: 12, backgroundColor: '#ffffff' },
  hookSlotTip: { width: 25, height: 8, marginTop: -7, borderRadius: 5, overflow: 'hidden', borderWidth: 0.5, borderColor: '#050505', zIndex: 7 },

  // --- STABLE ELEMENTS ---
  stableUI: {
    marginTop: 30,
    width: '100%',
    alignItems: 'center',
    zIndex: 10,
    paddingHorizontal: 32,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
    borderRadius: 16,
    width: '100%',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '800' },
  actionsBox: {
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 20,
  },
  actionGroup: {
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 15,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  iconFrame: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.graphite,
  },
  line: {
    height: 1,
    backgroundColor: '#f8fafc',
    marginLeft: 52,
  },
  versionContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 28,
    paddingBottom: 4,
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.4,
  },
});
