import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { colors, spacing } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  // LayoutAnimation handled automatically in the New Architecture
}

export default function LockScreen() {
  const { user, setUnlocked, logout } = useContext(AuthContext);
  const { showAlert } = useCustomAlert();
  const [pin, setPin] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [setupMode, setSetupMode] = useState(false);
  const [setupStep, setSetupStep] = useState(1); 
  const [firstPin, setFirstPin] = useState('');
  
  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const dotAnims = useRef([new Animated.Value(1), new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]).current;
  const iconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkPin();
    animateIcon();
  }, [user]);

  const animateIcon = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, { toValue: 1.1, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(iconScale, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const animateDot = (index: number, filled: boolean) => {
    Animated.spring(dotAnims[index], {
      toValue: filled ? 1.4 : 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const checkPin = async () => {
    if (!user) return;
    try {
      const savedPin = await AsyncStorage.getItem(`user_pin_${user.uid}`);
      if (savedPin) {
        setStoredPin(savedPin);
        setSetupMode(false);
        triggerBiometric();
      } else {
        setSetupMode(true);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const triggerBiometric = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock ScheduleMe',
          fallbackLabel: 'Use PIN',
          cancelLabel: 'Cancel',
          disableDeviceFallback: true,
        });

        if (result.success) {
          setUnlocked(true);
        }
      }
    } catch (e) {
      console.log('Biometric error: ', e);
    }
  };

  const handleKeyPress = async (num: string) => {
    const newPin = pin + num;
    if (newPin.length <= 4) {
      setPin(newPin);
      animateDot(newPin.length - 1, true);
      
      if (newPin.length === 4) {
        setTimeout(async () => {
          if (setupMode) {
            if (setupStep === 1) {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setFirstPin(newPin);
              setPin('');
              setSetupStep(2);
              resetDots();
            } else {
              if (newPin === firstPin) {
                await AsyncStorage.setItem(`user_pin_${user?.uid}`, newPin);
                setUnlocked(true);
              } else {
                triggerShake();
                setTimeout(() => {
                  setPin('');
                  setFirstPin('');
                  setSetupStep(1);
                  resetDots();
                }, 200);
              }
            }
          } else {
            if (newPin === storedPin) {
              setUnlocked(true);
            } else {
              triggerShake();
              setTimeout(() => {
                setPin('');
                resetDots();
              }, 200);
            }
          }
        }, 150);
      }
    }
  };

  const resetDots = () => {
    dotAnims.forEach((anim) => {
      Animated.timing(anim, { toValue: 1, duration: 100, useNativeDriver: true }).start();
    });
  };

  const handleBackspace = () => {
    if (pin.length > 0) {
      animateDot(pin.length - 1, false);
      setPin(pin.slice(0, -1));
    }
  };

  const renderDots = () => {
    return (
      <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeAnim }] }]}>
        {dotAnims.map((anim, i) => (
          <Animated.View 
            key={i} 
            style={[
              styles.dot, 
              i < pin.length && styles.dotFilled,
              { transform: [{ scale: anim }] }
            ]} 
          />
        ))}
      </Animated.View>
    );
  };

  const renderKeypad = () => {
    const rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['biometric', '0', 'delete']
    ];

    return (
      <View style={styles.keypad}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((keyStr) => {
              if (keyStr === 'biometric') {
                return (
                  <TouchableOpacity key={keyStr} style={[styles.keyButton, { backgroundColor: 'transparent', borderColor: 'transparent' }]} onPress={triggerBiometric} disabled={setupMode}>
                     {!setupMode && <MaterialCommunityIcons name="fingerprint" size={38} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }
              if (keyStr === 'delete') {
                return (
                  <TouchableOpacity key={keyStr} style={[styles.keyButton, { backgroundColor: 'transparent', borderColor: 'transparent' }]} onPress={handleBackspace}>
                     <MaterialCommunityIcons name="backspace-outline" size={32} color={colors.textSecondary} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity key={keyStr} style={styles.keyButton} onPress={() => handleKeyPress(keyStr)} activeOpacity={0.6}>
                  <Text style={styles.keyText}>{keyStr}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.decorCircle, { top: -100, left: -50 }]} />
      <View style={[styles.decorCircle, { bottom: -150, right: -50, backgroundColor: colors.secondary, width: 250, height: 250 }]} />
      
      <View style={styles.header}>
         <Animated.View style={{ transform: [{ scale: iconScale }] }}>
           <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="shield-check" size={40} color={colors.primary} />
           </View>
         </Animated.View>
         
         <Text style={styles.title}>
            {setupMode 
              ? (setupStep === 1 ? 'Create Secure PIN' : 'Confirm Your PIN') 
              : 'Welcome Back'}
         </Text>
         <Text style={styles.subtitle}>
            {setupMode 
              ? 'Enter a 4-digit code to protect your schedule and notes.' 
              : 'Enter your secure PIN to continue.'}
         </Text>
      </View>

      <View style={styles.mainContent}>
        {renderDots()}
        {renderKeypad()}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
         <Text style={styles.logoutText}>Forget PIN? <Text style={{ color: colors.error }}>Log out</Text></Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  decorCircle: {
     position: 'absolute',
     width: 300,
     height: 300,
     borderRadius: 150,
     backgroundColor: colors.primary,
     opacity: 0.15,
  },
  header: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(91, 194, 216, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(91, 194, 216, 0.3)',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: spacing.l,
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing.s,
    lineHeight: 22,
  },
  mainContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 60,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 15,
  },
  dotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    // Add shadow/glow for filled dots
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  keypad: {
    width: 300,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.l,
  },
  keyButton: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  keyText: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '400',
  },
  logoutBtn: {
     marginBottom: spacing.xl,
     padding: spacing.m,
  },
  logoutText: {
     color: colors.textSecondary,
     fontSize: 14,
     fontWeight: '500',
  }
});
