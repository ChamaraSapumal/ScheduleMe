import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, get } from 'firebase/database';
import { db } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { useIsFocused } from '@react-navigation/native';
import { useCustomAlert } from '../context/AlertContext';

const { width } = Dimensions.get('window');

// Bubbly Pastel Theme Colors
const theme = {
  bg: '#F8F5FF',
  card: '#EFE7FE',
  buttonDark: '#1A1820',
  textMain: '#2D2A3B',
  textMuted: '#8F8A9E',
  highlight: '#FFFFFF',
  accentProgress: '#D2B9FF',
  danger: '#FFB1B1',
  cardDanger: '#FFE5E5' // Pastel Red for warnings
};

const TOTAL_SEMESTER_CLASSES = 15; // Set to 15 per user request

export default function AttendanceScreen() {
  const { user, userName } = useContext(AuthContext);
  const firstName = userName ? userName.split(' ')[0] : 'Student';
  const isFocused = useIsFocused();
  const { showAlert } = useCustomAlert();
  const [courses, setCourses] = useState<string[]>([]);
  const [absences, setAbsences] = useState<Record<string, number>>({});

  useEffect(() => {
    if (user && isFocused) {
      loadData();
    }
  }, [user, isFocused]);

  const loadData = async () => {
    if (!user) return;
    try {
      const coursesRef = ref(db, 'courses');
      const snapshot = await get(coursesRef);
      const uniqueModules = new Set<string>();

      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          if (data.userId === user.uid && data.moduleName) {
            uniqueModules.add(data.moduleName);
          }
        });
      }
      const courseList = Array.from(uniqueModules);
      setCourses(courseList);

      const storedAbsences = await AsyncStorage.getItem(`attendance_${user.uid}`);
      if (storedAbsences) {
        setAbsences(JSON.parse(storedAbsences));
      } else {
        const initial: Record<string, number> = {};
        courseList.forEach(c => initial[c] = 0);
        setAbsences(initial);
      }
    } catch (e) {
      console.log('Error loading attendance', e);
    }
  };

  const addAbsence = async (courseName: string) => {
    const current = absences[courseName] || 0;
    if (current >= TOTAL_SEMESTER_CLASSES) return;

    const newMissed = current + 1;
    updateAbsence(courseName, newMissed);

    const attended = TOTAL_SEMESTER_CLASSES - newMissed;
    if ((attended / TOTAL_SEMESTER_CLASSES) < 0.8) {
      showAlert({
        title: 'Eligibility Warning!',
        message: `Your attendance in ${courseName} has dropped below 80%. Please attend your next classes!`,
      });
    }
  };

  const removeAbsence = async (courseName: string) => {
    const current = absences[courseName] || 0;
    if (current <= 0) return;
    updateAbsence(courseName, current - 1);
  };

  const updateAbsence = async (courseName: string, count: number) => {
    const updated = { ...absences, [courseName]: count };
    setAbsences(updated);
    if (user) {
      await AsyncStorage.setItem(`attendance_${user.uid}`, JSON.stringify(updated));
    }
  };

  const renderCourse = ({ item }: { item: string }) => {
    const missed = absences[item] || 0;
    const attended = TOTAL_SEMESTER_CLASSES - missed;
    const progressWidth = `${(attended / TOTAL_SEMESTER_CLASSES) * 100}%`;
    const isDanger = (attended / TOTAL_SEMESTER_CLASSES) < 0.8;

    const isWarning = missed >= 3;

    return (
      <View style={[styles.courseCard, isWarning && { backgroundColor: theme.cardDanger }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.courseName}>{item}</Text>
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[styles.smallBtn, { opacity: missed <= 0 ? 0.3 : 1 }]}
              onPress={() => removeAbsence(item)}
              disabled={missed <= 0}
            >
              <MaterialCommunityIcons name="minus" size={18} color={theme.textMain} />
            </TouchableOpacity>

            <View style={styles.missedCounter}>
              <Text style={styles.missedText}>{missed}</Text>
            </View>

            <TouchableOpacity
              style={[styles.smallBtn, { opacity: missed >= TOTAL_SEMESTER_CLASSES ? 0.3 : 1 }]}
              onPress={() => addAbsence(item)}
              disabled={missed >= TOTAL_SEMESTER_CLASSES}
            >
              <MaterialCommunityIcons name="plus" size={18} color={theme.textMain} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{TOTAL_SEMESTER_CLASSES}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{attended}</Text>
            <Text style={styles.statLabel}>Attended</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: missed > 3 ? theme.danger : theme.textMain }]}>{missed}</Text>
            <Text style={styles.statLabel}>Missed</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: progressWidth as any, backgroundColor: isDanger ? theme.danger : theme.accentProgress }]} />
        </View>
      </View>
    );
  };

  const isAnyIneligible = courses.some(c => (absences[c] || 0) > 3);
  const isAnyDanger = courses.some(c => (absences[c] || 0) === 3);

  const renderHeader = () => {
    let source = require('../../assets/student-celebrating.png');
    let title = `Congrats, ${firstName}!`;
    let subtitle = "Keep up the excellent attendance!";
    let badge = "You're on a roll!";
    let icon = "fire";
    let iconColor = "#FFA500";
    let badgeBorder = false;

    if (isAnyIneligible) {
      source = require('../../assets/sad-student.png');
      title = `Oh No, ${firstName}!`;
      subtitle = "You are currently ineligible for some exams.";
      badge = "Status Critical";
      icon = "alert-octagon";
      iconColor = theme.danger;
      badgeBorder = true;
    } else if (isAnyDanger) {
      source = require('../../assets/danger-zone-student.png');
      title = `Danger Zone, ${firstName}!`;
      subtitle = "One more absence and you'll be ineligible.";
      badge = "Danger Zone";
      icon = "alert-circle";
      iconColor = "#FFD700"; // Gold/Warning
      badgeBorder = true;
    }

    return (
      <View>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <MaterialCommunityIcons name="calendar-check-outline" size={24} color={theme.textMain} />
            <Text style={styles.headerText}>Eligibility Tracker</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => showAlert({ title: 'System Healthy', message: 'Attendance data is synced locally.' })}>
            <MaterialCommunityIcons name="shield-check-outline" size={24} color={theme.textMain} />
          </TouchableOpacity>
        </View>

        <View style={styles.imageContainer}>
          <Image source={source} style={styles.avatarImage} resizeMode="contain" />
          <View style={[styles.floatingBadge, badgeBorder && { borderColor: iconColor, borderWidth: 1 }]}>
            <Text style={styles.badgeText}>{badge}</Text>
            <MaterialCommunityIcons name={icon} size={16} color={iconColor} />
          </View>
        </View>

        <View style={styles.contentArea}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={courses}
        keyExtractor={item => item}
        renderItem={renderCourse}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="book-plus-outline" size={60} color={theme.textMuted} />
            <Text style={styles.emptyText}>Add some classes in your Agenda first to track them here!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 15,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.highlight,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  headerText: {
    marginLeft: 10,
    fontWeight: '700',
    color: theme.textMain,
    fontSize: 14,
  },
  notifBtn: {
    backgroundColor: theme.highlight,
    width: 45,
    height: 45,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    marginTop: 10,
    position: 'relative',
  },
  avatarImage: {
    width: width * 0.7,
    height: 200,
  },
  floatingBadge: {
    position: 'absolute',
    top: 20,
    right: 40,
    flexDirection: 'row',
    backgroundColor: theme.highlight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  badgeText: {
    fontWeight: '800',
    fontSize: 12,
    color: theme.textMain,
    marginRight: 5,
  },
  contentArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    color: theme.textMain,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  courseCard: {
    backgroundColor: theme.card,
    borderRadius: 30,
    padding: 20,
    marginBottom: 15,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  courseName: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.textMain,
    flex: 1,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    padding: 4,
  },
  smallBtn: {
    width: 32,
    height: 32,
    backgroundColor: theme.highlight,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  missedCounter: {
    paddingHorizontal: 12,
    minWidth: 35,
    alignItems: 'center',
  },
  missedText: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.textMain,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.textMain,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    marginTop: 2,
  },
  progressContainer: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.textMuted,
    marginTop: 15,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  }
});
