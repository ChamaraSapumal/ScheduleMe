import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { ref, get, remove } from 'firebase/database';
import { db } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { colors, spacing } from '../theme';
import CourseCard from '../components/CourseCard';
import { CourseSession } from '../types';
import { useIsFocused } from '@react-navigation/native';
import { fetchSriLankaHolidays } from '../utils/srilankaHolidays';

export default function CalendarScreen({ navigation }: any) {
  const { user } = useContext(AuthContext);
  const { showAlert } = useCustomAlert();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [courses, setCourses] = useState<CourseSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [markedDates, setMarkedDates] = useState<any>({});
  
  const isFocused = useIsFocused();

  const getDayOfWeekName = (dateStr: string) => {
    const d = new Date(dateStr);
    const options: any = { weekday: 'long' };
    return new Intl.DateTimeFormat('en-US', options).format(d);
  };

  const fetchCoursesAndMarks = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const selectedDayOfWeek = getDayOfWeekName(selectedDate);
      const coursesRef = ref(db, 'courses');
      const snapshot = await get(coursesRef);
      
      const fetchedCourses: CourseSession[] = [];
      let newMarked: any = {};
      
      const upcomingDates = [];
      for (let i = 0; i < 90; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        upcomingDates.push({
          date: d.toISOString().split('T')[0],
          dayName: getDayOfWeekName(d.toISOString())
        });
      }
      
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          if (data.userId === user.uid) {
            
            if (data.isRecurring && data.dayOfWeek === selectedDayOfWeek) {
              fetchedCourses.push({ id: childSnapshot.key, ...data } as CourseSession);
            } else if (!data.isRecurring && data.date === selectedDate) {
              fetchedCourses.push({ id: childSnapshot.key, ...data } as CourseSession);
            }
            
            if (data.isRecurring) {
              upcomingDates.forEach(ud => {
                if (ud.dayName === data.dayOfWeek) {
                  newMarked[ud.date] = { 
                    marked: true, 
                    dotColor: data.colorIndicator || colors.secondary 
                  };
                }
              });
            } else if (data.date) {
              newMarked[data.date] = {
                marked: true,
                dotColor: data.colorIndicator || colors.secondary
              };
            }
          }
        });
      }
      
      const sriLankaHolidays = await fetchSriLankaHolidays();
      
      Object.entries(sriLankaHolidays).forEach(([dateStr, holiday]) => {
        newMarked[dateStr] = {
           ...newMarked[dateStr],
           marked: true,
           dotColor: '#EF4444' 
        };
        
        if (dateStr === selectedDate) {
           fetchedCourses.unshift({
              id: `holiday-${dateStr}`,
              moduleName: holiday.name,
              type: holiday.type,
              location: 'Sri Lanka 🇱🇰',
              startTime: '00:00',
              endTime: '23:59',
              isRecurring: false,
              colorIndicator: '#EF4444',
           } as any);
        }
      });

      fetchedCourses.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setCourses(fetchedCourses);
      
      newMarked[selectedDate] = { 
        ...newMarked[selectedDate], 
        selected: true, 
        selectedColor: colors.primary 
      };
      
      setMarkedDates(newMarked);
    } catch (error: any) {
      console.error(error);
      showAlert({ title: 'Error fetching calendar', message: error.message });
    } finally {
      setLoading(false);
    }
  }, [user, selectedDate]);

  useEffect(() => {
    if (isFocused) {
      fetchCoursesAndMarks();
    }
  }, [isFocused, fetchCoursesAndMarks]);

  const handleDelete = (id: string, moduleName: string) => {
    showAlert({
      title: 'Delete Class',
      message: `Are you sure you want to delete ${moduleName}?`,
      showCancel: true,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await remove(ref(db, `courses/${id}`));
          fetchCoursesAndMarks();
        } catch (err) {
          showAlert({ title: 'Error', message: 'Failed to delete class.' });
        }
      }
    });
  };

  const handleEdit = (course: CourseSession) => {
    navigation.navigate('Add', { course });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Timetable</Text>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => navigation.navigate('Add', { prefillDate: selectedDate, prefillRecurring: false })}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.calendarContainer}>
          <Calendar
            onDayPress={(day: any) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            theme={{
              backgroundColor: colors.cardBackground,
              calendarBackground: colors.cardBackground,
              textSectionTitleColor: colors.textSecondary,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: colors.textDark,
              todayTextColor: colors.secondary,
              dayTextColor: colors.textPrimary,
              textDisabledColor: colors.textSecondary,
              monthTextColor: colors.textPrimary,
              arrowColor: colors.textPrimary,
              dotColor: colors.secondary,
              selectedDotColor: colors.textDark
            }}
            style={styles.calendar}
          />
        </View>

        {loading ? (
           <ActivityIndicator size="large" color={colors.primary} />
        ) : courses.length === 0 ? (
           <View style={{ alignItems: 'center', marginTop: 20 }}>
             <Text style={{ color: colors.textSecondary }}>No classes on this date.</Text>
           </View>
        ) : (
          <View style={styles.coursesContainer}>
            {courses.map((course) => {
               const typeColors: any = {
                 Lecture: '#3B82F6',
                 Lab: '#F59E0B',
                 Tutorial: '#10B981',
               };
               const courseColor = typeColors[course.type] || course.colorIndicator || colors.primary;
               return (
                 <CourseCard 
                   key={course.id}
                   moduleName={course.moduleName}
                   type={course.type}
                   location={course.location || 'TBD'}
                   timeRange={course.startTime === '00:00' && course.endTime === '23:59' ? 'All Day' : `${course.startTime} - ${course.endTime}`}
                   colorIndicator={courseColor}
                   onDelete={String(course.id).startsWith('holiday-') ? undefined : () => handleDelete(course.id as string, course.moduleName)}
                   onEdit={String(course.id).startsWith('holiday-') ? undefined : () => handleEdit(course)}
                 />
               );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.m },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.l,
    paddingTop: spacing.s,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  addButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  calendarContainer: { borderRadius: 16, overflow: 'hidden', marginBottom: spacing.xl },
  calendar: { borderRadius: 16 },
  coursesContainer: { gap: spacing.m },
});
