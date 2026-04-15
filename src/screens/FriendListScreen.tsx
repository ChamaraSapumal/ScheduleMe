import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { removeFriend } from '../utils/SyncManager';
import { colors } from '../theme';

const theme = {
  primary: '#3E315A',
  background: '#F8F5FF',
  white: '#FFFFFF',
  accent: '#D2B9FF',
  textMain: '#1A1820',
  textMuted: '#8F8A9E',
  danger: '#FF6B6B'
};

export default function FriendListScreen({ navigation }: any) {
  const { user, friends } = useContext(AuthContext);
  const { showAlert } = useCustomAlert();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const friendList = Object.entries(friends || {}).map(([uid, data]: [string, any]) => ({
    uid,
    name: data.name || 'Student',
    photo: data.photo,
    since: data.since
  })).sort((a, b) => a.name.localeCompare(b.name));

  const filteredFriends = friendList.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleUnfriend = (friendUid: string, name: string) => {
    showAlert({
      title: 'Remove Friend?',
      message: `Are you sure you want to remove ${name} from your connections? You won't be able to join their private groups easily.`,
      showCancel: true,
      confirmText: 'Remove',
      onConfirm: async () => {
        if (!user) return;
        setLoading(true);
        try {
          await removeFriend(user.uid, friendUid);
          // Success is handled by AuthContext listener updating local state
        } catch (e) {
          Alert.alert('Error', 'Could not remove friend.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const renderFriendItem = ({ item }: { item: any }) => (
    <View style={styles.friendCard}>
      <View style={styles.initialCircle}>
        <Text style={styles.initialText}>
          {(item.name || 'S').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.name}</Text>
        <Text style={styles.friendSince}>Connected since {new Date(item.since).toLocaleDateString()}</Text>
      </View>
      <TouchableOpacity 
        style={styles.unfriendBtn} 
        onPress={() => handleUnfriend(item.uid, item.name)}
      >
        <MaterialCommunityIcons name="account-remove-outline" size={22} color={theme.danger} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Connections</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={theme.textMuted} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search friends..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={theme.textMuted}
          />
        </View>
      </View>

      {loading && <ActivityIndicator style={{ marginVertical: 10 }} color={theme.primary} />}

      <FlatList
        data={filteredFriends}
        keyExtractor={item => item.uid}
        renderItem={renderFriendItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-search-outline" size={60} color="#CBD5E1" />
            <Text style={styles.emptyText}>
              {search ? "No friends found matching your search." : "You haven't added any friends yet. Scan a friend's QR to connect!"}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, marginBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: theme.textMain },
  searchSection: { paddingHorizontal: 20, marginBottom: 20 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 15, paddingHorizontal: 15, height: 50, elevation: 1 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: theme.textMain, fontWeight: '600' },
  listContent: { paddingHorizontal: 20, paddingBottom: 30 },
  friendCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 20, marginBottom: 12, elevation: 1 },
  initialCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
  initialText: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  friendInfo: { flex: 1, marginLeft: 15 },
  friendName: { fontSize: 16, fontWeight: '700', color: theme.textMain },
  friendSince: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  unfriendBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyText: { textAlign: 'center', color: theme.textMuted, marginTop: 15, fontSize: 14, fontWeight: '600', lineHeight: 20 }
});
