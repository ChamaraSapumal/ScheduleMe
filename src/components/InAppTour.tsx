import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Easing, Image } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
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
    subTarget: 'Astro',
    title: 'STELLAR EXPLORER',
    description: 'Need a study break? Watch real-time satellite positions orbiting above you.',
    position: { top: 150, alignSelf: 'center' },
    arrowDirection: 'none',
  },
  {
    target: 'Tools',
    subTarget: 'Knowledge',
    title: 'DAILY WIKI',
    description: 'Discover something new every day with curated interesting articles and facts.',
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
  }
];

export default function InAppTour() {
  const { hasSeenOnboarding, completeOnboarding } = useContext(AuthContext);
  const navigation = useNavigation<NavigationProp<any>>();
  const [currentStep, setCurrentStep] = useState(0);
  
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (hasSeenOnboarding === false && TOUR_STEPS[currentStep]) {
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
  }, [currentStep, hasSeenOnboarding]);

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

  if (hasSeenOnboarding !== false) return null;

  const step = TOUR_STEPS[currentStep];

  const handleNext = async () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await completeOnboarding();
      navigation.navigate('MainTabs', { screen: 'Agenda' }); 
    }
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

          <View style={styles.card}>
             <View style={styles.charContainer}>
                <Image 
                  source={require('../../assets/in_app_tour.png')} 
                  style={styles.charImage} 
                  resizeMode="contain"
                />
             </View>

             <View style={styles.cardHeader}>
               <Text style={styles.title}>{step.title}</Text>
             </View>
             
             <Text style={styles.description}>{step.description}</Text>
             
             <View style={styles.footer}>
                <Text style={styles.stepCounter}>{currentStep + 1} / {TOUR_STEPS.length}</Text>
                
                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                   <Text style={styles.nextText}>
                      {currentStep === TOUR_STEPS.length - 1 ? "FINISH" : "NEXT"}
                   </Text>
                   {currentStep !== TOUR_STEPS.length - 1 && (
                     <MaterialCommunityIcons name="arrow-right" size={18} color="#FFF" />
                   )}
                </TouchableOpacity>
             </View>
          </View>

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
  }
});
