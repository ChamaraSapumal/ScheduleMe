import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions, Share, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { ref, get, onValue, set, off } from 'firebase/database';
import { db } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';

const { width, height } = Dimensions.get('window');

const theme = {
  primary: '#3E315A',
  background: '#F8F5FF',
  white: '#FFFFFF',
  accent: '#D2B9FF',
  textMain: '#1A1820',
  textMuted: '#8F8A9E'
};

export default function ShareTimetableScreen({ navigation }: any) {
  const { user } = useContext(AuthContext);
  const { showAlert } = useCustomAlert();
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState<string | null>(null);
  
  // Thank you celebration state
  const [showThanks, setShowThanks] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    generateShareData();
    setupSyncListener();
    
    return () => {
        if (user) off(ref(db, `shares/${user.uid}/status`));
    };
  }, []);

  const setupSyncListener = () => {
    if (!user) return;
    const statusRef = ref(db, `shares/${user.uid}/status`);
    onValue(statusRef, (snapshot) => {
      const status = snapshot.val();
      if (status === 'thanks') {
        triggerCelebration();
      }
    });
  };

  const triggerCelebration = () => {
    setShowThanks(true);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      })
    ]).start();

    // Auto-dismiss after 3.5 seconds
    setTimeout(() => {
      dismissCelebration();
    }, 3500);
  };

  const dismissCelebration = () => {
     Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(async () => {
        setShowThanks(false);
        if (user) {
            // Clear the status in Firebase
            await set(ref(db, `shares/${user.uid}/status`), null);
        }
      });
  };

  const generateShareData = async () => {
    if (!user) return;
    try {
      const coursesRef = ref(db, 'courses');
      const snapshot = await get(coursesRef);
      const sharedCourses: any[] = [];
      
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          if (data.userId === user.uid && data.isRecurring) {
            sharedCourses.push({
              m: data.moduleName,
              t: data.type,
              d: data.dayOfWeek,
              s: data.startTime,
              e: data.endTime,
              l: data.location,
              isR: true
            });
          }
        });
      }

      if (sharedCourses.length === 0) {
        setLoading(false);
        return;
      }

      const payload = JSON.stringify({
        type: 'SM_TIMETABLE',
        v: 1,
        u: user.uid, // Sender UID for signaling
        author: user.displayName || 'Friend',
        data: sharedCourses
      });
      
      setQrData(payload);
    } catch (error) {
      console.error(error);
      showAlert({ title: 'Error', message: 'Failed to generate sharing data.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Schedule</Text>
        <View style={{ width: 45 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="qrcode-scan" size={32} color={theme.primary} />
          <Text style={styles.infoText}>
            Ask your friend to scan this code to instantly sync your weekly timetable.
          </Text>
        </View>

        <View style={styles.qrWrapper}>
          <View style={styles.qrBackground}>
            {loading ? (
              <ActivityIndicator size="large" color={theme.primary} />
            ) : qrData ? (
              <View style={styles.qrContainer}>
                <QRCode
                  value={qrData}
                  size={width * 0.65}
                  color={theme.primary}
                  backgroundColor="transparent"
                  logo={require('../../assets/icon.png')}
                  logoSize={40}
                  logoBackgroundColor='white'
                  logoBorderRadius={10}
                />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="calendar-blank" size={50} color={theme.textMuted} />
                <Text style={styles.emptyText}>No recurring classes found to share.</Text>
              </View>
            )}
          </View>
          <View style={styles.qrShelf} />
        </View>

        {qrData && (
          <TouchableOpacity 
            style={styles.shareBtn} 
            onPress={() => Share.share({ message: `Check out my schedule on ScheduleMe!` })}
          >
            <MaterialCommunityIcons name="share-variant-outline" size={20} color={theme.white} style={{ marginRight: 8 }} />
            <Text style={styles.shareBtnText}>Share as Text Link</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Secure P2P Sync Service</Text>
      </View>

      {/* Fullscreen Thank You Overlay */}
      {showThanks && (
         <Animated.View style={[styles.thankYouOverlay, { opacity: fadeAnim }]}>
            <Animated.View style={[styles.thankYouCard, { transform: [{ scale: scaleAnim }] }]}>
                <Image 
                    source={require('../../assets/thnakyou_student.png')} 
                    style={styles.thanksImage}
                    resizeMode="contain"
                />
                <Text style={styles.thanksTitle}>Shared Successfully!</Text>
                <Text style={styles.thanksSubtitle}>Your friend has imported your timetable. You're a great study buddy!</Text>
                <View style={styles.successBadge}>
                    <MaterialCommunityIcons name="check-circle" size={18} color="#FFF" />
                    <Text style={styles.successBadgeText}>Synced</Text>
                </View>
            </Animated.View>
         </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  backBtn: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: theme.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.textMain,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 40,
  },
  infoCard: {
    backgroundColor: theme.white,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 40,
    width: '100%',
    elevation: 3,
    shadowColor: theme.primary,
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  infoText: {
    textAlign: 'center',
    color: theme.textMuted,
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  qrWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBackground: {
    backgroundColor: theme.white,
    padding: 25,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    zIndex: 2,
    minHeight: width * 0.75,
    minWidth: width * 0.75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrContainer: {
    padding: 5,
  },
  qrShelf: {
    width: width * 0.6,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    marginTop: -5,
    zIndex: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.textMuted,
    marginTop: 15,
    fontSize: 14,
    fontWeight: '600',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingHorizontal: 30,
    paddingVertical: 18,
    borderRadius: 20,
    marginTop: 50,
    shadowColor: theme.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  shareBtnText: {
    color: theme.white,
    fontSize: 16,
    fontWeight: '800',
  },
  footer: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: '700',
    opacity: 0.6,
  },
  thankYouOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(62, 49, 90, 0.95)',
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  thankYouCard: {
    backgroundColor: theme.white,
    borderRadius: 40,
    padding: 30,
    width: '100%',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  thanksImage: {
    width: '100%',
    height: 220,
    marginBottom: 20,
  },
  thanksTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.primary,
    textAlign: 'center',
  },
  thanksSubtitle: {
    fontSize: 15,
    color: theme.textMuted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
    fontWeight: '600',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 25,
  },
  successBadgeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
    textTransform: 'uppercase',
  }
});
