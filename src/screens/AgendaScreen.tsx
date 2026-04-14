import React, { useContext, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ref, get, remove } from 'firebase/database';
import { db } from '../config/firebase';
import { syncWrite, fetchWithCache } from '../utils/SyncManager';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { colors, spacing } from '../theme';
import CourseCard from '../components/CourseCard';
import { CourseSession } from '../types';
import { useIsFocused } from '@react-navigation/native';
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export default function AgendaScreen({ navigation }: any) {
  const { user, isAdmin, userName } = useContext(AuthContext);
  const { showAlert } = useCustomAlert();
  
  const greetingTitle = userName ? userName.split(' ')[0] : 'Student';
  const avatarLetter = (userName || user?.email || 'S').charAt(0).toUpperCase();
  
  const [courses, setCourses] = useState<CourseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
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

      const data = await fetchWithCache('courses', user.uid);
      const fetchedCourses: CourseSession[] = [];
      
      if (data) {
        Object.entries(data).forEach(([key, val]: any) => {
          if (val.userId === user.uid) {
            if (val.isRecurring && val.dayOfWeek === queryDayOfWeek) {
              fetchedCourses.push({ id: key, ...val } as CourseSession);
            } else if (!val.isRecurring && val.date === queryDateStr) {
              fetchedCourses.push({ id: key, ...val } as CourseSession);
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
          await syncWrite('remove', `courses/${id}`, user.uid);
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

  const typeColors: any = {
    Lecture: '#3B82F6',   // Blue
    Lab: '#F59E0B',       // Amber/Orange
    Tutorial: '#10B981',  // Emerald/Green
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.profileBtn} 
            onPress={() => navigation.navigate('Tools', { screen: 'My profile' })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            </View>
            <View>
              <Text style={styles.greetingText}>Hello, {greetingTitle}</Text>
              <Text style={styles.subtext}>Welcome back to class</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => navigation.navigate('Add')}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
          </TouchableOpacity>
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
                  style={[
                    styles.dateCard, 
                    selected && styles.dateCardSelected, 
                    today && !selected && styles.dateCardToday
                  ]}
                  onPress={() => setSelectedDate(d)}
                >
                  <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{getShortDay(d)}</Text>
                  <Text style={[styles.dateText, selected && styles.dateTextSelected]}>{d.getDate()}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: 110 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daily Schedule</Text>
            <Text style={styles.courseCount}>{courses.length} Classes</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
          ) : courses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Image 
                source={require('../../assets/student-celebrating.png')} 
                style={styles.emptyImage}
                resizeMode="contain"
              />
              <Text style={styles.emptyText}>No classes scheduled for {isToday(selectedDate) ? 'today' : 'this day'}.</Text>
              {isToday(selectedDate) && (
                <TouchableOpacity style={styles.inlineAddBtn} onPress={() => navigation.navigate('Add')}>
                  <Text style={styles.inlineAddBtnText}>Schedule a Class</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.coursesList}>
              {courses.map((course) => {
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
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: { 
    width: 45, 
    height: 45, 
    borderRadius: 22.5, 
    backgroundColor: colors.primary, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: 'bold' },
  greetingText: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  subtext: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  addButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  dateStripContainer: { marginBottom: 15, marginTop: 10 },
  dateStrip: { paddingHorizontal: 20, gap: 12 },
  dateCard: { 
    paddingVertical: 15, 
    paddingHorizontal: 12, 
    borderRadius: 20, 
    backgroundColor: colors.cardBackground, 
    alignItems: 'center', 
    width: 65,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  dateCardSelected: { 
    backgroundColor: colors.primary,
    elevation: 8,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
  },
  dateCardToday: { 
    borderWidth: 1.5, 
    borderColor: colors.primary,
  },
  dayText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', marginBottom: 6 },
  dayTextSelected: { color: colors.white },
  dateText: { color: colors.textPrimary, fontSize: 20, fontWeight: '900' },
  dateTextSelected: { color: colors.white },
  content: { padding: 20, paddingTop: 10 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  courseCount: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 4,
  },
  coursesList: { gap: 15 },
  emptyContainer: { 
    alignItems: 'center', 
    marginTop: 40,
    backgroundColor: '#FFFFFF', // Seamless blend
    borderRadius: 40,
    padding: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  emptyImage: {
    width: width * 0.75, // Increased size
    height: width * 0.75,
    marginBottom: 10,
  },
  emptyText: { 
    color: colors.textSecondary, 
    fontSize: 16, 
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  inlineAddBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 15,
  },
  inlineAddBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  }
});
