import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, LayoutAnimation, Platform, UIManager, Dimensions, Image } from 'react-native';
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
  const dotAnims = useRef([new Animated.Value(1), new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    checkPin();
    Animated.timing(contentFade, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [user]);

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
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, { opacity: contentFade }]}>

          {/* Unified Vertical Flow */}
          <View style={styles.topSection}>
            <View style={styles.avatarWrapper}>
              <Image
                source={require('../../assets/student-secure-login.png')}
                style={styles.avatarImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.textWrapper}>
              <Text style={styles.greeting}>
                {setupMode 
                  ? (setupStep === 1 ? 'Secure your hub' : 'One more time') 
                  : 'Welcome back,'}
              </Text>
              <Text style={styles.name}>
                {setupMode 
                  ? (setupStep === 1 ? 'Create a PIN' : 'Confirm PIN') 
                  : firstName}
              </Text>
              {setupMode && (
                <Text style={styles.subtitle}>
                  Protects your local vault data & app access.
                </Text>
              )}
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

          {/* Bottom Section - Action */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <Text style={styles.logoutText}>Not you? <Text style={styles.logoutAccent}>Switch Account</Text></Text>
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
    backgroundColor: '#F8F5FF',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  topSection: {
    alignItems: 'center',
    marginTop: height * 0.02,
    marginBottom: 20,
  },
  avatarWrapper: {
    width: width * 0.45,
    height: width * 0.4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  textWrapper: {
    alignItems: 'center',
    marginTop: 5,
    width: '100%',
  },
  greeting: {
    fontSize: 14,
    color: '#8F8A9E',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  name: {
    fontSize: 28,
    color: '#1A1820',
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11,
    color: '#8F8A9E',
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 50,
  },
  interactionSection: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 10,
  },
  dotsWrapper: {
    marginBottom: 30,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(62, 49, 90, 0.1)',
    marginHorizontal: 12,
  },
  dotFilled: {
    backgroundColor: '#3E315A',
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
    width: 75,
    height: 75,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#3E315A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  keyButtonTransparent: {
    width: 75,
    height: 75,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    color: '#3E315A',
    fontSize: 26,
    fontWeight: '700',
  },
  footer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  logoutBtn: {
    padding: 10,
  },
  logoutText: {
    color: '#8F8A9E',
    fontSize: 14,
    fontWeight: '500',
  },
  logoutAccent: {
    color: '#3E315A',
    fontWeight: '800',
  }
});
