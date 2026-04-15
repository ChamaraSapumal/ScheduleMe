import { ActivityIndicator, View, Platform, StyleSheet, Animated, Dimensions, useWindowDimensions } from 'react-native';
import React, { useContext, useRef, useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme, useNavigationContainerRef, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTimer } from '../context/TimerContext';
import * as Notifications from 'expo-notifications';

import { AuthContext } from '../context/AuthContext';
import { ref, push, set, get, update } from 'firebase/database';
import { db } from '../config/firebase';
import { TimerProvider } from '../context/TimerContext';
import { DynamicIsland } from '../components/DynamicIsland';
import { useCustomAlert } from '../context/AlertContext';
import { acceptFriendRequest, declineFriendRequest, approveJoinGroup, declineJoinRequest } from '../utils/SyncManager';
import { useAppUpdate } from '../components/AppUpdater';
import { colors } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import AgendaScreen from '../screens/AgendaScreen';
import CalendarScreen from '../screens/CalendarScreen';
import WordListScreen from '../screens/WordListScreen';
import SelfDevHubScreen from '../screens/SelfDevHubScreen';
import FocusScreen from '../screens/FocusScreen';
import LockScreen from '../screens/LockScreen';
import AddCourseScreen from '../screens/AddCourseScreen';
import ShareSocialScreen from '../screens/ShareSocialScreen';
import ScanSocialScreen from '../screens/ScanSocialScreen';
import FriendListScreen from '../screens/FriendListScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
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

  const { isRunning } = useTimer();
  const navState = useNavigationState(state => state);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  
  // Use a more robust way to detect the active route across nested navigators
  let currentTabName = navState?.routes[navState.index]?.name;
  if (navState?.routes[navState.index]?.state) {
    const innerState: any = navState.routes[navState.index].state;
    currentTabName = innerState.routes[innerState.index]?.name;
  }
  
  // Hide tab bar if on Focus screen and in landscape (session active/launched)
  const hideTabBar = currentTabName === 'Focus' && isLandscape;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          display: hideTabBar ? 'none' : 'flex',
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
  const { user, loading, isUnlocked, hasSeenOnboarding, pokes, clearPokes, bubblePlayer, incomingRequests, groupJoinRequests, groupMetadata, userName } = useContext(AuthContext);
  const { isRunning, isDNDEnabled } = useTimer();
  const { isDownloading } = useAppUpdate();
  const { showAlert } = useCustomAlert();
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
        params: { href: 'ShareSocial' }
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

  const shouldShift = (isRunning || isDownloading) && 
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

  // Global Orientation Lock (Consolidated & Strict)
  useEffect(() => {
    // We stay in landscape if the timer is running OR if we are on the Focus screen
    // and it's already in landscape (meaning it started). 
    // This prevents flipping back on Pause/Reset.
    async function enforceOrientation() {
      try {
        if (currentRoute === 'Focus') {
          if (isRunning) {
            // Force Landscape when running
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
          } else {
            // When paused/reset on Focus screen, we ALLOW landscape if it was already there
            // but we don't force it back to portrait unless we leave the screen.
            const currentOrientation = await ScreenOrientation.getOrientationAsync();
            const isHorizontal = currentOrientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT || 
                             currentOrientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
            
            if (!isHorizontal) {
               await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            }
          }
        } else {
          // Everything else is strictly Portrait
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch (e) {
        console.warn('Orientation lock failed:', e);
      }
    }
    
    enforceOrientation();
  }, [isRunning, currentRoute]);

  // Global Poke Listener & Suppressor
  useEffect(() => {
    if (pokes && pokes.length > 0) {
      const isFocused = isRunning && currentRoute === 'Focus'; // More accurate suppression
      
      if (!isFocused && !isDNDEnabled) {
        const lastPoke = pokes[pokes.length - 1];
        
        // Trigger Dynamic Island via AlertContext
        showAlert({
          title: 'Incoming Motivation! ✨',
          message: `${lastPoke.senderName} says: ${lastPoke.message || 'Keep it up!'}`,
          type: 'success'
        });

        // Play Bubble Pop
        if (bubblePlayer) {
          bubblePlayer.seekTo(0);
          bubblePlayer.play();
        }

        // Clear from Firebase so we don't repeat
        clearPokes();
      }
    }
  }, [pokes, isRunning, currentRoute]);

  // Global Friend Request Listener
  useEffect(() => {
    if (incomingRequests && Object.keys(incomingRequests).length > 0) {
      const isFocused = isRunning && currentRoute === 'Focus';
      if (!isFocused && !isDNDEnabled) {
        const firstRequestUid = Object.keys(incomingRequests)[0];
        const request = incomingRequests[firstRequestUid];
        
        showAlert({
          title: 'New Friend Request! 👋',
          message: `${request.senderName} wants to connect with you.`,
          type: 'info',
          showCancel: true,
          cancelText: 'Reject',
          confirmText: 'Accept',
          onConfirm: async () => {
            if (!user) return;
            await acceptFriendRequest(user.uid, firstRequestUid, userName || 'Student', request.senderName);
            showAlert({ title: 'New Connection! ✨', message: `You and ${request.senderName} are now connected.`, type: 'success' });
          },
          onCancel: async () => {
            if (!user) return;
            await declineFriendRequest(user.uid, firstRequestUid);
            showAlert({ title: 'Request Declined', message: 'The request has been removed.', type: 'warning' });
          }
        });
      }
    }
  }, [incomingRequests, isRunning, currentRoute]);

  // Global Group Join Request Listener
  useEffect(() => {
    if (groupJoinRequests && Object.keys(groupJoinRequests).length > 0) {
      const isFocused = isRunning && currentRoute === 'Focus';
      if (!isFocused && !isDNDEnabled) {
        // Iterate through all groups and find the first pending request
        for (const groupId of Object.keys(groupJoinRequests || {})) {
          const requests = groupJoinRequests[groupId];
          if (!requests) continue;
          for (const requesterUid of Object.keys(requests || {})) {
            const req = requests[requesterUid];
            if (req.status === 'pending') {
              const groupName = groupMetadata[groupId]?.name || 'Group';
              
              showAlert({
                title: 'Join Request! 🏢',
                message: `${req.name} wants to rejoin "${groupName}".`,
                type: 'info',
                confirmText: 'Approve',
                showCancel: true,
                cancelText: 'Decline',
                onConfirm: async () => {
                   if (!user) return;
                   await approveJoinGroup(user.uid, groupId, requesterUid);
                   showAlert({ title: 'Welcome Back!', message: `${req.name} has been added to the group.`, type: 'success' });
                },
                onCancel: async () => {
                   if (!user) return;
                   await declineJoinRequest(user.uid, groupId, requesterUid);
                }
              });

              // Mark as 'seen' so it doesn't notify again
              update(ref(db, `groups/${groupId}/join_requests/${requesterUid}`), { status: 'seen' });
              
              // Only notify one at a time for sanity
              return; 
            }
          }
        }
      }
    }
  }, [groupJoinRequests, isRunning, currentRoute, groupMetadata]);

  // Handle Native Notification Actions (Dynamic Island Buttons)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const actionId = response.actionIdentifier;
      const data = response.notification.request.content.data;
      
      if (!user) return;

      if (data.type === 'friend_request') {
        if (actionId === 'accept') {
          acceptFriendRequest(user.uid, data.senderUid, userName || 'Student', data.senderName);
          showAlert({ title: 'New Connection! ✨', message: `You and ${data.senderName} are now connected.`, type: 'success' });
        } else if (actionId === 'reject') {
          declineFriendRequest(user.uid, data.senderUid);
          showAlert({ title: 'Request Declined', message: 'The request has been removed.', type: 'warning' });
        }
      } else if (data.type === 'group_request') {
        if (actionId === 'approve') {
          approveJoinGroup(user.uid, data.groupId, data.requesterUid);
          showAlert({ title: 'Welcome Back!', message: `${data.requesterName} has been added to the group.`, type: 'success' });
        } else if (actionId === 'decline') {
          declineJoinRequest(user.uid, data.groupId, data.requesterUid);
        }
      }
    });

    return () => subscription.remove();
  }, [user, userName]);

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
                  <Stack.Screen name="ShareSocial" component={ShareSocialScreen} />
                  <Stack.Screen name="ScanSocial" component={ScanSocialScreen} />
                  <Stack.Screen name="FriendList" component={FriendListScreen} />
                  <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
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
