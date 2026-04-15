import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions, Share, Image, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
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

type ShareType = 'TIMETABLE' | 'PROFILE' | 'GROUP' | 'APP';

export default function ShareSocialScreen({ navigation, route }: any) {
  const { user, userGroups, groupMetadata, userName, university } = useContext(AuthContext);
  const { showAlert } = useCustomAlert();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ShareType>(route.params?.initialTab || 'PROFILE');
  const [qrData, setQrData] = useState<string | null>(null);
  const [selectedShareGroupId, setSelectedShareGroupId] = useState<string | null>(null);
  const [latestAppUrl, setLatestAppUrl] = useState<string | null>(null);
  
  // Thank you celebration state
  const [showThanks, setShowThanks] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Default to first group if none selected
    if (userGroups.length > 0 && !selectedShareGroupId) {
       setSelectedShareGroupId(userGroups[0]);
    }
  }, [userGroups]);

  useEffect(() => {
    generateQR();
    setupSyncListener();
    
    return () => {
        if (user) off(ref(db, `shares/${user.uid}/status`));
    };
  }, [activeTab, selectedShareGroupId]);

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
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true })
    ]).start();

    setTimeout(() => dismissCelebration(), 8000);
  };

  const dismissCelebration = () => {
     Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(async () => {
        setShowThanks(false);
        if (user) await set(ref(db, `shares/${user.uid}/status`), null);
      });
  };

  const generateQR = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let payload = '';

      if (activeTab === 'TIMETABLE') {
        const coursesRef = ref(db, 'courses');
        const snapshot = await get(coursesRef);
        const sharedCourses: any[] = [];
        if (snapshot.exists()) {
          snapshot.forEach((child) => {
            const data = child.val();
            if (data.userId === user.uid && data.isRecurring) {
              sharedCourses.push({ m: data.moduleName, t: data.type, d: data.dayOfWeek, s: data.startTime, e: data.endTime, l: data.location });
            }
          });
        }
        payload = JSON.stringify({ type: 'SM_TIMETABLE', u: user.uid, author: userName, uni: university, data: sharedCourses });
      } else if (activeTab === 'PROFILE') {
        payload = JSON.stringify({ type: 'SM_FRIEND', u: user.uid, n: userName, uni: university });
      } else if (activeTab === 'GROUP') {
        const gid = selectedShareGroupId;
        if (!gid) {
          setQrData(null);
          setLoading(false);
          return;
        }
        const groupSnap = await get(ref(db, `groups/${gid}`));
        const groupData = groupSnap.val();
        if (!groupData) {
          showAlert({ title: 'Not Found', message: 'Group data could not be retrieved.' });
          setLoading(false);
          return;
        }
        payload = JSON.stringify({ type: 'SM_GROUP', g: gid, n: groupData.name, a: userName, uni: university });
      } else if (activeTab === 'APP') {
        if (!latestAppUrl) {
           const response = await fetch('https://api.github.com/repos/ChamaraSapumal/ScheduleMe/releases/latest');
           if (response.ok) {
             const data = await response.json();
             const apkAsset = data.assets?.find((asset: any) => asset.name.endsWith('.apk'));
             if (apkAsset) {
               const url = apkAsset.browser_download_url;
               setLatestAppUrl(url);
               payload = `https://github.com/ChamaraSapumal/ScheduleMe/releases/latest?referrer=${user.uid}&type=APP_SHARE`;
             }
           }
        } else {
           payload = `https://github.com/ChamaraSapumal/ScheduleMe/releases/latest?referrer=${user.uid}&type=APP_SHARE`;
        }
        
        if (!payload) {
          showAlert({ title: 'Fetch Failed', message: 'Could not find the latest app release on GitHub.' });
          setLoading(false);
          return;
        }
      }
      
      setQrData(payload);
    } catch (error) {
      console.error(error);
      showAlert({ title: 'Error', message: 'Failed to generate QR data.' });
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
        <Text style={styles.headerTitle}>Social Sync</Text>
        <View style={{ width: 45 }} />
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabBar}>
         <TouchableOpacity 
           style={[styles.tab, activeTab === 'PROFILE' && styles.activeTab]} 
           onPress={() => setActiveTab('PROFILE')}
         >
           <Text style={[styles.tabText, activeTab === 'PROFILE' && styles.activeTabText]}>Profile</Text>
         </TouchableOpacity>
         <TouchableOpacity 
           style={[styles.tab, activeTab === 'GROUP' && styles.activeTab]} 
           onPress={() => setActiveTab('GROUP')}
         >
           <Text style={[styles.tabText, activeTab === 'GROUP' && styles.activeTabText]}>Group</Text>
         </TouchableOpacity>
         <TouchableOpacity 
           style={[styles.tab, activeTab === 'TIMETABLE' && styles.activeTab]} 
           onPress={() => setActiveTab('TIMETABLE')}
         >
           <Text style={[styles.tabText, activeTab === 'TIMETABLE' && styles.activeTabText]}>Agenda</Text>
         </TouchableOpacity>
         <TouchableOpacity 
           style={[styles.tab, activeTab === 'APP' && styles.activeTab]} 
           onPress={() => setActiveTab('APP')}
         >
           <Text style={[styles.tabText, activeTab === 'APP' && styles.activeTabText]}>App</Text>
         </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <MaterialCommunityIcons 
            name={activeTab === 'PROFILE' ? 'account-heart' : activeTab === 'GROUP' ? 'account-group' : activeTab === 'APP' ? 'cellphone-link' : 'calendar-multiple'} 
            size={32} color={theme.primary} 
          />
          <Text style={styles.infoText}>
            {activeTab === 'PROFILE' ? 'Let someone scan this to instantly become friends!' : 
             activeTab === 'GROUP' ? 'Invite friends to join your squad on ScheduleMe' : 
             activeTab === 'APP' ? 'Share ScheduleMe with friends and earn community points!' :
             'Instantly share your weekly timetable agenda with friends.'}
          </Text>
        </View>

        {activeTab === 'GROUP' && userGroups.length > 1 && (
           <View style={styles.groupPicker}>
              <Text style={styles.pickerLabel}>Select Group to Share:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerContent}>
                 {userGroups.map(gid => (
                    <TouchableOpacity 
                       key={gid} 
                       style={[styles.pickerPill, selectedShareGroupId === gid && styles.activePickerPill]}
                       onPress={() => setSelectedShareGroupId(gid)}
                    >
                       <Text style={[styles.pickerPillText, selectedShareGroupId === gid && styles.activePickerPillText]}>
                          {groupMetadata[gid]?.name || 'Loading...'}
                       </Text>
                    </TouchableOpacity>
                 ))}
              </ScrollView>
           </View>
        )}

        <View style={styles.qrHeader}>
           <Text style={styles.qrName}>{userName}</Text>
           {university ? <Text style={styles.qrUni}>• {university}</Text> : null}
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
                <MaterialCommunityIcons 
                  name={activeTab === 'GROUP' ? "account-group-outline" : activeTab === 'APP' ? "cellphone-arrow-down" : "calendar-blank"} 
                  size={50} color={theme.textMuted} 
                />
                <Text style={styles.emptyText}>
                  {activeTab === 'GROUP' ? "You haven't joined any study groups yet." : 
                   activeTab === 'APP' ? "Fetching latest release data..." : "No data found to share."}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.qrShelf} />
        </View>

        {qrData && (
          <TouchableOpacity 
            style={styles.shareBtn} 
            onPress={() => Share.share({ message: `Check out my ${activeTab.toLowerCase()} on ScheduleMe!` })}
          >
            <MaterialCommunityIcons name="share-variant-outline" size={20} color={theme.white} style={{ marginRight: 8 }} />
            <Text style={styles.shareBtnText}>
              {activeTab === 'APP' ? 'Share App Link' : 'Share Link'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Thank You Overlay */}
      {showThanks && (
         <Animated.View style={[styles.thankYouOverlay, { opacity: fadeAnim }]}>
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Animated.View style={[styles.thankYouCard, { transform: [{ scale: scaleAnim }] }]}>
                <View style={styles.glowBackdrop} />
                <Image source={{uri: 'https://cdn-icons-png.flaticon.com/512/190/190411.png'}} style={styles.thanksImage} />
                <Text style={styles.thanksTitle}>Success!</Text>
                <Text style={styles.thanksSubtitle}>Action completed successfully!</Text>
                <TouchableOpacity style={styles.successBtn} onPress={dismissCelebration}>
                    <Text style={styles.successBtnText}>AWESOME</Text>
                </TouchableOpacity>
            </Animated.View>
         </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 10 },
  backBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: theme.white, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: theme.textMain },
  tabBar: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 20, gap: 10 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 15, backgroundColor: '#FFF', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  activeTab: { backgroundColor: theme.primary, borderColor: theme.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: theme.textMuted },
  activeTabText: { color: '#FFF' },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 30, paddingTop: 20 },
  infoCard: { backgroundColor: theme.white, padding: 20, borderRadius: 20, alignItems: 'center', marginBottom: 30, width: '100%', elevation: 3 },
  infoText: { textAlign: 'center', color: theme.textMuted, marginTop: 12, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  qrHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  qrName: { fontSize: 20, fontWeight: '900', color: theme.textMain },
  qrUni: { fontSize: 18, fontWeight: '700', color: theme.primary, marginLeft: 8 },
  qrWrapper: { alignItems: 'center', justifyContent: 'center' },
  qrBackground: { backgroundColor: theme.white, padding: 25, borderRadius: 30, elevation: 5, minHeight: width * 0.75, minWidth: width * 0.75, justifyContent: 'center', alignItems: 'center' },
  qrContainer: { padding: 5 },
  qrShelf: { width: width * 0.6, height: 10, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 20, marginTop: -5 },
  emptyState: { alignItems: 'center', padding: 20 },
  emptyText: { textAlign: 'center', color: theme.textMuted, marginTop: 15, fontSize: 14, fontWeight: '600' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary, paddingHorizontal: 30, paddingVertical: 18, borderRadius: 20, marginTop: 40 },
  shareBtnText: { color: theme.white, fontSize: 16, fontWeight: '800' },
  thankYouOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'center', alignItems: 'center', padding: 25 },
  thankYouCard: { backgroundColor: theme.white, borderRadius: 35, padding: 35, width: '100%', alignItems: 'center' },
  glowBackdrop: { position: 'absolute', top: -50, width: width, height: 250, backgroundColor: 'rgba(210, 185, 255, 0.2)', borderRadius: 200 },
  thanksImage: { width: 120, height: 120, marginBottom: 20 },
  thanksTitle: { fontSize: 28, fontWeight: '900', color: theme.primary },
  thanksSubtitle: { fontSize: 15, color: theme.textMuted, textAlign: 'center', marginTop: 10, marginBottom: 25 },
  successBtn: { backgroundColor: '#10B981', width: '100%', paddingVertical: 16, borderRadius: 20, alignItems: 'center' },
  successBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  groupPicker: { width: '100%', marginBottom: 20 },
  pickerLabel: { fontSize: 13, fontWeight: '800', color: theme.textMuted, marginBottom: 10, marginLeft: 5 },
  pickerContent: { gap: 8 },
  pickerPill: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  activePickerPill: { backgroundColor: theme.primary, borderColor: theme.primary },
  pickerPillText: { fontSize: 13, fontWeight: '700', color: theme.textMuted },
  activePickerPillText: { color: '#FFF' }
});
