import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ref, push, set, remove, get } from 'firebase/database';
import { db } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { colors, spacing } from '../theme';

interface ListItem {
  id: string;
  text: string;
}

export default function DreamsScreen() {
  const { user } = useContext(AuthContext);
  const [dreams, setDreams] = useState<ListItem[]>([]);
  const [newDream, setNewDream] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDreams();
  }, [user]);

  const fetchDreams = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const dreamsRef = ref(db, `users/${user.uid}/dreams`);
      const dreamsSnap = await get(dreamsRef);
      const fetchedDreams: ListItem[] = [];
      if (dreamsSnap.exists()) {
        dreamsSnap.forEach(child => {
          fetchedDreams.push({ id: child.key, ...child.val() });
        });
      }
      setDreams(fetchedDreams);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDream = async () => {
    if (!user || !newDream.trim()) return;
    try {
      const dreamsRef = ref(db, `users/${user.uid}/dreams`);
      const newRef = push(dreamsRef);
      await set(newRef, { text: newDream.trim() });
      setNewDream('');
      fetchDreams();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteDream = async (id: string) => {
    if (!user) return;
    try {
      await remove(ref(db, `users/${user.uid}/dreams/${id}`));
      fetchDreams();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <ActivityIndicator size="large" color={colors.secondary} style={{ marginTop: 20 }} />;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput 
          style={styles.input}
          placeholder="Add a dream or goal..."
          placeholderTextColor={colors.textSecondary}
          value={newDream}
          onChangeText={setNewDream}
          onSubmitEditing={handleAddDream}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddDream}>
          <MaterialCommunityIcons name="plus" size={20} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {dreams.map(dream => (
          <View key={dream.id} style={styles.listItem}>
            <View style={styles.todoRow}>
              <MaterialCommunityIcons name="star" size={20} color={colors.secondary} style={{ marginRight: 8 }} />
              <Text style={styles.listText}>{dream.text}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDeleteDream(dream.id)}>
              <MaterialCommunityIcons name="close" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}
        {dreams.length === 0 && <Text style={styles.emptyText}>No dreams added yet.</Text>}
      </View>
      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.m, backgroundColor: colors.background },
  inputContainer: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.m, marginTop: spacing.s },
  input: { flex: 1, backgroundColor: colors.cardBackground, color: colors.textPrimary, padding: spacing.m, borderRadius: 8 },
  addButton: { width: 48, backgroundColor: colors.secondary, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  list: { gap: spacing.s },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.cardBackground, padding: spacing.m, borderRadius: 8 },
  todoRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  listText: { color: colors.textPrimary, fontSize: 16, flex: 1 },
  emptyText: { color: colors.textSecondary, fontStyle: 'italic', marginVertical: spacing.s, textAlign: 'center' }
});
