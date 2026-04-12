import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ref, push, set } from 'firebase/database';
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
  textMuted: '#8F8A9E',
  success: '#10B981'
};

export default function ScanTimetableScreen({ navigation }: any) {
  const { user } = useContext(AuthContext);
  const { showAlert } = useCustomAlert();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || importing) return;
    setScanned(true);

    try {
      const payload = JSON.parse(data);
      
      // Basic validation
      if (payload.type !== 'SM_TIMETABLE' || !Array.isArray(payload.data)) {
        throw new Error('This QR code is not a valid ScheduleMe timetable.');
      }

      showAlert({
        title: 'Timetable Found!',
        message: `Found ${payload.data.length} recurring classes from ${payload.author}. Would you like to import them into your Agenda?`,
        showCancel: true,
        confirmText: 'Import Now',
        onConfirm: () => importData(payload.data, payload.u),
        onCancel: () => setScanned(false)
      });
    } catch (error: any) {
      showAlert({ 
        title: 'Invalid QR Code', 
        message: error.message || 'The scanned data could not be parsed.',
        onConfirm: () => setScanned(false)
      });
    }
  };

  const importData = async (courseList: any[], authorId?: string) => {
    if (!user) return;
    setImporting(true);
    try {
      const coursesRef = ref(db, 'courses');
      const timestamp = new Date().toISOString();

      const typeColors: any = {
        Lecture: '#3B82F6',   
        Lab: '#F59E0B',       
        Tutorial: '#10B981',  
      };

      // Batch import
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
          createdAt: timestamp
        });
      }

      // Signal back to the sender for the Thank You celebration
      if (authorId) {
        await set(ref(db, `shares/${authorId}/status`), 'thanks');
      }

      showAlert({
        title: 'Import Success!',
        message: `${courseList.length} classes have been added to your Agenda.`,
        onConfirm: () => navigation.navigate('Agenda')
      });
    } catch (error) {
      showAlert({ title: 'Import Failed', message: 'Could not save the timetable to your account.' });
      setScanned(false);
    } finally {
      setImporting(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <MaterialCommunityIcons name="camera-off" size={60} color={theme.textMuted} />
        <Text style={styles.permissionText}>We need camera permission to scan QR codes.</Text>
        <TouchableOpacity style={styles.requestBtn} onPress={requestPermission}>
          <Text style={styles.requestBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      {/* UI Overlay */}
      <SafeAreaView style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="close" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Timetable</Text>
          <View style={{ width: 45 }} />
        </View>

        <View style={styles.scannerWrapper}>
          <View style={styles.scannerOutline}>
             <View style={[styles.corner, styles.topLeft]} />
             <View style={[styles.corner, styles.topRight]} />
             <View style={[styles.corner, styles.bottomLeft]} />
             <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.hintText}>Point your camera at a friend's QR code</Text>
        </View>

        {importing && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.white} />
            <Text style={styles.loadingText}>Importing Timetable...</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
    padding: 30,
  },
  permissionText: {
    textAlign: 'center',
    color: theme.textMuted,
    fontSize: 16,
    marginTop: 20,
    marginBottom: 30,
    fontWeight: '600',
  },
  requestBtn: {
    backgroundColor: theme.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 15,
  },
  requestBtnText: {
    color: theme.white,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  backBtn: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerOutline: {
    width: width * 0.7,
    height: width * 0.7,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: theme.accent,
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 20,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 20,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 20,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 20,
  },
  hintText: {
    color: '#FFF',
    fontWeight: '700',
    marginTop: 40,
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 15,
    fontWeight: '800',
  }
});
