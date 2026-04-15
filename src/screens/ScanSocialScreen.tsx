import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ref, push, set, get } from 'firebase/database';
import { db } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { acceptFriendRequest, joinGroup, awardReferralPoints } from '../utils/SyncManager';
import { useAppUpdate } from '../components/AppUpdater';

const { width, height } = Dimensions.get('window');

const theme = {
  primary: '#3E315A',
  background: '#F8F5FF',
  white: '#FFFFFF',
  accent: '#D2B9FF',
  textMain: '#1A1820',
  textMuted: '#8F8A9E',
  success: '#10B981'
};

export default function ScanSocialScreen({ navigation }: any) {
  const { user, userName, friends } = useContext(AuthContext);
  const { showAlert } = useCustomAlert();
  const { handleDownloadAndInstall } = useAppUpdate();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!permission) requestPermission();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);

    try {
      const payload = JSON.parse(data);
      
      if (payload.type === 'SM_TIMETABLE') {
        showAlert({
          title: 'Timetable Found!',
          message: `Import ${payload.author}'s timetable into your Agenda?`,
          showCancel: true,
          confirmText: 'Import Now',
          onConfirm: () => importTimetable(payload.data, payload.u),
          onCancel: () => setScanned(false)
        });
      } else if (payload.type === 'SM_FRIEND') {
        if (payload.u === user?.uid) {
           showAlert({ title: "It's You!", message: "You cannot add yourself as a friend.", onConfirm: () => setScanned(false) });
           return;
        }
        showAlert({
          title: 'New Connection!',
          message: `Add ${payload.n} as a friend?`,
          showCancel: true,
          confirmText: 'Add Friend',
          onConfirm: () => handleAddFriend(payload.u, payload.n),
          onCancel: () => setScanned(false)
        });
      } else if (payload.type === 'SM_GROUP') {
        showAlert({
          title: 'Join Study Group?',
          message: `Join "${payload.n}" (Admin: ${payload.a})?`,
          showCancel: true,
          confirmText: 'Join Group',
          onConfirm: () => handleJoinGroup(payload.g, payload.n),
          onCancel: () => setScanned(false)
        });
      } else if (data.includes('type=APP_SHARE')) {
        // Handle URL-based App Share
        const urlParams = new URLSearchParams(data.split('?')[1]);
        const referrerUid = urlParams.get('referrer');
        
        if (referrerUid === user?.uid) {
           showAlert({ title: "Sharing is Caring!", message: "This is your own share code. Share it with friends to earn points!", onConfirm: () => setScanned(false) });
           return;
        }

        showAlert({
          title: 'Update ScheduleMe?',
          message: `Download the latest version! You'll help your friend earn community points.`,
          showCancel: true,
          confirmText: 'Download Now',
          onConfirm: () => handleAppDownloadShare(referrerUid, data.split('?')[0]),
          onCancel: () => setScanned(false)
        });
      } else {
        throw new Error('Unrecognized QR Code');
      }
    } catch (error: any) {
      showAlert({ 
        title: 'Invalid QR Code', 
        message: 'This code is not supported by ScheduleMe.',
        onConfirm: () => setScanned(false)
      });
    }
  };

  const handleAddFriend = async (friendUid: string, friendName: string) => {
    if (!user) return;
    setLoading(true);
    try {
      await acceptFriendRequest(user.uid, friendUid, userName || 'Student', friendName);
      // Success celebrate!
      await set(ref(db, `shares/${friendUid}/status`), 'thanks');
      showAlert({ title: 'New Friend!', message: `You and ${friendName} are now connected.`, onConfirm: () => navigation.goBack() });
    } catch (e) {
      showAlert({ title: 'Connection Failed', message: 'Could not establish friendship.', onConfirm: () => setScanned(false) });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (groupId: string, groupName: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const status = await joinGroup(user.uid, groupId, userName || 'Student');
      
      if (status === 'PENDING') {
         showAlert({ 
           title: 'Request Sent! ⏳', 
           message: `Since you were previously removed from "${groupName}", the admin must approve your rejoin request.`, 
           onConfirm: () => navigation.goBack() 
         });
      } else {
         showAlert({ 
           title: 'Welcome!', 
           message: `You have joined the "${groupName}" study group.`, 
           onConfirm: () => navigation.goBack() 
         });
      }
    } catch (error: any) {
      showAlert({ title: 'Join Failed', message: error.message || 'Could not join group.', onConfirm: () => setScanned(false) });
    } finally {
      setLoading(false);
    }
  };

  const importTimetable = async (courseList: any[], authorId?: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const coursesRef = ref(db, 'courses');
      const typeColors: any = { Lecture: '#3B82F6', Lab: '#F59E0B', Tutorial: '#10B981' };

      for (const c of courseList) {
        const newCourseRef = push(coursesRef);
        await set(newCourseRef, {
          userId: user.uid,
          moduleName: c.m,
          type: c.t,
          dayOfWeek: c.d,
          startTime: c.s,
          endTime: c.e,
          location: c.l,
          isRecurring: true,
          colorIndicator: typeColors[c.t] || theme.primary,
          createdAt: new Date().toISOString()
        });
      }

      if (authorId) await set(ref(db, `shares/${authorId}/status`), 'thanks');
      showAlert({ title: 'Success!', message: 'Timetable imported successfully.', onConfirm: () => navigation.navigate('Agenda') });
    } catch (error) {
      showAlert({ title: 'Import Failed', message: 'Could not save the timetable.' });
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAppDownloadShare = async (referrerUid: string | null, baseUrl: string) => {
    setLoading(true);
    try {
      // 1. Award points to referrer if they exist
      if (referrerUid) {
        await awardReferralPoints(referrerUid, 50);
        await set(ref(db, `shares/${referrerUid}/status`), 'thanks');
      }

      // 2. Fetch the actual APK from GitHub again to be sure (or just use the base URL if it's direct)
      const response = await fetch('https://api.github.com/repos/ChamaraSapumal/ScheduleMe/releases/latest');
      if (response.ok) {
        const data = await response.json();
        const apkAsset = data.assets?.find((asset: any) => asset.name.endsWith('.apk'));
        if (apkAsset) {
          await handleDownloadAndInstall(apkAsset.browser_download_url);
        } else {
          throw new Error('No APK found in release assets.');
        }
      } else {
        throw new Error('Could not fetch latest release info.');
      }
    } catch (error: any) {
      showAlert({ title: 'Download Failed', message: error.message || 'Could not start download.', onConfirm: () => setScanned(false) });
    } finally {
      setLoading(false);
    }
  };

  if (!permission || !permission.granted) {
     return (
       <View style={styles.centerContainer}>
         <MaterialCommunityIcons name="camera-off" size={60} color={theme.textMuted} />
         <Text style={styles.permissionText}>Camera access required.</Text>
         <TouchableOpacity style={styles.requestBtn} onPress={requestPermission}><Text style={styles.requestBtnText}>Grant Permission</Text></TouchableOpacity>
       </View>
     );
  }

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFillObject} onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}><MaterialCommunityIcons name="close" size={26} color="#FFF" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Social Sync</Text>
          <View style={{ width: 45 }} />
        </View>
        <View style={styles.scannerWrapper}>
           <View style={styles.scannerOutline} />
           <Text style={styles.hintText}>Scan a Friend, Group, or Timetable</Text>
        </View>
        {loading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color="#FFF" /></View>}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background, padding: 30 },
  permissionText: { textAlign: 'center', color: theme.textMuted, fontSize: 16, marginTop: 20, marginBottom: 30 },
  requestBtn: { backgroundColor: theme.primary, paddingHorizontal: 30, paddingVertical: 15, borderRadius: 15 },
  requestBtnText: { color: theme.white, fontWeight: '800' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 10 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  backBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  scannerWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scannerOutline: { width: width * 0.7, height: width * 0.7, borderWidth: 4, borderColor: theme.accent, borderRadius: 30 },
  hintText: { color: '#FFF', fontWeight: '700', marginTop: 40, fontSize: 15, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 5 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }
});
