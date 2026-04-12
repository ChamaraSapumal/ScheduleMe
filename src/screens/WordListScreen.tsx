import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ref, push, set, remove, get } from 'firebase/database';
import { db } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { colors, spacing } from '../theme';

interface WordItem {
  id: string;
  word: string;
  definition: string;
  timestamp: number;
}

type SortOption = 'newest' | 'oldest' | 'az';

export default function WordListScreen() {
  const { user } = useContext(AuthContext);
  const { showAlert } = useCustomAlert();
  const [words, setWords] = useState<WordItem[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newDefinition, setNewDefinition] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [sortParam, setSortParam] = useState<SortOption>('newest');

  useEffect(() => {
    fetchWords();
  }, [user]);

  const fetchWords = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const wordsRef = ref(db, `users/${user.uid}/words`);
      const wordsSnap = await get(wordsRef);
      const fetchedWords: WordItem[] = [];
      if (wordsSnap.exists()) {
        wordsSnap.forEach(child => {
          fetchedWords.push({ id: child.key, ...child.val() });
        });
      }
      setWords(fetchedWords);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWord = async () => {
    if (!user || !newWord.trim()) return;
    try {
      const wordsRef = ref(db, `users/${user.uid}/words`);
      const newRef = push(wordsRef);
      await set(newRef, { 
        word: newWord.trim(), 
        definition: newDefinition.trim(),
        timestamp: Date.now()
      });
      setNewWord('');
      setNewDefinition('');
      fetchWords();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteWord = async (id: string) => {
    if (!user) return;
    try {
      await remove(ref(db, `users/${user.uid}/words/${id}`));
      fetchWords();
    } catch (e) {
      console.error(e);
    }
  };

  const handleLookupWord = async () => {
    if (!newWord.trim()) return;
    setLookingUp(true);
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${newWord.trim()}`);
      if (!response.ok) {
         showAlert({ title: "Meaning not found", message: "Could not find a definition for this word in the dictionary." });
         setLookingUp(false);
         return;
      }
      const data = await response.json();
      const firstMeaning = data[0]?.meanings[0]?.definitions[0]?.definition;
      if (firstMeaning) {
        setNewDefinition(firstMeaning);
      } else {
        showAlert({ title: "No meaning found", message: "The dictionary API returned results but no definition was found." });
      }
    } catch (e) {
      console.error(e);
      showAlert({ title: "Network error", message: "Failed to connect to the dictionary API." });
    } finally {
      setLookingUp(false);
    }
  };

  const sortedWords = [...words].sort((a, b) => {
    if (sortParam === 'az') {
      return a.word.localeCompare(b.word);
    } else if (sortParam === 'newest') {
      return (b.timestamp || 0) - (a.timestamp || 0);
    } else { // oldest
      return (a.timestamp || 0) - (b.timestamp || 0);
    }
  });

  const cycleSort = () => {
    if (sortParam === 'newest') setSortParam('oldest');
    else if (sortParam === 'oldest') setSortParam('az');
    else setSortParam('newest');
  };

  const getSortLabel = () => {
    if (sortParam === 'newest') return 'Newest First';
    if (sortParam === 'oldest') return 'Oldest First';
    return 'A-Z';
  };

  const getSortIcon = () => {
    if (sortParam === 'newest') return 'sort-clock-descending-outline';
    if (sortParam === 'oldest') return 'sort-clock-ascending-outline';
    return 'sort-alphabetical-ascending';
  };

  if (loading) return <ActivityIndicator size="large" color={colors.secondary} style={{ marginTop: 20 }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={styles.container}>
      <View style={styles.inputGroup}>
        <View style={styles.row}>
          <TextInput 
            style={[styles.input, { flex: 1, marginBottom: spacing.s }]}
            placeholder="New word..."
            placeholderTextColor={colors.textSecondary}
            value={newWord}
            onChangeText={setNewWord}
          />
          <TouchableOpacity 
             style={[styles.lookupButton, { opacity: newWord.trim().length === 0 ? 0.5 : 1 }]} 
             onPress={handleLookupWord}
             disabled={lookingUp || newWord.trim().length === 0}
          >
             {lookingUp ? <ActivityIndicator size="small" color={colors.textDark} /> : <MaterialCommunityIcons name="magnify" size={24} color={colors.textDark} />}
          </TouchableOpacity>
        </View>
        
        <TextInput 
          style={[styles.input, { minHeight: 80 }]}
          placeholder="Meaning or context..."
          placeholderTextColor={colors.textSecondary}
          value={newDefinition}
          onChangeText={setNewDefinition}
          onSubmitEditing={handleAddWord}
          multiline
          textAlignVertical="top"
        />
        <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.secondary, marginTop: spacing.m }]} onPress={handleAddWord}>
          <Text style={[styles.submitText, { color: colors.textDark }]}>Add Word</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        <Text style={styles.filterTitle}>Saved Words ({words.length})</Text>
        <TouchableOpacity style={styles.sortButton} onPress={cycleSort}>
          <Text style={styles.sortText}>{getSortLabel()}</Text>
          <MaterialCommunityIcons name={getSortIcon()} size={18} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {sortedWords.map(item => (
          <View key={item.id} style={styles.wordItem}>
            <View style={styles.wordContent}>
              <Text style={styles.wordTitle}>{item.word}</Text>
              {!!item.definition && <Text style={styles.wordDefinition}>{item.definition}</Text>}
            </View>
            <TouchableOpacity onPress={() => handleDeleteWord(item.id)}>
              <MaterialCommunityIcons name="close" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}
        {words.length === 0 && <Text style={styles.emptyText}>No words added yet.</Text>}
      </View>
      <View style={{height: 100}} />
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.m, backgroundColor: colors.background },
  inputGroup: { marginBottom: spacing.s, marginTop: spacing.s },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  input: { backgroundColor: colors.cardBackground, color: colors.textPrimary, padding: spacing.m, borderRadius: 8 },
  lookupButton: { backgroundColor: colors.secondary, width: 48, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.s },
  submitButton: { backgroundColor: colors.primary, padding: spacing.m, borderRadius: 8, alignItems: 'center' },
  submitText: { color: colors.textDark, fontWeight: 'bold', fontSize: 16 },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.m, marginTop: spacing.s },
  filterTitle: { color: colors.textSecondary, fontWeight: 'bold', fontSize: 14 },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.cardBackground, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  sortText: { color: colors.secondary, fontSize: 12, fontWeight: 'bold' },
  list: { gap: spacing.s },
  wordItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.cardBackground, padding: spacing.m, borderRadius: 8 },
  wordContent: { flex: 1 },
  wordTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  wordDefinition: { color: colors.textSecondary, fontSize: 14 },
  emptyText: { color: colors.textSecondary, fontStyle: 'italic', marginVertical: spacing.s, textAlign: 'center' }
});
