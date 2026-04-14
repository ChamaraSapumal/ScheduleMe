import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ref, push, set, update, get } from 'firebase/database';
import { db } from '../config/firebase';
import { AuthContext } from '../context/AuthContext';
import { useCustomAlert } from '../context/AlertContext';
import { colors, spacing } from '../theme';

export default function AddCourseScreen({ navigation, route }: any) {
  const { user } = useContext(AuthContext);
  const { showAlert } = useCustomAlert();
  
  const editingCourse = route.params?.course || null;

  const [isRecurring, setIsRecurring] = useState(route.params?.prefillRecurring !== undefined ? route.params.prefillRecurring : true);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState('Monday');
  const [selectedDate, setSelectedDate] = useState(route.params?.prefillDate || new Date().toISOString().split('T')[0]);
  
  const [moduleName, setModuleName] = useState('');
  const [type, setType] = useState('Lecture'); // Lecture, Lab, Tutorial
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  
  const [startTimeDate, setStartTimeDate] = useState(new Date());
  const [endTimeDate, setEndTimeDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [existingModules, setExistingModules] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      get(ref(db, 'courses')).then(snap => {
        const mods = new Set<string>();
        if (snap.exists()) {
          snap.forEach(child => {
             const data = child.val();
             if (data.userId === user.uid && data.moduleName) {
               mods.add(data.moduleName);
             }
          });
        }
        setExistingModules(Array.from(mods));
      });
    }
  }, [user]);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const types = ['Lecture', 'Lab', 'Tutorial'];

  const parseTime = (timeStr: string) => {
    if (!timeStr) return new Date();
    try {
       const [time, period] = timeStr.split(' ');
       let [hours, minutes] = time.split(':').map(Number);
       if (period === 'PM' && hours < 12) hours += 12;
       if (period === 'AM' && hours === 12) hours = 0;
       
       const d = new Date();
       d.setHours(hours, minutes, 0, 0);
       return d;
    } catch {
       return new Date();
    }
  };

  useEffect(() => {
    if (editingCourse) {
      setIsRecurring(editingCourse.isRecurring);
      if (editingCourse.isRecurring && editingCourse.dayOfWeek) {
        setSelectedDayOfWeek(editingCourse.dayOfWeek);
      } else if (!editingCourse.isRecurring && editingCourse.date) {
        setSelectedDate(editingCourse.date);
      }
      setModuleName(editingCourse.moduleName);
      setType(editingCourse.type);
      setLocation(editingCourse.location);
      setDescription(editingCourse.description || '');
      setStartTimeDate(parseTime(editingCourse.startTime));
      setEndTimeDate(parseTime(editingCourse.endTime));
    } else {
      // Clear fields if navigating without editingCourse
      if (route.params?.prefillRecurring !== undefined) {
        setIsRecurring(route.params.prefillRecurring);
      }
      if (route.params?.prefillDate) {
        setSelectedDate(route.params.prefillDate);
      }
      
      setModuleName('');
      setLocation('');
      setDescription('');
      setStartTimeDate(new Date());
      setEndTimeDate(new Date());
    }
  }, [editingCourse, route.params?.prefillRecurring, route.params?.prefillDate]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const onStartTimeChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) setStartTimeDate(selectedDate);
  };
  
  const onEndTimeChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) setEndTimeDate(selectedDate);
  };

  const handleSubmit = async () => {
    if (!moduleName) {
      showAlert({ title: 'Error', message: 'Module Name is required.' });
      return;
    }

    if (!user) {
      showAlert({ title: 'Error', message: 'You must be logged in.' });
      return;
    }

    setSubmitting(true);
    try {
      const typeColors: any = {
        Lecture: '#3B82F6',   // Blue
        Lab: '#F59E0B',       // Amber/Orange
        Tutorial: '#10B981',  // Emerald/Green
      };
      const assignedColor = typeColors[type] || colors.primary;
      
      const courseData: any = {
        userId: user.uid,
        moduleName,
        type,
        startTime: formatTime(startTimeDate),
        endTime: formatTime(endTimeDate),
        location: location || 'TBA',
        description,
        colorIndicator: assignedColor,
        isRecurring,
        createdAt: editingCourse?.createdAt || new Date().toISOString(),
      };

      if (isRecurring) {
        courseData.dayOfWeek = selectedDayOfWeek;
        courseData.date = null; // Clean up old data if switched
      } else {
        courseData.date = selectedDate;
        courseData.dayOfWeek = null;
      }

      if (editingCourse?.id) {
        await update(ref(db, `courses/${editingCourse.id}`), courseData);
        showAlert({ title: 'Success', message: 'Class updated successfully!' });
      } else {
        const coursesRef = ref(db, 'courses');
        const newCourseRef = push(coursesRef);
        await set(newCourseRef, courseData);
        showAlert({ title: 'Success', message: 'Class scheduled successfully!' });
      }

      navigation.navigate('Agenda');
      
      // Cleanup for new inserts
      if (!editingCourse) {
        setModuleName('');
        setLocation('');
        setDescription('');
      }
    } catch (error: any) {
      console.error(error);
      showAlert({ title: 'Error', message: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{editingCourse ? 'Edit class' : 'Add class'}</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="calendar-sync" size={20} color={colors.textPrimary} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Schedule Type</Text>
            </View>
            
            <View style={styles.switchRow}>
              <Text style={styles.label}>{isRecurring ? 'Weekly Recurring' : 'One-off / Unexpected'}</Text>
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: colors.textSecondary, true: colors.primary }}
                thumbColor={colors.textDark}
              />
            </View>

            {isRecurring ? (
              <View style={styles.chipsContainer}>
                {daysOfWeek.map((day) => (
                  <TouchableOpacity 
                    key={day} 
                    style={[styles.chipButton, selectedDayOfWeek === day && styles.chipButtonActive]}
                    onPress={() => setSelectedDayOfWeek(day)}
                  >
                    <Text style={[styles.chipText, selectedDayOfWeek === day && styles.chipTextActive]}>{day.substring(0, 3)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Calendar
                onDayPress={(day: any) => setSelectedDate(day.dateString)}
                markedDates={{
                  [selectedDate]: { selected: true, selectedColor: colors.primary },
                }}
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
                }}
                style={styles.calendar}
              />
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="format-list-bulleted-type" size={20} color={colors.textPrimary} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Class Type</Text>
            </View>
            <View style={styles.chipsContainer}>
              {types.map((t) => (
                <TouchableOpacity 
                  key={t} 
                  style={[styles.chipButton, type === t && styles.chipButtonActive]}
                  onPress={() => setType(t)}
                >
                  <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="information-outline" size={20} color={colors.textPrimary} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Module Information</Text>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Module Name</Text>
              <TextInput 
                style={styles.input}
                placeholder="Numerical Methods..."
                placeholderTextColor={colors.textSecondary}
                value={moduleName}
                onChangeText={setModuleName}
              />
              {!isRecurring && existingModules.length > 0 && (
                <View style={{ marginTop: spacing.s }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {existingModules.map(mod => (
                      <TouchableOpacity 
                        key={mod} 
                        style={[styles.chipButton, moduleName === mod && styles.chipButtonActive, { marginRight: spacing.xs, paddingVertical: 6, paddingHorizontal: 12 }]}
                        onPress={() => setModuleName(mod)}
                      >
                        <Text style={[styles.chipText, moduleName === mod && styles.chipTextActive, { fontSize: 12 }]}>{mod}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: spacing.s }]}>
                <Text style={styles.label}>Start Time</Text>
                <TouchableOpacity style={styles.input} onPress={() => setShowStartPicker(true)}>
                  <Text style={{ color: colors.textPrimary, fontSize: 16 }}>{formatTime(startTimeDate)}</Text>
                </TouchableOpacity>
                {showStartPicker && (
                  <DateTimePicker
                    value={startTimeDate}
                    mode="time"
                    is24Hour={false}
                    display="default"
                    onChange={onStartTimeChange}
                  />
                )}
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.s }]}>
                <Text style={styles.label}>End Time</Text>
                <TouchableOpacity style={styles.input} onPress={() => setShowEndPicker(true)}>
                   <Text style={{ color: colors.textPrimary, fontSize: 16 }}>{formatTime(endTimeDate)}</Text>
                </TouchableOpacity>
                {showEndPicker && (
                  <DateTimePicker
                    value={endTimeDate}
                    mode="time"
                    is24Hour={false}
                    display="default"
                    onChange={onEndTimeChange}
                  />
                )}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location</Text>
              <TextInput 
                style={styles.input}
                placeholder="Room 104 / Zoom..."
                placeholderTextColor={colors.textSecondary}
                value={location}
                onChangeText={setLocation}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description/Notes (Optional)</Text>
              <TextInput 
                style={[styles.input, styles.textArea]}
                placeholder="Bring lab coat..."
                placeholderTextColor={colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={colors.textDark} />
            ) : (
              <Text style={styles.submitButtonText}>{editingCourse ? 'Update Class' : 'Save Class'} <MaterialCommunityIcons name="content-save-outline" size={18} /></Text>
            )}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.m },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl, paddingTop: spacing.s },
  headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: 'bold' },
  section: { backgroundColor: colors.cardBackground, borderRadius: 16, padding: spacing.m, marginBottom: spacing.l },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.m },
  sectionIcon: { marginRight: spacing.s },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.m },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.s },
  chipButton: { backgroundColor: colors.background, paddingVertical: spacing.s, paddingHorizontal: spacing.m, borderRadius: 16, borderWidth: 1, borderColor: colors.background },
  chipButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: 'bold', fontSize: 13 },
  chipTextActive: { color: colors.textDark },
  calendar: { borderRadius: 16, marginTop: spacing.s },
  inputGroup: { marginBottom: spacing.m },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  label: { color: colors.textSecondary, marginBottom: spacing.xs, fontSize: 14, fontWeight: '500' },
  input: { backgroundColor: colors.background, color: colors.textPrimary, padding: spacing.m, borderRadius: 8, fontSize: 16 },
  textArea: { height: 80 },
  submitButton: { backgroundColor: colors.primary, padding: spacing.m, borderRadius: 8, alignItems: 'center', marginBottom: spacing.xl, flexDirection: 'row', justifyContent: 'center', gap: spacing.s },
  submitButtonText: { color: colors.textDark, fontSize: 18, fontWeight: 'bold' },
});
