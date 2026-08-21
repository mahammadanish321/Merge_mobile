import { Tabs } from 'expo-router';
import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { LayoutDashboard, Calendar, User, Clock, Users, MessageSquare, Flame } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/context/AuthContext';

interface TabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

function CustomTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { user } = useAuth();
  const canManage = user?.role === 'teacher' || user?.role === 'admin';

  // Filter routes for tab dock
  const visibleRoutes = state.routes.filter((route: any) => {
    // 1. Never show sessions on the bottom dock (it is accessed from Routine header)
    if (route.name === 'sessions') return false;

    // 2. Hide students tab for student users
    if (route.name === 'students' && !canManage) return false;

    const { options } = descriptors[route.key];
    if (options?.href === null) return false;

    return true;
  });

  const activeRoute = state.routes[state.index];

  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.liquidWrapper}>
        <BlurView intensity={95} tint="light" style={styles.tabBar}>
          {/* Liquid Sheen - Primary Gloss */}
          <LinearGradient
            colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.1)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.glossyOverlay}
          />
          
          {/* Liquid Sheen - Secondary Reflection */}
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.15)', 'transparent']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.reflectionOverlay}
          />

          <View style={styles.tabsInner}>
            {visibleRoutes.map((route: any) => {
              const { options } = descriptors[route.key];
              const label = options.title !== undefined ? options.title : route.name;
              const isFocused = activeRoute.key === route.key;

              const onPress = () => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
              };

              const activeColor = '#105934'; // Brand Green
              const inactiveColor = 'rgba(16, 89, 52, 0.45)';

              const renderIcon = (color: string) => {
                const size = 22;
                const strokeWidth = isFocused ? 2.5 : 2;
                switch (route.name) {
                  case 'index': return <LayoutDashboard size={size} color={color} strokeWidth={strokeWidth} />;
                  case 'nodes': return <MessageSquare size={size} color={color} strokeWidth={strokeWidth} />;
                  case 'drop': return <Flame size={size} color={color} strokeWidth={strokeWidth} />;
                  case 'students': return <Users size={size} color={color} strokeWidth={strokeWidth} />;
                  case 'sessions': return <Clock size={size} color={color} strokeWidth={strokeWidth} />;
                  case 'schedule': return <Calendar size={size} color={color} strokeWidth={strokeWidth} />;
                  case 'you': return <User size={size} color={color} strokeWidth={strokeWidth} />;
                  default: return <LayoutDashboard size={size} color={color} strokeWidth={strokeWidth} />;
                }
              };

              return (
                <TouchableOpacity 
                  key={route.key} 
                  onPress={onPress} 
                  style={styles.tabItem} 
                  activeOpacity={0.7}
                >
                  <View style={styles.iconContainerVertical}>
                    {renderIcon(isFocused ? activeColor : inactiveColor)}
                    <Text style={[styles.tabLabel, { color: isFocused ? activeColor : inactiveColor }]}>
                      {label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const canManage = user?.role === 'teacher' || user?.role === 'admin';

  return (
    <View style={styles.content}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="nodes" options={{ title: 'Nodes' }} />
        <Tabs.Screen name="drop" options={{ title: 'Drop' }} />
        <Tabs.Screen 
          name="students" 
          options={{ 
            title: 'Students', 
            href: canManage ? '/students' : null 
          }} 
        />
        <Tabs.Screen name="schedule" options={{ title: 'Routine' }} />
        <Tabs.Screen name="you" options={{ title: 'You' }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 35 : 25,
    left: 20,
    right: 20,
    height: 75,
    zIndex: 1000,
  },
  liquidWrapper: {
    flex: 1,
    borderRadius: 38,
    backgroundColor: 'transparent',
    // Soft glass shadow
    shadowColor: '#105934',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  tabBar: {
    flex: 1,
    borderRadius: 38,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'rgba(16, 89, 52, 0.08)', // Brand green with ultra-low opacity
  },
  glossyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
  },
  reflectionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderBottomLeftRadius: 38,
    borderBottomRightRadius: 38,
  },
  tabsInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconContainerVertical: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    zIndex: 10,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
});
