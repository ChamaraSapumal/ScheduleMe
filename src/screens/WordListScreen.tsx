import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ref, push, set, remove, get } from 'firebase/database';
import { db } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { colors, spacing } from '../theme';

const { width } = Dimensions.get('window');

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
    showAlert({
      title: 'Delete Word',
      message: 'Are you sure you want to remove this word from your vault?',
      showCancel: true,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await remove(ref(db, `users/${user.uid}/words/${id}`));
          fetchWords();
        } catch (e) {
          console.error(e);
        }
      }
    });
  };

  const handleLookupWord = async () => {
    if (!newWord.trim()) return;
    setLookingUp(true);
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${newWord.trim()}`);
      if (!response.ok) {
        showAlert({ title: "Not Found", message: "We couldn't find a standard definition for this word." });
        setLookingUp(false);
        return;
      }
      const data = await response.json();
      const firstMeaning = data[0]?.meanings[0]?.definitions[0]?.definition;
      if (firstMeaning) {
        setNewDefinition(firstMeaning);
      } else {
        showAlert({ title: "Notice", message: "Found the word, but no clear definition was available." });
      }
    } catch (e) {
      console.error(e);
      showAlert({ title: "Connection Error", message: "Failed to reach the dictionary service." });
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
    if (sortParam === 'newest') return 'Newest';
    if (sortParam === 'oldest') return 'Oldest';
    return 'A-Z';
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Word Vault</Text>
          <Text style={styles.headerSubtitle}>Building your vocabulary</Text>
        </View>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="alphabetical-variant" size={24} color="#FFF" />
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Draft Deck Input Card */}
        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <MaterialCommunityIcons name="pencil-plus-outline" size={20} color={colors.primary} />
            <Text style={styles.inputCardTitle}>New Entry</Text>
          </View>

          <View style={styles.wordInputRow}>
            <TextInput
              style={styles.wordInput}
              placeholder="Start typing a word..."
              placeholderTextColor={colors.textSecondary}
              value={newWord}
              onChangeText={setNewWord}
            />
            <TouchableOpacity
              style={[styles.lookupBtn, { opacity: newWord.trim().length === 0 ? 0.6 : 1 }]}
              onPress={handleLookupWord}
              disabled={lookingUp || newWord.trim().length === 0}
            >
              {lookingUp ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <MaterialCommunityIcons name="magnify" size={22} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.definitionInput}
            placeholder="What does it mean? (or auto-lookup above)"
            placeholderTextColor={colors.textSecondary}
            value={newDefinition}
            onChangeText={setNewDefinition}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.addBtn, { opacity: newWord.trim().length === 0 ? 0.6 : 1 }]}
            onPress={handleAddWord}
            disabled={newWord.trim().length === 0}
          >
            <Text style={styles.addBtnText}>Save to Vault</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listHeader}>
          <View style={styles.statsPill}>
            <Text style={styles.statsText}>{words.length} WORDS SAVED</Text>
          </View>
          <TouchableOpacity style={styles.sortPill} onPress={cycleSort}>
            <Text style={styles.sortText}>{getSortLabel()}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : words.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Image
              source={require('../../assets/finding_words.png')}
              style={styles.emptyImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyTitle}>Your vault is empty</Text>
            <Text style={styles.emptySubtitle}>Start collecting new words to expand your vocabulary and dominate your classes!</Text>
          </View>
        ) : (
          <View style={styles.wordList}>
            {sortedWords.map(item => (
              <View key={item.id} style={styles.wordCard}>
                <View style={styles.cardMain}>
                  <View style={styles.wordRow}>
                    <Text style={styles.wordText}>{item.word}</Text>
                    <Text style={styles.timeText}>{formatTime(item.timestamp)}</Text>
                  </View>
                  {!!item.definition && (
                    <Text style={styles.definitionText} numberOfLines={2}>
                      {item.definition}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteWord(item.id)}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '700',
    marginTop: -2,
  },
  headerIcon: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  container: { flex: 1, paddingHorizontal: 20 },
  inputCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 30,
    padding: 20,
    marginTop: 10,
    marginBottom: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  inputCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
    marginLeft: 8,
  },
  wordInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  wordInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  lookupBtn: {
    width: 50,
    backgroundColor: colors.primary,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  definitionInput: {
    backgroundColor: colors.background,
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 80,
    marginBottom: 15,
  },
  addBtn: {
    backgroundColor: colors.secondary,
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: 'center',
  },
  addBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  statsPill: {
    backgroundColor: 'rgba(109, 90, 150, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statsText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 1,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    marginRight: 4,
  },
  wordList: { gap: 12 },
  wordCard: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 15,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
  },
  cardMain: { flex: 1 },
  wordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  wordText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  timeText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  definitionText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    fontWeight: '500',
  },
  deleteBtn: {
    padding: 10,
  },
  emptyContainer: { 
    alignItems: 'center', 
    marginTop: 30,
    backgroundColor: '#FFFFFF', // Matching image background
    borderRadius: 40,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  emptyImage: {
    width: width * 0.75, // Made bigger
    height: width * 0.75,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600',
  }
});
