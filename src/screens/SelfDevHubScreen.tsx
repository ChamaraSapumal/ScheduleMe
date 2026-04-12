import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

import TodosScreen from './TodosScreen';
import DreamsScreen from './DreamsScreen';
import EmergencyNotesScreen from './EmergencyNotesScreen';
import WordListScreen from './WordListScreen';
import DailyKnowledgeScreen from './DailyKnowledgeScreen';

const Tab = createMaterialTopTabNavigator();

export default function SelfDevHubScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Self Development</Text>
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
        }}
      >
        <Tab.Screen name="Knowledge" component={DailyKnowledgeScreen} />
        <Tab.Screen name="To-Dos" component={TodosScreen} />
        <Tab.Screen name="Dreams" component={DreamsScreen} />
        <Tab.Screen name="Notes" component={EmergencyNotesScreen} />
        <Tab.Screen name="Words" component={WordListScreen} />
      </Tab.Navigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', marginBottom: spacing.m, paddingTop: spacing.s },
  headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: 'bold' }
});
