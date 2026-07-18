import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  Modal,
  Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { User, Lock, Eye, EyeOff, CheckCircle2, Building2, ShieldCheck, Mail, ChevronRight, Search, Sparkles, Monitor, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../src/context/AuthContext';
import apiClient from '../src/api/client';

const { width } = Dimensions.get('window');

type ViewState = 
  | 'login' 
  | 'register' 
  | 'activate_email' 
  | 'activate_otp' 
  | 'activate_password'
  | 'forgot_email'
  | 'forgot_otp'
  | 'forgot_password'
  | 'success';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

export default function LoginScreen() {
  const [view, setView] = useState<ViewState>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Organizations for activation
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOrgList, setShowOrgList] = useState(false);

  // OTP & Password States
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Registration States (Admin only)
  const [regData, setRegData] = useState({
    name: '',
    email: '',
    orgName: '',
    orgSlug: ''
  });

  const { signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (view === 'activate_email') {
      fetchOrgs();
    }
  }, [view]);

  const handleRoleChange = (newRole: 'student' | 'teacher' | 'admin') => {
    setRole(newRole);
    if (newRole === 'admin') {
      setView('register');
    } else {
      setView('login');
    }
  };

  const fetchOrgs = async () => {
    try {
      const res = await apiClient.get('/organizations');
      setOrgs(res.data);
    } catch (err) {
      console.error('Failed to fetch orgs', err);
    }
  };

  // --- HANDLERS ---

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    const result = await signIn(email, password, role);
    setLoading(false);
    if (result.success) {
      router.replace('/(tabs)');
    } else {
      Alert.alert('Login Failed', result.message);
    }
  };

  // Activation Flow
  const handleActivateInit = async () => {
    if (!selectedOrg || !email) {
      Alert.alert('Error', 'Please select institution and enter email');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/claim-init', {
        email,
        organization_id: selectedOrg,
        role: role
      });
      setView('activate_otp');
    } catch (err: any) {
      Alert.alert('Activation Error', err.response?.data?.message || 'Email not found in this institution.');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateVerify = async () => {
    if (!otp) return;
    setLoading(true);
    try {
      await apiClient.post('/auth/claim-verify', {
        email,
        otp,
        organization_id: selectedOrg,
        role
      });
      setView('activate_password');
    } catch (err: any) {
      Alert.alert('Error', 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateFinalize = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/claim-finalize', {
        email,
        password: newPassword,
        organization_id: selectedOrg,
        role
      });
      setView('success');
    } catch (err: any) {
      Alert.alert('Error', 'Failed to finalize account');
    } finally {
      setLoading(false);
    }
  };

  // Admin Registration Flow
  const handleRegisterInit = async () => {
    if (!regData.name || !regData.email || !regData.orgName || !regData.orgSlug) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/admin-signup-init', regData);
      setEmail(regData.email); // Store email for OTP step
      setView('activate_otp'); // Reuse OTP view, logic handles it
    } catch (err: any) {
      Alert.alert('Registration Error', err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminVerify = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/admin-signup-verify', { email, otp });
      const { token, user: userData } = res.data;
      // Admin is automatically logged in after OTP
      if (token) {
        setView('success');
      }
    } catch (err: any) {
      Alert.alert('Error', 'Invalid Admin OTP');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Flow
  const handleForgotInit = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your registered email');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password-init', { email });
      setView('forgot_otp');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Email not found');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotVerify = async () => {
    if (!otp) return;
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password-verify', { email, otp });
      setView('forgot_password');
    } catch (err: any) {
      Alert.alert('Error', 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotFinalize = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password-finalize', { email, password: newPassword });
      setView('success');
    } catch (err: any) {
      Alert.alert('Error', 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessDone = () => {
    if (role === 'admin') {
      Linking.openURL('https://Merge-frontend.vercel.app');
    } else {
      setView('login');
    }
  };

  const filteredOrgs = orgs.filter(o => 
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    o.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. Role Selector (Only show on Login/Register) */}
          {(view === 'login' || view === 'register') && (
            <View style={styles.roleContainer}>
              {(['student', 'teacher', 'admin'] as const).map((r) => (
                <TouchableOpacity 
                  key={r}
                  style={[styles.roleChip, role === r && styles.roleChipActive]}
                  onPress={() => handleRoleChange(r)}
                >
                  <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 2. Brand Logo */}
          <View style={styles.logoContainer}>
            <Image 
              source={{ uri: 'https://res.cloudinary.com/dmi7vzu8w/image/upload/v1778328482/Picsart_26-05-07_07-29-20-114_v3en0e.jpg' }} 
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.brandTitle}>Merge</Text>
          </View>

          {/* --- VIEW: LOGIN --- */}
          {view === 'login' && role !== 'admin' && (
            <View style={styles.viewWrapper}>
              <View style={styles.welcomeSection}>
                <Text style={styles.title}>Welcome back 👋</Text>
                <Text style={styles.subtitle}>Sign in to your {role} account</Text>
              </View>

              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>institutional email</Text>
                  <View style={styles.inputWrapper}>
                    <User size={18} color="#6b7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="name@college.edu"
                      placeholderTextColor="#9ca3af"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>password</Text>
                  <View style={styles.inputWrapper}>
                    <Lock size={18} color="#6b7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#9ca3af"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff size={18} color="#6b7280" /> : <Eye size={18} color="#6b7280" />}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.forgotBtn} onPress={() => setView('forgot_email')}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.mainButton} onPress={handleLogin} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainButtonText}>Login</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.subLink} onPress={() => setView('activate_email')}>
                  <Text style={styles.subLinkText}>First time logging in? Activate account</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* --- VIEW: ACTIVATE EMAIL --- */}
          {view === 'activate_email' && (
            <View style={styles.viewWrapper}>
              <View style={styles.welcomeSection}>
                <Text style={styles.title}>Activate Account</Text>
                <Text style={styles.subtitle}>Search for your institution to begin</Text>
              </View>

              <View style={styles.formContainer}>
                <View style={[styles.inputGroup, { zIndex: 100 }]}>
                  <Text style={styles.label}>select institution</Text>
                  <View style={styles.inputWrapper}>
                    <Search size={18} color="#6b7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Type college name..."
                      placeholderTextColor="#9ca3af"
                      value={searchQuery}
                      onChangeText={(t) => { setSearchQuery(t); setShowOrgList(true); }}
                      onFocus={() => setShowOrgList(true)}
                    />
                  </View>
                  {showOrgList && searchQuery.length > 0 && (
                    <View style={styles.dropdown}>
                      {filteredOrgs.map(org => (
                        <TouchableOpacity 
                          key={org.id} 
                          style={styles.dropdownItem}
                          onPress={() => { setSelectedOrg(org.id); setSearchQuery(org.name); setShowOrgList(false); }}
                        >
                          <Text style={styles.dropdownText}>{org.name}</Text>
                          <Text style={styles.dropdownSlug}>{org.slug}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>registered email</Text>
                  <View style={styles.inputWrapper}>
                    <Mail size={18} color="#6b7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="name@college.edu"
                      placeholderTextColor="#9ca3af"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <TouchableOpacity style={styles.mainButton} onPress={handleActivateInit} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainButtonText}>Verify Email</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.backButton} onPress={() => setView('login')}>
                  <ArrowLeft size={16} color="#4b5563" />
                  <Text style={styles.backButtonText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* --- VIEW: OTP VERIFICATION --- */}
          {(view === 'activate_otp' || view === 'forgot_otp') && (
            <View style={styles.viewWrapper}>
              <View style={styles.welcomeSection}>
                <Text style={styles.title}>Verify OTP</Text>
                <Text style={styles.subtitle}>Enter the 6-digit code sent to {email}</Text>
              </View>

              <View style={styles.formContainer}>
                <View style={styles.otpInputWrapper}>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="000000"
                    placeholderTextColor="#9ca3af"
                    maxLength={6}
                    keyboardType="number-pad"
                    value={otp}
                    onChangeText={setOtp}
                  />
                </View>

                <TouchableOpacity 
                  style={styles.mainButton} 
                  onPress={role === 'admin' && view === 'activate_otp' ? handleAdminVerify : (view === 'forgot_otp' ? handleForgotVerify : handleActivateVerify)} 
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainButtonText}>Verify Code</Text>}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.backButton} 
                  onPress={() => setView(view === 'forgot_otp' ? 'forgot_email' : (role === 'admin' ? 'register' : 'activate_email'))}
                >
                  <ArrowLeft size={16} color="#4b5563" />
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* --- VIEW: SET PASSWORD --- */}
          {(view === 'activate_password' || view === 'forgot_password') && (
            <View style={styles.viewWrapper}>
              <View style={styles.welcomeSection}>
                <Text style={styles.title}>{view === 'forgot_password' ? 'Reset Password' : 'Set Password'}</Text>
                <Text style={styles.subtitle}>Create a secure password for your account</Text>
              </View>

              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>new password</Text>
                  <View style={styles.inputWrapper}>
                    <Lock size={18} color="#6b7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>confirm password</Text>
                  <View style={styles.inputWrapper}>
                    <Lock size={18} color="#6b7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.mainButton} 
                  onPress={view === 'forgot_password' ? handleForgotFinalize : handleActivateFinalize} 
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainButtonText}>Save & Finalize</Text>}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.backButton} 
                  onPress={() => setView(view === 'forgot_password' ? 'forgot_otp' : 'activate_otp')}
                >
                  <ArrowLeft size={16} color="#4b5563" />
                  <Text style={styles.backButtonText}>Back to OTP</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* --- VIEW: FORGOT EMAIL --- */}
          {view === 'forgot_email' && (
            <View style={styles.viewWrapper}>
              <View style={styles.welcomeSection}>
                <Text style={styles.title}>Forgot Password</Text>
                <Text style={styles.subtitle}>Enter your email to receive a reset code</Text>
              </View>

              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>institutional email</Text>
                  <View style={styles.inputWrapper}>
                    <Mail size={18} color="#6b7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="name@college.edu"
                      placeholderTextColor="#9ca3af"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <TouchableOpacity style={styles.mainButton} onPress={handleForgotInit} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainButtonText}>Send Reset Link</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.backButton} onPress={() => setView('login')}>
                  <ArrowLeft size={16} color="#4b5563" />
                  <Text style={styles.backButtonText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* --- VIEW: ADMIN REGISTER --- */}
          {view === 'register' && role === 'admin' && (
            <View style={styles.viewWrapper}>
              <View style={styles.welcomeSection}>
                <Text style={styles.title}>Register College</Text>
                <Text style={styles.subtitle}>Set up your institution on Merge</Text>
              </View>

              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>admin full name</Text>
                  <View style={styles.inputWrapper}>
                    <User size={18} color="#6b7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="John Doe"
                      placeholderTextColor="#9ca3af"
                      value={regData.name}
                      onChangeText={(t) => setRegData({...regData, name: t})}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>admin email</Text>
                  <View style={styles.inputWrapper}>
                    <Mail size={18} color="#6b7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="admin@college.edu"
                      placeholderTextColor="#9ca3af"
                      value={regData.email}
                      onChangeText={(t) => setRegData({...regData, email: t})}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>college full name</Text>
                  <View style={styles.inputWrapper}>
                    <Building2 size={18} color="#6b7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Model Engineering College"
                      placeholderTextColor="#9ca3af"
                      value={regData.orgName}
                      onChangeText={(t) => setRegData({...regData, orgName: t})}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>unique college slug</Text>
                  <View style={styles.inputWrapper}>
                    <ShieldCheck size={18} color="#6b7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. mec-kerala"
                      placeholderTextColor="#9ca3af"
                      value={regData.orgSlug}
                      onChangeText={(t) => setRegData({...regData, orgSlug: t})}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <TouchableOpacity style={styles.mainButton} onPress={handleRegisterInit} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainButtonText}>Register Institution</Text>}
                </TouchableOpacity>

                <View style={styles.desktopNotice}>
                  <Monitor size={16} color="#4b5563" />
                  <Text style={styles.desktopNoticeText}>After verification, manage your college using our Desktop App.</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal visible={view === 'success'} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <CheckCircle2 size={80} color="#105934" style={{ marginBottom: 20 }} />
            <Text style={styles.successTitle}>
              {role === 'admin' ? 'Success!' : 'Account Activated!'}
            </Text>
            <Text style={styles.successSubtitle}>
              {role === 'admin' 
                ? 'Your institution is registered. Check your email for details and switch to Desktop to continue.' 
                : 'Your account is now ready. You can log in with your email and password.'}
            </Text>
            <TouchableOpacity style={styles.successBtn} onPress={handleSuccessDone}>
              <Text style={styles.successBtnText}>
                {role === 'admin' ? 'Open Desktop Portal' : 'Log In Now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingHorizontal: 30, paddingTop: 50, paddingBottom: 40 },
  roleContainer: { flexDirection: 'row', backgroundColor: '#f5f5f5', borderRadius: 30, padding: 6, marginBottom: 20 },
  roleChip: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 25 },
  roleChipActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
  roleChipText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  roleChipTextActive: { color: '#105934' },
  logoContainer: { alignItems: 'center', marginBottom: 30 },
  logoImage: { width: 100, height: 100, borderRadius: 20 },
  brandTitle: { fontSize: 22, fontWeight: '800', color: '#105934', marginTop: 10 },
  viewWrapper: { width: '100%' },
  welcomeSection: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#4b5563', textAlign: 'center' },
  formContainer: { width: '100%' },
  inputGroup: { marginBottom: 20, position: 'relative' },
  label: { fontSize: 12, color: '#555555', marginBottom: 8, fontWeight: '700', textTransform: 'lowercase' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 15, paddingHorizontal: 16, height: 56 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#111827', fontWeight: '500' },
  dropdown: { position: 'absolute', top: 85, left: 0, right: 0, backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#d1d5db', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10, maxHeight: 200, zIndex: 1000 },
  dropdownItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownText: { fontSize: 14, color: '#111827', fontWeight: '500' },
  dropdownSlug: { fontSize: 12, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  otpInputWrapper: { alignItems: 'center', marginVertical: 30 },
  otpInput: { fontSize: 36, letterSpacing: 10, fontWeight: '800', color: '#105934', borderBottomWidth: 2, borderBottomColor: '#105934', width: '80%', textAlign: 'center', paddingBottom: 10 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 30 },
  forgotText: { color: '#111827', fontSize: 14, fontWeight: '600' },
  mainButton: { backgroundColor: '#105934', height: 56, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: '#105934', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  mainButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  subLink: { marginTop: 24, alignItems: 'center' },
  subLinkText: { color: '#105934', fontSize: 14, fontWeight: '700' },
  backButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, gap: 8 },
  backButtonText: { color: '#374151', fontSize: 14, fontWeight: '600' },
  desktopNotice: { flexDirection: 'row', alignItems: 'center', marginTop: 20, padding: 15, backgroundColor: '#f3f4f6', borderRadius: 15, gap: 10 },
  desktopNoticeText: { flex: 1, fontSize: 12, color: '#4b5563', lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  successCard: { backgroundColor: '#fff', width: '100%', borderRadius: 30, padding: 40, alignItems: 'center' },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 12, textAlign: 'center' },
  successSubtitle: { fontSize: 14, color: '#4b5563', textAlign: 'center', marginBottom: 30, lineHeight: 20 },
  successBtn: { backgroundColor: '#105934', width: '100%', height: 56, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  successBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
