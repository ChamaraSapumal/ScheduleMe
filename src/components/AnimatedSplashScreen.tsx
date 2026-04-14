import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing, Image } from 'react-native';
import { colors } from '../theme';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  isAppReady: boolean;
  onFinish: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ isAppReady, onFinish }) => {
  const letters = "ScheduleMe".split("");
  
  // Animation values
  const letterAnims = useRef(letters.map(() => new Animated.Value(0))).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslate = useRef(new Animated.Value(50)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const squareTranslates = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;
  
  // Floating orb animations for glassmorphism effect
  const orb1Translate = useRef(new Animated.Value(0)).current;
  const orb2Translate = useRef(new Animated.Value(0)).current;

  const minTimeElapsed = useRef(false);
  const dataReady = useRef(isAppReady);
  const isExiting = useRef(false);
  const sequenceFinished = useRef(false);
  const loopAnim = useRef<Animated.CompositeAnimation | null>(null);

  const checkAndExit = () => {
    if (minTimeElapsed.current && dataReady.current && sequenceFinished.current && !isExiting.current) {
      isExiting.current = true;
      
      if (loopAnim.current) {
          loopAnim.current.stop();
      }

      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }
  };

  useEffect(() => {
    dataReady.current = isAppReady;
    checkAndExit();
  }, [isAppReady]);

  useEffect(() => {
    // 2.5 second minimum display - fast, snappy, and premium
    const minimumTimer = setTimeout(() => {
        minTimeElapsed.current = true;
        checkAndExit();
    }, 2500);

    // Dynamic looping background elements
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(orb1Translate, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orb1Translate, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(orb2Translate, { toValue: 1, duration: 5500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orb2Translate, { toValue: 0, duration: 5500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ])
    ).start();

    // Intro Animation Sequence
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
        Animated.spring(logoTranslate, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
      Animated.stagger(50, letterAnims.map(anim => 
        Animated.spring(anim, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true })
      )),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 800, useNativeDriver: true })
    ]).start(() => {
      sequenceFinished.current = true;
      
      // 5-square staggering wave animation
      loopAnim.current = Animated.loop(
        Animated.stagger(100, squareTranslates.map(anim => 
          Animated.sequence([
            Animated.timing(anim, { toValue: -10, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            Animated.delay(600)
          ])
        ))
      );
      loopAnim.current.start();
      
      checkAndExit();
    });

    return () => clearTimeout(minimumTimer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      {/* Blurred Orbs representing Neo-Brutalism/Glassmorphism blend */}
      <Animated.View style={[
        styles.orb1, 
        { transform: [{ translateY: orb1Translate.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) }] }
      ]} />
      <Animated.View style={[
        styles.orb2, 
        { transform: [{ translateX: orb2Translate.interpolate({ inputRange: [0, 1], outputRange: [0, 60] }) }] }
      ]} />
      
      <View style={styles.blurOverlay} />

      <View style={styles.content}>
        <Animated.View style={[
            styles.logoWrapper,
            { 
              opacity: logoOpacity,
              transform: [{ scale: logoScale }, { translateY: logoTranslate }]
            }
        ]}>
          <Image 
            source={require('../../assets/icon.png')} 
            style={styles.appIcon} 
            resizeMode="cover" 
          />
        </Animated.View>

        <View style={styles.letterContainer}>
          {letters.map((char, index) => (
            <Animated.Text
              key={index}
              style={[
                styles.letter,
                {
                  opacity: letterAnims[index],
                  transform: [
                    { translateY: letterAnims[index].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                    { scale: letterAnims[index].interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }
                  ]
                }
              ]}
            >
              {char}
            </Animated.Text>
          ))}
        </View>
        
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Elevate Your Productivity
        </Animated.Text>

        <Animated.View style={[styles.squaresContainer, { opacity: taglineOpacity }]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Animated.View 
               key={i} 
               style={[
                 styles.loadingSquare, 
                 { transform: [{ translateY: squareTranslates[i] }] }
               ]} 
            />
          ))}
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F0C1B', // Immersive deep background
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
    overflow: 'hidden',
  },
  orb1: {
    position: 'absolute',
    width: width,
    height: width,
    borderRadius: width / 2,
    backgroundColor: 'rgba(123, 77, 255, 0.15)', // Vibrant primary glow
    top: -height * 0.15,
    left: -width * 0.25,
  },
  orb2: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    backgroundColor: 'rgba(210, 185, 255, 0.1)', // Soft secondary glow
    bottom: -height * 0.2,
    right: -width * 0.4,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 12, 27, 0.3)', // Mix background & orbs
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoWrapper: {
    marginBottom: 50,
    shadowColor: '#9C72FF',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 35,
    elevation: 30, // Stand out heavily
    backgroundColor: '#FFFFFF',
    borderRadius: 36, // Sleek squircle
    padding: 3,
  },
  appIcon: {
    width: 130,
    height: 130,
    borderRadius: 33, // Match padding and wrapper border radius elegantly
  },
  letterContainer: {
    flexDirection: 'row',
  },
  letter: {
    fontSize: 46,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    textShadowColor: 'rgba(255, 255, 255, 0.25)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 15,
  },
  tagline: {
    marginTop: 20,
    fontSize: 13,
    color: '#D2B9FF', // Subtle pastel purple accent
    fontWeight: '800',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  squaresContainer: {
    flexDirection: 'row',
    marginTop: 35,
    gap: 8,
  },
  loadingSquare: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#D2B9FF',
    opacity: 0.8,
  }
});
