import React, { useState, useRef, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions, Platform, PanResponder } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTimer } from '../context/TimerContext';
import { useCustomAlert } from '../context/AlertContext';
import { AuthContext } from '../context/AuthContext';
import { useAppUpdate } from '../components/AppUpdater';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import Svg, { Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');

const CircularProgress = ({ progress, size = 30, icon = "timer-outline", color = colors.accent }: { progress: number, size?: number, icon?: string, color?: string }) => {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }], backgroundColor: 'transparent' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <MaterialCommunityIcons name={icon as any} size={size * 0.55} color={color} />
    </View>
  );
};

export const DynamicIsland = ({ currentRoute }: { currentRoute: string | null }) => {
  const { user, isUnlocked } = useContext(AuthContext);
  const { timeLeft, totalTime, isRunning, mode, toggleTimer, resetTimer } = useTimer();
  const { activeAlert, hideAlert } = useCustomAlert();
  const { isDownloading, downloadProgress, cancelDownload, latestVersion } = useAppUpdate();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [islandMode, setIslandMode] = useState<'TIMER' | 'ALERT' | 'UPDATE'>('TIMER');
  
  const progress = timeLeft / totalTime;
  const autoHideTimer = useRef<NodeJS.Timeout | null>(null);

  const isTimerModeVisible = isRunning && 
    user &&
    isUnlocked &&
    currentRoute && 
    currentRoute !== 'Focus';

  const isAlertActive = !!activeAlert;
  const isIslandVisible = isTimerModeVisible || isAlertActive || isDownloading;

  const widthAnim = useRef(new Animated.Value(150)).current;
  const heightAnim = useRef(new Animated.Value(32)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isDownloading) {
        setIslandMode('UPDATE');
        if (!isExpanded && !isDownloading) setIsExpanded(false);
    } else if (activeAlert) {
        setIslandMode('ALERT');
        setIsExpanded(false);
        translateY.setValue(-100);
        Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            tension: 40,
            useNativeDriver: false
        }).start();

        if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
        autoHideTimer.current = setTimeout(() => {
            hideAlert();
        }, 7000);
    } else {
        setIslandMode('TIMER');
        Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: false
        }).start();
    }
  }, [activeAlert, isDownloading]);

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: isIslandVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();

    if (!isIslandVisible && isExpanded) {
        setIsExpanded(false);
    }
  }, [isIslandVisible]);

  useEffect(() => {
    let targetWidth = 150;
    let targetHeight = 40;

    if (isExpanded) {
        targetWidth = width * 0.94;
        if (islandMode === 'ALERT') {
            targetHeight = activeAlert?.showCancel ? 160 : 120;
        } else if (islandMode === 'TIMER') {
            targetHeight = 85;
        } else if (islandMode === 'UPDATE') {
            targetHeight = 110;
        }
    } else if (isIslandVisible) {
        targetWidth = (islandMode === 'ALERT' || islandMode === 'UPDATE') ? 240 : 210;
        targetHeight = 40;
    }

    Animated.parallel([
      Animated.spring(widthAnim, {
        toValue: targetWidth,
        friction: 8,
        tension: 40,
        useNativeDriver: false,
      }),
      Animated.spring(heightAnim, {
        toValue: targetHeight,
        friction: 8,
        tension: 40,
        useNativeDriver: false,
      })
    ]).start();
  }, [isExpanded, isIslandVisible, islandMode, activeAlert]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return (islandMode === 'ALERT' || islandMode === 'UPDATE') && gestureState.dy < -10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
            translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -30) {
            Animated.timing(translateY, {
                toValue: -150,
                duration: 250,
                useNativeDriver: false
            }).start(() => {
                if (islandMode === 'ALERT') hideAlert();
                else if (islandMode === 'UPDATE') cancelDownload();
                translateY.setValue(0);
            });
        } else {
            Animated.spring(translateY, {
                toValue: 0,
                friction: 8,
                useNativeDriver: false
            }).start();
        }
      }
    })
  ).current;

  const [shouldRender, setShouldRender] = useState(false);
  useEffect(() => {
    if (isIslandVisible) {
        setShouldRender(true);
    } else {
        const timer = setTimeout(() => setShouldRender(false), 300);
        return () => clearTimeout(timer);
    }
  }, [isIslandVisible]);

  if (!shouldRender) return null;

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');
  
  const getAlertColor = () => {
    switch (activeAlert?.type) {
      case 'success': return colors.success;
      case 'warning': return '#F59E0B';
      case 'error': return colors.error;
      default: return colors.accent;
    }
  };

  const getAlertIcon = () => {
    switch (activeAlert?.type) {
      case 'success': return 'check-circle';
      case 'warning': return 'alert';
      case 'error': return 'close-circle';
      default: return 'information';
    }
  };

  return (
    <View style={styles.outerContainer} pointerEvents="box-none">
      {isExpanded && (
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={() => setIsExpanded(false)} 
        />
      )}
      <Animated.View 
        {...panResponder.panHandlers}
        style={[
            styles.islandPill,
            { 
                width: widthAnim, 
                height: heightAnim, 
                opacity: opacityAnim,
                transform: [{ translateY }]
            }
        ]}
      >
        <BlurView 
            intensity={90} 
            tint="dark" 
            style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]} />
        
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={toggleExpand} 
          style={styles.touchArea}
        >
          {islandMode === 'TIMER' && (
            !isExpanded ? (
                <View style={styles.pillContent}>
                  <CircularProgress progress={progress} size={32} />
                  <Text style={styles.pillText}>{minutes}:{seconds}</Text>
                </View>
              ) : (
                <View style={styles.expandedContent}>
                  <View style={styles.expandedInfo}>
                    <Text style={styles.expandedMode}>{mode === 'FOCUS' ? 'Focus' : 'Break'} Session</Text>
                    <Text style={styles.expandedTime}>{minutes}:{seconds}</Text>
                  </View>
                  <View style={styles.controls}>
                    <TouchableOpacity style={styles.controlBtn} onPress={toggleTimer}>
                      <MaterialCommunityIcons name={isRunning ? "pause" : "play"} size={22} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.controlBtn, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]} onPress={resetTimer}>
                      <MaterialCommunityIcons name="refresh" size={22} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              )
          )}

          {islandMode === 'ALERT' && (
            !isExpanded ? (
                <View style={styles.pillContent}>
                  <MaterialCommunityIcons name={getAlertIcon() as any} size={24} color={getAlertColor()} />
                  <Text style={styles.alertPillText} numberOfLines={1}>{activeAlert?.title}</Text>
                </View>
            ) : (
                <View style={styles.expandedAlertContent}>
                    <View style={styles.alertHeader}>
                        <MaterialCommunityIcons name={getAlertIcon() as any} size={28} color={getAlertColor()} />
                        <Text style={styles.expandedAlertTitle}>{activeAlert?.title}</Text>
                    </View>
                    <Text style={styles.expandedAlertMessage}>{activeAlert?.message}</Text>
                    
                    {activeAlert?.onConfirm && (
                      <View style={styles.alertActions}>
                        {activeAlert.showCancel && (
                          <TouchableOpacity 
                            style={[styles.btnAction, styles.btnSecondary]} 
                            onPress={() => {
                              hideAlert();
                              setIsExpanded(false);
                            }}
                          >
                            <Text style={styles.btnSecondaryText}>{activeAlert.cancelText || 'Cancel'}</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                          style={[styles.btnAction, styles.btnPrimary]} 
                          onPress={() => {
                            activeAlert.onConfirm?.();
                            hideAlert();
                            setIsExpanded(false);
                          }}
                        >
                          <Text style={styles.btnPrimaryText}>{activeAlert.confirmText || 'Confirm'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                </View>
            )
          )}

          {islandMode === 'UPDATE' && (
            !isExpanded ? (
                <View style={styles.pillContent}>
                  <CircularProgress progress={downloadProgress} size={32} icon="cloud-download-outline" color="#3ABEFF" />
                  <Text style={styles.pillText}>{Math.round(downloadProgress * 100)}%</Text>
                </View>
            ) : (
                <View style={styles.expandedContent}>
                   <View style={styles.expandedInfo}>
                    <Text style={styles.expandedMode}>Updating to v{latestVersion}</Text>
                    <Text style={styles.expandedTime}>{Math.round(downloadProgress * 100)}%</Text>
                  </View>
                  <View style={styles.controls}>
                    <TouchableOpacity style={[styles.controlBtn, { backgroundColor: '#FF6B6B' }]} onPress={cancelDownload}>
                      <MaterialCommunityIcons name="close" size={22} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
            )
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  backdrop: {
    position: 'absolute',
    top: -500,
    left: -500,
    width: width * 5,
    height: 3000,
    backgroundColor: 'transparent',
  },
  islandPill: {
    borderRadius: 25,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  touchArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    backgroundColor: 'transparent',
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
  pillText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
    backgroundColor: 'transparent',
  },
  alertPillText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
    marginLeft: 12,
    backgroundColor: 'transparent',
  },
  expandedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
  },
  expandedInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  expandedMode: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    backgroundColor: 'transparent',
  },
  expandedTime: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
    backgroundColor: 'transparent',
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedAlertContent: {
    width: '100%',
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  expandedAlertTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 10,
    backgroundColor: 'transparent',
  },
  expandedAlertMessage: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    backgroundColor: 'transparent',
    marginBottom: 15,
  },
  alertActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 5,
  },
  btnAction: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.accent,
  },
  btnSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  btnPrimaryText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  btnSecondaryText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  }
});
