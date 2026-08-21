import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import React, { useCallback, useEffect, useState } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, Linking, LogBox, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { NotificationProvider } from '../src/context/NotificationContext';

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'expo-notifications: Push notifications',
  'Unable to activate keep awake',
  'Unable to deactivate keep awake',
  'Error: Unable to activate keep awake',
]);

type NativeUpdateState = {
  required: boolean;
  checking: boolean;
  message: string;
  latestVersion?: string;
  updateUrl?: string;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://merge-backend.onrender.com/api';
const CURRENT_APP_VERSION = Constants.expoConfig?.version || '0.0.0';
const isExpoGo = Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';

function compareVersions(currentVersion: string, requiredVersion: string) {
  const current = currentVersion.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const required = requiredVersion.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(current.length, required.length);

  for (let index = 0; index < length; index += 1) {
    const currentPart = current[index] || 0;
    const requiredPart = required[index] || 0;

    if (currentPart > requiredPart) return 1;
    if (currentPart < requiredPart) return -1;
  }

  return 0;
}

function NativeUpdateGate({ state, onRetry }: { state: NativeUpdateState; onRetry: () => void }) {
  const openUpdate = async () => {
    if (state.updateUrl) {
      await Linking.openURL(state.updateUrl);
    }
  };
  const hasUpdateUrl = Boolean(state.updateUrl);

  return (
    <View style={styles.updateGate}>
      <View style={styles.updatePanel}>
        <View style={styles.updateIcon}>
          <Text style={styles.updateIconText}>!</Text>
        </View>
        <Text style={styles.updateTitle}>Update Required</Text>
        <Text style={styles.updateMessage}>{state.message}</Text>
        <Text style={styles.updateVersion}>
          Installed v{CURRENT_APP_VERSION}
          {state.latestVersion ? ` - Latest v${state.latestVersion}` : ''}
        </Text>

        <Pressable
          disabled={!hasUpdateUrl}
          style={[styles.primaryButton, !hasUpdateUrl && styles.disabledButton]}
          onPress={openUpdate}
        >
          <Text style={styles.primaryButtonText}>
            {hasUpdateUrl ? 'Download Latest Version' : 'Update Link Not Set'}
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onRetry}>
          <Text style={styles.secondaryButtonText}>
            {state.checking ? 'Checking...' : 'Check Again'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inTabsGroup = segments[0] === '(tabs)';
    const isProtectedRoute = inTabsGroup || segments[0] === 'chat' || segments[0] === 'drop' || segments[0] === 'sessions';

    if (!user && isProtectedRoute) {
      // Redirect to login if not logged in and trying to access protected routes
      router.replace('/login');
    } else if (user && segments[0] === 'login') {
      // Redirect to tabs if logged in and trying to access login
      router.replace('/(tabs)');
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#105934" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sessions" options={{ headerShown: false }} />
      <Stack.Screen name="drop" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [nativeUpdate, setNativeUpdate] = useState<NativeUpdateState>({
    required: false,
    checking: true,
    message: '',
  });

  const checkNativeUpdate = useCallback(async () => {
    setNativeUpdate((current) => ({ ...current, checking: true }));

    try {
      if (!isExpoGo && Updates.isEnabled) {
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
          return;
        }
      }
    } catch (error) {
      console.warn('OTA update check failed. Checking native version gate.', error);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/app-version`);
      const payload = await response.json();
      const mobile = payload?.mobile;
      const minRequiredVersion = mobile?.minRequiredVersion;

      if (
        typeof minRequiredVersion === 'string' &&
        compareVersions(CURRENT_APP_VERSION, minRequiredVersion) < 0
      ) {
        setNativeUpdate({
          required: true,
          checking: false,
          message:
            mobile?.message ||
            'Please update Merge. This installed app is too old to continue.',
          latestVersion: mobile?.latestVersion || minRequiredVersion,
          updateUrl: mobile?.updateUrl,
        });
        return;
      }
    } catch (error) {
      console.warn('Native version gate check failed.', error);
    }

    setNativeUpdate((current) => ({ ...current, required: false, checking: false }));
  }, []);

  useEffect(() => {
    checkNativeUpdate();
  }, [checkNativeUpdate]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <NotificationProvider>
            {nativeUpdate.required ? (
              <NativeUpdateGate state={nativeUpdate} onRetry={checkNativeUpdate} />
            ) : (
              <RootLayoutNav />
            )}
            <StatusBar style="auto" />
          </NotificationProvider>
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  updateGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8faf9',
    padding: 24,
  },
  updatePanel: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 32,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  updateIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: '#fef3c7',
    marginBottom: 18,
  },
  updateIconText: {
    color: '#b45309',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
  },
  updateTitle: {
    color: '#0f172a',
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  updateMessage: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  updateVersion: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 22,
  },
  primaryButton: {
    width: '100%',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#105934',
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  secondaryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#105934',
    fontSize: 14,
    fontWeight: '800',
  },
});
