import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, LayoutAnimation, Platform, UIManager, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { colors, spacing } from '../theme';

// Premium Lock Screen UI Overhaul
// Improved with radial depth and glassmorphic elements

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
  const radialAnim = useRef(new Animated.Value(0)).current;

  // Key press scale animations
  const keyScaleAnims = useRef<{[key: string]: Animated.Value}>({}).current;
  ['1','2','3','4','5','6','7','8','9','0','biometric','delete'].forEach(key => {
    if (!keyScaleAnims[key]) keyScaleAnims[key] = new Animated.Value(1);
  });

  useEffect(() => {
    checkPin();
    Animated.parallel([
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(radialAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    ]).start();
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
      tension: 50,
      useNativeDriver: true,
    }).start();
  };

  const animateKeyPress = (key: string) => {
    Animated.sequence([
        Animated.timing(keyScaleAnims[key], { toValue: 0.9, duration: 80, useNativeDriver: true }),
        Animated.timing(keyScaleAnims[key], { toValue: 1, duration: 120, useNativeDriver: true }),
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
                    opacity: dotAnims[i],
                    transform: [{ 
                        scale: dotAnims[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.5, 1.2]
                        }) 
                    }] 
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
                        activeOpacity={0.6}
                    >
                        {keyStr === 'biometric' && (
                            <MaterialCommunityIcons name="fingerprint" size={36} color={colors.primary} />
                        )}
                        {keyStr === 'delete' && (
                            <MaterialCommunityIcons name="backspace-outline" size={28} color={colors.textSecondary} />
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
      {/* Radial Depth Background */}
      <Animated.View 
        style={[
            styles.radialGlow, 
            { opacity: radialAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }
        ]} 
      />
      
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.content, { opacity: contentFade }]}>

          {/* Unified Vertical Flow */}
          <View style={styles.topSection}>
            <View style={styles.avatarOuter}>
                <View style={styles.avatarWrapper}>
                <Image
                    source={require('../../assets/student-secure-login.png')}
                    style={styles.avatarImage}
                    resizeMode="contain"
                />
                </View>
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
              {!setupMode && <View style={styles.indicator} />}
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
  radialGlow: {
    position: 'absolute',
    top: -height * 0.1,
    left: -width * 0.2,
    width: width * 1.4,
    height: width * 1.4,
    borderRadius: width * 0.7,
    backgroundColor: colors.accent,
    opacity: 0.1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
    marginTop: height * 0.04,
  },
  avatarOuter: {
    padding: 10,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#3E315A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 2,
    marginBottom: 15,
  },
  avatarWrapper: {
    width: width * 0.4,
    height: width * 0.35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  textWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  greeting: {
    fontSize: 13,
    color: '#8F8A9E',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  name: {
    fontSize: 34,
    color: '#1A1820',
    fontWeight: '900',
    letterSpacing: -1.5,
    marginTop: 2,
    textAlign: 'center',
  },
  indicator: {
    width: 30,
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginTop: 10,
    opacity: 0.3,
  },
  interactionSection: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsWrapper: {
    marginBottom: 40,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotBackground: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(62, 49, 90, 0.08)',
    marginHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(62, 49, 90, 0.03)',
  },
  dotFilled: {
    width: 12,
    height: 12,
    borderRadius: 6,
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
    marginBottom: 25,
  },
  keyButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#3E315A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  keyButtonSpecial: {
    width: 78,
    height: 78,
    borderRadius: 39,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyButtonEmpty: {
    width: 78,
    height: 78,
  },
  keyText: {
    color: '#3E315A',
    fontSize: 30,
    fontWeight: '700',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  logoutBtn: {
    padding: 15,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  logoutText: {
    color: '#8F8A9E',
    fontSize: 13,
    fontWeight: '600',
  },
  logoutAccent: {
    color: '#3E315A',
    fontWeight: '900',
  }
});
