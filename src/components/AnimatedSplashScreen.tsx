import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { colors } from '../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  onFinish: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ onFinish }) => {
  const letters = "ScheduleMe".split("");
  
  // Animation values for each letter
  const letterAnims = useRef(letters.map(() => new Animated.Value(0))).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoRotateX = useRef(new Animated.Value(0)).current;
  const logoRotateY = useRef(new Animated.Value(0)).current;
  const logoShadow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Logo Entrance and 3D Spin
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: false, // Changed to false to match shadow animation
        }),
        Animated.timing(logoRotateX, {
            toValue: 1,
            duration: 1000,
            easing: Easing.out(Easing.back(1.5)),
            useNativeDriver: false, // Changed to false to match shadow animation
        }),
        Animated.timing(logoShadow, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
        })
      ]),
      // 2. Staggered Letter Assembly
      Animated.stagger(80, letterAnims.map(anim => 
        Animated.spring(anim, {
            toValue: 1,
            friction: 7,
            tension: 50,
            useNativeDriver: true, // Letters can stay on native driver as they don't animate shadows
        })
      )),
      // 3. Pause and Fade Out
      Animated.delay(800),
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start(() => {
      onFinish();
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <View style={styles.content}>
        {/* Core Modern Logo (Square/Bolt concept) */}
        <Animated.View style={[
            styles.logoContainer,
            { 
                transform: [
                    { scale: logoScale },
                    { rotateX: logoRotateX.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
                    { rotateY: logoRotateX.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
                ],
                shadowOpacity: logoShadow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] })
            }
        ]}>
          <View style={styles.squareLogo}>
            <MaterialCommunityIcons name="flash" size={60} color={colors.accent} />
          </View>
        </Animated.View>

        {/* Letter Assembly */}
        <View style={styles.letterContainer}>
          {letters.map((char, index) => (
            <Animated.Text
              key={index}
              style={[
                styles.letter,
                {
                  opacity: letterAnims[index],
                  transform: [
                    { translateY: letterAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0]
                    })},
                    { scale: letterAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.5, 1]
                    })}
                  ]
                }
              ]}
            >
              {char}
            </Animated.Text>
          ))}
        </View>
        <Text style={styles.tagline}>The Ultimate Student Companion</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 20,
  },
  squareLogo: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterContainer: {
    flexDirection: 'row',
  },
  letter: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -2,
  },
  tagline: {
    marginTop: 15,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  }
});
