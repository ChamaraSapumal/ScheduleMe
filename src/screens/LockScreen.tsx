import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, LayoutAnimation, Platform, UIManager, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { colors, spacing } from '../theme';

const { width, height } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
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
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkPin();
    animateIcon();
    Animated.timing(contentFade, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [user]);

  const animateIcon = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, { toValue: 1.05, duration: 2500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(iconScale, { toValue: 1, duration: 2500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
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
      toValue: filled ? 1.3 : 1,
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
    if (pin.length >= 4) return;
    const newPin = pin + num;
    setPin(newPin);
    animateDot(newPin.length - 1, true);
    
    if (newPin.length === 4) {
      setTimeout(async () => {
        if (setupMode) {
          if (setupStep === 1) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
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
  };

  const resetDots = () => {
    dotAnims.forEach((anim) => {
      Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
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
                  <TouchableOpacity 
                    key={keyStr} 
                    style={styles.keyButtonTransparent} 
                    onPress={triggerBiometric} 
                    disabled={setupMode}
                  >
                    {!setupMode && <MaterialCommunityIcons name="fingerprint" size={32} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }
              if (keyStr === 'delete') {
                return (
                  <TouchableOpacity 
                    key={keyStr} 
                    style={styles.keyButtonTransparent} 
                    onPress={handleBackspace}
                  >
                    <MaterialCommunityIcons name="backspace-outline" size={26} color={colors.textSecondary} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity 
                  key={keyStr} 
                  style={styles.keyButton} 
                  onPress={() => handleKeyPress(keyStr)} 
                  activeOpacity={0.7}
                >
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
    <View style={styles.container}>
      {/* Background Decorative Shapes - Moved to background and restricted to top */}
      <View style={styles.artContainer} pointerEvents="none">
        <View style={[styles.shape, styles.shapeBeige]} />
        <View style={[styles.shape, styles.shapeYellow]} />
      </View>
      
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, { opacity: contentFade }]}>
          {/* Header Section - Ample room, clear contrast */}
          <View style={styles.header}>
            <Animated.View style={{ transform: [{ scale: iconScale }] }}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="shield-lock" size={36} color={colors.primary} />
              </View>
            </Animated.View>
            
            <Text style={styles.title}>
               {setupMode 
                 ? (setupStep === 1 ? 'Create PIN' : 'Confirm PIN') 
                 : 'Welcome'}
            </Text>
            <Text style={styles.subtitle}>
               {setupMode 
                 ? 'Secure your classes with a 4-digit code.' 
                 : 'Verify your ID to continue.'}
            </Text>
          </View>

          {/* Functional Section - Elevated card for maximum usability */}
          <View style={styles.bottomCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHandle} />
            </View>
            
            <View style={styles.dotsWrapper}>
              {renderDots()}
            </View>

            <View style={styles.keypadWrapper}>
              {renderKeypad()}
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
               <Text style={styles.logoutText}>Switch Account or <Text style={{ color: colors.error, fontWeight: '800' }}>Log out</Text></Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  artContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
  },
  shape: {
    position: 'absolute',
  },
  shapeBeige: {
    backgroundColor: colors.secondary,
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    top: -width * 0.6,
    left: -width * 0.2,
    opacity: 0.8,
  },
  shapeYellow: {
    backgroundColor: colors.primary,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    top: -width * 0.2,
    right: -width * 0.2,
    opacity: 0.6,
  },
  header: {
    alignItems: 'center',
    paddingTop: height * 0.04,
    paddingHorizontal: spacing.xl,
    zIndex: 1,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    color: '#000000',
    fontSize: 32,
    fontWeight: '900',
    marginTop: spacing.l,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: 'rgba(0,0,0,0.5)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: spacing.s,
    fontWeight: '500',
  },
  bottomCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingBottom: spacing.l,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 2,
  },
  cardHeader: {
    alignItems: 'center',
    paddingVertical: spacing.m,
  },
  cardHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#EAEAEA',
    borderRadius: 2,
  },
  dotsWrapper: {
    paddingVertical: spacing.l,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 12,
  },
  dotFilled: {
    backgroundColor: '#111111',
  },
  keypadWrapper: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  keypad: {
    width: '100%',
    maxWidth: 320,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.m,
  },
  keyButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  keyButtonTransparent: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    color: '#000000',
    fontSize: 26,
    fontWeight: '600',
  },
  logoutBtn: {
    alignSelf: 'center',
    marginTop: spacing.m,
    padding: spacing.s,
  },
  logoutText: {
    color: 'rgba(0,0,0,0.4)',
    fontSize: 14,
    fontWeight: '500',
  }
});
