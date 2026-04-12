import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import { View, AppState, PanResponder } from 'react-native';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { ref, get } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isUnlocked: boolean;
  setUnlocked: (unlocked: boolean) => void;
  hasSeenOnboarding: boolean | null;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  userName: string | null;
  setUserName: (name: string | null) => void;
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
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUnlocked, setUnlocked] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
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
    const checkOnboarding = async () => {
      try {
        const val = await AsyncStorage.getItem('@onboarding_complete');
        setHasSeenOnboarding(val === 'true');
      } catch (err) {
        setHasSeenOnboarding(false);
      }
    };
    checkOnboarding();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // 1. Try to load name from AsyncStorage immediately for zero-lag UI
        try {
          const cachedName = await AsyncStorage.getItem(`cached_name_${currentUser.uid}`);
          if (cachedName) setUserName(cachedName);
          
          // 2. Fetch fresh name from Firebase
          const profileRef = ref(db, `users/${currentUser.uid}/profile`);
          const snap = await get(profileRef);
          if (snap.exists()) {
            const data = snap.val();
            if (data.name) {
              setUserName(data.name);
              await AsyncStorage.setItem(`cached_name_${currentUser.uid}`, data.name);
            }
          }
        } catch (err) {
          console.warn('Error loading user profile data:', err);
        }
      } else {
        setUserName(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setUnlocked(false);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('@onboarding_complete', 'true');
      setHasSeenOnboarding(true);
    } catch (error) {
      console.error("Error setting onboarding:", error);
    }
  };

  const resetOnboarding = async () => {
    try {
      await AsyncStorage.removeItem('@onboarding_complete');
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
      userName, setUserName
    }}>
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        {children}
      </View>
    </AuthContext.Provider>
  );
};
