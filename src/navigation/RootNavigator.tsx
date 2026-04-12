import React, { useContext } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, View, Platform } from 'react-native';

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
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          height: Platform.OS === 'ios' ? 70 : 55,
          paddingBottom: Platform.OS === 'ios' ? 15 : 5,
          paddingTop: 5,
          elevation: 15,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -5 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        },
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarActiveTintColor: '#1A1820',
        tabBarInactiveTintColor: '#A0A3AE',
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
            <View>
              <MaterialCommunityIcons 
                name={iconName} 
                size={26} 
                color={color} 
              />
              {route.name === 'Tools' && updateAvailable && (
                  <View style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#FFFFFF' }} />
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
