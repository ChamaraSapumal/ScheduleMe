import React, { useContext } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import { AuthContext } from '../context/AuthContext';
import { colors } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import AgendaScreen from '../screens/AgendaScreen';
import CalendarScreen from '../screens/CalendarScreen';
import AddCourseScreen from '../screens/AddCourseScreen';
import SelfDevHubScreen from '../screens/SelfDevHubScreen';
import LockScreen from '../screens/LockScreen';

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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.cardBackground,
          borderTopColor: colors.cardBackground,
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarActiveTintColor: colors.secondary, // Yellow
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarIcon: ({ color, size }) => {
          let iconName: any = 'help-circle-outline';

          if (route.name === 'Agenda') {
            iconName = 'playlist-check';
          } else if (route.name === 'Add') {
            iconName = 'calendar-plus';
          } else if (route.name === 'Calendar') {
            iconName = 'calendar-month';
          } else if (route.name === 'Tools') {
            iconName = 'toolbox-outline';
          }

          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Agenda" component={AgendaScreen} />
      <Tab.Screen name="Add" component={AddCourseScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Tools" component={SelfDevHubScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading, isUnlocked } = useContext(AuthContext);

  if (loading) {
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
            <Stack.Screen name="MainTabs" component={TabNavigator} />
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
