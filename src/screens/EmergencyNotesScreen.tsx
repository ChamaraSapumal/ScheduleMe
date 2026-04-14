import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ref, push, set, remove, get } from 'firebase/database';
import { db } from '../config/firebase';
import { syncWrite, fetchWithCache } from '../utils/SyncManager';
import { AuthContext } from '../context/AuthContext';
import { colors, spacing } from '../theme';

interface NoteItem {
  id: string;
  text: string;
  timestamp: number;
}

export default function EmergencyNotesScreen() {
  const { user } = useContext(AuthContext);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, [user]);

  const fetchNotes = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchWithCache(`users/${user.uid}/notes`, user.uid);
      const fetchedNotes: NoteItem[] = [];
      if (data) {
        Object.entries(data).forEach(([key, val]: any) => {
          fetchedNotes.push({ id: key, ...val });
        });
      }
      fetchedNotes.sort((a, b) => b.timestamp - a.timestamp);
      setNotes(fetchedNotes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!user || !newNote.trim()) return;
    try {
      const notesRef = ref(db, `users/${user.uid}/notes`);
      const newId = push(notesRef).key;
      await syncWrite('set', `users/${user.uid}/notes/${newId}`, user.uid, { text: newNote.trim(), timestamp: Date.now() });
      setNewNote('');
      fetchNotes();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!user) return;
    try {
      await syncWrite('remove', `users/${user.uid}/notes/${id}`, user.uid);
      fetchNotes();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.inputGroup}>
        <TextInput 
          style={[styles.input, styles.textArea]}
          placeholder="Quick note..."
          placeholderTextColor={colors.textSecondary}
          value={newNote}
          onChangeText={setNewNote}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        <TouchableOpacity style={styles.submitButton} onPress={handleAddNote}>
          <Text style={styles.submitText}>Save Note</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {notes.map(note => (
          <View key={note.id} style={styles.noteItem}>
            <Text style={styles.noteText}>{note.text}</Text>
            <View style={styles.noteFooter}>
              <Text style={styles.noteDate}>{new Date(note.timestamp).toLocaleString()}</Text>
              <TouchableOpacity onPress={() => handleDeleteNote(note.id)}>
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {notes.length === 0 && <Text style={styles.emptyText}>No emergency notes yet.</Text>}
      </View>
      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.m, backgroundColor: colors.background },
  inputGroup: { marginBottom: spacing.l, marginTop: spacing.s },
  input: { backgroundColor: colors.cardBackground, color: colors.textPrimary, padding: spacing.m, borderRadius: 8 },
  textArea: { height: 80, marginBottom: spacing.m },
  submitButton: { backgroundColor: colors.primary, padding: spacing.m, borderRadius: 8, alignItems: 'center' },
  submitText: { color: colors.textDark, fontWeight: 'bold', fontSize: 16 },
  list: { gap: spacing.s },
  noteItem: { backgroundColor: colors.cardBackground, padding: spacing.m, borderRadius: 8 },
  noteText: { color: colors.textPrimary, fontSize: 16, marginBottom: spacing.s },
  noteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.s, borderTopWidth: 1, borderTopColor: colors.background, paddingTop: spacing.s },
  noteDate: { color: colors.textSecondary, fontSize: 12 },
  emptyText: { color: colors.textSecondary, fontStyle: 'italic', marginVertical: spacing.s, textAlign: 'center' }
});
