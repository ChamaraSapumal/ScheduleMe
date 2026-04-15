import React, { useEffect, useContext, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, 
  ScrollView, Platform, Animated, useWindowDimensions 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCustomAlert } from '../context/AlertContext';
import { AuthContext } from '../context/AuthContext';

import { useTimer } from '../context/TimerContext';

const { width } = Dimensions.get('window');

// Bubbly Pastel Theme Colors
const theme = {
  bg: '#F8F5FF', // Very light purple/white
  card: '#EFE7FE', // Soft lavender bubbly card
  buttonDark: '#1A1820', // Charcoal black
  textMain: '#2D2A3B', // Dark greyish purple
  textMuted: '#8F8A9E', // Gray
  highlight: '#FFFFFF', // White bubbles
};

export default function FocusScreen({ navigation }: any) {
  const { showAlert } = useCustomAlert();
  const { user, userName } = useContext(AuthContext);
  const firstName = userName ? userName.split(' ')[0] : 'Student';
  
  const { timeLeft, isRunning, mode, toggleTimer, resetTimer, switchMode, isDNDEnabled, toggleDND, openSystemDND } = useTimer();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const bounceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(isRunning ? 1 : 0)).current;

  // Bouncing hint animation
  useEffect(() => {
    if (!isRunning && !isLandscape) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, { toValue: -10, duration: 1000, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 1000, useNativeDriver: true })
        ])
      ).start();
    } else {
      bounceAnim.setValue(0);
    }
  }, [isRunning, isLandscape]);

  // Scale & Fade Animation for Transition
  useEffect(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: isLandscape ? 1.2 : 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: isLandscape ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
  }, [isLandscape]);

  const handleJumpToAgenda = async () => {
    navigation.navigate('Agenda');
  };

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');

  if (isLandscape) {
    return (
      <SafeAreaView style={styles.landscapeContainer} edges={['left', 'right']}>
        <StatusBar hidden={isRunning} />
        <View style={styles.landscapeHeader}>
          <TouchableOpacity style={styles.agendaJumpBtn} onPress={handleJumpToAgenda}>
            <MaterialCommunityIcons name="arrow-left" size={18} color={theme.textMain} />
            <Text style={styles.agendaJumpText}>Agenda</Text>
          </TouchableOpacity>

          <View style={styles.smallSegmentedControl}>
            <TouchableOpacity
              style={[styles.smallSegmentBtn, mode === 'FOCUS' && styles.segmentActive]}
              onPress={() => switchMode('FOCUS')}
            >
              <Text style={[styles.smallSegmentText, mode === 'FOCUS' && styles.segmentTextActive]}>Focus</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallSegmentBtn, mode === 'BREAK' && styles.segmentActive]}
              onPress={() => switchMode('BREAK')}
            >
              <Text style={[styles.smallSegmentText, mode === 'BREAK' && styles.segmentTextActive]}>Break</Text>
            </TouchableOpacity>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity 
              style={[styles.smallBellBtn, isDNDEnabled && { backgroundColor: '#EF4444' }]} 
              onPress={() => {
                toggleDND();
                if (!isDNDEnabled) {
                  showAlert({
                    title: 'DND Active! 🔇',
                    message: 'In-app social alerts are now silenced. Use full system silence for better focus?',
                    type: 'info',
                    confirmText: 'Open Settings',
                    showCancel: true,
                    cancelText: 'Keep App-Only',
                    onConfirm: openSystemDND
                  });
                }
              }}
            >
              <MaterialCommunityIcons 
                name={isDNDEnabled ? "minus-circle" : "minus-circle-outline"} 
                size={20} 
                color={isDNDEnabled ? "#FFF" : theme.textMain} 
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.smallBellBtn} onPress={() => showAlert({ title: 'Notifications Enabled', message: 'You will be notified!', type: 'info' })}>
              <MaterialCommunityIcons name="bell-outline" size={20} color={theme.textMain} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.landscapeMainArea} pointerEvents="box-none">
          <Animated.View style={[styles.landscapeTimerArea, { transform: [{ scale: scaleAnim }] }]} pointerEvents="none">
            <Text style={styles.landscapeTimerText}>{minutes}:{seconds}</Text>
            <Text style={styles.landscapeSubText}>{mode === 'FOCUS' ? 'STAY FOCUSED' : 'TIME TO RELAX'}</Text>
          </Animated.View>
        </View>

        <View style={styles.landscapeControls}>
          <TouchableOpacity style={styles.landscapeActionBtn} onPress={resetTimer}>
            <MaterialCommunityIcons name="refresh" size={20} color={theme.textMain} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.landscapeMainBtn} onPress={toggleTimer}>
            <Text style={styles.landscapeMainBtnText}>{isRunning ? 'Pause' : 'Resume'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header section */}
        <View style={styles.header}>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[styles.segmentBtn, mode === 'FOCUS' && styles.segmentActive]}
              onPress={() => switchMode('FOCUS')}
            >
              <Text style={[styles.segmentBtnText, mode === 'FOCUS' && styles.segmentTextActive]}>Focus</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, mode === 'BREAK' && styles.segmentActive]}
              onPress={() => switchMode('BREAK')}
            >
              <Text style={[styles.segmentBtnText, mode === 'BREAK' && styles.segmentTextActive]}>Break</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity 
              style={[styles.bellBtn, isDNDEnabled && { backgroundColor: '#EF4444' }]} 
              onPress={() => {
                toggleDND();
                if (!isDNDEnabled) {
                  showAlert({
                    title: 'Do Not Disturb! 🔇',
                    message: 'Interruptions are now silenced in-app. Want to enable full system silence too?',
                    type: 'info',
                    confirmText: 'System Settings',
                    showCancel: true,
                    cancelText: 'Maybe Later',
                    onConfirm: openSystemDND
                  });
                }
              }}
            >
              <MaterialCommunityIcons 
                name={isDNDEnabled ? "minus-circle" : "minus-circle-outline"} 
                size={24} 
                color={isDNDEnabled ? "#FFF" : theme.textMain} 
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.bellBtn} onPress={() => showAlert({ title: 'Notifications Enabled', message: 'You will be notified when your Pomodoro session completes!', type: 'info' })}>
              <MaterialCommunityIcons name="bell-outline" size={24} color={theme.textMain} />
            </TouchableOpacity>
          </View>
        </View>

        {!isRunning && (
          <View style={styles.titleArea}>
            <Text style={styles.subtitle}>Let's study hard!</Text>
            <Text style={styles.title}>Welcome back,</Text>
            <Text style={[styles.title, { fontWeight: '900' }]}>{firstName}</Text>
          </View>
        )}

        {/* 3D Avatar Image */}
        {!isRunning && (
          <View style={styles.imageContainer}>
            {/* We use require without variables to satisfy the bundler */}
            <Image
              source={require('../../assets/student-studying.png')}
              style={styles.avatarImage}
              resizeMode="contain"
            />
          </View>
        )}

        {!isRunning && (
          <Animated.View style={[styles.scrollHint, { transform: [{ translateY: bounceAnim }] }]}>
            <Text style={styles.scrollHintText}>Swipe up to begin</Text>
            <MaterialCommunityIcons name="chevron-up" size={24} color={theme.textMuted} />
          </Animated.View>
        )}

        {/* Timer Bubble Card */}
        <View style={[styles.timerCard, isRunning && { marginTop: 40 }]}>
          <View style={styles.timerHeader}>
            <MaterialCommunityIcons name="clock-outline" size={20} color={theme.textMuted} />
            <Text style={styles.timerSubText}>{mode === 'FOCUS' ? 'Pomodoro Session' : 'Short Break'}</Text>
          </View>

          <Text style={styles.timerText}>{minutes}:{seconds}</Text>

          <Text style={styles.quoteText}>
            {mode === 'FOCUS' ? 'AI-powered planning that frees you to focus.' : 'Take a deep breath and relax.'}
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={resetTimer}>
              <MaterialCommunityIcons name="refresh" size={28} color={theme.textMain} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.mainBtn} onPress={toggleTimer}>
              <Text style={styles.mainBtnText}>{isRunning ? 'Pause' : 'Get Started'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 110,
  },
  scrollHint: {
    alignItems: 'center',
    marginVertical: 10,
    opacity: 0.6,
  },
  scrollHintText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: -5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 40,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.highlight,
    borderRadius: 30,
    padding: 5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  segmentBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  segmentActive: {
    backgroundColor: theme.buttonDark,
  },
  segmentBtnText: {
    color: theme.textMuted,
    fontWeight: '700',
    fontSize: 14,
  },
  segmentTextActive: {
    color: '#FFF',
  },
  bellBtn: {
    backgroundColor: theme.highlight,
    padding: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  titleArea: {
    paddingHorizontal: 25,
    marginTop: 20,
    zIndex: 2,
  },
  title: {
    fontSize: 32,
    color: theme.textMain,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: theme.textMuted,
    fontWeight: '600',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 250,
    marginTop: -20, // Negative margin to flow into the title
    zIndex: 1,
  },
  avatarImage: {
    width: width * 0.8,
    height: 250,
  },
  timerCard: {
    backgroundColor: theme.card,
    flex: 1,
    minHeight: 300,
    marginTop: 10,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 30,
    alignItems: 'center',
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  timerSubText: {
    marginLeft: 8,
    color: theme.textMain,
    fontWeight: '700',
    fontSize: 14,
  },
  timerText: {
    fontSize: 110,
    fontWeight: '800',
    color: theme.textMain,
    letterSpacing: -2,
    marginVertical: 10,
  },
  quoteText: {
    color: theme.textMuted,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginVertical: 15,
    paddingHorizontal: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 30,
    marginBottom: 20,
  },
  actionBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  mainBtn: {
    flex: 1,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.buttonDark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.buttonDark,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  mainBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },

  // Landscape Styles
  landscapeContainer: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 30,
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  landscapeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    zIndex: 10, // Ensure header is interactive
  },
  smallSegmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.highlight,
    borderRadius: 20,
    padding: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  smallSegmentBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  smallSegmentText: {
    color: theme.textMuted,
    fontWeight: '700',
    fontSize: 12,
  },
  smallBellBtn: {
    backgroundColor: theme.highlight,
    padding: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  landscapeMainArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -40, // Pull up to reduce gap to top
  },
  landscapeTimerArea: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  landscapeTimerText: {
    fontSize: 135, // Slightly smaller to prevent overlap
    fontWeight: '800',
    color: theme.textMain,
    letterSpacing: -5,
  },
  landscapeSubText: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: -10, // Adjusted for larger font
  },
  agendaJumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.highlight,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
    elevation: 2,
  },
  agendaJumpText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.textMain,
  },
  landscapeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingBottom: 5, // Push away from bottom edge
    position: 'absolute',
    bottom: 5,
    left: 0,
    right: 0,
    zIndex: 10, // Ensure controls are interactive
  },
  landscapeActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  landscapeMainBtn: {
    width: 130,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.buttonDark,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  landscapeMainBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
