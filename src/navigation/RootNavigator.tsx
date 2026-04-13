import React, { useContext } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, View, Platform, StyleSheet } from 'react-native';

import { AuthContext } from '../context/AuthContext';
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
import ShareTimetableScreen from '../screens/ShareTimetableScreen';
import ScanTimetableScreen from '../screens/ScanTimetableScreen';
import InAppTour from '../components/InAppTour';

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

  return (
    <View style={{ flex: 1 }}>
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.primary,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 85 : 70,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
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
    <InAppTour />
    </View>
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

  if (loading || hasSeenOnboarding === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={MyTheme}>
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
    </NavigationContainer>
  );
}
