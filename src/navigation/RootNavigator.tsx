import React, { useContext } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import { AuthContext } from '../context/AuthContext';
import { useAppUpdate } from '../components/AppUpdater';
import { colors } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import AgendaScreen from '../screens/AgendaScreen';
import CalendarScreen from '../screens/CalendarScreen';
import WordListScreen from '../screens/WordListScreen';
import SelfDevHubScreen from '../screens/SelfDevHubScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LockScreen from '../screens/LockScreen';
import AddCourseScreen from '../screens/AddCourseScreen';
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
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          paddingTop: 0,
          paddingBottom: 15,
          height: 65,
        },
        tabBarActiveTintColor: '#000000', // Solid black active
        tabBarInactiveTintColor: '#A0A3AE', // Gray inactive
        tabBarShowLabel: false, // Hide labels like in the screenshot
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: any = 'help-circle-outline';

          if (route.name === 'Agenda') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Words') {
            iconName = focused ? 'card-multiple' : 'card-multiple-outline';
          } else if (route.name === 'Tools') {
            iconName = focused ? 'hexagon' : 'hexagon-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'emoticon' : 'emoticon-outline';
            if (updateAvailable) {
              return (
                <View>
                  <MaterialCommunityIcons name={iconName} size={size} color={color} />
                  <View style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: colors.background }} />
                </View>
              );
            }
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar-month' : 'calendar-month-outline';
          }

          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Agenda" component={AgendaScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Words" component={WordListScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
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
