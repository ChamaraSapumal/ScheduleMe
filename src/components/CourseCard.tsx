import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

interface CourseCardProps {
  moduleName: string;
  type: string;
  location: string;
  timeRange: string;
  colorIndicator: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function CourseCard({ moduleName, type, location, timeRange, colorIndicator, onEdit, onDelete }: CourseCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.type}>{type}</Text>
        <View style={styles.actionIcons}>
          {onEdit && (
            <TouchableOpacity onPress={onEdit} style={styles.iconButton}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity onPress={onDelete} style={styles.iconButton}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{moduleName}</Text>
        <View style={[styles.indicator, { backgroundColor: colorIndicator }]} />
      </View>
      
      <View style={styles.infoRow}>
        <MaterialCommunityIcons name="clock-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.infoText}>{timeRange}</Text>
      </View>
      
      <View style={styles.infoRow}>
        <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.infoText}>{location}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: spacing.m,
    marginBottom: spacing.m,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.s,
  },
  type: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: spacing.s,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginLeft: 6,
  },
  actionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: spacing.m,
  },
});
