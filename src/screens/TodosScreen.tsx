import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ref, push, set, remove, get } from 'firebase/database';
import { db } from '../config/firebase';
import { syncWrite, fetchWithCache, broadcastActivity } from '../utils/SyncManager';
import { AuthContext } from '../context/AuthContext';
import { colors, spacing } from '../theme';

interface ListItem {
  id: string;
  text: string;
  completed?: boolean;
}

export default function TodosScreen() {
  const { user } = useContext(AuthContext);
  const [todos, setTodos] = useState<ListItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTodos();
  }, [user]);

  const fetchTodos = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchWithCache(`users/${user.uid}/todos`, user.uid);
      const fetchedTodos: ListItem[] = [];
      if (data) {
        Object.entries(data).forEach(([key, val]: any) => {
          fetchedTodos.push({ id: key, ...val });
        });
      }
      setTodos(fetchedTodos);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTodo = async () => {
    if (!user || !newTodo.trim()) return;
    try {
      const todosRef = ref(db, `users/${user.uid}/todos`);
      const newId = push(todosRef).key;
      await syncWrite('set', `users/${user.uid}/todos/${newId}`, user.uid, { text: newTodo.trim(), completed: false });
      setNewTodo('');
      fetchTodos();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleTodo = async (item: ListItem) => {
    if (!user) return;
    try {
      await syncWrite('set', `users/${user.uid}/todos/${item.id}`, user.uid, { ...item, completed: !item.completed });
      if (!item.completed) {
        broadcastActivity(user.uid, '', 'completed a To-Do task 🎯');
      }
      fetchTodos();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    if (!user) return;
    try {
      await syncWrite('remove', `users/${user.uid}/todos/${id}`, user.uid);
      fetchTodos();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput 
          style={styles.input}
          placeholder="Add a new task..."
          placeholderTextColor={colors.textSecondary}
          value={newTodo}
          onChangeText={setNewTodo}
          onSubmitEditing={handleAddTodo}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddTodo}>
          <MaterialCommunityIcons name="plus" size={20} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {todos.map(todo => (
          <View key={todo.id} style={styles.listItem}>
            <TouchableOpacity onPress={() => handleToggleTodo(todo)} style={styles.todoRow}>
              <MaterialCommunityIcons 
                name={todo.completed ? "checkbox-marked" : "checkbox-blank-outline"} 
                size={24} 
                color={todo.completed ? colors.primary : colors.textSecondary} 
              />
              <Text style={[styles.listText, todo.completed && styles.listTextCompleted]}>
                {todo.text}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteTodo(todo.id)}>
              <MaterialCommunityIcons name="close" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}
        {todos.length === 0 && <Text style={styles.emptyText}>No tasks yet.</Text>}
      </View>
      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.m, backgroundColor: colors.background },
  inputContainer: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.m, marginTop: spacing.s },
  input: { flex: 1, backgroundColor: colors.cardBackground, color: colors.textPrimary, padding: spacing.m, borderRadius: 8 },
  addButton: { width: 48, backgroundColor: colors.primary, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  list: { gap: spacing.s },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.cardBackground, padding: spacing.m, borderRadius: 8 },
  todoRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  listText: { color: colors.textPrimary, marginLeft: spacing.s, fontSize: 16, flex: 1 },
  listTextCompleted: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  emptyText: { color: colors.textSecondary, fontStyle: 'italic', marginVertical: spacing.s, textAlign: 'center' }
});
