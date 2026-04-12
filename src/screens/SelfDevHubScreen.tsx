import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

import TodosScreen from './TodosScreen';
import DreamsScreen from './DreamsScreen';
import EmergencyNotesScreen from './EmergencyNotesScreen';
import SpaceExplorerScreen from './SpaceExplorerScreen';
import ProfileScreen from './ProfileScreen';
import AttendanceScreen from './AttendanceScreen';
import AddCourseScreen from './AddCourseScreen';
import DailyKnowledgeScreen from './DailyKnowledgeScreen';

const Tab = createMaterialTopTabNavigator();

export default function SelfDevHubScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Development</Text>
        <MaterialCommunityIcons name="hexagon-multiple" size={28} color="#000" />
      </View>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: {
            backgroundColor: colors.cardBackground,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: colors.background,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: 'bold',
            textTransform: 'none',
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarIndicatorStyle: {
            backgroundColor: colors.primary,
            height: 3,
            borderRadius: 3,
          },
          tabBarScrollEnabled: true,
          tabBarItemStyle: { width: 'auto', paddingHorizontal: spacing.m },
          swipeEnabled: false,
        }}
      >
        <Tab.Screen name="Attendance" component={AttendanceScreen} />
        <Tab.Screen name="Add Class" component={AddCourseScreen} />
        <Tab.Screen name="Notes" component={EmergencyNotesScreen} />
        <Tab.Screen name="To-Dos" component={TodosScreen} />
        <Tab.Screen name="Dreams" component={DreamsScreen} />
        <Tab.Screen name="My profile" component={ProfileScreen} />
        <Tab.Screen name="Astro" component={SpaceExplorerScreen} />
        <Tab.Screen name="Knowledge" component={DailyKnowledgeScreen} />
      </Tab.Navigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.l,
    paddingHorizontal: spacing.m,
    paddingTop: spacing.s,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
});
