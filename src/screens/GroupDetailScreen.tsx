import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, 
  TextInput, ActivityIndicator, Alert, Modal, Dimensions, 
  Animated, PanResponder, KeyboardAvoidingView, Platform, 
  TouchableWithoutFeedback, Keyboard 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { sendShout, leaveGroup, kickMember, approveJoinGroup, declineJoinRequest, pruneShoutbox } from '../utils/SyncManager';
import { colors } from '../theme';

const { width } = Dimensions.get('window');

const MEMBER_COLORS = [
  '#FF6B6B', // Coral Red
  '#20B2AA', // Light Sea Green
  '#4682B4', // Steel Blue
  '#D2691E', // Chocolate
  '#9ACD32', // Yellow Green
  '#6A5ACD', // Slate Blue
  '#FF7F50', // Coral
  '#008B8B', // Dark Cyan
  '#B8860B', // Dark Goldenrod
  '#C71585', // Medium Violet Red
];

const getUserColor = (uid: string) => {
  if (!uid) return '#cbd5e1';
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % MEMBER_COLORS.length;
  return MEMBER_COLORS[index];
};

export default function GroupDetailScreen({ route, navigation }: any) {
  const { groupId } = route.params;
  const { user, userName, groupMembers, groupMetadata, groupJoinRequests, leaderboard } = useContext(AuthContext);
  const { showAlert } = useCustomAlert();
  
  const [shouts, setShouts] = useState<any[]>([]);
  const [shoutText, setShoutText] = useState('');
  const [sendingShout, setSendingShout] = useState(false);
  const [loading, setLoading] = useState(true);

  // Bottom Sheet Logic
  const screenHeight = Dimensions.get('window').height;
  const sheetY = useRef(new Animated.Value(screenHeight + 300)).current;
  const flatListRef = useRef<FlatList>(null);

  const openSheet = () => {
    Animated.spring(sheetY, { toValue: screenHeight * 0.3, useNativeDriver: true, tension: 50, friction: 8 }).start();
  };

  const closeSheet = () => {
    Animated.spring(sheetY, { toValue: screenHeight + 300, useNativeDriver: true }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (e, gs) => {
        if (gs.dy > 0) { // Only allow dragging down
          sheetY.setValue(screenHeight * 0.3 + gs.dy);
        }
      },
      onPanResponderRelease: (e, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) {
          closeSheet();
        } else {
          openSheet();
        }
      }
    })
  ).current;

  const meta = groupMetadata[groupId];
  const members = groupMembers[groupId] || {};
  const isAdmin = meta?.admin === user?.uid;

  // Filter leaderboard to only group members
  const memberListData = leaderboard
    .filter(u => members[u.id])
    .sort((a, b) => b.score - a.score);

  useEffect(() => {
    // Prune old shouts on entry
    pruneShoutbox(groupId).catch(() => {});

    const shoutRef = ref(db, `groups/${groupId}/shoutbox`);
    const unsubscribe = onValue(shoutRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const list = Object.keys(data || {}).map(key => ({ id: key, ...data[key] })).sort((a: any, b: any) => a.timestamp - b.timestamp);
        setShouts(list); // Show all remaining shouts (up to 4h old)
        
        // Auto scroll to bottom
        setTimeout(() => {
           flatListRef.current?.scrollToEnd({ animated: true });
        }, 500);
      } else {
        setShouts([]);
      }
      setLoading(false);
    });

    return () => off(shoutRef);
  }, [groupId]);

  const handleSendShout = async () => {
    if (!shoutText.trim() || !user) return;
    setSendingShout(true);
    try {
      await sendShout(groupId, user.uid, userName || 'Student', shoutText.trim());
      setShoutText('');
    } catch (e) {
      Alert.alert('Error', 'Could not send shout.');
    } finally {
      setSendingShout(false);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderShoutItem = ({ item, index }: { item: any, index: number }) => {
    const isMyShout = item.uid === user?.uid;
    const timeStr = formatTime(item.timestamp);
    
    // Logic: Only show time if the NEXT message is from a different minute (or doesn't exist)
    const nextItem = shouts[index + 1];
    const showTime = !nextItem || formatTime(nextItem.timestamp) !== timeStr;

    const userColor = isMyShout ? colors.primary : getUserColor(item.uid);

    return (
      <View style={[styles.shoutWrapper, isMyShout ? styles.myShoutWrapper : styles.theirShoutWrapper]}>
        {!isMyShout && <Text style={[styles.shoutUserSmall, { color: userColor }]}>{item.name}</Text>}
        <View style={[
          styles.shoutBubbleMain, 
          isMyShout ? styles.myShoutBubble : [styles.theirShoutBubble, { borderLeftColor: userColor, borderLeftWidth: 4 }]
        ]}>
          <Text style={[styles.shoutMsgMain, isMyShout ? styles.myShoutText : styles.theirShoutText]}>
            {item.text}
          </Text>
        </View>
        {showTime && (
          <Text style={[styles.timeText, isMyShout ? { textAlign: 'right', marginRight: 5 } : { textAlign: 'left', marginLeft: 5 }]}>
            {timeStr}
          </Text>
        )}
      </View>
    );
  };

   return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          <LinearGradient colors={['#3E315A', '#1E1B4B']} style={styles.header}>
            <SafeAreaView edges={['top']}>
              <View style={styles.navBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                  <MaterialCommunityIcons name="chevron-left" size={28} color="#FFF" />
                </TouchableOpacity>
                 <View style={styles.headerInfo}>
                  <Text style={styles.headerTitle} numberOfLines={1}>{meta?.name || 'Group Hub'}</Text>
                  <Text style={styles.headerSubtitle}>{memberListData.length} Members</Text>
                </View>
                <View style={styles.headerRightActions}>
                   <TouchableOpacity onPress={openSheet} style={styles.headerIconBtn}>
                     <MaterialCommunityIcons name="trophy-variant" size={24} color="#D9BC67" />
                   </TouchableOpacity>
                   <TouchableOpacity 
                     onPress={() => {
                       showAlert({
                         title: 'Leave Group?',
                         message: 'Are you sure you want to exit?',
                         showCancel: true,
                         confirmText: 'Leave',
                         onConfirm: () => {
                           leaveGroup(user!.uid, groupId);
                           navigation.goBack();
                         }
                       });
                     }}
                     style={styles.headerIconBtn}
                   >
                     <MaterialCommunityIcons name="logout-variant" size={22} color="#FF6B6B" />
                   </TouchableOpacity>
                </View>
              </View>

              <View style={styles.achievementsRow}>
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 10, paddingHorizontal: 20}}>
                    <View style={styles.achievementBadge}>
                       <MaterialCommunityIcons name="trophy-outline" size={14} color="#F59E0B" />
                       <Text style={styles.achievementText}>Foundation</Text>
                    </View>
                    <View style={styles.achievementBadge}>
                       <MaterialCommunityIcons name="owl" size={14} color="#A5B4FC" />
                       <Text style={styles.achievementText}>Night Owls</Text>
                    </View>
                    <View style={styles.achievementBadge}>
                       <MaterialCommunityIcons name="lightning-bolt" size={14} color="#10B981" />
                       <Text style={styles.achievementText}>Speed Stars</Text>
                    </View>
                 </ScrollView>
              </View>
            </SafeAreaView>
          </LinearGradient>

          <View style={styles.chatContainer}>
             <FlatList
                ref={flatListRef}
                data={shouts}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.chatListContent}
                renderItem={renderShoutItem}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
             />

             <BlurView intensity={80} tint="light" style={styles.bottomDock}>
                <View style={styles.shoutInputRowFixed}>
                   <TextInput 
                      style={styles.shoutInput}
                      placeholder="Shout to squad..."
                      placeholderTextColor="#94A3B8"
                      value={shoutText}
                      onChangeText={setShoutText}
                      multiline={true}
                      maxLength={500}
                      textAlignVertical="top"
                   />
                   <TouchableOpacity 
                     onPress={handleSendShout}
                     disabled={sendingShout || !shoutText.trim()}
                   >
                     <LinearGradient
                        colors={shoutText.trim() ? ['#8B5CF6', '#6D28D9'] : ['#E2E8F0', '#CBD5E1']}
                        style={styles.sendBtnGradient}
                     >
                        {sendingShout ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialCommunityIcons name="send" size={20} color="#FFF" />}
                     </LinearGradient>
                   </TouchableOpacity>
                </View>
             </BlurView>
          </View>

          {/* Leaderboard Bottom Sheet */}
          <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetY }] }]}>
             <View {...panResponder.panHandlers} style={styles.sheetHandleArea}>
                <View style={styles.handle} />
             </View>
             <View style={styles.sheetContent}>
                <View style={styles.sheetHeader}>
                   <Text style={styles.sheetTitle}>Squad Leaderboard</Text>
                   <TouchableOpacity onPress={closeSheet}>
                      <MaterialCommunityIcons name="close-circle" size={24} color="#CBD5E1" />
                   </TouchableOpacity>
                </View>

                {isAdmin && groupJoinRequests?.[groupId] && Object.keys(groupJoinRequests[groupId] || {}).length > 0 && (
                   <View style={styles.pendingSection}>
                      <Text style={styles.pendingTitle}>Pending Joins</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 10}}>
                         {Object.entries(groupJoinRequests[groupId] || {}).map(([uid, req]: any) => (
                           <View key={uid} style={styles.pendingCard}>
                              <Text style={styles.pendingName}>{req.name}</Text>
                              <View style={styles.pendingActions}>
                                 <TouchableOpacity style={styles.apprBtnSmall} onPress={() => approveJoinGroup(user!.uid, groupId, uid)}>
                                    <MaterialCommunityIcons name="check" size={14} color="#FFF" />
                                 </TouchableOpacity>
                                 <TouchableOpacity style={styles.declBtnSmall} onPress={() => declineJoinRequest(user!.uid, groupId, uid)}>
                                    <MaterialCommunityIcons name="close" size={14} color="#FFF" />
                                 </TouchableOpacity>
                              </View>
                           </View>
                         ))}
                      </ScrollView>
                   </View>
                )}

                <FlatList
                   data={memberListData}
                   keyExtractor={item => item.id}
                   renderItem={({ item, index }) => {
                      const isMe = item.id === user?.uid;
                      const badgeStyle = item.score >= 1500 ? styles.avatarGold : (item.score >= 500 ? styles.avatarSilver : styles.avatarBronze);
                      return (
                        <View style={[styles.memberCardFixed, isMe && styles.myCardFixed]}>
                          <Text style={styles.rankTextFixed}>{index + 1}</Text>
                          <View style={[styles.avatarFixed, badgeStyle]}>
                             <Text style={styles.avatarTextFixed}>{(item.name || 'U').charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={{flex: 1}}>
                             <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                 <Text style={styles.memberNameFixed}>{item.name}</Text>
                                 {item.vibe && <Text style={{marginLeft: 6, fontSize: 14}}>{item.vibe.emoji}</Text>}
                             </View>
                             <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 2}}>
                                 <Text style={styles.memberScoreFixed}>{item.score} pts</Text>
                                 {item.university ? (
                                   <View style={[styles.uniBadgeFixed, { marginLeft: 6 }]}>
                                      <Text style={styles.uniBadgeTextFixed}>{item.university}</Text>
                                   </View>
                                 ) : null}
                             </View>
                          </View>
                          {isAdmin && !isMe && (
                             <TouchableOpacity onPress={() => kickMember(user!.uid, groupId, item.id)}>
                                <MaterialCommunityIcons name="account-remove-outline" size={18} color="#FF6B6B" />
                             </TouchableOpacity>
                          )}
                        </View>
                      );
                   }}
                />
             </View>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F5FF' },
  header: { paddingBottom: 15, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 5 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, paddingLeft: 10, alignItems: 'flex-start' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  headerSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700' },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  achievementsRow: { marginTop: 10 },
  achievementBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  achievementText: { color: '#FFF', fontSize: 11, fontWeight: '700', marginLeft: 6 },
  
  chatContainer: { flex: 1, backgroundColor: '#F8F5FF' },
  chatListContent: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 20 },
  
  shoutWrapper: { marginBottom: 12, maxWidth: '85%' },
  myShoutWrapper: { alignSelf: 'flex-end' },
  theirShoutWrapper: { alignSelf: 'flex-start' },
  shoutUserSmall: { fontSize: 10, fontWeight: '800', color: '#94A3B8', marginLeft: 10, marginBottom: 1 },
  shoutBubbleMain: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  myShoutBubble: { backgroundColor: '#3E315A', borderBottomRightRadius: 4 },
  theirShoutBubble: { backgroundColor: '#FFF', borderBottomLeftRadius: 4 },
  shoutMsgMain: { fontSize: 14, fontWeight: '600' },
  myShoutText: { color: '#FFF' },
  theirShoutText: { color: '#1E1B4B' },
  
  emptyShoutContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyShoutText: { color: '#94A3B8', marginTop: 10, fontWeight: '600' },

  bottomDock: { 
    paddingBottom: Platform.OS === 'ios' ? 25 : 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'rgba(255,255,255,0.7)', // Fallback if blur fails
  },
  shoutInputRowFixed: { flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', gap: 10 },
  shoutInput: { 
    flex: 1, 
    backgroundColor: '#FFF', 
    borderRadius: 18, 
    paddingHorizontal: 20, 
    paddingVertical: 12,
    minHeight: 50,
    maxHeight: 120,
    fontSize: 15, 
    fontWeight: '600', 
    color: '#1E1B4B',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  sendBtnGradient: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },

  bottomSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.2, shadowRadius: 15 },
  sheetHandleArea: { width: '100%', height: 40, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3 },
  sheetContent: { flex: 1, paddingHorizontal: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: '#1E1B4B' },
  
  pendingSection: { marginBottom: 20, padding: 15, backgroundColor: '#F8F5FF', borderRadius: 20 },
  pendingTitle: { fontSize: 12, fontWeight: '900', color: '#8B5CF6', textTransform: 'uppercase', marginBottom: 10 },
  pendingCard: { backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, marginRight: 10, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 1 },
  pendingName: { fontSize: 13, fontWeight: '700', color: '#1E1B4B' },
  pendingActions: { flexDirection: 'row', gap: 5 },
  apprBtnSmall: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  declBtnSmall: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },

  memberCardFixed: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  myCardFixed: { backgroundColor: 'rgba(139, 92, 246, 0.05)', borderRadius: 15, paddingHorizontal: 10 },
  rankTextFixed: { width: 25, fontSize: 14, fontWeight: '900', color: '#94A3B8' },
  avatarFixed: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarTextFixed: { color: '#FFF', fontWeight: 'bold' },
  memberNameFixed: { fontSize: 15, fontWeight: '800', color: '#1E1B4B' },
  memberScoreFixed: { fontSize: 12, color: '#64748B', fontWeight: '700' },
  avatarGold: { backgroundColor: '#F59E0B' },
  avatarSilver: { backgroundColor: '#94A3B8' },
  avatarBronze: { backgroundColor: '#3E315A' },
  timeText: { fontSize: 10, color: '#94A3B8', fontWeight: '700', marginTop: 4 },
  uniBadgeFixed: {
    backgroundColor: '#F3F0FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(62, 49, 90, 0.1)',
  },
  uniBadgeTextFixed: {
    fontSize: 10,
    fontWeight: '900',
    color: '#3E315A',
  },
});
