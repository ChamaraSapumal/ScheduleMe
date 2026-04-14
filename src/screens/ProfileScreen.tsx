import React, { useContext, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Animated, PanResponder, Dimensions, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { useAppUpdate } from '../components/AppUpdater';
import { auth, db } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing } from '../theme';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

// Premium Purple Palette
const profileTheme = {
  primary: '#3E315A',
  secondary: '#EFE7FE',
  background: '#F8F5FF',
  white: '#FFFFFF',
  accent: '#D2B9FF',
  textHeader: '#1A1820',
  textSecondary: '#8F8A9E',
  danger: '#FF6B6B'
};

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, setUnlocked, setUserName } = useContext(AuthContext);
  const { updateAvailable, latestVersion, isDownloading, downloadProgress, handleDownloadAndInstall, cancelDownload } = useAppUpdate();

  const currentVersion = Constants.expoConfig?.version || '1.0.0';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const SNAP_BOTTOM = 0; 
  const SNAP_TOP = -screenHeight * 0.45; 
  
  const panY = useRef(new Animated.Value(SNAP_BOTTOM)).current;
  const panYVal = useRef(SNAP_BOTTOM);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
      onPanResponderGrant: () => {
        panY.setOffset(panYVal.current);
        panY.setValue(0);
      },
      onPanResponderMove: Animated.event([null, { dy: panY }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gestureState) => {
        panY.flattenOffset();
        
        if (gestureState.dy < -50 || gestureState.vy < -0.5) {
          panYVal.current = SNAP_TOP;
        } else if (gestureState.dy > 50 || gestureState.vy > 0.5) {
          panYVal.current = SNAP_BOTTOM; 
        } else {
          // @ts-ignore
          const currentVal = panY._value;
          const distToTop = Math.abs(currentVal - SNAP_TOP);
          const distToBot = Math.abs(currentVal - SNAP_BOTTOM);
          panYVal.current = distToTop < distToBot ? SNAP_TOP : SNAP_BOTTOM;
        }

        Animated.spring(panY, {
          toValue: panYVal.current,
          useNativeDriver: false,
          bounciness: 0,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    try {
      const storedImage = await AsyncStorage.getItem(`profileImage_${user.uid}`);
      if (storedImage) {
        const fileInfo = await FileSystem.getInfoAsync(storedImage);
        if (fileInfo.exists) {
          setPhotoUri(storedImage);
        }
      }

      const profileRef = ref(db, `users/${user.uid}/profile`);
      const snap = await get(profileRef);
      if (snap.exists()) {
        const data = snap.val();
        if (data.name) {
          setName(data.name);
          setUserName(data.name);
        }
        if (data.phone) setPhone(data.phone);
      }
    } catch (error) {
      console.log('Error loading profile:', error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera roll permissions needed.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const sourceUri = result.assets[0].uri;
      try {
        const uniqueFileName = `avatar_${Date.now()}.jpg`;
        const destUri = `${FileSystem.documentDirectory}${uniqueFileName}`;
        
        await FileSystem.copyAsync({ from: sourceUri, to: destUri });

        if (user) {
          await AsyncStorage.setItem(`profileImage_${user.uid}`, destUri);
        }
        setPhotoUri(destUri);
      } catch (error: any) {
        Alert.alert('Error', 'Could not save the image locally.');
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!user) return;
    try {
      const profileRef = ref(db, `users/${user.uid}/profile`);
      await set(profileRef, { name: editName, phone: editPhone });
      setName(editName);
      setUserName(editName);
      setPhone(editPhone);
      
      // Update persistent cache
      await AsyncStorage.setItem(`cached_name_${user.uid}`, editName);
      
      setIsEditing(false);
    } catch (er) {
      Alert.alert('Error', 'Could not save profile details.');
    }
  };

  const handleLogOut = async () => {
    try {
      await signOut(auth);
      setUnlocked(false);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const displayName = name || 'User';
  const displayPhone = phone || 'Add phone number';
  const defaultImage = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      {/* Top Hero Section */}
      <View style={styles.topSection}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Account Settings</Text>
            <TouchableOpacity 
              style={styles.headerBtn}
              onPress={() => { setEditName(name); setEditPhone(phone); setIsEditing(!isEditing); }}
            >
              <MaterialCommunityIcons name={isEditing ? "close" : "cog-outline"} size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {!isEditing ? (
          <View style={styles.heroContent}>
            <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} activeOpacity={0.9}>
              <View style={styles.avatarGlow} />
              <View style={styles.avatarOuterRing}>
                <Image source={{ uri: photoUri || defaultImage }} style={styles.avatarImage} />
              </View>
              <View style={styles.cameraIconBadge}>
                <MaterialCommunityIcons name="camera-outline" size={16} color={profileTheme.primary} />
              </View>
            </TouchableOpacity>
            
            <View style={styles.nameContainer}>
              <Text style={styles.nameText}>{displayName}</Text>
              <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Premium Student Hub</Text>
                  <MaterialCommunityIcons name="check-decagram" size={14} color={profileTheme.accent} />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.editHero}>
            <Text style={styles.editTitle}>Update Profile</Text>
            <View style={styles.inputWrapper}>
               <MaterialCommunityIcons name="account-outline" size={20} color="#FFF" style={styles.inputIcon} />
               <TextInput 
                  style={styles.input} 
                  value={editName} 
                  onChangeText={setEditName} 
                  placeholder="Full Name"
                  placeholderTextColor="rgba(255,255,255,0.5)"
               />
            </View>
            <View style={styles.inputWrapper}>
               <MaterialCommunityIcons name="phone-outline" size={20} color="#FFF" style={styles.inputIcon} />
               <TextInput 
                  style={styles.input} 
                  value={editPhone} 
                  onChangeText={setEditPhone} 
                  placeholder="Phone Number"
                  keyboardType="phone-pad"
                  placeholderTextColor="rgba(255,255,255,0.5)"
               />
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
               <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Modern Draggable Bottom Sheet */}
      <Animated.View style={[
        styles.bottomSheet, 
        { transform: [{ translateY: panY }] }
      ]}>
        <View style={styles.dragArea} {...panResponder.panHandlers}>
          <View style={styles.dragIndicator} />
        </View>
        
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Info Section */}
          <Text style={styles.sectionTitle}>Information</Text>
          
          <View style={styles.card}>
            <View style={styles.cardItem}>
              <View style={[styles.iconContainer, { backgroundColor: '#F0E8FF' }]}>
                <MaterialCommunityIcons name="phone-outline" size={22} color={profileTheme.primary} />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.itemLabel}>Primary Phone</Text>
                <Text style={styles.itemValue}>{displayPhone}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardItem}>
              <View style={[styles.iconContainer, { backgroundColor: '#F0E8FF' }]}>
                <MaterialCommunityIcons name="email-outline" size={22} color={profileTheme.primary} />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.itemLabel}>Email Address</Text>
                <Text style={styles.itemValue}>{user?.email || 'N/A'}</Text>
              </View>
            </View>
          </View>

          {/* Peer Sharing */}
          <Text style={styles.sectionTitle}>Peer Sharing</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.cardItem} onPress={() => navigation.navigate('ShareTimetable')}>
              <View style={[styles.iconContainer, { backgroundColor: '#E8F5FF' }]}>
                <MaterialCommunityIcons name="qrcode-plus" size={22} color="#0EA5E9" />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.itemLabel}>Share Schedule</Text>
                <Text style={styles.itemValue}>Generate Timetable QR</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={profileTheme.textSecondary} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.cardItem} onPress={() => navigation.navigate('ScanTimetable')}>
              <View style={[styles.iconContainer, { backgroundColor: '#E8F5FF' }]}>
                <MaterialCommunityIcons name="qrcode-scan" size={22} color="#0EA5E9" />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.itemLabel}>Scan Timetable</Text>
                <Text style={styles.itemValue}>Sync a friend's agenda</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={profileTheme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Security & System */}
          <Text style={styles.sectionTitle}>Security & Updates</Text>

          <View style={styles.card}>
            <View style={styles.cardItem}>
              <View style={[styles.iconContainer, { backgroundColor: '#000' }]}>
                <MaterialCommunityIcons name="fingerprint" size={22} color={profileTheme.accent} />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.itemLabel}>Security Vault</Text>
                <Text style={styles.itemValue}>Biometrics & PIN Enabled</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={profileTheme.textSecondary} />
            </View>

            <View style={styles.divider} />

            <View style={styles.cardItem}>
              <View style={[styles.iconContainer, { backgroundColor: '#FFF0F0' }]}>
                <MaterialCommunityIcons name="cloud-check-outline" size={22} color="#FF6B6B" />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.itemLabel}>App Version</Text>
                <Text style={styles.itemValue}>
                  V{currentVersion} {updateAvailable ? `(v${latestVersion} Available)` : '(Up to date)'}
                </Text>
              </View>
              {updateAvailable && (
                <TouchableOpacity 
                   style={[styles.updateBadge, isDownloading && { backgroundColor: '#FF6B6B' }]} 
                   onPress={handleDownloadAndInstall}
                   disabled={isDownloading}
                >
                  <Text style={styles.updateBadgeText}>
                     {isDownloading ? `DL ${Math.round(downloadProgress * 100)}%` : 'UPDATE'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogOut}>
            <MaterialCommunityIcons name="logout-variant" size={22} color={profileTheme.white} />
            <Text style={styles.logoutBtnText}>Sign Out Securely</Text>
          </TouchableOpacity>
          
          <View style={styles.footerBranding}>
             <Text style={styles.brandingText}>ScheduleMe Premium v{currentVersion}</Text>
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: profileTheme.background,
  },
  topSection: {
    backgroundColor: profileTheme.primary,
    height: '60%',
    width: '100%',
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  headerBtn: {
    width: 45,
    height: 45,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    alignItems: 'center',
    marginTop: 30,
  },
  avatarContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(210, 185, 255, 0.15)',
  },
  avatarOuterRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 3,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 10,
    backgroundColor: '#FFF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  nameContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  nameText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: profileTheme.accent,
    marginRight: 4,
    textTransform: 'uppercase',
  },
  editHero: {
    paddingHorizontal: 30,
    marginTop: 10,
  },
  editTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 15,
    height: 55,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: profileTheme.accent,
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
    shadowColor: profileTheme.accent,
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  saveBtnText: {
    color: profileTheme.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  bottomSheet: {
    backgroundColor: profileTheme.white, 
    position: 'absolute',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 25,
    height: screenHeight * 0.9,
    top: screenHeight * 0.48, 
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -15 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  dragArea: {
    width: '100%',
    height: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: screenHeight * 0.45, 
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: profileTheme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 15,
    marginTop: 20,
    marginLeft: 5,
  },
  card: {
    backgroundColor: profileTheme.secondary,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  itemText: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: profileTheme.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  itemValue: {
    fontSize: 16,
    fontWeight: '800',
    color: profileTheme.textHeader,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginHorizontal: 15,
  },
  updateBadge: {
    backgroundColor: profileTheme.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  updateBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  logoutBtn: {
    flexDirection: 'row',
    backgroundColor: profileTheme.primary,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
    shadowColor: profileTheme.primary,
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  logoutBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 10,
  },
  footerBranding: {
    marginTop: 40,
    alignItems: 'center',
  },
  brandingText: {
    fontSize: 12,
    color: profileTheme.textSecondary,
    fontWeight: '600',
    opacity: 0.5,
  }
});
