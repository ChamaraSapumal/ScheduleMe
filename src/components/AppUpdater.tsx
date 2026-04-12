import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { ref, get } from 'firebase/database';
import { db } from '../config/firebase';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';

export const AppUpdater = ({ children }: { children: React.ReactNode }) => {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    checkVersion();
  }, []);

  const checkVersion = async () => {
    try {
      // Fetch required version configuration from Firebase RTDB
      const configRef = ref(db, 'appConfig/android');
      const snapshot = await get(configRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const requiredNativeVersion = data.requiredNativeVersion;
        // The current app version comes from expo-constants (derived from app.json)
        const currentVersion = Constants.expoConfig?.version || '1.0.0';

        // Check if the current version is LESS THAN the required version
        if (compareVersions(requiredNativeVersion, currentVersion) > 0) {
          setDownloadUrl(data.downloadUrl);
          setUpdateRequired(true);
        }
      }
    } catch (error) {
      console.log('Error checking update version:', error);
    }
  };

  // Simple semantic version comparator
  const compareVersions = (v1: string, v2: string) => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  };

  const handleDownloadAndInstall = async () => {
    if (!downloadUrl) return;

    try {
      setIsDownloading(true);
      // Construct a local uri for the downloaded APK
      const fileUri = `${FileSystem.documentDirectory}ScheduledMe_Update.apk`;

      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        fileUri,
        {},
        (progressEvent) => {
          const progress = progressEvent.totalBytesWritten / progressEvent.totalBytesExpectedToWrite;
          setDownloadProgress(progress);
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (result) {
        // Must convert the standard file uri to an Android content URI 
        const contentUri = await FileSystem.getContentUriAsync(result.uri);
        
        // Launch Android Package Installer Intent
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/vnd.android.package-archive',
        });
      }
    } catch (error) {
      console.error('Update Download failed:', error);
      Alert.alert('Download Error', 'Could not download the update. Check your internet connection.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      {children}
      <Modal visible={updateRequired} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.brutalistCard}>
            <Text style={styles.title}>MAJOR UPDATE!</Text>
            <Text style={styles.subtitle}>
              A structural update is required. You must download the new App Version to continue using ScheduleMe.
            </Text>

            {isDownloading ? (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="large" color="#000" />
                <Text style={styles.progressText}>{Math.round(downloadProgress * 100)}%</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.brutalistButton} onPress={handleDownloadAndInstall}>
                <Text style={styles.buttonText}>DOWNLOAD & INSTALL</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  brutalistCard: {
    backgroundColor: '#FFDE59', // High contrast yellow
    borderWidth: 4,
    borderColor: '#000',
    padding: 30,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0, // Disable android default shadow
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
    marginBottom: 15,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 16,
    color: '#000',
    marginBottom: 30,
    lineHeight: 24,
    fontWeight: '600',
  },
  brutalistButton: {
    backgroundColor: '#00D1FF', // High contrast cyan
    borderWidth: 3,
    borderColor: '#000',
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  progressContainer: {
    alignItems: 'center',
    padding: 10,
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  progressText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  }
});
