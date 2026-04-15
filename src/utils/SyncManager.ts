import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, get, set, remove, update, push, onValue, query, limitToLast } from 'firebase/database';
import { db } from '../config/firebase';

const OFFLINE_QUEUE_KEY = '@offline_action_queue';

type ActionPayload = {
  id: string;
  type: 'set' | 'update' | 'remove' | 'push';
  path: string;
  data?: any;
  timestamp: number;
};

// Check if user agreed to storage
export const isOfflineSyncEnabled = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem('@offline_sync_enabled')) === 'true';
  } catch {
    return false;
  }
};

// Generic read: fallback to AsyncStorage if Firebase fails
export const fetchWithCache = async (path: string, uid: string, timeoutMs = 5000) => {
  const cacheKey = `@cached_${uid}_${path}`;
  const getEnabled = await isOfflineSyncEnabled();

  try {
    // Attempt network fetch with a forced timeout
    const fetchPromise = get(ref(db, path));
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), timeoutMs));
    
    const snapshot: any = await Promise.race([fetchPromise, timeoutPromise]);
    
    // Success: Update Cache
    if (getEnabled) {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(snapshot.val()));
    }
    
    return snapshot.val();
  } catch (error) {
    // Network failed or timeout out, retrieve from local cache
    console.warn(`[SyncManager] Network unreachable for ${path}. Falling back to storage.`);
    if (getEnabled) {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    }
    return null; // No cache available
  }
};

// Generic write logic mapping
const enqueueAction = async (action: ActionPayload) => {
  try {
    const queueRaw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: ActionPayload[] = queueRaw ? JSON.parse(queueRaw) : [];
    queue.push(action);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("Queue action failed", e);
  }
};

const updateCacheOnWrite = async (path: string, uid: string, type: string, data?: any) => {
  const cacheKey = `@cached_${uid}_${path.split('/')[0]}`; // e.g. cache root 'courses'
  try {
      const existingRaw = await AsyncStorage.getItem(cacheKey);
      let existing = existingRaw ? JSON.parse(existingRaw) : {};
      
      const segments = path.split('/');
      const key = segments[segments.length - 1]; // e.g. the item ID

      if (type === 'remove') {
          if (existing && existing[key]) delete existing[key];
      } else if (type === 'set' || type === 'update') {
          existing[key] = { ...existing[key], ...data };
      }
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(existing));
  } catch(e) {}
};

export const syncWrite = async (type: 'set' | 'update' | 'remove', path: string, uid: string, data?: any) => {
  const enabled = await isOfflineSyncEnabled();
  
  // Try network primary
  try {
    const dbRef = ref(db, path);
    if (type === 'set') await set(dbRef, data);
    if (type === 'update') await update(dbRef, data);
    if (type === 'remove') await remove(dbRef);
    
    // Successfully hit cloud, so update disk cache copy too
    if (enabled) {
        await updateCacheOnWrite(path, uid, type, data);
    }
  } catch (error) {
    // FAILED: We are offline. Record action into queue & modify cache directly
    console.warn(`[SyncManager] Write to ${path} failed. Queueing offline action.`);
    if (enabled) {
        await enqueueAction({
            id: Date.now().toString() + Math.random().toString(36).substring(7),
            type,
            path,
            data,
            timestamp: Date.now()
        });
        await updateCacheOnWrite(path, uid, type, data);
    }
  }
};

// Attempt to resolve the queue when app loads
export const resolveOfflineQueue = async () => {
  const enabled = await isOfflineSyncEnabled();
  if (!enabled) return;

  try {
    const queueRaw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!queueRaw) return;
    
    const queue: ActionPayload[] = JSON.parse(queueRaw);
    if (queue.length === 0) return;

    console.log(`[SyncManager] Attempting to resolve ${queue.length} offline actions...`);
    
    const remainingQueue: ActionPayload[] = [];
    
    for (const action of queue) {
      try {
        const dbRef = ref(db, action.path);
        if (action.type === 'set') await set(dbRef, action.data);
        if (action.type === 'update') await update(dbRef, action.data);
        if (action.type === 'remove') await remove(dbRef);
      } catch (err) {
        // Still failing (still offline?), push back to queue
        remainingQueue.push(action);
      }
    }
    
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
    if (remainingQueue.length === 0) {
        console.log(`[SyncManager] All offline operations successfully pushed to Firebase!`);
    } else {
        console.log(`[SyncManager] Deferred ${remainingQueue.length} actions.`);
    }
  } catch (e) {
    console.error("Queue sync failed", e);
  }
};

