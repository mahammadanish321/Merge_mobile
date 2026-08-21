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
  Modal 
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { User, Lock, Eye, EyeOff, CheckCircle2, Building2, ShieldCheck, Mail, ChevronRight, Search, Sparkles, Monitor, ArrowLeft } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../src/context/AuthContext';
import apiClient from '../src/api/client';

const { width } = Dimensions.get('window');

type ViewState = 
  | 'login' 
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

const GoogleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <Path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
    />
    <Path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <Path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </Svg>
);

export default function LoginScreen() {
  const [view, setView] = useState<ViewState>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Organizations for activation
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [loginChecked, setLoginChecked] = useState(false);
  const [loginOrganizations, setLoginOrganizations] = useState<Organization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOrgList, setShowOrgList] = useState(false);

  // OTP & Password States
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (view === 'activate_email') {
      fetchOrgs();
    }
  }, [view]);

  const handleRoleChange = (newRole: 'student' | 'teacher') => {
    setRole(newRole);
    setLoginChecked(false);
    setLoginOrganizations([]);
    setSelectedOrg(null);
    setPassword('');
    setView('login');
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
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setLoading(true);
    try {
      if (!loginChecked) {
        const response = await apiClient.get('/auth/check-email', {
          params: { email: email.trim().toLowerCase(), role }
        });

        if (!response.data.found) {
          Alert.alert('Account Not Found', `No registered ${role} account found for this email.`);
          return;
        }

        const matchingOrganizations = response.data.organizations;
        setLoginChecked(true);
        setLoginOrganizations(matchingOrganizations);
        setSelectedOrg(matchingOrganizations.length === 1 ? matchingOrganizations[0].id : null);
        return;
      }

      if (!selectedOrg || !password) {
        Alert.alert('Error', 'Select your organization and enter your password.');
        return;
      }

      const result = await signIn(email.trim().toLowerCase(), password, role, selectedOrg);
      if (result.success) {
        router.replace('/(tabs)' as any);
      } else {
        Alert.alert('Login Failed', result.message);
      }
    } catch (err: any) {
      console.error('[AUTH] Login / Check email error:', err);
      if (err.message === 'Network Error' || !err.response) {
        Alert.alert(
          'Connection Failed',
          `Cannot reach backend server at:\n${apiClient.defaults.baseURL}\n\n💡 If testing on physical phone:\n1. Connect phone to the SAME Wi-Fi as your PC (or phone hotspot).\n2. Ensure your backend is running on port 5000.`
        );
      } else {
        const msg = err.response?.data?.message || err.message || 'Unable to check this email. Please try again.';
        Alert.alert('Login Failed', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const redirectUri = Linking.createURL('login');
      const authUrl = `https://merge-workspace.firebaseapp.com/__/auth/handler?apiKey=AIzaSyDwfClhsc_w0BE5w2qKVHWifoiOd0h_0aw&appName=[DEFAULT]&authType=signInWithPopup&providerId=google.com&scopes=email,profile&redirect_uri=${encodeURIComponent(redirectUri)}`;
      
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (result.type === 'success' && result.url) {
        const match = result.url.match(/id_token=([^&]+)/) || result.url.match(/credential=([^&]+)/);
        const idToken = match ? decodeURIComponent(match[1]) : null;
        if (idToken) {
          const res = await signInWithGoogle(idToken, role, selectedOrg);
          if (res.success) {
            router.replace('/(tabs)' as any);
            return;
          } else {
            Alert.alert('Google Sign-In', res.message);
            return;
          }
        }
      }
      Alert.alert('Google Sign-In', 'Google Authentication session completed.');
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      Alert.alert('Google Sign-In', err.message || 'Failed to complete Google Sign-In');
    } finally {
      setLoading(false);
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
      Alert.alert('Error', 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotFinalize = async () => {
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
      await apiClient.post('/auth/forgot-password-finalize', {
        email,
        otp,
        new_password: newPassword
      });
      setView('success');
    } catch (err: any) {
      Alert.alert('Error', 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessDone = () => {
    setView('login');
  };

  const filteredOrgs = orgs.filter(o => 
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    o.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Role Toggle Chips */}
        {view !== 'success' && (
          <View style={styles.roleContainer}>
            <TouchableOpacity 
              style={[styles.roleChip, role === 'student' && styles.roleChipActive]}
              onPress={() => handleRoleChange('student')}
            >
              <Text style={[styles.roleChipText, role === 'student' && styles.roleChipTextActive]}>Student</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.roleChip, role === 'teacher' && styles.roleChipActive]}
              onPress={() => handleRoleChange('teacher')}
            >
              <Text style={[styles.roleChipText, role === 'teacher' && styles.roleChipTextActive]}>Teacher</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Brand Logo */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/images/icon.png')} 
            style={styles.logoImage} 
            resizeMode="contain" 
          />
          <Text style={styles.brandTitle}>Merge</Text>
        </View>

        {/* --- VIEW: LOGIN --- */}
        {view === 'login' && (
          <View style={styles.viewWrapper}>
            <View style={styles.welcomeSection}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Enter your details to sign in</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>email</Text>
                <View style={styles.inputWrapper}>
                  <User size={18} color="#6b7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="name@college.edu"
                    placeholderTextColor="#9ca3af"
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      setLoginChecked(false);
                      setLoginOrganizations([]);
                      setSelectedOrg(null);
                      setPassword('');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!loginChecked}
                  />
                </View>
              </View>

              {loginChecked && loginOrganizations.length > 1 && !selectedOrg && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>select your organization</Text>
                  {loginOrganizations.map(org => (
                    <TouchableOpacity key={org.id} style={styles.orgChoice} onPress={() => setSelectedOrg(org.id)}>
                      <Text style={styles.orgChoiceName}>{org.name}</Text>
                      <Text style={styles.orgChoiceSlug}>{org.slug}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {loginChecked && selectedOrg && (
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
              )}

              {loginChecked && selectedOrg && (
                <TouchableOpacity style={styles.forgotBtn} onPress={() => setView('forgot_email')}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.mainButton}
                onPress={handleLogin}
                disabled={loading || (loginChecked && loginOrganizations.length > 1 && !selectedOrg)}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainButtonText}>{loginChecked ? 'Login' : 'Continue'}</Text>}
              </TouchableOpacity>

              {!loginChecked && (
                <>
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity
                    style={styles.googleButton}
                    onPress={handleGoogleSignIn}
                    disabled={loading}
                  >
                    <GoogleIcon />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </TouchableOpacity>
                </>
              )}

              {loginChecked && (
                <TouchableOpacity style={styles.backButton} onPress={() => {
                  setLoginChecked(false);
                  setLoginOrganizations([]);
                  setSelectedOrg(null);
                  setPassword('');
                }}>
                  <ArrowLeft size={16} color="#4b5563" />
                  <Text style={styles.backButtonText}>Change Email</Text>
                </TouchableOpacity>
              )}

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
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                      {filteredOrgs.map((org) => (
                        <TouchableOpacity
                          key={org.id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setSelectedOrg(org.id);
                            setSearchQuery(org.name);
                            setShowOrgList(false);
                          }}
                        >
                          <Text style={styles.dropdownText}>{org.name}</Text>
                          <Text style={styles.dropdownSlug}>{org.slug}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

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

              <TouchableOpacity style={styles.mainButton} onPress={handleActivateInit} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainButtonText}>Continue</Text>}
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
              <Text style={styles.title}>Enter Code</Text>
              <Text style={styles.subtitle}>We've sent a 6-digit OTP to {email}</Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.otpInputWrapper}>
                <TextInput
                  style={styles.otpInput}
                  placeholder="000000"
                  placeholderTextColor="#d1d5db"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                />
              </View>

              <TouchableOpacity 
                style={styles.mainButton} 
                onPress={view === 'forgot_otp' ? handleForgotVerify : handleActivateVerify} 
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainButtonText}>Verify Code</Text>}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => setView(view === 'forgot_otp' ? 'forgot_email' : 'activate_email')}
              >
                <ArrowLeft size={16} color="#4b5563" />
                <Text style={styles.backButtonText}>Change Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* --- VIEW: SET NEW PASSWORD --- */}
        {(view === 'activate_password' || view === 'forgot_password') && (
          <View style={styles.viewWrapper}>
            <View style={styles.welcomeSection}>
              <Text style={styles.title}>Create Password</Text>
              <Text style={styles.subtitle}>Set a secure password for your account</Text>
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
      </ScrollView>

      {/* Success Modal */}
      <Modal visible={view === 'success'} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <CheckCircle2 size={80} color="#105934" style={{ marginBottom: 20 }} />
            <Text style={styles.successTitle}>Account Activated!</Text>
            <Text style={styles.successSubtitle}>
              Your account is now ready. You can log in with your email and password.
            </Text>
            <TouchableOpacity style={styles.successBtn} onPress={handleSuccessDone}>
              <Text style={styles.successBtnText}>Log In Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  orgChoice: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', borderRadius: 12, padding: 14, marginBottom: 10 },
  orgChoiceName: { color: '#111827', fontSize: 15, fontWeight: '700' },
  orgChoiceSlug: { color: '#166534', fontSize: 12, marginTop: 3 },
  otpInputWrapper: { alignItems: 'center', marginVertical: 30 },
  otpInput: { fontSize: 36, letterSpacing: 10, fontWeight: '800', color: '#105934', borderBottomWidth: 2, borderBottomColor: '#105934', width: '80%', textAlign: 'center', paddingBottom: 10 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { color: '#111827', fontSize: 14, fontWeight: '600' },
  mainButton: { backgroundColor: '#105934', height: 56, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: '#105934', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  mainButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { marginHorizontal: 10, fontSize: 12, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase' },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 30, height: 56, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  googleButtonText: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  subLink: { marginTop: 20, alignItems: 'center' },
  subLinkText: { color: '#105934', fontSize: 14, fontWeight: '700' },
  backButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 8 },
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
