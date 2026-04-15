import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import { View, AppState, PanResponder } from 'react-native';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { ref, get, onValue, onDisconnect, serverTimestamp, set, remove, update, query, orderByChild, limitToLast } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';
import { resolveOfflineQueue, updateSmartScore } from '../utils/SyncManager';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isUnlocked: boolean;
  setUnlocked: (unlocked: boolean) => void;
  hasSeenOnboarding: boolean | null;
  completeOnboarding: (uid?: string) => Promise<void>;
  resetOnboarding: (uid?: string) => Promise<void>;
  userName: string | null;
  setUserName: (name: string | null) => void;
  pokes: any[];
  clearPokes: () => void;
  friends: Record<string, any>;
  incomingRequests: Record<string, any>;
  sentRequests: Record<string, any>;
  userGroups: string[];
  groupMembers: Record<string, any>; // [groupId]: { [uid]: true }
  groupMetadata: Record<string, any>; // [groupId]: { name: string, admin: string }
  groupJoinRequests: Record<string, any>; // [groupId]: { [uid]: { name, ... } }
  leaderboard: any[];
  onlineCount: number;
  university: string | null;
  setUniversity: (uni: string | null) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  isAdmin: false,
  isUnlocked: false,
  setUnlocked: () => {},
  hasSeenOnboarding: null,
  completeOnboarding: async () => {},
  resetOnboarding: async () => {},
  userName: null,
  setUserName: () => {},
  friends: {},
  incomingRequests: {},
  sentRequests: {},
  userGroups: [],
  groupMembers: {},
  groupMetadata: {},
  groupJoinRequests: {},
  leaderboard: [],
  onlineCount: 0,
  university: null,
  setUniversity: () => {}
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUnlocked, setUnlocked] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [pokes, setPokes] = useState<any[]>([]);
  const [friends, setFriends] = useState<Record<string, any>>({});
  const [incomingRequests, setIncomingRequests] = useState<Record<string, any>>({});
  const [sentRequests, setSentRequests] = useState<Record<string, any>>({});
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [groupMembers, setGroupMembers] = useState<Record<string, any>>({});
  const [groupMetadata, setGroupMetadata] = useState<Record<string, any>>({});
  const [groupJoinRequests, setGroupJoinRequests] = useState<Record<string, any>>({});
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [university, setUniversity] = useState<string | null>(null);
  
  const membershipListeners = useRef<Record<string, () => void>>({});
  const joinRequestListeners = useRef<Record<string, () => void>>({});
  const bubblePlayer = useAudioPlayer({ uri: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3' });
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const FOREGROUND_TIMEOUT = 5 * 60 * 1000; // 5 mins
  const BACKGROUND_TIMEOUT = 3 * 60 * 1000; // 3 mins

  const resetInactivityTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isUnlocked) {
      timerRef.current = setTimeout(() => {
        setUnlocked(false);
      }, FOREGROUND_TIMEOUT);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        resetInactivityTimer();
        return false;
      },
      onMoveShouldSetPanResponderCapture: () => {
        resetInactivityTimer();
        return false;
      },
    })
  ).current;

  // Reset timer when unlocked changes
  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isUnlocked]);

  // Handle background state timeout
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (backgroundTime.current) {
          const timeElapsed = Date.now() - backgroundTime.current;
          if (timeElapsed > BACKGROUND_TIMEOUT) {
            setUnlocked(false);
          }
        }
        resetInactivityTimer(); // App came active, reset foreground
      } else if (nextAppState.match(/inactive|background/)) {
        backgroundTime.current = Date.now();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isUnlocked]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Synchronize any offline cache that was waiting
        resolveOfflineQueue();

        // Check user-specific onboarding status
        try {
          const val = await AsyncStorage.getItem(`@onboarding_complete_${currentUser.uid}`);
          setHasSeenOnboarding(val === 'true');
        } catch (err) {
          setHasSeenOnboarding(false);
        }

        // 1. Try to load name from AsyncStorage immediately for zero-lag UI
        try {
          const cachedName = await AsyncStorage.getItem(`cached_name_${currentUser.uid}`);
          if (cachedName) setUserName(cachedName);
          
          // 2. Fetch fresh name from Firebase without blocking the app startup
          const profileRef = ref(db, `users/${currentUser.uid}/profile`);
          get(profileRef).then(async (snap) => {
            if (snap.exists()) {
              const data = snap.val();
              if (data.name) {
                setUserName(data.name);
                await AsyncStorage.setItem(`cached_name_${currentUser.uid}`, data.name);
              }
              if (data.university) {
                setUniversity(data.university);
              }
              // Immediately sync them to community with up-to-date score and name
              updateSmartScore(currentUser.uid);
            } else {
              // Retroactive fix: auto-create RTDB profile for users from older builds 
              // who authenticated but never saved a profile.
              const defaultName = currentUser.email ? currentUser.email.split('@')[0] : 'Student';
              try {
                await set(profileRef, {
                  name: defaultName,
                  totalScore: 0,
                  communityVisibility: true
                });
                setUserName(defaultName);
                await AsyncStorage.setItem(`cached_name_${currentUser.uid}`, defaultName);
                
                // Immediately sync them to community with up-to-date score and name
                updateSmartScore(currentUser.uid);
              } catch (e) {
                console.log("[AuthContext] Failed to retroactively push user profile", e);
              }
            }
          }).catch(err => {
             console.log('[AuthContext] Profile background fetch handled:', err.message);
          });
        } catch (err) {
          console.warn('Error loading user profile data:', err);
        }
      } else {
        setUserName(null);
        setHasSeenOnboarding(false); // Default to false (show tour if they sign up/in) to clear global loading gate
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Presence & Poke Listeners
  useEffect(() => {
    if (!user) {
      setPokes([]);
      return;
    }

    // 1. Presence System
    const presenceRef = ref(db, `community/${user.uid}/isOnline`);
    const lastSeenRef = ref(db, `community/${user.uid}/lastSeen`);
    const connectedRef = ref(db, '.info/connected');

    const unsubscribePresence = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(presenceRef).set(false);
        onDisconnect(lastSeenRef).set(serverTimestamp());
        set(presenceRef, true);
        set(lastSeenRef, serverTimestamp());
      }
    });

    // 2. Poke Listener
    const pokesRef = ref(db, `pokes/${user.uid}`);
    const unsubscribePokes = onValue(pokesRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const newPokes = Object.keys(data || {}).map(key => ({
          id: key,
          ...data[key]
        }));
        
        // We'll handle the actual alert triggering in RootNavigator 
        // because it needs access to TimerContext for focus suppression.
        setPokes(newPokes);
      } else {
        setPokes([]);
      }
    });

    // 3. Friends & Requests Listeners
    const friendsRef = ref(db, `friends/${user.uid}`);
    const incomingRef = ref(db, `friend_requests/${user.uid}`);
    const sentRef = ref(db, `sent_requests/${user.uid}`);

    const unsubFriends = onValue(friendsRef, (snap) => {
      setFriends(snap.exists() ? snap.val() : {});
    });

    const unsubIncoming = onValue(incomingRef, (snap) => {
      setIncomingRequests(snap.exists() ? snap.val() : {});
    });

    const unsubSent = onValue(sentRef, (snap) => {
      setSentRequests(snap.exists() ? snap.val() : {});
    });

    const userGroupRef = ref(db, `user_groups/${user.uid}`);
    const unsubUserGroups = onValue(userGroupRef, (snap) => {
       const groupsObj = snap.exists() ? snap.val() : {};
       const groupIds = Object.keys(groupsObj || {});
       setUserGroups(groupIds);
       
       // Handle dynamic group listeners selectively
       // 1. Clean up removed groups
       Object.keys(membershipListeners.current || {}).forEach(existingId => {
          if (!groupIds.includes(existingId)) {
             membershipListeners.current[existingId]();
             delete membershipListeners.current[existingId];
             // Optional: clean up metadata/members state if you want
          }
       });

       // 2. Add new groups
       groupIds.forEach(groupId => {
          if (!membershipListeners.current[groupId]) {
             // Fetch metadata once
             const metaRef = ref(db, `groups/${groupId}`);
             get(metaRef).then(mSnap => {
                if (mSnap.exists()) {
                   setGroupMetadata(prev => ({ ...prev, [groupId]: mSnap.val() }));
                }
             });

             // Listen to members
             const membersRef = ref(db, `groups/${groupId}/members`);
             const unsubMembers = onValue(membersRef, (mSnap) => {
                setGroupMembers(prev => ({ ...prev, [groupId]: mSnap.exists() ? mSnap.val() : {} }));
             });

             membershipListeners.current[groupId] = unsubMembers;
          }

          // 3. Listen to Join Requests if admin
          const fetchRequestsIfAdmin = () => {
             const metaRef = ref(db, `groups/${groupId}`);
             get(metaRef).then(mSnap => {
                const gData = mSnap.val();
                if (gData && gData.admin === user.uid) {
                   if (!joinRequestListeners.current[groupId]) {
                      const requestsRef = ref(db, `groups/${groupId}/join_requests`);
                      const unsubRequests = onValue(requestsRef, (rSnap) => {
                         setGroupJoinRequests(prev => ({ ...prev, [groupId]: rSnap.exists() ? rSnap.val() : {} }));
                      });
                      joinRequestListeners.current[groupId] = unsubRequests;
                   }
                } else {
                   // Clean up if no longer admin
                   if (joinRequestListeners.current[groupId]) {
                      joinRequestListeners.current[groupId]();
                      delete joinRequestListeners.current[groupId];
                      setGroupJoinRequests(prev => {
                         const n = {...prev}; delete n[groupId]; return n;
                      });
                   }
                }
             });
          };

          fetchRequestsIfAdmin();
        });
    });

     // 4. Global Presence & Leaderboard Listener
     const communityRef = ref(db, 'community');
     // We remove the limit to get the total online count, but we slice the leaderboard for performance
     const unsubLeaderboard = onValue(communityRef, (snap) => {
       if (snap.exists()) {
         const data = snap.val();
         const allUsers = Object.keys(data || {}).map(key => ({
           id: key,
           ...data[key]
         })).filter((u: any) => u.name && u.score !== undefined);
         
         const sorted = [...allUsers].sort((a: any, b: any) => b.score - a.score);
         setLeaderboard(sorted.slice(0, 50)); // Only top 50 in state for UI performance
         
         const count = allUsers.filter((u: any) => u.isOnline).length;
         setOnlineCount(count);
       } else {
         setLeaderboard([]);
         setOnlineCount(0);
       }
     });

    return () => {
      unsubscribePresence();
      unsubscribePokes();
      unsubFriends();
      unsubIncoming();
      unsubSent();
      unsubUserGroups();
      unsubLeaderboard();
      // Clean up all individual group listeners
      Object.values(membershipListeners.current || {}).forEach(unsub => unsub());
      Object.values(joinRequestListeners.current || {}).forEach(unsub => unsub());
      membershipListeners.current = {};
      joinRequestListeners.current = {};
    };
  }, [user]);

  const clearPokes = async () => {
    if (!user) return;
    try {
      await remove(ref(db, `pokes/${user.uid}`));
      setPokes([]);
    } catch (e) {}
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setUnlocked(false);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const completeOnboarding = async (uid?: string) => {
    const targetUid = uid || user?.uid;
    if (!targetUid) return;
    try {
      await AsyncStorage.setItem(`@onboarding_complete_${targetUid}`, 'true');
      setHasSeenOnboarding(true);
    } catch (error) {
      console.error("Error setting onboarding:", error);
    }
  };

  const resetOnboarding = async (uid?: string) => {
    const targetUid = uid || user?.uid;
    if (!targetUid) return;
    try {
      await AsyncStorage.removeItem(`@onboarding_complete_${targetUid}`);
      setHasSeenOnboarding(false);
    } catch (error) {
      console.error("Error resetting onboarding:", error);
    }
  };

  const isAdmin = user?.email === 'chamarasecu21@gmail.com';

  return (
    <AuthContext.Provider value={{ 
      user, loading, logout, isAdmin, isUnlocked, setUnlocked, 
      hasSeenOnboarding, completeOnboarding, resetOnboarding,
      userName, setUserName,
      pokes, clearPokes, bubblePlayer,
      friends, incomingRequests, sentRequests,
      userGroups, groupMembers, groupMetadata, groupJoinRequests,
      leaderboard, onlineCount,
      university, setUniversity
    }}>
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        {children}
      </View>
    </AuthContext.Provider>
  );
};
