import { ActivityIndicator, View, Platform, StyleSheet, Animated, Dimensions } from 'react-native';
import React, { useContext, useRef, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, useNavigationContainerRef } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTimer } from '../context/TimerContext';

import { AuthContext } from '../context/AuthContext';
import { useAppUpdate } from '../components/AppUpdater';
import { colors } from '../theme';
import { TimerProvider } from '../context/TimerContext';
import { DynamicIsland } from '../components/DynamicIsland';

import LoginScreen from '../screens/LoginScreen';
import AgendaScreen from '../screens/AgendaScreen';
import CalendarScreen from '../screens/CalendarScreen';
import WordListScreen from '../screens/WordListScreen';
import SelfDevHubScreen from '../screens/SelfDevHubScreen';
import FocusScreen from '../screens/FocusScreen';
import LockScreen from '../screens/LockScreen';
import AddCourseScreen from '../screens/AddCourseScreen';
import ShareTimetableScreen from '../screens/ShareTimetableScreen';
import ScanTimetableScreen from '../screens/ScanTimetableScreen';
import InAppTour from '../components/InAppTour';
import { AnimatedSplashScreen } from '../components/AnimatedSplashScreen';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionCallback } from 'expo-quick-actions/hooks';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MyTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
  },
};

function TabNavigator() {
  const { updateAvailable } = useAppUpdate();
  const insets = useSafeAreaInsets();

  const isAndroid = Platform.OS === 'android';
  const bottomInset = insets.bottom;
  
  // Dynamic height calculation to avoid overlap
  const tabHeight = Platform.OS === 'ios' ? 85 : (70 + (bottomInset > 0 ? bottomInset - 5 : 0));
  const tabPaddingBottom = Platform.OS === 'ios' ? 30 : Math.max(10, bottomInset);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.primary,
          borderTopWidth: 0,
          height: tabHeight,
          paddingBottom: tabPaddingBottom,
          paddingTop: 10,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.2,
          shadowRadius: 15,
        },
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
          marginTop: 5,
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.4)',
        tabBarIcon: ({ color, focused }) => {
          let iconName: any = 'help-circle-outline';

          if (route.name === 'Agenda') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar-month' : 'calendar-month-outline';
          } else if (route.name === 'Words') {
            iconName = focused ? 'book-open-page-variant' : 'book-open-page-variant-outline';
          } else if (route.name === 'Focus') {
            iconName = focused ? 'timer' : 'timer-outline';
          } else if (route.name === 'Tools') {
            iconName = focused ? 'compass' : 'compass-outline';
          }

          return (
            <View style={styles.iconContainer}>
              {focused && <View style={styles.activePill} />}
              <MaterialCommunityIcons 
                name={iconName} 
                size={24} 
                color={color} 
              />
              {route.name === 'Tools' && updateAvailable && (
                  <View style={styles.updateBadge} />
              )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Agenda" component={AgendaScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Words" component={WordListScreen} />
      <Tab.Screen name="Focus" component={FocusScreen} />
      <Tab.Screen name="Tools" component={SelfDevHubScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 32,
  },
  activePill: {
    position: 'absolute',
    width: 45,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  updateBadge: {
    position: 'absolute',
    top: -2,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: colors.primary,
  }
});

export default function RootNavigator() {
  const { user, loading, isUnlocked, hasSeenOnboarding } = useContext(AuthContext);
  const { isRunning } = useTimer();
  const navigationRef = useNavigationContainerRef();

  const [currentRoute, setCurrentRoute] = React.useState<string | null>(null);
  const [pendingQuickAction, setPendingQuickAction] = React.useState<string | null>(null);

  // Initialize Quick Actions
  useEffect(() => {
    QuickActions.setItems([
      {
        id: 'start_focus',
        title: 'Start Focus Session',
        // In Android, passing standard valid icon names (lowercase) is recommended
        icon: 'timer', 
        params: { href: 'Focus' }
      },
      {
        id: 'share_schedule',
        title: 'Share Schedule',
        icon: 'share',
        params: { href: 'ShareTimetable' }
      },
      {
        id: 'add_course',
        title: 'Add Course',
        icon: 'add',
        params: { href: 'Add' }
      }
    ]);
  }, []);

  // Catch Quick Actions (Shortcuts)
  useQuickActionCallback((action) => {
    if (action?.params?.href) {
      const targetRoute = action.params.href as string;
      if (user && isUnlocked) {
        handleQuickNavigation(targetRoute);
      } else {
        // App is locked or opening - queue the routing intent securely
        setPendingQuickAction(targetRoute);
      }
    }
  });

  const handleQuickNavigation = (route: string) => {
    if (!navigationRef.isReady()) return;
    if (route === 'Focus') {
      // Focus is nested inside MainTabs
      // @ts-ignore
      navigationRef.navigate('MainTabs', { screen: 'Focus' });
    } else {
      // @ts-ignore
      navigationRef.navigate(route);
    }
  };

  // Evaluate queued shortcut intent after Biometric Authentication
  useEffect(() => {
    if (user && isUnlocked && pendingQuickAction) {
      // Small delay to ensure LockScreen completely unmounts and Tabs stack mounts
      const flushTimer = setTimeout(() => {
        handleQuickNavigation(pendingQuickAction);
        setPendingQuickAction(null);
      }, 300);
      return () => clearTimeout(flushTimer);
    }
  }, [user, isUnlocked, pendingQuickAction]);

  // Set initial route
  useEffect(() => {
    const timer = setTimeout(() => {
        if (navigationRef.isReady()) {
            const state = navigationRef.getRootState();
            onStateChange(state);
        }
    }, 500); // Small delay to let navigation settle
    return () => clearTimeout(timer);
  }, []);

  // Detect current route for the root layout shift
  const onStateChange = (state: any) => {
    try {
      if (!state) return;
      let route = state.routes[state.index];
      while (route && route.state) {
        const nextIndex = route.state.index ?? 0;
        route = route.state.routes[nextIndex];
      }
      setCurrentRoute(route?.name || null);
    } catch (e) {
      setCurrentRoute(null);
    }
  };

  const shouldShift = isRunning && 
    user && 
    isUnlocked &&
    currentRoute !== 'Focus';
  const shiftAnim = useRef(new Animated.Value(0)).current;

  // Track splash visibility globally here instead of blocking App.tsx
  const [showSplash, setShowSplash] = React.useState(true);
  // App is ready to reveal when auth is loaded and onboarding flags are parsed
  const isSetupComplete = !loading && (!user || hasSeenOnboarding !== null);

  useEffect(() => {
    Animated.spring(shiftAnim, {
      toValue: shouldShift ? 90 : 0, // 50 (top) + 40 (height) = 90px to clear perfectly at new position
      friction: 8,
      tension: 50,
      useNativeDriver: false,
    }).start();
  }, [shouldShift]);

  return (
    <NavigationContainer theme={MyTheme} onStateChange={onStateChange} ref={navigationRef}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Animated.View style={{ flex: 1, marginTop: shiftAnim }}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {user ? (
              isUnlocked ? (
                <Stack.Group>
                  <Stack.Screen name="MainTabs" component={TabNavigator} />
                  <Stack.Screen name="Add" component={AddCourseScreen} />
                  <Stack.Screen name="ShareTimetable" component={ShareTimetableScreen} />
                  <Stack.Screen name="ScanTimetable" component={ScanTimetableScreen} />
                </Stack.Group>
              ) : (
                <Stack.Screen name="Lock" component={LockScreen} />
              )
            ) : (
              <Stack.Screen name="Login" component={LoginScreen} />
            )}
          </Stack.Navigator>
        </Animated.View>
        <DynamicIsland currentRoute={currentRoute} />
        <InAppTour />

        {showSplash && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 99999 }]}>
            <AnimatedSplashScreen 
                isAppReady={isSetupComplete} 
                onFinish={() => setShowSplash(false)} 
            />
          </View>
        )}
      </View>
    </NavigationContainer>
  );
}
