import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function PlaceholderScreen({ route }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{route.name} Screen</Text>
      <Text style={styles.subText}>Under Construction</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  subText: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: 8,
  }
});