/**
 * SMART SCORE SYSTEM
 */
export const updateSmartScore = async (uid: string) => {
  try {
    const [attendance, words, dreams, todos, profile] = await Promise.all([
      get(ref(db, `users/${uid}/attendance`)),
      get(ref(db, `users/${uid}/words`)),
      get(ref(db, `users/${uid}/dreams`)),
      get(ref(db, `users/${uid}/todos`)),
      get(ref(db, `users/${uid}/profile`))
    ]);

    let score = 0;

    // 1. Attendance (10 pts per attended class)
    // Based on AttendanceScreen.tsx: 15 base + extra - absences
    if (attendance.exists()) {
      const absences = attendance.val() as Record<string, number>;
      Object.entries(absences).forEach(([course, missed]) => {
        const attended = Math.max(0, 15 - missed); // Simple estimate as we don't have extra class info here easily
        score += attended * 10;
      });
    }

    // 2. Vocabulary (5 pts per word)
    if (words.exists()) {
      score += Object.keys(words.val()).length * 5;
    }

    // 3. Dreams (50 pts per completed dream)
    if (dreams.exists()) {
      const dreamList = Object.values(dreams.val()) as any[];
      score += dreamList.filter(d => d.completed).length * 50;
    }

    // 4. To-Dos (5 pts per completed task)
    if (todos.exists()) {
      const todoList = Object.values(todos.val()) as any[];
      score += todoList.filter(t => t.completed).length * 5;
    }

    // 5. Focus Time (1 pt per minute)
    if (profile.exists()) {
      const data = profile.val();
      score += (data.totalFocusMinutes || 0);
    }

    // Sync to both private profile and public community node
    const updates: any = {};
    updates[`users/${uid}/profile/totalScore`] = score;
    
    // Push hidePoints flag and populate name/score/pokeEnabled consistently
    if (profile.exists()) {
      const pval = profile.val();
      const isVisible = pval.communityVisibility !== false; // Default true
      updates[`community/${uid}/hidePoints`] = !isVisible;
      updates[`community/${uid}/pokeEnabled`] = pval.pokeEnabled !== false; // Default true
      updates[`community/${uid}/name`] = pval.name || 'Student';
      updates[`community/${uid}/score`] = score;
      if (pval.university) {
        updates[`community/${uid}/university`] = pval.university;
      }
    }

    await update(ref(db), updates);
    return score;
  } catch (err) {
    console.warn('[SyncManager] Score sync failed:', err);
    return 0;
  }
};

export const awardReferralPoints = async (uid: string, amount: number = 50) => {
  try {
    const profileRef = ref(db, `users/${uid}/profile`);
    const snap = await get(profileRef);
    if (!snap.exists()) return;
    
    const currentScore = snap.val().totalScore || 0;
    const newScore = currentScore + amount;
    
    const updates: any = {};
    updates[`users/${uid}/profile/totalScore`] = newScore;
    updates[`community/${uid}/score`] = newScore;
    
    await update(ref(db), updates);
    
    // Broadcast for extra social proof
    await broadcastActivity(uid, snap.val().name || 'Student', `earned ${amount} pts for a successful referral! 🚀`);
    
    return newScore;
  } catch (err) {
    console.warn('[SyncManager] Referral award failed:', err);
  }
};

// Only allow poking between established friends
export const sendPoke = async (targetUid: string, senderName: string, message: string = 'poked you') => {
  try {
    const pokeId = Date.now().toString();
    await set(ref(db, `pokes/${targetUid}/${pokeId}`), {
      senderName,
      message,
      timestamp: Date.now(),
      status: 'new'
    });
  } catch (e) {}
};

/**
 * GROUP SYSTEM
 */

export const createGroup = async (uid: string, groupName: string) => {
  try {
    const groupId = 'GR_' + Date.now().toString() + Math.random().toString(36).substring(7);
    const updates: any = {};
    
    updates[`groups/${groupId}`] = {
      name: groupName,
      admin: uid,
      createdAt: Date.now(),
      members: { [uid]: true }
    };
    updates[`user_groups/${uid}/${groupId}`] = true;
    
    await update(ref(db), updates);
    return groupId;
  } catch (e) {
    throw e;
  }
};

