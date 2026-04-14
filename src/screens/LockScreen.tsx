import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, LayoutAnimation, Platform, UIManager, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';

const { width, height } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function LockScreen() {
  const { user, setUnlocked, logout, userName } = useContext(AuthContext);
  const firstName = userName ? userName.split(' ')[0] : 'Student';
  const { showAlert } = useCustomAlert();
  const [pin, setPin] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [setupMode, setSetupMode] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [firstPin, setFirstPin] = useState('');

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const dotAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  // Key press scale animations
  const keyScaleAnims = useRef<{[key: string]: Animated.Value}>({}).current;
  ['1','2','3','4','5','6','7','8','9','0','biometric','delete'].forEach(key => {
    if (!keyScaleAnims[key]) keyScaleAnims[key] = new Animated.Value(1);
  });

  useEffect(() => {
    checkPin();
    
    // Initial entry fade
    Animated.timing(contentFade, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

  }, [user]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 15, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -15, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const animateDot = (index: number, filled: boolean) => {
    Animated.spring(dotAnims[index], {
      toValue: filled ? 1 : 0,
      friction: 6,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  const animateKeyPress = (key: string) => {
    Animated.sequence([
        Animated.timing(keyScaleAnims[key], { toValue: 0.9, duration: 60, useNativeDriver: true }),
        Animated.timing(keyScaleAnims[key], { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
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
    animateKeyPress(num);
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
              }, 300);
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
            }, 300);
          }
        }
      }, 150);
    }
  };

  const resetDots = () => {
    dotAnims.forEach((anim) => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    });
  };

  const handleBackspace = () => {
    animateKeyPress('delete');
    if (pin.length > 0) {
      animateDot(pin.length - 1, false);
      setPin(pin.slice(0, -1));
    }
  };

  const renderDots = () => {
    return (
      <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeAnim }] }]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.dotBackground}>
              <Animated.View
                style={[
                styles.dotFilled,
                { 
                    opacity: dotAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.1, 1]
                    }),
                    transform: [{ 
                        scale: dotAnims[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1.2]
                        }) 
                    }],
                    backgroundColor: dotAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: ['#3A3749', '#6C5CE7']
                    })
                }
                ]}
              />
          </View>
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
              const isSpecial = keyStr === 'biometric' || keyStr === 'delete';
              
              if (keyStr === 'biometric' && setupMode) {
                  return <View key="bio-empty" style={styles.keyButtonEmpty} />;
              }

              return (
                <Animated.View 
                    key={keyStr} 
                    style={{ transform: [{ scale: keyScaleAnims[keyStr] }] }}
                >
                    <TouchableOpacity
                        style={isSpecial ? styles.keyButtonSpecial : styles.keyButton}
                        onPress={() => {
                            if (keyStr === 'biometric') triggerBiometric();
                            else if (keyStr === 'delete') handleBackspace();
                            else handleKeyPress(keyStr);
                        }}
                        activeOpacity={0.7}
                    >
                        {keyStr === 'biometric' && (
                            <MaterialCommunityIcons name="line-scan" size={32} color="#6C5CE7" />
                        )}
                        {keyStr === 'delete' && (
                            <MaterialCommunityIcons name="backspace-outline" size={28} color="#8B87A0" />
                        )}
                        {!isSpecial && <Text style={styles.keyText}>{keyStr}</Text>}
                    </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Dark Premium Background Decor */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, { opacity: contentFade }]}>

          {/* Top Section */}
          <View style={styles.topSection}>
            <MaterialCommunityIcons name="shield-lock-outline" size={32} color="#6C5CE7" style={styles.lockIcon} />
            
            <View style={styles.textWrapper}>
              <Text style={styles.greeting}>
                {setupMode 
                  ? (setupStep === 1 ? 'Secure your hub' : 'Verification') 
                  : 'Welcome back'}
              </Text>
              <Text style={styles.name}>
                {setupMode 
                  ? (setupStep === 1 ? 'Create PIN' : 'Confirm PIN') 
                  : firstName}
              </Text>
            </View>
          </View>

          {/* Interaction Section */}
          <View style={styles.interactionSection}>
            <View style={styles.dotsWrapper}>
              {renderDots()}
            </View>

            <View style={styles.keypadWrapper}>
              {renderKeypad()}
            </View>
          </View>

          {/* Bottom Section */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.switchBtn} onPress={logout}>
              <Text style={styles.switchText}>Not you? <Text style={styles.switchAccent}>Switch Account</Text></Text>
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
    backgroundColor: '#0A0A0E', // Stunning Deep Black/Purple
  },
  decorCircle1: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    backgroundColor: '#6C5CE7',
    opacity: 0.05,
    top: -width * 0.4,
    left: -width * 0.1,
  },
  decorCircle2: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: '#A29BFE',
    opacity: 0.03,
    bottom: height * 0.1,
    right: -width * 0.3,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 25,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
    marginTop: height * 0.12, // Pushed up 
  },
  lockIcon: {
    marginBottom: 20,
    opacity: 0.8,
    textShadowColor: 'rgba(108, 92, 231, 0.4)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  textWrapper: {
    alignItems: 'center',
  },
  greeting: {
    fontSize: 14,
    color: '#8B87A0',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: 10,
  },
  name: {
    fontSize: 42,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(255, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 15,
  },
  interactionSection: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsWrapper: {
    marginBottom: 50, // Keep space clean
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotBackground: {
    width: 14,
    height: 14,
    marginHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotFilled: {
    width: '100%',
    height: '100%',
    borderRadius: 7,
  },
  keypadWrapper: {
    width: '100%',
    maxWidth: 320,
  },
  keypad: {
    width: '100%',
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  keyButton: {
    width: 80, // Fixed symmetrical size
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)', // Glassy dark
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  keyButtonSpecial: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  keyButtonEmpty: {
    width: 80,
    height: 80,
  },
  keyText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '500',
  },
  footer: {
    paddingVertical: 25,
    alignItems: 'center',
  },
  switchBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  switchText: {
    color: '#8B87A0',
    fontSize: 14,
    fontWeight: '500',
  },
  switchAccent: {
    color: '#6C5CE7',
    fontWeight: '700',
  }
});

