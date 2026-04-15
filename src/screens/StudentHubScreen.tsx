import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Animated, ActivityIndicator, Dimensions, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { db } from '../config/firebase';
import { ref, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { AuthContext } from '../context/AuthContext';
import { sendPoke, sendFriendRequest, acceptFriendRequest, declineFriendRequest, createGroup, leaveGroup, kickMember, approveJoinGroup, declineJoinRequest } from '../utils/SyncManager';
import { useCustomAlert } from '../context/AlertContext';
import { colors, spacing } from '../theme';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

interface CommunityUser {
  id: string;
  name: string;
  photo: string | null;
  score: number;
  isOnline: boolean;
  status: 'available' | 'focus';
  lastSeen?: number;
  hidePoints?: boolean;
  pokeEnabled?: boolean;
}

interface ActivityEvent {
  id: string;
  uid: string;
  userName: string;
  action: string;
  timestamp: number;
}

export default function StudentHubScreen() {
  const navigation = useNavigation<any>();
  const { user, userName, friends, incomingRequests, sentRequests, userGroups, groupMembers, groupMetadata, groupJoinRequests, leaderboard, onlineCount } = useContext(AuthContext);
  const { showAlert } = useCustomAlert();
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [pokeUser, setPokeUser] = useState<CommunityUser | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [currentTab, setCurrentTab] = useState<'global' | 'group'>('group');
  const [newGroupName, setNewGroupName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    // Auto-select first group if none selected
    if (!selectedGroupId && userGroups.length > 0) {
      setSelectedGroupId(userGroups[0]);
    }
  }, [userGroups]);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Pulse animation for "Online" indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    ).start();

    // 2. Activity feed listener
    const activityRef = ref(db, 'community_activity');
    const qAct = query(activityRef, limitToLast(10));
    const unsubAct = onValue(qAct, (snap) => {
       if (snap.exists()) {
         const data = snap.val();
         const acts = Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a: any, b: any) => b.timestamp - a.timestamp);
         setActivities(acts);
       } else {
         setActivities([]);
       }
       setLoading(false);
    });

    return () => {
      unsubAct();
    };
  }, []);

  const sendMotivation = (message: string) => {
    if (!user || !pokeUser) return;
    sendPoke(pokeUser.id, userName || 'A mysterious student', message);
    setPokeUser(null);
  };

  const handleAddFriend = async (target: CommunityUser) => {
    if (!user) return;
    try {
      await sendFriendRequest(target.id, user.uid, userName || 'Student');
      showAlert({ title: 'Request Sent', message: `Friend request sent to ${target.name}.` });
    } catch (error: any) {
      showAlert({ title: 'Wait a moment', message: error.message || 'Could not send request.' });
    }
  };

  const handleAccept = async (target: CommunityUser) => {
    if (!user) return;
    await acceptFriendRequest(user.uid, target.id, userName || 'Student', target.name);
  };

  const handleDecline = async (target: CommunityUser) => {
    if (!user) return;
    await declineFriendRequest(user.uid, target.id);
  };

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return;
    setCreating(true);
    try {
      const gid = await createGroup(user.uid, newGroupName.trim());
      setSelectedGroupId(gid);
      setShowCreateModal(false);
      setNewGroupName('');
      showAlert({ title: 'Group Created!', message: `Welcome to "${newGroupName.trim()}". Invite friends using the QR scanner!` });
    } catch (e) {
      showAlert({ title: 'Error', message: 'Could not create group.' });
    } finally {
      setCreating(false);
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    showAlert({
      title: 'Leave Group?',
      message: 'Are you sure you want to exit this group?',
      showCancel: true,
      confirmText: 'Leave',
      onConfirm: async () => {
        if (!user) return;
        await leaveGroup(user.uid, groupId);
      }
    });
  };

  const getBadgeStyle = (score: number) => {
    if (score >= 1500) return styles.avatarGold;
    if (score >= 500) return styles.avatarSilver;
    return styles.avatarBronze;
  };

  const formatLastSeen = (timestamp?: number) => {
    if (!timestamp) return 'Offline';
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    if (mins < 60) return `Last seen ${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Last seen ${hours}h ago`;
    return `Last seen ${Math.floor(hours/24)}d ago`;
  };

  const handleKick = (targetUid: string, targetName: string) => {
    if (!selectedGroupId || !user) return;
    showAlert({
      title: 'Kick Member?',
      message: `Are you sure you want to remove ${targetName} from the group? They will need your approval to rejoin.`,
      showCancel: true,
      confirmText: 'Kick',
      onConfirm: async () => {
        try {
          await kickMember(user.uid, selectedGroupId, targetUid);
        } catch (e: any) {
          Alert.alert('Error', e.message || 'Could not kick member.');
        }
      }
    });
  };

  const renderItem = ({ item, index }: { item: CommunityUser, index: number }) => {
    const isMe = item.id === user?.uid;
    const isFocus = item.status === 'focus';
    
    // Privacy Logic Handlers
    const currentUserObj = leaderboard.find(u => u.id === user?.uid);
    const myPointsHidden = !!currentUserObj?.hidePoints;
    const isScoreHidden = myPointsHidden || !!item.hidePoints;
    
    // You cannot poke if you are hidden, the target is hidden, target is in focus, or anyone has disabled pokes.
    // Friendship logic
    const isFriend = !!friends?.[item.id];
    const isIncoming = !!incomingRequests?.[item.id];
    const isSent = !!sentRequests?.[item.id];

    // You cannot poke if you are hidden, the target is hidden, target is in focus, or anyone has disabled pokes.
    // AND now, they must be friends.
    const myPokeEnabled = currentUserObj?.pokeEnabled !== false;
    const targetPokeEnabled = item.pokeEnabled !== false;
    const baseCanPoke = !myPointsHidden && !item.hidePoints && !isFocus && myPokeEnabled && targetPokeEnabled;
    const canPoke = baseCanPoke && isFriend;
    
    // If scores are hidden, bronze style acts as a generic style
    const badgeStyle = getBadgeStyle(isScoreHidden ? 0 : item.score);

    return (
      <View style={[styles.userCard, isMe && styles.myCard]}>
        <View style={styles.rankBadge}>
           <Text style={styles.rankText}>{index + 1}</Text>
        </View>

        <View style={styles.avatarWrapper}>
          <View style={[styles.avatar, badgeStyle]}>
            <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold' }}>
              {(item.name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          {item.isOnline ? (
            <View style={[styles.statusDot, { backgroundColor: isFocus ? '#F59E0B' : '#10B981' }]} />
          ) : (
            <View style={[styles.statusDot, { backgroundColor: '#9CA3AF' }]} />
          )}
        </View>

        <View style={styles.infoArea}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
            {isMe && <Text style={styles.meLabel}> (You)</Text>}
            {item.vibe && (
              <View style={styles.vibeBadgeSmall}>
                <Text style={styles.vibeBadgeEmojiSmall}>{item.vibe.emoji}</Text>
              </View>
            )}
          </View>
          <View style={styles.scoreRow}>
            <MaterialCommunityIcons name={isScoreHidden ? "incognito" : "trophy-outline"} size={14} color="#D9BC67" />
            <Text style={styles.scoreText}>{isScoreHidden ? '???' : item.score} pts</Text>
            {item.university ? (
              <View style={[styles.uniBadgeSmall, { marginLeft: 6 }]}>
                 <Text style={styles.uniBadgeTextSmall}>{item.university}</Text>
              </View>
            ) : null}
            {isFocus && (
               <View style={styles.focusLabel}>
                 <Text style={styles.focusLabelText}>In Focus</Text>
               </View>
            )}
          </View>
          {!item.isOnline && item.lastSeen && (
             <Text style={styles.lastSeenText}>{formatLastSeen(item.lastSeen)}</Text>
          )}
        </View>

        {currentTab === 'group' && selectedGroupId && groupMetadata[selectedGroupId]?.admin === user?.uid && !isMe && (
          <TouchableOpacity 
            style={styles.kickBtn} 
            onPress={() => handleKick(item.id, item.name)}
          >
            <MaterialCommunityIcons name="account-remove-outline" size={20} color="#FF6B6B" />
          </TouchableOpacity>
        )}

        {!isMe && (
          <View style={styles.actionRow}>
            {isFriend ? (
              <TouchableOpacity 
                style={[styles.pokeBtn, !canPoke && styles.pokeBtnDisabled]} 
                onPress={() => canPoke ? setPokeUser(item) : null}
                activeOpacity={canPoke ? 0.7 : 1}
              >
                <MaterialCommunityIcons 
                  name={(!targetPokeEnabled || item.hidePoints) ? "eye-off-outline" : "hand-wave-outline"} 
                  size={20} 
                  color={canPoke ? "#FFF" : "#A1A1AA"} 
                />
              </TouchableOpacity>
            ) : isIncoming ? (
              <View style={styles.incomingBtns}>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item)}>
                  <MaterialCommunityIcons name="check" size={18} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(item)}>
                  <MaterialCommunityIcons name="close" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : isSent ? (
               <View style={styles.pendingBadge}>
                 <Text style={styles.pendingText}>Pending</Text>
               </View>
            ) : (
              <TouchableOpacity style={styles.addFriendBtn} onPress={() => handleAddFriend(item)}>
                <MaterialCommunityIcons name="account-plus-outline" size={20} color="#3E315A" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderGroupItem = ({ item }: { item: string }) => {
    const meta = groupMetadata[item];
    const memberCount = Object.keys(groupMembers[item] || {}).length;
    
    return (
      <TouchableOpacity 
        style={styles.groupCard}
        onPress={() => navigation.navigate('GroupDetail', { groupId: item })}
      >
        <LinearGradient 
          colors={['#4F46E5', '#3E315A']} 
          start={{x:0, y:0}} 
          end={{x:1, y:1}} 
          style={styles.groupCardGradient}
        >
          <View style={styles.groupCardHeader}>
            <View style={styles.groupIconBox}>
              <MaterialCommunityIcons name="account-group" size={24} color="#FFF" />
            </View>
            <View style={styles.groupCardInfo}>
              <Text style={styles.groupCardName}>{meta?.name || 'Loading Group...'}</Text>
              <Text style={styles.groupCardStats}>{memberCount} Members • Active now</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="rgba(255,255,255,0.5)" />
          </View>
          
          <View style={styles.recentShout}>
             <MaterialCommunityIcons name="bullhorn-variant-outline" size={14} color="#A5B4FC" />
             <Text style={styles.shoutText} numberOfLines={1}>
                Check out the new group achievements!
             </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // Filtered leaderboard for Group tab
  const displayData = currentTab === 'global' 
    ? leaderboard 
    : leaderboard.filter(u => selectedGroupId && groupMembers[selectedGroupId]?.[u.id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerTitleRow}>
        <Text style={styles.sectionHeading}>Student Hub</Text>
        <View style={styles.headerActions}>
           <View style={styles.onlineBadge}>
              <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.onlineText}>{onlineCount} Online</Text>
           </View>
           <TouchableOpacity style={styles.infoBtn} onPress={() => setShowInfo(true)} activeOpacity={0.7}>
              <MaterialCommunityIcons name="information-outline" size={22} color="#8F8A9E" />
           </TouchableOpacity>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
         <TouchableOpacity 
           style={[styles.hubTab, currentTab === 'group' && styles.activeHubTab]} 
           onPress={() => setCurrentTab('group')}
         >
           <Text style={[styles.hubTabText, currentTab === 'group' && styles.activeHubTabText]}>My Group</Text>
           {Object.keys(incomingRequests).length > 0 && currentTab === 'global' && (
             <View style={styles.tabBadge} />
           )}
         </TouchableOpacity>
         <TouchableOpacity 
           style={[styles.hubTab, currentTab === 'global' && styles.activeHubTab]} 
           onPress={() => setCurrentTab('global')}
         >
           <Text style={[styles.hubTabText, currentTab === 'global' && styles.activeHubTabText]}>Global</Text>
         </TouchableOpacity>
      </View>

      <BlurView intensity={20} style={styles.statHeader}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{displayData.length}</Text>
            <Text style={styles.statLabel}>{currentTab === 'global' ? 'Peers' : 'Members'}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{displayData.filter(u => u.isOnline).length}</Text>
            <Text style={styles.statLabel}>Online</Text>
          </View>
          {currentTab === 'group' && selectedGroupId && (
            <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveGroup}>
               <MaterialCommunityIcons name="logout" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          )}
      </BlurView>

      {/* Group Switcher Pills */}
      {currentTab === 'group' && userGroups.length > 0 && (
        <View style={styles.groupPickerScroll}>
           <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupPickerContent}>
              {userGroups.map(gid => (
                <TouchableOpacity 
                   key={gid} 
                   style={[styles.groupPill, selectedGroupId === gid && styles.activeGroupPill]}
                   onPress={() => setSelectedGroupId(gid)}
                >
                   <MaterialCommunityIcons 
                      name="account-group" 
                      size={14} 
                      color={selectedGroupId === gid ? "#FFF" : "#8F8A9E"} 
                      style={{marginRight: 6}} 
                   />
                   <Text style={[styles.groupPillText, selectedGroupId === gid && styles.activeGroupPillText]}>
                      {groupMetadata[gid]?.name || 'Loading...'}
                   </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.addGroupPill} onPress={() => setShowCreateModal(true)}>
                 <MaterialCommunityIcons name="plus" size={16} color="#3E315A" />
              </TouchableOpacity>
           </ScrollView>
        </View>
      )}

      {activities.length > 0 && (
         <View style={styles.activityTickerContainer}>
            <MaterialCommunityIcons name="lightning-bolt" size={14} color="#F59E0B" style={{marginRight: 6}} />
            <FlatList 
               data={activities}
               keyExtractor={(item) => item.id}
               horizontal
               showsHorizontalScrollIndicator={false}
               renderItem={({item}) => (
                  <View style={styles.activityPill}>
                     <Text style={styles.activityText}>
                        <Text style={{fontWeight: 'bold'}}>{item.userName}</Text> {item.action}
                     </Text>
                  </View>
               )}
            />
         </View>
      )}

      {currentTab === 'group' && selectedGroupId && groupMetadata[selectedGroupId]?.admin === user?.uid && groupJoinRequests?.[selectedGroupId] && Object.keys(groupJoinRequests[selectedGroupId] || {}).length > 0 && (
         <View style={styles.requestsSection}>
            <Text style={styles.requestsTitle}>Pending Approvals</Text>
            {Object.entries(groupJoinRequests[selectedGroupId] || {}).map(([requesterUid, req]: [string, any]) => (
               <View key={requesterUid} style={styles.requestCard}>
                  <View style={styles.requestInfo}>
                     <Text style={styles.requestName}>{req.name}</Text>
                     <Text style={styles.requestTime}>{new Date(req.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                  </View>
                  <View style={styles.requestActions}>
                     <TouchableOpacity 
                        style={styles.approveSmallBtn} 
                        onPress={() => approveJoinGroup(user!.uid, selectedGroupId!, requesterUid)}
                     >
                        <MaterialCommunityIcons name="check" size={16} color="#FFF" />
                     </TouchableOpacity>
                     <TouchableOpacity 
                        style={styles.declineSmallBtn} 
                        onPress={() => declineJoinRequest(user!.uid, selectedGroupId!, requesterUid)}
                     >
                        <MaterialCommunityIcons name="close" size={16} color="#FFF" />
                     </TouchableOpacity>
                  </View>
               </View>
            ))}
         </View>
      )}

      <FlatList
        data={currentTab === 'global' ? leaderboard : userGroups}
        keyExtractor={item => typeof item === 'string' ? item : item.id}
        renderItem={currentTab === 'global' ? renderItem : renderGroupItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          currentTab === 'group' && userGroups.length === 0 ? (
            <View style={styles.emptyContainer}>
               <Image 
                 source={require('../../assets/student-studying.png')} 
                 style={styles.emptyIllustration}
                 resizeMode="contain"
               />
               <Text style={styles.emptyTitle}>Not in Any Group</Text>
               <Text style={styles.emptySubtitle}>You haven't joined a Study Group yet. Join your squad to compete and stay motivated!</Text>
               <TouchableOpacity style={styles.createGroupBtn} onPress={() => setShowCreateModal(true)}>
                  <MaterialCommunityIcons name="plus-circle" size={20} color="#FFF" style={{marginRight: 8}} />
                  <Text style={styles.createGroupBtnText}>Create a Group</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.scanBtn} onPress={() => navigation.navigate('ScanSocial')}>
                  <MaterialCommunityIcons name="qrcode-scan" size={20} color={colors.primary} style={{marginRight: 8}} />
                  <Text style={styles.scanBtnText}>Scan Group QR</Text>
               </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name={currentTab === 'group' ? "account-group" : "earth-off"} size={60} color="#CBD5E1" />
              <Text style={styles.emptyText}>
                {currentTab === 'group' 
                  ? "This group is empty or processing. Invite some friends!" 
                  : "No users are currently visible. Be the first to join the community from your Profile!"}
              </Text>
            </View>
          )
        }
      />

      {/* Create Group Modal */}
      <Modal visible={showCreateModal} transparent={true} animationType="fade">
         <View style={styles.modalBackdropCenter}>
            <View style={styles.createModalContent}>
               <Text style={styles.modalTitle}>New Study Group</Text>
               <Text style={styles.modalSubtitle}>Give your squad a name!</Text>
               
               <TextInput 
                  style={styles.groupInput}
                  placeholder="e.g. Dream Team 2026"
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  autoFocus
               />

               <TouchableOpacity 
                  style={[styles.confirmCreateBtn, !newGroupName.trim() && { opacity: 0.5 }]} 
                  onPress={handleCreateGroup}
                  disabled={creating || !newGroupName.trim()}
               >
                  {creating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmCreateBtnText}>Create Group</Text>}
               </TouchableOpacity>
               
               <TouchableOpacity onPress={() => setShowCreateModal(false)} style={{marginTop: 15}}>
                  <Text style={{color: '#94A3B8', fontWeight: '700'}}>Cancel</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

      {/* Motivation Modal */}
      <Modal visible={!!pokeUser} transparent={true} animationType="slide">
         <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
               <Text style={styles.modalTitle}>Send Motivation</Text>
               <Text style={styles.modalSubtitle}>Encourage {pokeUser?.name}!</Text>
               
               <TouchableOpacity style={styles.motivateRow} onPress={() => sendMotivation("High Five ✋")}>
                 <MaterialCommunityIcons name="hand-clap" size={24} color="#F59E0B" />
                 <Text style={styles.motivateText}>High Five ✋</Text>
               </TouchableOpacity>
               
               <TouchableOpacity style={styles.motivateRow} onPress={() => sendMotivation("Keep pushing! 🔥")}>
                 <MaterialCommunityIcons name="fire" size={24} color="#EF4444" />
                 <Text style={styles.motivateText}>Keep pushing! 🔥</Text>
               </TouchableOpacity>
               
               <TouchableOpacity style={styles.motivateRow} onPress={() => sendMotivation("Focus Champion 🧠")}>
                 <MaterialCommunityIcons name="brain" size={24} color="#8B5CF6" />
                 <Text style={styles.motivateText}>Focus Champion 🧠</Text>
               </TouchableOpacity>

               <TouchableOpacity style={styles.cancelBtn} onPress={() => setPokeUser(null)}>
                 <Text style={styles.cancelBtnText}>Cancel</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

      {/* Info Modal */}
      <Modal visible={showInfo} transparent={true} animationType="fade">
         <View style={styles.modalBackdropCenter}>
            <View style={styles.infoModalContent}>
               <View style={styles.infoIconWrapper}>
                 <MaterialCommunityIcons name="trophy-award" size={32} color="#D9BC67" />
               </View>
               <Text style={styles.infoTitle}>Smart Score Guide</Text>
               <Text style={styles.infoText}>Your Smart Score is calculated dynamically as you use ScheduleMe:</Text>
               
               <View style={styles.ruleRow}>
                  <MaterialCommunityIcons name="check-decagram" size={20} color="#10B981" />
                  <Text style={styles.ruleText}><Text style={styles.ruleBold}>Attendance:</Text> 10 pts per class attended</Text>
               </View>
               <View style={styles.ruleRow}>
                  <MaterialCommunityIcons name="book-open-page-variant" size={20} color="#8B5CF6" />
                  <Text style={styles.ruleText}><Text style={styles.ruleBold}>Vocabulary:</Text> 5 pts per word saved</Text>
               </View>
               <View style={styles.ruleRow}>
                  <MaterialCommunityIcons name="cloud-check" size={20} color="#0EA5E9" />
                  <Text style={styles.ruleText}><Text style={styles.ruleBold}>Dreams:</Text> 50 pts per completed dream</Text>
               </View>
               <View style={styles.ruleRow}>
                  <MaterialCommunityIcons name="format-list-checks" size={20} color="#F59E0B" />
                  <Text style={styles.ruleText}><Text style={styles.ruleBold}>To-Dos:</Text> 5 pts per completed task</Text>
               </View>
               <View style={styles.ruleRow}>
                  <MaterialCommunityIcons name="timer-outline" size={20} color="#EF4444" />
                  <Text style={styles.ruleText}><Text style={styles.ruleBold}>Focus Timer:</Text> 1 pt per minute focused</Text>
               </View>
               
               <TouchableOpacity style={styles.infoCloseBtn} onPress={() => setShowInfo(false)}>
                 <Text style={styles.infoCloseBtnText}>GOT IT</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5FF',
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    textTransform: 'uppercase',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 4,
    borderRadius: 14,
  },
  hubTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeHubTab: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  hubTabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  activeHubTabText: {
    color: '#1E1B4B',
  },
  tabBadge: {
    position: 'absolute',
    top: 6,
    right: 30,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  leaveBtn: {
    position: 'absolute',
    right: 20,
    top: 20,
  },
  groupPickerScroll: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  groupPickerContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  groupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeGroupPill: {
    backgroundColor: '#3E315A',
    borderColor: '#3E315A',
  },
  groupPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  activeGroupPillText: {
    color: '#FFF',
  },
  kickBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  requestsSection: {
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    backgroundColor: 'rgba(210, 185, 255, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(62, 49, 90, 0.1)',
  },
  requestsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3E315A',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  requestTime: {
    fontSize: 11,
    color: '#8F8A9E',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveSmallBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineSmallBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addGroupPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupCard: {
    marginBottom: 15,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#3E315A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  groupCardGradient: {
    padding: 20,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  groupCardInfo: {
    flex: 1,
  },
  groupCardName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2,
  },
  groupCardStats: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
  },
  recentShout: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  shoutText: {
    color: '#A5B4FC',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  sectionHeading: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E1B4B',
  },
  infoBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3E315A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statHeader: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 10,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#3E315A',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  list: {
    padding: 15,
    paddingBottom: 40,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#3E315A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  myCard: {
    borderWidth: 2,
    borderColor: '#D2B9FF',
    backgroundColor: '#F3F0FF',
  },
  rankBadge: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#64748B',
  },
  avatarWrapper: {
    position: 'relative',
    marginHorizontal: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E2E8F0',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  infoArea: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  scoreText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
    marginLeft: 4,
  },
  focusLabel: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 8,
  },
  focusLabelText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D97706',
    textTransform: 'uppercase',
  },
  pokeBtn: {
    backgroundColor: '#3E315A',
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pokeBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addFriendBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D2B9FF',
  },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  incomingBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    width: '100%',
  },
  emptyIllustration: {
    width: 220,
    height: 180,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E1B4B',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 10,
    lineHeight: 22,
    fontWeight: '600',
    marginBottom: 10,
  },
  createGroupBtn: {
    backgroundColor: '#3E315A',
    paddingHorizontal: 30,
    paddingVertical: 18,
    borderRadius: 20,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3E315A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  createGroupBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    padding: 10,
  },
  scanBtnText: {
    color: colors.primary,
    fontWeight: '800',
  },
  createModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 25,
    padding: 30,
    width: '90%',
    alignItems: 'center',
  },
  groupInput: {
    width: '100%',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 5,
    marginBottom: 20,
    color: '#1E1B4B',
  },
  confirmCreateBtn: {
    backgroundColor: '#10B981',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  confirmCreateBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  avatarBronze: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3E315A',
  },
  avatarSilver: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3E315A',
    borderWidth: 2,
    borderColor: '#94A3B8',
  },
  avatarGold: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4B3F6B',
    borderWidth: 2,
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  lastSeenText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  activityTickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    height: 30,
  },
  activityPill: {
    backgroundColor: 'rgba(217, 188, 103, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  activityText: {
    fontSize: 12,
    color: '#3E315A',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 30,
    paddingBottom: 50,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E1B4B',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  motivateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F5FF',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
  },
  motivateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3E315A',
    marginLeft: 15,
  },
  cancelBtn: {
    marginTop: 15,
    padding: 15,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 30,
    padding: 30,
    width: '100%',
    alignItems: 'center',
  },
  infoIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(217, 188, 103, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  infoTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E1B4B',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  ruleText: {
    fontSize: 14,
    color: '#334155',
    marginLeft: 12,
  },
  ruleBold: {
    fontWeight: '800',
    color: '#1E1B4B',
  },
  infoCloseBtn: {
    backgroundColor: '#3E315A',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 30,
    shadowColor: '#3E315A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  infoCloseBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E1B4B',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 20,
  },
  vibeBadgeSmall: {
    marginLeft: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  vibeBadgeEmojiSmall: {
    fontSize: 12,
  },
  uniBadgeSmall: {
    backgroundColor: '#F3F0FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(62, 49, 90, 0.1)',
  },
  uniBadgeTextSmall: {
    fontSize: 10,
    fontWeight: '900',
    color: '#3E315A',
  },
  meLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
});
