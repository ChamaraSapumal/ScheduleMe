import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, LayoutAnimation } from 'react-native';
import { scheduleFocusNotification, cancelAllNotifications, registerForPushNotificationsAsync } from '../utils/notificationService';
import { useAudioPlayer } from 'expo-audio';

interface TimerContextType {
  timeLeft: number;
  totalTime: number;
  isRunning: boolean;
  mode: 'FOCUS' | 'BREAK';
  toggleTimer: () => Promise<void>;
  resetTimer: () => Promise<void>;
  switchMode: (newMode: 'FOCUS' | 'BREAK') => Promise<void>;
}

const FOCUS_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(FOCUS_TIME);
  const [mode, setMode] = useState<'FOCUS' | 'BREAK'>('FOCUS');
  
  const totalTime = mode === 'FOCUS' ? FOCUS_TIME : BREAK_TIME;
  
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
      const newMode = mode === 'FOCUS' ? 'BREAK' : 'FOCUS';
      setMode(newMode);
      setTimeLeft(newMode === 'FOCUS' ? FOCUS_TIME : BREAK_TIME);
      setIsRunning(false);
      cancelAllNotifications();
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, mode]);

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

  return (
    <TimerContext.Provider value={{ timeLeft, totalTime, isRunning, mode, toggleTimer, resetTimer, switchMode }}>
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) throw new Error('useTimer must be used within TimerProvider');
  return context;
};
