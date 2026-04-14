import React, { useEffect, useState, createContext, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, Modal, Image } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

export const UpdateContext = createContext<any>(null);

export const useAppUpdate = () => useContext(UpdateContext);

export const AppUpdater = ({ children }: { children: React.ReactNode }) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    checkVersion();
  }, []);

  const checkVersion = async () => {
    try {
      const response = await fetch('https://api.github.com/repos/ChamaraSapumal/ScheduleMe/releases/latest');
      if (!response.ok) return;
      const data = await response.json();
      
      const remoteVersion = data.tag_name ? data.tag_name.replace('v', '') : '1.0.0';
      const currentVersion = Constants.expoConfig?.version || '1.0.0';

      console.log(`Update Check: Remote V${remoteVersion} | Local V${currentVersion}`);

      if (compareVersions(remoteVersion, currentVersion) > 0) {
        setLatestVersion(remoteVersion);
        
        const apkAsset = data.assets?.find((asset: any) => asset.name.endsWith('.apk'));
        if (apkAsset) {
          setDownloadUrl(apkAsset.browser_download_url);
          setUpdateAvailable(true);
        } else {
          setUpdateAvailable(false);
        }
      } else {
        setUpdateAvailable(false);
      }
    } catch (error) {
      console.log('Error checking GitHub release:', error);
      setUpdateAvailable(false);
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

  const downloadResumable = React.useRef<FileSystem.DownloadResumable | null>(null);
  
  const cancelDownload = async () => {
    if (downloadResumable.current) {
      try {
        await downloadResumable.current.cancelAsync();
        console.log('Download cancelled.');
      } catch (error) {
        console.warn('Error cancelling download:', error);
      } finally {
        downloadResumable.current = null;
        setIsDownloading(false);
        setDownloadProgress(0);
      }
    }
  };

  const handleDownloadAndInstall = async () => {
    if (!downloadUrl) return;

    try {
      setIsDownloading(true);
      // Construct a local uri for the downloaded APK
      const fileUri = `${FileSystem.documentDirectory}ScheduledMe_Update.apk`;

      downloadResumable.current = FileSystem.createDownloadResumable(
        downloadUrl,
        fileUri,
        {
          headers: {
            'User-Agent': 'ScheduleMe-AppUpdater'
          }
        },
        (progressEvent) => {
          const progress = progressEvent.totalBytesWritten / progressEvent.totalBytesExpectedToWrite;
          setDownloadProgress(progress);
        }
      );

      const result = await downloadResumable.current.downloadAsync();

      if (result) {
        // Must convert the standard file uri to an Android content URI 
        const contentUri = await FileSystem.getContentUriAsync(result.uri);
        
        // Launch Android Package Installer Intent
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/vnd.android.package-archive',
        });
        
        // Show the success modal after launching the installer
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      console.error('Update Download failed:', error);
      Alert.alert(
        'Download Error', 
        `Could not download the update. Error: ${error.message || 'Unknown error'}\n\nPlease check your internet connection.`
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <UpdateContext.Provider value={{ updateAvailable, latestVersion, downloadUrl, isDownloading, downloadProgress, handleDownloadAndInstall, cancelDownload, checkVersion }}>
      {children}
      
      <Modal visible={showSuccessModal} transparent={true} animationType="slide">
        <View style={styles.successModalContainer}>
          <View style={styles.successCard}>
            <View style={styles.imageHeader}>
              <Image 
                source={require('../../assets/thankyou-student.png')} 
                style={styles.successImage} 
                resizeMode="contain" 
              />
            </View>
            <View style={styles.successContent}>
              <Text style={styles.successTitle}>Update Ready!</Text>
              <Text style={styles.successText}>
                Your update has been downloaded successfully. After installation, we highly recommend clearing the App Data from settings to optimize your storage space!
              </Text>
              <TouchableOpacity 
                style={styles.successButton} 
                onPress={() => setShowSuccessModal(false)}
              >
                <Text style={styles.successButtonText}>Got it!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </UpdateContext.Provider>
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
    backgroundColor: '#D9BC67', // Theme primary mustard
    borderWidth: 4,
    borderColor: '#000',
    padding: 30,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0, 
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
    backgroundColor: '#000', // Solid black
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
    color: '#FFF', // White text
    fontSize: 18,
    fontWeight: '900',
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
  },
  successModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 12, 27, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 20,
  },
  imageHeader: {
    width: '100%',
    height: 220,
    backgroundColor: '#F8F5FF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successImage: {
    width: '100%',
    height: '100%',
  },
  successContent: {
    padding: 24,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1A162D',
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    color: '#6F6B7D',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  successButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  successButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  }
});
