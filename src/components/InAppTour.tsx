import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Easing, Image } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

const { width, height } = Dimensions.get('window');

const TOUR_STEPS = [
  {
    target: 'Agenda',
    title: 'WELCOME STUDENT!',
    description: 'I am here to guide you. This is your personal hub where your university life becomes organized.',
    position: { top: 150, alignSelf: 'center' },
    arrowDirection: 'none',
  },
  {
    target: 'Agenda',
    title: 'YOUR SCHEDULE',
    description: 'Track all your daily classes, labs, and lectures here. Keep your day structured!',
    position: { top: height * 0.4, alignSelf: 'center' },
    arrowDirection: 'none',
  },
  {
    target: 'Calendar',
    title: 'MONTHLY HUB',
    description: 'Plan ahead with a full monthly view. We automatically mark public holidays for you.',
    position: { bottom: 120, left: width * 0.1 },
    arrowDirection: 'down',
  },
  {
    target: 'Words',
    title: 'SMART DICTIONARY',
    description: 'Found a complex term in a lecture? Save it here to build your academic vocabulary.',
    position: { bottom: 120, alignSelf: 'center' },
    arrowDirection: 'down',
  },
  {
    target: 'Focus',
    title: 'POMODORO POWER',
    description: 'Boost your productivity with my 25-minute study timer. Focus hard, then take a short break!',
    position: { bottom: 120, alignSelf: 'center' },
    arrowDirection: 'down',
  },
  {
    target: 'Tools',
    title: 'DEVELOPMENT HUB',
    description: 'The heart of the app. This is where you access all your advanced student tools.',
    position: { bottom: 120, right: width * 0.05 },
    arrowDirection: 'down',
  },
  {
    target: 'Tools',
    subTarget: 'Attendance',
    title: 'ELIGIBILITY TRACKER',
    description: 'Never miss an exam! I will warn you if your attendance drops below 80%.',
    position: { top: 150, alignSelf: 'center' },
    arrowDirection: 'none',
  },
  {
    target: 'Tools',
    subTarget: 'My profile',
    title: 'SECURE PROFILE',
    description: 'Set your name, update your photo, and manage your security vault settings here.',
    position: { top: height * 0.25, alignSelf: 'center' },
    arrowDirection: 'none',
  },
  {
    target: 'Agenda',
    title: 'OFFLINE SCHEDULE',
    description: 'Can we securely save your schedule directly on your phone? This allows you to view your classes without an internet connection. We will auto-sync with the cloud when you connect.',
    position: { top: height * 0.25, alignSelf: 'center' },
    arrowDirection: 'none',
    isStoragePrompt: true,
  }
];

