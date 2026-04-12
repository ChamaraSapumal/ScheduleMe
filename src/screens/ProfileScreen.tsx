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
import { colors, spacing } from '../theme';

const { height: screenHeight } = Dimensions.get('window');

export default function ProfileScreen() {
  const { user, setUnlocked } = useContext(AuthContext);
  const { updateAvailable, latestVersion, isDownloading, downloadProgress, handleDownloadAndInstall, cancelDownload } = useAppUpdate();

  const currentVersion = Constants.expoConfig?.version || '1.0.0';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // 0 is the default resting area (down).
  // -screenHeight * 0.45 pushes it up securely.
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
        if (data.name) setName(data.name);
        if (data.phone) setPhone(data.phone);
      }
    } catch (error) {
      console.log('Error loading profile:', error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to update your avatar.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [7, 8],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const sourceUri = result.assets[0].uri;
      try {
        const uniqueFileName = `avatar_${Date.now()}.jpg`;
        const destUri = `${FileSystem.documentDirectory}${uniqueFileName}`;
        
        await FileSystem.copyAsync({
          from: sourceUri,
          to: destUri
        });

        if (user) {
          await AsyncStorage.setItem(`profileImage_${user.uid}`, destUri);
        }
        setPhotoUri(destUri);
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Could not save the image locally.');
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!user) return;
    try {
      const profileRef = ref(db, `users/${user.uid}/profile`);
      await set(profileRef, {
        name: editName,
        phone: editPhone
      });
      setName(editName);
      setPhone(editPhone);
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
  const displayPhone = phone || 'Add a phone number';
  const defaultImage = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.topSection}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>My profile</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={() => { /* Generate QR */ }}>
                <MaterialCommunityIcons name="qrcode" size={26} color="#000" style={{ marginRight: 15 }} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setEditName(name); setEditPhone(phone); setIsEditing(true); }}>
                <MaterialCommunityIcons name={isEditing ? "close" : "square-edit-outline"} size={26} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        {!isEditing ? (
          <>
            <View style={styles.avatarWrapper}>
              <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} activeOpacity={0.8}>
                <View style={styles.avatarShadow} />
                <View style={styles.avatarFrame}>
                  <Image 
                    source={{ uri: photoUri || defaultImage }} 
                    style={styles.avatarImage} 
                  />
                  <View style={styles.editBadge}>
                      <MaterialCommunityIcons name="camera" size={16} color="#FFF" />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.nameContainer}>
              <Text style={styles.nameText}>{displayName}</Text>
              <View style={styles.idRow}>
                <Text style={styles.idText}>H97DPSZB</Text>
                <TouchableOpacity style={{ marginLeft: 6 }}>
                  <MaterialCommunityIcons name="share-variant" size={14} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.editContainer}>
            <Text style={styles.editLabel}>Name</Text>
            <TextInput 
               style={styles.input} 
               value={editName} 
               onChangeText={setEditName} 
               placeholder="Your name"
               placeholderTextColor="#666"
            />
            <Text style={styles.editLabel}>Phone</Text>
            <TextInput 
               style={styles.input} 
               value={editPhone} 
               onChangeText={setEditPhone} 
               placeholder="+1 234 567 8900"
               keyboardType="phone-pad"
               placeholderTextColor="#666"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
               <Text style={styles.saveBtnText}>Save Details</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Animated.View style={[
        styles.bottomSheet, 
        { transform: [{ translateY: panY }] }
      ]}>
        <View style={styles.dragArea} {...panResponder.panHandlers}>
          <MaterialCommunityIcons name="chevron-up" size={30} color="#000" style={{ marginBottom: -10 }} />
        </View>
        
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.listItem}>
            <View style={styles.listIconContainer}>
              <MaterialCommunityIcons name="access-point" size={22} color="#000" />
            </View>
            <View>
              <Text style={styles.listTitle}>Phone number</Text>
              <Text style={styles.listSubtitle}>{displayPhone}</Text>
            </View>
          </View>

          <View style={styles.listItem}>
            <View style={[styles.listIconContainer, { backgroundColor: '#AF9F85' }]}>
              <MaterialCommunityIcons name="email-outline" size={22} color="#FFF" />
            </View>
            <View>
              <Text style={styles.listTitle}>Email address</Text>
              <Text style={styles.listSubtitle}>{user?.email || 'user@example.com'}</Text>
            </View>
          </View>

          <View style={styles.listItem}>
            <View style={[styles.listIconContainer, { backgroundColor: '#000' }]}>
              <MaterialCommunityIcons name="fingerprint" size={22} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.listTitle}>Key fingerprint</Text>
              <Text style={styles.listSubtitle}>3A7S350FFFSKRDLNLY4#60</Text>
            </View>
          </View>

          <View style={styles.listItem}>
            <View style={[styles.listIconContainer, { backgroundColor: '#FFD500' }]}>
              <MaterialCommunityIcons name="cloud-download-outline" size={22} color="#000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>App Status</Text>
              {updateAvailable ? (
                <View style={{ marginTop: 2 }}>
                  <Text style={[styles.listSubtitle, { color: '#EF4444', fontWeight: 'bold' }]}>
                    Update Available: v{latestVersion}
                  </Text>
                  {isDownloading ? (
                    <View style={styles.downloadRow}>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#000' }}>
                        Downloading... {Math.round(downloadProgress * 100)}%
                      </Text>
                      <TouchableOpacity style={styles.cancelTinyBtn} onPress={cancelDownload}>
                        <MaterialCommunityIcons name="close" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.updateInlineBtn} onPress={handleDownloadAndInstall}>
                      <Text style={styles.updateInlineBtnText}>Download & Install</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Text style={styles.listSubtitle}>Version {currentVersion} (Up to date)</Text>
                  <MaterialCommunityIcons name="check-decagram" size={16} color="#10B981" style={{ marginLeft: 4 }} />
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogOut}>
            <MaterialCommunityIcons name="logout" size={20} color="#FFF" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9', 
  },
  topSection: {
    backgroundColor: '#AF9F85', // Updated secondary color
    height: '67%',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingTop: spacing.m,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#000',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  avatarContainer: {
    width: 170,
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarShadow: {
    position: 'absolute',
    width: 170,
    height: 170,
    backgroundColor: '#000',
    borderRadius: 30,
    top: 10,
    right: -10,
  },
  avatarFrame: {
    width: 170,
    height: 170,
    backgroundColor: '#FFD500', // Yellow background from reference
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#000',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  editBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 12,
  },
  nameContainer: {
    alignItems: 'center',
    marginTop: 25,
  },
  nameText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#000',
    marginBottom: 4,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  idText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '700',
    opacity: 0.6,
  },
  editContainer: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.m,
  },
  editLabel: {
    fontWeight: '900',
    color: '#000',
    marginBottom: 6,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 3,
    borderColor: '#000',
    padding: spacing.m,
    borderRadius: 12,
    marginBottom: spacing.m,
    color: '#000',
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: '#000',
    padding: spacing.m,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 18,
    textTransform: 'uppercase',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF', 
    position: 'absolute',
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    paddingHorizontal: spacing.l,
    borderTopWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    height: screenHeight * 0.9,
    top: screenHeight * 0.53, 
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  dragArea: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragIndicator: {
    width: 50,
    height: 6,
    backgroundColor: '#000',
    borderRadius: 3,
  },
  scrollContent: {
    paddingTop: spacing.m,
    paddingBottom: screenHeight * 0.45, 
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  listIconContainer: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: '#D9BC67',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.l,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
  },
  listSubtitle: {
    fontSize: 15,
    color: '#777',
    fontWeight: '600',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#000',
    paddingVertical: 18,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.m,
  },
  logoutText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: spacing.m,
    textTransform: 'uppercase',
  },
  updateInlineBtn: {
    backgroundColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    marginTop: 12,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
  },
  updateInlineBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 15,
    textTransform: 'uppercase',
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  cancelTinyBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1.5,
    borderColor: '#EF4444',
  }
});
