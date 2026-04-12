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
import { colors, spacing } from '../theme';

const { height: screenHeight } = Dimensions.get('window');

export default function ProfileScreen() {
  const { user, setUnlocked } = useContext(AuthContext);
  const { updateAvailable, latestVersion, isDownloading, downloadProgress, handleDownloadAndInstall } = useAppUpdate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // 0 is the default resting area (down).
  // -screenHeight * 0.40 pushes it up securely.
  const SNAP_BOTTOM = 0; 
  const SNAP_TOP = -screenHeight * 0.40; 
  
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
        
        // Decide where to snap based on velocity and swipe distance
        if (gestureState.dy < -50 || gestureState.vy < -0.5) {
          panYVal.current = SNAP_TOP;
        } else if (gestureState.dy > 50 || gestureState.vy > 0.5) {
          panYVal.current = SNAP_BOTTOM; 
        } else {
          // Snap to whichever is closer if dropped lazily
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
            <TouchableOpacity onPress={() => { setEditName(name); setEditPhone(phone); setIsEditing(true); }}>
              <MaterialCommunityIcons name={isEditing ? "close" : "pencil-outline"} size={28} color="#000" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {!isEditing ? (
          <>
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
            <Text style={styles.nameText}>{displayName}</Text>
            <Text style={styles.idText}>SECURE ID <MaterialCommunityIcons name="qrcode" size={12} /></Text>
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
          <View style={styles.dragIndicator} />
        </View>
        
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.listItem}>
            <View style={styles.listIconContainer}>
              <MaterialCommunityIcons name="cellphone" size={20} color="#000" />
            </View>
            <View>
              <Text style={styles.listTitle}>Phone number</Text>
              <Text style={styles.listSubtitle}>{displayPhone}</Text>
            </View>
          </View>

          <View style={styles.listItem}>
            <View style={styles.listIconContainer}>
              <MaterialCommunityIcons name="email-outline" size={20} color="#000" />
            </View>
            <View>
              <Text style={styles.listTitle}>Email address</Text>
              <Text style={styles.listSubtitle}>{user?.email || 'user@example.com'}</Text>
            </View>
          </View>

          <View style={styles.listItem}>
            <View style={[styles.listIconContainer, { backgroundColor: '#000' }]}>
              <MaterialCommunityIcons name="fingerprint" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.listTitle}>Key fingerprint</Text>
              <Text style={styles.listSubtitle}>3A7S350FFFSKRDLNLY4#60</Text>
            </View>
          </View>

          <View style={styles.listItem}>
            <View style={[styles.listIconContainer, { backgroundColor: '#FFDE59' }]}>
              <MaterialCommunityIcons name="cloud-download-outline" size={20} color="#000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>App Status</Text>
              {updateAvailable ? (
                <View style={{ marginTop: 2 }}>
                  <Text style={[styles.listSubtitle, { color: '#EF4444', fontWeight: 'bold' }]}>
                    Update Available: v{latestVersion}
                  </Text>
                  {isDownloading ? (
                    <Text style={{ marginTop: 6, fontSize: 13, fontWeight: 'bold' }}>
                      Downloading... {Math.round(downloadProgress * 100)}%
                    </Text>
                  ) : (
                    <TouchableOpacity style={styles.updateInlineBtn} onPress={handleDownloadAndInstall}>
                      <Text style={styles.updateInlineBtnText}>Download & Install</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Text style={styles.listSubtitle}>Version 1.0.0 (Up to date)</Text>
                  <MaterialCommunityIcons name="check-decagram" size={16} color="#10B981" style={{ marginLeft: 4 }} />
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogOut}>
            <MaterialCommunityIcons name="logout" size={20} color={colors.background} />
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
    backgroundColor: colors.secondary, 
    height: '60%',
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
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
  },
  avatarContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    justifyContent: 'center',
  },
  avatarShadow: {
    position: 'absolute',
    width: 140,
    height: 160,
    backgroundColor: '#000',
    borderRadius: 20,
    top: 5,
    left: '50%',
    marginLeft: -60,
  },
  avatarFrame: {
    width: 140,
    height: 160,
    backgroundColor: colors.primary,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderWidth: 2,
    borderColor: '#000',
  },
  avatarImage: {
    width: '130%',
    height: '110%',
    resizeMode: 'cover',
  },
  editBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 12,
  },
  nameText: {
    textAlign: 'center',
    marginTop: spacing.l,
    fontSize: 20,
    fontWeight: '800',
    color: '#000',
  },
  idText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  editContainer: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  editLabel: {
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#000',
    padding: spacing.m,
    borderRadius: 12,
    marginBottom: spacing.m,
    color: '#000',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#000',
    padding: spacing.m,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  bottomSheet: {
    backgroundColor: colors.background, 
    position: 'absolute',
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    paddingHorizontal: spacing.l,
    borderWidth: 2,
    borderColor: '#000',
    height: screenHeight * 0.85,
    top: screenHeight * 0.55, 
    width: '100%',
  },
  dragArea: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#000',
    borderRadius: 2,
  },
  scrollContent: {
    paddingBottom: screenHeight * 0.4, 
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.l,
  },
  listIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.m,
    borderWidth: 2,
    borderColor: '#000',
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  listSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#000',
    paddingVertical: spacing.m,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: spacing.s,
  },
  updateInlineBtn: {
    backgroundColor: '#00D1FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  updateInlineBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  }
});
