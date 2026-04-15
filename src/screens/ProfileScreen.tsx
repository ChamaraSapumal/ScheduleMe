import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { useAppUpdate } from '../components/AppUpdater';
import { auth, db } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { ref, get, set, update } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { updateVibe } from '../utils/SyncManager';
import { colors, spacing } from '../theme';

const { width: screenWidth } = Dimensions.get('window');

// Premium Purple Palette
const profileTheme = {
  primary: '#3E315A',
  secondary: '#EFE7FE',
  background: '#F8F5FF',
  white: '#FFFFFF',
  accent: '#D2B9FF',
  textHeader: '#1A1820',
  textSecondary: '#8F8A9E',
  danger: '#FF6B6B',
  success: '#10B981',
  info: '#0EA5E9'
};

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, setUnlocked, setUserName, friends, setUniversity } = useContext(AuthContext);
  const { updateAvailable, latestVersion, isDownloading, downloadProgress, handleDownloadAndInstall, cancelDownload } = useAppUpdate();

  const currentVersion = Constants.expoConfig?.version || '1.0.0';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [universityShort, setUniversityShort] = useState('');
  const [editUniversity, setEditUniversity] = useState('');
  const friendCount = friends ? Object.keys(friends).length : 0;
  const [showVibeModal, setShowVibeModal] = useState(false);
  const [vibeEmoji, setVibeEmoji] = useState('✨');
  const [vibeText, setVibeText] = useState('Feeling Good');
  const [customVibe, setCustomVibe] = useState('');
  const [offlineSyncEnabled, setOfflineSyncEnabled] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [communityVisibility, setCommunityVisibility] = useState(false);
  const [pokeEnabled, setPokeEnabled] = useState(true);
  const [totalScore, setTotalScore] = useState(0);

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
        if (data.university) {
          setUniversityShort(data.university);
          setUniversity(data.university);
        }
        if (data.communityVisibility !== undefined) setCommunityVisibility(data.communityVisibility);
        if (data.pokeEnabled !== undefined) setPokeEnabled(data.pokeEnabled);
        if (data.totalScore) setTotalScore(data.totalScore);
        if (data.vibe) {
          setVibeEmoji(data.vibe.emoji || '✨');
          setVibeText(data.vibe.text || 'Feeling Good');
        }
      }

      const syncPref = await AsyncStorage.getItem('@offline_sync_enabled');
      setOfflineSyncEnabled(syncPref === 'true');
    } catch (error) {
      console.log('Error loading profile:', error);
    }
  };

  const toggleOfflineSync = async () => {
    if (offlineSyncEnabled) {
      setOfflineSyncEnabled(false);
      await AsyncStorage.setItem('@offline_sync_enabled', 'false');
    } else {
      setShowOfflineModal(true);
    }
  };

  const confirmEnableOffline = async () => {
    setOfflineSyncEnabled(true);
    await AsyncStorage.setItem('@offline_sync_enabled', 'true');
    setShowOfflineModal(false);
  };

  const toggleCommunityVisibility = async () => {
    if (!user) return;
    const newVal = !communityVisibility;
    setCommunityVisibility(newVal);

    try {
      const updates: any = {};
      updates[`users/${user.uid}/profile/communityVisibility`] = newVal;
      updates[`community/${user.uid}/hidePoints`] = !newVal;
      updates[`community/${user.uid}/name`] = name || 'Student';
      if (universityShort) {
        updates[`community/${user.uid}/university`] = universityShort;
      }
      updates[`community/${user.uid}/photo`] = photoUri || null;
      updates[`community/${user.uid}/score`] = totalScore;
      // also ensure pokeEnabled state is pushed to community
      updates[`community/${user.uid}/pokeEnabled`] = pokeEnabled;

      await update(ref(db), updates);
    } catch (e) {
      Alert.alert('Error', 'Could not update visibility settings.');
      setCommunityVisibility(!newVal);
    }
  };

  const togglePokeEnabled = async () => {
    if (!user) return;
    const newVal = !pokeEnabled;
    setPokeEnabled(newVal);

    try {
      const updates: any = {};
      updates[`users/${user.uid}/profile/pokeEnabled`] = newVal;
      updates[`community/${user.uid}/pokeEnabled`] = newVal;

      await update(ref(db), updates);
    } catch (e) {
      Alert.alert('Error', 'Could not update poke settings.');
      setPokeEnabled(!newVal);
    }
  };

  const handleSaveVibe = async (emoji: string, text: string) => {
    if (!user) return;
    try {
      await updateVibe(user.uid, emoji, text);
      setVibeEmoji(emoji);
      setVibeText(text);
      setShowVibeModal(false);
    } catch (e) {
      Alert.alert('Error', 'Could not update vibe.');
    }
  };

  const curatedVibes = [
    { emoji: '✍️', label: 'Grinding' },
    { emoji: '☕', label: 'Coffee Break' },
    { emoji: '🎧', label: 'In the Zone' },
    { emoji: '😵‍💫', label: 'Exam Mode' },
    { emoji: '🔥', label: 'On Fire' },
    { emoji: '😴', label: 'Exhausted' },
  ];

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
          const oldImage = await AsyncStorage.getItem(`profileImage_${user.uid}`);
          if (oldImage && oldImage !== destUri) {
            try { await FileSystem.deleteAsync(oldImage, { idempotent: true }); } catch (e) { }
          }
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
      const communityRef = ref(db, `community/${user.uid}`);

      const uniData = editUniversity.trim().toUpperCase().slice(0, 8);

      const profileUpdate = {
        name: editName,
        phone: editPhone,
        university: uniData
      };

      await update(profileRef, profileUpdate);

      // Also update community node for immediate leaderboard effect
      await update(communityRef, {
        name: editName,
        university: uniData
      });

      setName(editName);
      setUserName(editName);
      setPhone(editPhone);
      setUniversityShort(uniData);
      setUniversity(uniData);

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

  const renderCardItem = (
    icon: string,
    bgColor: string,
    iconColor: string,
    title: string,
    subtitle: string,
    onPress?: () => void,
    rightElement?: React.ReactNode,
    isFirst?: boolean,
    isLast?: boolean
  ) => {
    return (
      <View>
        <TouchableOpacity
          style={[
            styles.cardRow,
            isFirst && styles.cardRowFirst,
            isLast && styles.cardRowLast
          ]}
          onPress={onPress}
          activeOpacity={onPress ? 0.7 : 1}
        >
          <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
            <MaterialCommunityIcons name={icon as any} size={22} color={iconColor} />
          </View>
          <View style={styles.itemTextContainer}>
            <Text style={styles.itemTitle}>{title}</Text>
            <Text style={styles.itemSubtitle}>{subtitle}</Text>
          </View>
          {rightElement || (onPress && <MaterialCommunityIcons name="chevron-right" size={24} color="#CBD5E1" />)}
        </TouchableOpacity>
        {!isLast && <View style={styles.divider} />}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Premium Compact Header */}
        <View style={styles.heroWrapper}>
          <SafeAreaView edges={['top']}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>Profile</Text>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => {
                  setEditName(name);
                  setEditPhone(phone);
                  setEditUniversity(universityShort);
                  setIsEditing(!isEditing);
                }}
              >
                <MaterialCommunityIcons name={isEditing ? "close" : "square-edit-outline"} size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {!isEditing ? (
            <View style={styles.heroDisplay}>
              <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} activeOpacity={0.9}>
                <Image source={{ uri: photoUri || defaultImage }} style={styles.avatarImg} />
                <View style={styles.avatarEditBadge}>
                  <MaterialCommunityIcons name="camera" size={14} color="#FFF" />
                </View>
              </TouchableOpacity>
              <View style={styles.heroTextContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.heroName}>{displayName}</Text>
                </View>
                <View style={styles.badgesRow}>
                  <View style={styles.heroBadge}>
                    <MaterialCommunityIcons name="star-circle" size={14} color={profileTheme.accent} />
                    <Text style={styles.heroBadgeText}>Lvl {Math.floor(totalScore / 100) + 1}</Text>
                  </View>
                  <View style={[styles.heroBadge, { backgroundColor: 'rgba(210, 185, 255, 0.15)' }]}>
                    <MaterialCommunityIcons name="check-decagram" size={14} color={profileTheme.accent} />
                    <Text style={styles.heroBadgeText}>{totalScore} Pts</Text>
                  </View>
                  {universityShort ? (
                    <View style={[styles.heroBadge, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}>
                      <MaterialCommunityIcons name="school" size={14} color={profileTheme.accent} />
                      <Text style={styles.heroBadgeText}>{universityShort}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.heroBadge, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}
                    onPress={() => navigation.navigate('FriendList')}
                  >
                    <MaterialCommunityIcons name="account-group" size={14} color="#FFF" />
                    <Text style={styles.heroBadgeText}>{friendCount} {friendCount === 1 ? 'Friend' : 'Friends'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.editFormContainer}>
              <View style={styles.inputFlexRow}>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons name="account-outline" size={20} color={profileTheme.accent} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Full Name"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                  />
                </View>
              </View>
              <View style={styles.inputFlexRow}>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons name="phone-outline" size={20} color={profileTheme.accent} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    placeholder="Phone Number"
                    keyboardType="phone-pad"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                  />
                </View>
              </View>
              <View style={styles.inputFlexRow}>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons name="school-outline" size={20} color={profileTheme.accent} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={editUniversity}
                    onChangeText={setEditUniversity}
                    placeholder="University (e.g. UWU, WYB)"
                    maxLength={8}
                    placeholderTextColor="rgba(255,255,255,0.4)"
                  />
                </View>
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                <Text style={styles.saveBtnText}>Save Profile Details</Text>
                <MaterialCommunityIcons name="check-circle-outline" size={20} color={profileTheme.primary} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Settings Body */}
        <View style={styles.settingsBody}>

          <TouchableOpacity 
             style={styles.premiumDigitalCard} 
             onPress={() => navigation.navigate('ShareSocial', { initialTab: 'PROFILE' })}
             activeOpacity={0.85}
          >
             <View style={styles.digitalCardContent}>
                <View style={styles.digitalIconFrame}>
                   <MaterialCommunityIcons name="qrcode-scan" size={24} color={profileTheme.primary} />
                </View>
                <View style={styles.digitalTextFrame}>
                   <Text style={styles.digitalTitle}>My Digital Pass</Text>
                   <Text style={styles.digitalSubtitle}>Instantly connect with peers • Open QR</Text>
                </View>
                <View style={styles.arrowBox}>
                   <MaterialCommunityIcons name="chevron-right" size={20} color={profileTheme.primary} />
                </View>
             </View>
             <View style={styles.cardGlowLine} />
          </TouchableOpacity>

          <Text style={styles.sectionHeading}>Account Details</Text>
          <View style={styles.cardGroup}>
            {renderCardItem("phone-outline", "#F3F0FF", profileTheme.primary, "Primary Phone", displayPhone, undefined, undefined, true, false)}
            {renderCardItem("email-outline", "#F3F0FF", profileTheme.primary, "Email Address", user?.email || 'N/A', undefined, undefined, false, true)}
          </View>

          <Text style={styles.sectionHeading}>Peer Network</Text>
          <View style={styles.cardGroup}>
            {renderCardItem("qrcode-plus", "#E0F2FE", profileTheme.info, "Share Schedule", "Generate Timetable QR", () => navigation.navigate('ShareSocial', { initialTab: 'TIMETABLE' }), undefined, true, false)}
            {renderCardItem("qrcode-scan", "#E0F2FE", profileTheme.info, "Scan Timetable", "Sync a friend's agenda", () => navigation.navigate('ScanSocial'), undefined, false, true)}
          </View>

          <Text style={styles.sectionHeading}>Preferences & Privacy</Text>
          <View style={styles.cardGroup}>
            {renderCardItem(
              communityVisibility ? "earth" : "earth-off",
              communityVisibility ? "rgba(210, 185, 255, 0.2)" : "#F1F5F9",
              communityVisibility ? profileTheme.primary : "#94A3B8",
              "Community Visibility",
              communityVisibility ? "Visible to Peers" : "Hidden in Ghost Mode",
              toggleCommunityVisibility,
              <MaterialCommunityIcons name={communityVisibility ? "toggle-switch" : "toggle-switch-off-outline"} size={36} color={communityVisibility ? profileTheme.accent : "#CBD5E1"} />,
              true, false
            )}
            {renderCardItem(
              pokeEnabled ? "hand-wave" : "hand-wave-outline",
              pokeEnabled ? "rgba(255, 107, 107, 0.1)" : "#F1F5F9",
              pokeEnabled ? profileTheme.danger : "#94A3B8",
              "Receive Motivations",
              pokeEnabled ? "Anyone can poke me" : "Pokes completely disabled",
              togglePokeEnabled,
              <MaterialCommunityIcons name={pokeEnabled ? "toggle-switch" : "toggle-switch-off-outline"} size={36} color={pokeEnabled ? profileTheme.danger : "#CBD5E1"} />,
              false, false
            )}
            {renderCardItem(
              offlineSyncEnabled ? "cloud-check" : "cloud-off-outline",
              offlineSyncEnabled ? "rgba(210, 185, 255, 0.2)" : "#F1F5F9",
              offlineSyncEnabled ? profileTheme.primary : "#94A3B8",
              "Offline Mode",
              offlineSyncEnabled ? "Schedule saved locally" : "Requires internet",
              toggleOfflineSync,
              <MaterialCommunityIcons name={offlineSyncEnabled ? "toggle-switch" : "toggle-switch-off-outline"} size={36} color={offlineSyncEnabled ? profileTheme.accent : "#CBD5E1"} />,
              false, true
            )}
          </View>

          <Text style={styles.sectionHeading}>Security & System</Text>
          <View style={styles.cardGroup}>
            {renderCardItem("fingerprint", "#1E293B", profileTheme.accent, "Security Vault", "Biometrics & PIN active", undefined, undefined, true, false)}
            <View>
              <TouchableOpacity style={[styles.cardRow, styles.cardRowLast]} activeOpacity={1}>
                <View style={[styles.iconContainer, { backgroundColor: '#FFF0F0' }]}>
                  <MaterialCommunityIcons name="update" size={22} color={profileTheme.danger} />
                </View>
                <View style={styles.itemTextContainer}>
                  <Text style={styles.itemTitle}>App Version</Text>
                  <Text style={styles.itemSubtitle}>V{currentVersion} {updateAvailable ? `(v${latestVersion} Available)` : '(Up to date)'}</Text>
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
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogOut}>
            <MaterialCommunityIcons name="logout-variant" size={22} color={profileTheme.danger} />
            <Text style={styles.logoutBtnText}>Sign Out Securely</Text>
          </TouchableOpacity>

          <View style={styles.footerBrand}>
            <MaterialCommunityIcons name="shield-check" size={14} color="#94A3B8" />
            <Text style={styles.footerBrandText}>ScheduleMe Premium Auth</Text>
          </View>

        </View>
      </ScrollView>

      {/* Offline Mode Modal */}
      <Modal visible={showOfflineModal} transparent={true} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.storageCard}>
            <View style={styles.storageImageWrapper}>
              <Image source={require('../../assets/storage-permission.png')} style={styles.storageImage} resizeMode="contain" />
            </View>
            <View style={styles.storageContent}>
              <Text style={styles.storageTitle}>OFFLINE MODE</Text>
              <Text style={styles.storageDesc}>
                Can we securely save your schedule directly on your phone?
                This allows you to view your classes without an internet connection.
              </Text>
              <View style={styles.storageFooter}>
                <TouchableOpacity style={styles.declineButton} onPress={() => setShowOfflineModal(false)}>
                  <Text style={styles.declineText}>NOT NOW</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.enableButton} onPress={confirmEnableOffline}>
                  <Text style={styles.enableText}>ENABLE MODE</Text>
                  <MaterialCommunityIcons name="lightning-bolt" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Vibe Modal */}
      <Modal visible={showVibeModal} transparent={true} animationType="fade">
        <View style={styles.modalBackdropCenter}>
          <View style={styles.vibeModalContent}>
            <Text style={styles.modalTitle}>Set Your Vibe</Text>
            <Text style={styles.modalSubtitle}>How are you feeling right now?</Text>

            <View style={styles.vibeGrid}>
              {curatedVibes.map((v) => (
                <TouchableOpacity
                  key={v.label}
                  style={styles.vibeItem}
                  onPress={() => handleSaveVibe(v.emoji, v.label)}
                >
                  <Text style={{ fontSize: 24, marginBottom: 4 }}>{v.emoji}</Text>
                  <Text style={styles.vibeItemLabel}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.customVibeSection}>
              <TextInput
                style={styles.vibeInput}
                placeholder="Or type something custom..."
                value={customVibe}
                onChangeText={setCustomVibe}
                maxLength={20}
              />
              <TouchableOpacity
                style={[styles.vibeSubmitBtn, !customVibe.trim() && { opacity: 0.5 }]}
                disabled={!customVibe.trim()}
                onPress={() => handleSaveVibe('✨', customVibe.trim())}
              >
                <MaterialCommunityIcons name="check" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.vibeCancel} onPress={() => setShowVibeModal(false)}>
              <Text style={{ color: '#94A3B8', fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: profileTheme.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroWrapper: {
    backgroundColor: profileTheme.primary,
    paddingHorizontal: 25,
    paddingBottom: 35,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: profileTheme.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 10 : 0,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  editBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 20,
  },
  avatarImg: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: profileTheme.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  heroTextContent: {
    flex: 1,
  },
  heroName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  heroBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  editFormContainer: {
    marginTop: 10,
  },
  inputFlexRow: {
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    flexDirection: 'row',
    backgroundColor: profileTheme.accent,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  saveBtnText: {
    color: profileTheme.primary,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 8,
  },
  settingsBody: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  premiumDigitalCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(62, 49, 90, 0.05)',
    shadowColor: '#3E315A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 15,
    elevation: 3,
    overflow: 'hidden',
  },
  digitalCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  digitalIconFrame: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(210, 185, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  digitalTextFrame: {
    flex: 1,
  },
  digitalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E1B4B',
    marginBottom: 2,
  },
  digitalSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  cardGlowLine: {
    position: 'absolute',
    bottom: 0,
    left: '10%',
    right: '10%',
    height: 3,
    backgroundColor: profileTheme.accent,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    opacity: 0.3,
  },
  arrowBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(62, 49, 90, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 25,
    marginBottom: 12,
    marginLeft: 4,
  },
  cardGroup: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    shadowColor: '#3E315A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  cardRowFirst: {
    paddingTop: 20,
  },
  cardRowLast: {
    paddingBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 54,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  itemTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E1B4B',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  updateBadge: {
    backgroundColor: profileTheme.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  updateBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },
  logoutBtn: {
    flexDirection: 'row',
    backgroundColor: '#FFF0F0',
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 35,
    borderWidth: 1,
    borderColor: '#FFE4E4',
  },
  logoutBtnText: {
    color: profileTheme.danger,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 8,
  },
  footerBrand: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 25,
    opacity: 0.6,
  },
  footerBrandText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
    marginLeft: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storageCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#3E315A',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 10,
  },
  storageImageWrapper: {
    width: '100%',
    height: 180,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 10,
  },
  storageImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: '#F8F5FF',
  },
  storageContent: {
    padding: 25,
    alignItems: 'center',
  },
  storageTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#3E315A',
    marginBottom: 8,
    textAlign: 'center',
  },
  storageDesc: {
    fontSize: 14,
    color: '#6F6B7D',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 25,
    paddingHorizontal: 10,
  },
  storageFooter: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    color: '#64748B',
    fontWeight: '800',
    fontSize: 13,
  },
  enableButton: {
    flex: 1.5,
    flexDirection: 'row',
    backgroundColor: profileTheme.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: profileTheme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  enableText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    marginRight: 6,
  },
  vibePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    marginBottom: 5,
    alignSelf: 'flex-start',
  },
  vibeEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  vibeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  vibeModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 30,
    padding: 25,
    width: '90%',
    alignItems: 'center',
  },
  vibeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 15,
  },
  vibeItem: {
    width: '28%',
    aspectRatio: 1,
    backgroundColor: '#F8F5FF',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  vibeItemLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textAlign: 'center',
  },
  customVibeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
    gap: 10,
  },
  vibeInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  vibeSubmitBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vibeCancel: {
    marginTop: 20,
    padding: 10,
  },
});