export default function InAppTour() {
  const { hasSeenOnboarding, completeOnboarding, user, isUnlocked } = useContext(AuthContext);
  const navigation = useNavigation<NavigationProp<any>>();
  const [currentStep, setCurrentStep] = useState(0);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Only attempt navigation and animation if the user is in the app and tour is active
    if (hasSeenOnboarding === false && isUnlocked && user && TOUR_STEPS[currentStep]) {
      setTimeout(() => {
        const step = TOUR_STEPS[currentStep];
        if (step.subTarget) {
          navigation.navigate('MainTabs', {
            screen: step.target,
            params: { screen: step.subTarget }
          });
        } else {
          navigation.navigate('MainTabs', { screen: step.target });
        }

        fadeAnim.setValue(0);
        scaleAnim.setValue(0.9);

        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
          })
        ]).start();
      }, 300);
    }
  }, [currentStep, hasSeenOnboarding, isUnlocked, user]);

  // Subtle breathing pulse for the arrow
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  if (hasSeenOnboarding !== false || !isUnlocked || !user) return null;

  const step = TOUR_STEPS[currentStep];

  const handleNext = async () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Not storage prompt, should never hit this ideally but fallback
      await completeOnboarding();
      navigation.navigate('MainTabs', { screen: 'Agenda' });
    }
  };

  const handleAgreeStorage = async () => {
    await AsyncStorage.setItem('@offline_sync_enabled', 'true');
    await completeOnboarding();
    navigation.navigate('MainTabs', { screen: 'Tools', params: { screen: 'My profile' } });
  };

  const handleDeclineStorage = async () => {
    await AsyncStorage.setItem('@offline_sync_enabled', 'false');
    await completeOnboarding();
    navigation.navigate('MainTabs', { screen: 'Tools', params: { screen: 'My profile' } });
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Soft dark translucent mask */}
      <View style={styles.backdrop} />

      {/* Floating tooltip box dynamically positioned */}
      <Animated.View
        style={[
          styles.tooltipContainer,
          step.position as any,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
        ]}
      >
        {step.arrowDirection === 'up' && (
          <Animated.View style={[styles.arrowUp, { transform: [{ scale: pulseAnim }] }]} />
        )}

        {(step as any).isStoragePrompt ? (
          <View style={[styles.card, styles.storageCard]}>
            <View style={styles.storageImageWrapper}>
              <Image
                source={require('../../assets/storage-permission.png')}
                style={styles.storageImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.storageContent}>
              <Text style={styles.storageTitle}>OFFLINE MODE</Text>
              <Text style={styles.storageDesc}>
                Can we securely save your schedule directly on your phone?
                This allows you to view your classes without an internet connection.
              </Text>

              <View style={styles.storageFooter}>
                <TouchableOpacity style={styles.declineButton} onPress={handleDeclineStorage}>
                  <Text style={styles.declineText}>NOT NOW</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.enableButton} onPress={handleAgreeStorage}>
                  <Text style={styles.enableText}>ENABLE MODE</Text>
                  <MaterialCommunityIcons name="lightning-bolt" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.charContainer}>
              <Image
                source={require('../../assets/in-app-tour.png')}
                style={styles.charImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.cardHeader}>
              <Text style={styles.title}>{step.title}</Text>
            </View>

            <Text style={styles.description}>{step.description}</Text>

            <View style={styles.footer}>
              <Text style={styles.stepCounter}>{currentStep + 1} / {TOUR_STEPS.length - 1}</Text>

              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Text style={styles.nextText}>
                  {currentStep === TOUR_STEPS.length - 2 ? "FINISH" : "NEXT"}
                </Text>
                {currentStep !== TOUR_STEPS.length - 2 && (
                  <MaterialCommunityIcons name="arrow-right" size={18} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step.arrowDirection === 'down' && (
          <Animated.View style={[styles.arrowDown, { transform: [{ scale: pulseAnim }] }]} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)', // Not too harsh, soft black mask
  },
  tooltipContainer: {
    position: 'absolute',
    width: width * 0.8,
    zIndex: 9999,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    padding: spacing.l,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(62, 49, 90, 0.1)',
    shadowColor: '#3E315A',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 10,
  },
  charContainer: {
    alignItems: 'center',
    marginBottom: 10,
    marginTop: -height * 0.15, // Floating he's telling style
  },
  charImage: {
    width: 200,
    height: 200,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.s,
  },
  title: {
    color: '#3E315A',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  description: {
    color: '#6F6B7D',
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.l,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.m,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  stepCounter: {
    color: '#8F8A9E',
    fontWeight: 'bold',
    fontSize: 14,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3E315A',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 20,
    shadowColor: '#3E315A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    marginRight: 4,
  },
  arrowUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 16,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
    marginBottom: -1,
    alignSelf: 'flex-end',
    marginRight: 35,
  },
  arrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 16,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    marginTop: -1,
    alignSelf: 'center',
  },
  storageCard: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  storageImageWrapper: {
    width: '100%',
    height: 180,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 10,
  },
  storageImage: {
    width: 140,
    height: 140,
    borderRadius: 70, // Clips the gray background into a perfect circle
    borderWidth: 4,
    borderColor: '#F8F5FF',
  },
  storageContent: {
    padding: 25,
    alignItems: 'center',
  },
  storageTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#3E315A',
    marginBottom: 8,
    textAlign: 'center',
  },
  storageDesc: {
    fontSize: 14,
    color: '#6F6B7D',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 25,
    paddingHorizontal: 10,
  },
  storageFooter: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    color: '#8F8A9E',
    fontWeight: '800',
    fontSize: 13,
  },
  enableButton: {
    flex: 1.5,
    flexDirection: 'row',
    backgroundColor: '#3E315A',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3E315A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  enableText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    marginRight: 6,
  }
});
