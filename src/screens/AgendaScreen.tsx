import React, { useContext, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ref, get, remove } from 'firebase/database';
import { db } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { colors, spacing } from '../theme';
import CourseCard from '../components/CourseCard';
import { CourseSession } from '../types';
import { useIsFocused } from '@react-navigation/native';

export default function AgendaScreen({ navigation }: any) {
  const { user, isAdmin } = useContext(AuthContext);
  const { showAlert } = useCustomAlert();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  
  const [courses, setCourses] = useState<CourseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  // New state to allow picking "that day" inside Agenda
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Generate dates: 3 days ago to 10 days ahead
    const dates = [];
    const today = new Date();
    today.setHours(0,0,0,0);
    
    for (let i = -3; i <= 10; i++) {
       const d = new Date(today);
       d.setDate(d.getDate() + i);
       dates.push(d);
    }
    setWeekDates(dates);
  }, []);

  const getDayOfWeekName = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };
  
  const getShortDay = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const formatDateString = (date: Date) => {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, '0') + "-" + String(date.getDate()).padStart(2, '0');
  };

  const fetchCourses = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const queryDateStr = formatDateString(selectedDate);
      const queryDayOfWeek = getDayOfWeekName(selectedDate);

      const coursesRef = ref(db, 'courses');
      const snapshot = await get(coursesRef);
      const fetchedCourses: CourseSession[] = [];
      
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          if (data.userId === user.uid) {
            if (data.isRecurring && data.dayOfWeek === queryDayOfWeek) {
              fetchedCourses.push({ id: childSnapshot.key, ...data } as CourseSession);
            } else if (!data.isRecurring && data.date === queryDateStr) {
              fetchedCourses.push({ id: childSnapshot.key, ...data } as CourseSession);
            }
          }
        });
      }
      
      fetchedCourses.sort((a, b) => a.startTime.localeCompare(b.startTime));
      
      setCourses(fetchedCourses);
    } catch (error: any) {
      console.error(error);
      showAlert({ title: 'Error fetching agenda', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchCourses();
    }
  }, [user, selectedDate, isFocused]);

  const handleDelete = (id: string, moduleName: string) => {
    showAlert({
      title: 'Delete Class',
      message: `Are you sure you want to delete ${moduleName}?`,
      showCancel: true,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await remove(ref(db, `courses/${id}`));
          fetchCourses();
        } catch (err) {
          showAlert({ title: 'Error', message: 'Failed to delete class.' });
        }
      }
    });
  };

  const handleEdit = (course: CourseSession) => {
    navigation.navigate('Add', { course });
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const isSelected = (d: Date) => {
    return d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
  };

  // Color mapping logic natively inside Agenda for rendering cards
  const typeColors: any = {
    Lecture: '#3B82F6',   // Blue
    Lab: '#F59E0B',       // Amber/Orange
    Tutorial: '#10B981',  // Emerald/Green
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Agenda
            {isAdmin && <Text style={{ color: colors.secondary, fontSize: 12 }}> (ADMIN)</Text>}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Add')}>
            <MaterialCommunityIcons name="plus" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.greeting}>My Timetable</Text>
        </View>

        {/* Date Strip */}
        <View style={styles.dateStripContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            ref={scrollViewRef}
            contentContainerStyle={styles.dateStrip}
          >
            {weekDates.map((d, index) => {
              const selected = isSelected(d);
              const today = isToday(d);
              return (
                <TouchableOpacity 
                  key={index} 
                  style={[styles.dateCard, selected && styles.dateCardSelected, today && !selected && styles.dateCardToday]}
                  onPress={() => setSelectedDate(d)}
                >
                  <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{getShortDay(d)}</Text>
                  <Text style={[styles.dateText, selected && styles.dateTextSelected]}>{d.getDate()}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
          ) : courses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No classes scheduled for {isToday(selectedDate) ? 'today' : 'this day'}.</Text>
              {isToday(selectedDate) && (
                <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('Add')}>
                  <Text style={styles.addButtonText}>Add your first class</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.coursesList}>
              {courses.map((course) => {
                 // Dynamic color based on type
                 const courseColor = typeColors[course.type] || course.colorIndicator || colors.primary;
                 return (
                   <CourseCard 
                     key={course.id}
                     moduleName={course.moduleName}
                     type={course.type}
                     location={course.location || 'TBD'}
                     timeRange={`${course.startTime} - ${course.endTime}`}
                     colorIndicator={courseColor}
                     onDelete={() => handleDelete(course.id as string, course.moduleName)}
                     onEdit={() => handleEdit(course)}
                   />
                 )
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.l,
    paddingHorizontal: spacing.m,
    paddingTop: spacing.s,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  profileSection: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.m, paddingHorizontal: spacing.m },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.m },
  avatarText: { color: colors.textDark, fontSize: 20, fontWeight: 'bold' },
  greeting: { color: colors.textPrimary, fontSize: 18, fontWeight: 'bold' },
  dateStripContainer: { marginBottom: spacing.m },
  dateStrip: { paddingHorizontal: spacing.m, gap: spacing.s },
  dateCard: { paddingVertical: spacing.m, paddingHorizontal: spacing.m, borderRadius: 12, backgroundColor: colors.cardBackground, alignItems: 'center', width: 60 },
  dateCardSelected: { backgroundColor: colors.primary },
  dateCardToday: { borderWidth: 1, borderColor: colors.primary },
  dayText: { color: colors.textSecondary, fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  dayTextSelected: { color: colors.textDark },
  dateText: { color: colors.textPrimary, fontSize: 18, fontWeight: 'bold' },
  dateTextSelected: { color: colors.textDark },
  content: { padding: spacing.m, paddingTop: 0 },
  coursesList: { gap: spacing.m },
  emptyContainer: { alignItems: 'center', marginTop: spacing.xl },
  emptyText: { color: colors.textSecondary, fontSize: 16, marginBottom: spacing.m },
  addButton: { paddingVertical: spacing.s, paddingHorizontal: spacing.l, backgroundColor: colors.cardBackground, borderRadius: 8 },
  addButtonText: { color: colors.textPrimary, fontWeight: 'bold' }
});
