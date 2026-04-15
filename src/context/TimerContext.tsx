import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, LayoutAnimation, Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { scheduleFocusNotification, cancelAllNotifications, registerForPushNotificationsAsync } from '../utils/notificationService';
import { useAudioPlayer } from 'expo-audio';
import { AuthContext } from '../context/AuthContext';
import { db } from '../config/firebase';
import { ref, set, get, update, runTransaction } from 'firebase/database';
import { updateSmartScore } from '../utils/SyncManager';

interface TimerContextType {
  timeLeft: number;
  totalTime: number;
  isRunning: boolean;
  mode: 'FOCUS' | 'BREAK';
  isDNDEnabled: boolean;
  toggleTimer: () => Promise<void>;
  resetTimer: () => Promise<void>;
  switchMode: (newMode: 'FOCUS' | 'BREAK') => Promise<void>;
  toggleDND: () => void;
  openSystemDND: () => void;
}

const FOCUS_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(FOCUS_TIME);
  const [mode, setMode] = useState<'FOCUS' | 'BREAK'>('FOCUS');
  const [isDNDEnabled, setIsDNDEnabled] = useState(false);
  
  const totalTime = mode === 'FOCUS' ? FOCUS_TIME : BREAK_TIME;
  
  const { user } = useContext(AuthContext);
  const tickRef = useRef(Date.now());
  const stateRef = useRef({ isRunning, timeLeft, mode });
  const player = useAudioPlayer({ uri: 'https://actions.google.com/sounds/v1/water/water_drop.ogg' });

  useEffect(() => {
    stateRef.current = { isRunning, timeLeft, mode };
  }, [isRunning, timeLeft, mode]);

  const playZenSound = async () => {
    try {
      player.seekTo(0);
      player.play();
    } catch (e) { }
  };

  useEffect(() => {
    const loadState = async () => {
      try {
        const stored = await AsyncStorage.getItem('@pomodoro_state');
        if (stored) {
          const { targetTime, mode: storedMode, wasRunning, remainder } = JSON.parse(stored);
          const currentMode = storedMode || 'FOCUS';
          setMode(currentMode);

          if (wasRunning && targetTime) {
            const remaining = Math.round((targetTime - Date.now()) / 1000);
            if (remaining > 0) {
              setTimeLeft(remaining);
              setIsRunning(true);
            } else {
              const newMode = currentMode === 'FOCUS' ? 'BREAK' : 'FOCUS';
              setMode(newMode);
              setTimeLeft(newMode === 'FOCUS' ? FOCUS_TIME : BREAK_TIME);
              setIsRunning(false);
              playZenSound();
            }
          } else {
            setTimeLeft(remainder || (currentMode === 'FOCUS' ? FOCUS_TIME : BREAK_TIME));
            setIsRunning(false);
          }
        }

        const dndStored = await AsyncStorage.getItem('@dnd_enabled');
        if (dndStored !== null) {
          setIsDNDEnabled(JSON.parse(dndStored));
        }
      } catch (e) { }
    };

    loadState();

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const { isRunning: currRun, timeLeft: currLeft, mode: currMode } = stateRef.current;
      
      if (nextAppState === 'active') {
        loadState();
      } else if (nextAppState.match(/inactive|background/)) {
        if (currRun) {
          const targetTime = Date.now() + (currLeft * 1000);
          await AsyncStorage.setItem('@pomodoro_state', JSON.stringify({ targetTime, mode: currMode, wasRunning: true }));
        } else {
          await AsyncStorage.setItem('@pomodoro_state', JSON.stringify({ remainder: currLeft, mode: currMode, wasRunning: false }));
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let interval: any;
    if (isRunning && timeLeft > 0) {
      tickRef.current = Date.now();
      interval = setInterval(() => {
        const now = Date.now();
        const delta = Math.floor((now - tickRef.current) / 1000);
        if (delta >= 1) {
          setTimeLeft((prev) => {
            const next = prev - delta;
            return next > 0 ? next : 0;
          });
          tickRef.current += delta * 1000;
        }
      }, 250);
    } else if (timeLeft === 0 && isRunning) {
      playZenSound();
      
      // Update Total Focus Minutes if session completed
      if (mode === 'FOCUS' && user) {
        const profileRef = ref(db, `users/${user.uid}/profile/totalFocusMinutes`);
        runTransaction(profileRef, (currentMinutes) => {
          return (currentMinutes || 0) + (FOCUS_TIME / 60);
        }).then(() => {
          updateSmartScore(user.uid);
        });
      }

      const newMode = mode === 'FOCUS' ? 'BREAK' : 'FOCUS';
      setMode(newMode);
      setTimeLeft(newMode === 'FOCUS' ? FOCUS_TIME : BREAK_TIME);
      setIsRunning(false);
      cancelAllNotifications();
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, mode]);

  // Sync Status to Community Hub
  useEffect(() => {
    if (!user) return;
    
    const statusRef = ref(db, `community/${user.uid}/status`);
    const status = (isRunning && mode === 'FOCUS') ? 'focus' : 'available';
    set(statusRef, status);
    
    return () => {
      set(statusRef, 'available');
    };
  }, [isRunning, mode, user]);

  const toggleTimer = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const nextState = !isRunning;
    setIsRunning(nextState);

    if (nextState) {
      await registerForPushNotificationsAsync();
      await scheduleFocusNotification(timeLeft, mode);
    } else {
      await cancelAllNotifications();
    }
  };

  const resetTimer = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsRunning(false);
    setTimeLeft(mode === 'FOCUS' ? FOCUS_TIME : BREAK_TIME);
    await cancelAllNotifications();
    await AsyncStorage.removeItem('@pomodoro_state');
  };

  const switchMode = async (newMode: 'FOCUS' | 'BREAK') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMode(newMode);
    setTimeLeft(newMode === 'FOCUS' ? FOCUS_TIME : BREAK_TIME);
    setIsRunning(false);
    await cancelAllNotifications();
  };

  const toggleDND = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newState = !isDNDEnabled;
    setIsDNDEnabled(newState);
    AsyncStorage.setItem('@dnd_enabled', JSON.stringify(newState)).catch(() => {});
  };

  const openSystemDND = () => {
    if (Platform.OS === 'android') {
      IntentLauncher.startActivityAsync('android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS');
    } else {
      Linking.openURL('App-Prefs:DO_NOT_DISTURB').catch(() => {
        Linking.openSettings(); // Fallback to general settings
      });
    }
  };

  return (
    <TimerContext.Provider value={{ 
      timeLeft, totalTime, isRunning, mode, isDNDEnabled,
      toggleTimer, resetTimer, switchMode, toggleDND, openSystemDND 
    }}>
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) throw new Error('useTimer must be used within TimerProvider');
  return context;
};
