import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Easing } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

const { width, height } = Dimensions.get('window');

const TOUR_STEPS = [
  {
    target: 'Agenda',
    title: 'YOUR SCHEDULE',
    description: 'Welcome to your private agenda. Track all your daily classes here securely.',
    position: { top: 180, alignSelf: 'center' },
    arrowDirection: 'none',
  },
  {
    target: 'Agenda',
    title: 'ADD A CLASS',
    description: 'Tap the + icon in the top right at any time to schedule a new lecture or lab.',
    position: { top: 90, right: 30 },
    arrowDirection: 'up',
  },
  {
    target: 'Calendar',
    title: 'MONTHLY OVERVIEW',
    description: 'Switch to the calendar to see your entire month. Public holidays are automatically marked.',
    position: { bottom: 100, left: width * 0.2 },
    arrowDirection: 'down',
  },
  {
    target: 'Words',
    title: 'PERSONAL DICTIONARY',
    description: 'Discover a new engineering term? Save it in your local dictionary and review it daily.',
    position: { bottom: 100, alignSelf: 'center' },
    arrowDirection: 'down',
  },
  {
    target: 'Tools',
    title: 'DAILY GROWTH',
    description: 'Access tools and daily knowledge, like AI news and space facts, to grow every day.',
    position: { bottom: 100, right: width * 0.25 },
    arrowDirection: 'down',
  },
  {
    target: 'Profile',
    title: 'SECURE VAULT',
    description: 'Manage your local vault, setup App Updates via GitHub, and verify your ID.',
    position: { bottom: 100, right: 30 },
    arrowDirection: 'down',
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
      // Small timeout fixes React Navigation crash on mount
      setTimeout(() => {
        // Handle deeply nested navigation
        navigation.navigate('MainTabs', { screen: TOUR_STEPS[currentStep].target });
        
        // Reset animations
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
             <View style={styles.cardHeader}>
               <MaterialCommunityIcons name="star-four-points" size={20} color={colors.primary} style={{ marginRight: 8 }} />
               <Text style={styles.title}>{step.title}</Text>
             </View>
             
             <Text style={styles.description}>{step.description}</Text>
             
             <View style={styles.footer}>
                <Text style={styles.stepCounter}>{currentStep + 1} / {TOUR_STEPS.length}</Text>
                
                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                   <Text style={styles.nextText}>
                      {currentStep === TOUR_STEPS.length - 1 ? "GOT IT!" : "NEXT"}
                   </Text>
                   {currentStep !== TOUR_STEPS.length - 1 && (
                     <MaterialCommunityIcons name="arrow-right" size={18} color="#000" />
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
    backgroundColor: '#FFFFFF', // Clean White
    padding: spacing.l,
    borderRadius: 24, // Soft elegant curve
    borderWidth: 1, // Elegant styling
    borderColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.s,
  },
  title: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  description: {
    color: '#4A4A4A', // Softer black/gray text
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: spacing.l,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.s,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  stepCounter: {
    color: '#A3947D', // Beige Secondary Color
    fontWeight: 'bold',
    fontSize: 13,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D9BC67', // Mustard Primary Color
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#D9BC67',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  nextText: {
    color: '#000',
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