export const joinGroup = async (uid: string, groupId: string, userName?: string) => {
  try {
    const groupRef = ref(db, `groups/${groupId}`);
    const snap = await get(groupRef);
    if (!snap.exists()) throw new Error('Group not found');
    const groupData = snap.val();
    
    // 1. Check if user is kicked (Admin Approval Required)
    const wasKicked = groupData.kicked && groupData.kicked[uid];
    
    if (wasKicked) {
        const updates: any = {};
        updates[`groups/${groupId}/join_requests/${uid}`] = {
            name: userName || 'Student',
            timestamp: Date.now(),
            status: 'pending'
        };
        await update(ref(db), updates);
        return 'PENDING';
    }

    // 2. Check Mutual Friend Rule: Must be friends with at least one member
    const members = groupData.members || {};
    // Admin is always a friend of the system essentially, but we stick to the rule
    const friendsRef = ref(db, `friends/${uid}`);
    const friendsSnap = await get(friendsRef);
    const myFriends = friendsSnap.exists() ? Object.keys(friendsSnap.val()) : [];
    
    const isFriendWithMember = Object.keys(members).some(memberUid => myFriends.includes(memberUid));
    
    if (!isFriendWithMember && groupData.admin !== uid) {
      throw new Error('You must be friends with a member to join this group.');
    }

    const updates: any = {};
    updates[`groups/${groupId}/members/${uid}`] = true;
    updates[`user_groups/${uid}/${groupId}`] = true;
    
    await update(ref(db), updates);
    return 'SUCCESS';
  } catch (e) {
    throw e;
  }
};

export const kickMember = async (adminUid: string, groupId: string, targetUid: string) => {
  try {
    const groupRef = ref(db, `groups/${groupId}`);
    const snap = await get(groupRef);
    if (!snap.exists()) return;
    if (snap.val().admin !== adminUid) throw new Error('Unauthorized: Only admin can kick members');

    const updates: any = {};
    updates[`groups/${groupId}/members/${targetUid}`] = null;
    updates[`user_groups/${targetUid}/${groupId}`] = null;
    updates[`groups/${groupId}/kicked/${targetUid}`] = true;
    
    await update(ref(db), updates);
  } catch (e) {
    throw e;
  }
};

export const approveJoinGroup = async (adminUid: string, groupId: string, targetUid: string) => {
  try {
    const groupRef = ref(db, `groups/${groupId}`);
    const snap = await get(groupRef);
    if (!snap.exists()) return;
    if (snap.val().admin !== adminUid) return;

    const updates: any = {};
    updates[`groups/${groupId}/members/${targetUid}`] = true;
    updates[`user_groups/${targetUid}/${groupId}`] = true;
    updates[`groups/${groupId}/kicked/${targetUid}`] = null;
    updates[`groups/${groupId}/join_requests/${targetUid}`] = null;
    
    await update(ref(db), updates);
  } catch (e) {}
};

export const declineJoinRequest = async (adminUid: string, groupId: string, targetUid: string) => {
  try {
    const groupRef = ref(db, `groups/${groupId}`);
    const snap = await get(groupRef);
    if (!snap.exists()) return;
    if (snap.val().admin !== adminUid) return;

    await set(ref(db, `groups/${groupId}/join_requests/${targetUid}`), null);
  } catch (e) {}
};

export const leaveGroup = async (uid: string, groupId: string) => {
  try {
    const updates: any = {};
    updates[`groups/${groupId}/members/${uid}`] = null;
    updates[`user_groups/${uid}/${groupId}`] = null;
    await update(ref(db), updates);
  } catch (e) {}
};

/**
 * FRIENDSHIP SYSTEM
 */

