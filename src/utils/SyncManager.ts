import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, get, set, remove, update } from 'firebase/database';
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