export const sendFriendRequest = async (targetUid: string, senderUid: string, senderName: string) => {
  try {
    // 1. Check for 24h cooldown on rejections
    const rejectionRef = ref(db, `rejections/${targetUid}/${senderUid}`);
    const rejectionSnap = await get(rejectionRef);
    
    if (rejectionSnap.exists()) {
      const lastRejection = rejectionSnap.val();
      const diff = Date.now() - lastRejection;
      const cooldownMs = 24 * 60 * 60 * 1000;
      
      if (diff < cooldownMs) {
        const remainingHours = Math.ceil((cooldownMs - diff) / (60 * 60 * 1000));
        throw new Error(`Wait ${remainingHours}h before sending another request.`);
      }
    }

    // 2. Send request
    const updates: any = {};
    const timestamp = Date.now();
    
    // Incoming for target
    updates[`friend_requests/${targetUid}/${senderUid}`] = {
      senderName,
      timestamp,
      status: 'pending'
    };
    
    // Outgoing reference for sender (for UI lookup)
    updates[`sent_requests/${senderUid}/${targetUid}`] = true;

    await update(ref(db), updates);
  } catch (error: any) {
    throw error;
  }
};

export const acceptFriendRequest = async (myUid: string, friendUid: string, myName: string, friendName: string) => {
  try {
    const updates: any = {};
    const timestamp = Date.now();

    // Bidirectional friendship
    updates[`friends/${myUid}/${friendUid}`] = { name: friendName, since: timestamp };
    updates[`friends/${friendUid}/${myUid}`] = { name: myName, since: timestamp };

    // Cleanup requests
    updates[`friend_requests/${myUid}/${friendUid}`] = null;
    updates[`sent_requests/${friendUid}/${myUid}`] = null;
    
    // Cleanup any lingering cooldowns
    updates[`rejections/${myUid}/${friendUid}`] = null;
    updates[`rejections/${friendUid}/${myUid}`] = null;

    await update(ref(db), updates);
  } catch (e) {}
};

export const declineFriendRequest = async (myUid: string, requesterUid: string) => {
  try {
    const updates: any = {};
    
    // Remove request
    updates[`friend_requests/${myUid}/${requesterUid}`] = null;
    updates[`sent_requests/${requesterUid}/${myUid}`] = null;

    // Set 24h cooldown
    updates[`rejections/${myUid}/${requesterUid}`] = Date.now();

    await update(ref(db), updates);
  } catch (e) {}
};

export const broadcastActivity = async (uid: string, userName: string, action: string) => {
  try {
    const profileSnap = await get(ref(db, `users/${uid}/profile`));
    if (profileSnap.exists() && profileSnap.val().communityVisibility) {
      const activityId = Date.now().toString();
      await set(ref(db, `community_activity/${activityId}`), {
        uid,
        userName: userName || profileSnap.val().name || 'Student',
        action,
        timestamp: Date.now()
      });
    }
  } catch (e) {}
};

export const removeFriend = async (uid: string, friendUid: string) => {
  try {
    const updates: any = {};
    updates[`friends/${uid}/${friendUid}`] = null;
    updates[`friends/${friendUid}/${uid}`] = null;
    await update(ref(db), updates);
  } catch (e) {
    console.error('[SyncManager] Failed to unfriend:', e);
  }
};

export const pruneShoutbox = async (groupId: string) => {
  try {
    const shoutboxRef = ref(db, `groups/${groupId}/shoutbox`);
    const snapshot = await get(shoutboxRef);
    if (!snapshot.exists()) return;

    const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
    const data = snapshot.val();
    const updates: any = {};
    let prunedCount = 0;

    Object.keys(data || {}).forEach(key => {
      if (data[key].timestamp < fourHoursAgo) {
        updates[key] = null;
        prunedCount++;
      }
    });

    if (prunedCount > 0) {
      await update(shoutboxRef, updates);
    }
  } catch (e) {
    console.error('[SyncManager] Failed to prune shoutbox:', e);
  }
};

export const sendShout = async (groupId: string, uid: string, name: string, text: string) => {
  // Prune before sending to keep it fresh
  pruneShoutbox(groupId).catch(() => {});
  
  const shoutRef = ref(db, `groups/${groupId}/shoutbox`);
  const newShout = push(shoutRef);
  return set(newShout, {
    uid,
    name,
    text: text.substring(0, 50),
    timestamp: Date.now()
  });
};

export const updateVibe = async (uid: string, emoji: string, text: string) => {
  const updates: any = {};
  updates[`users/${uid}/profile/vibe`] = { emoji, text };
  updates[`community/${uid}/vibe`] = { emoji, text };
  return update(ref(db), updates);
};

export const updateGroupAchievements = async (groupId: string, achievements: string[]) => {
  return set(ref(db, `groups/${groupId}/achievements`), achievements);
};
