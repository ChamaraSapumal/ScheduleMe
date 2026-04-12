export interface CourseSession {
  id?: string;
  userId: string;
  moduleName: string;
  type: string; // 'Lecture', 'Lab', 'Tutorial'
  isRecurring: boolean;
  dayOfWeek?: string; // 'Monday', 'Tuesday', etc.
  date?: string; // 'YYYY-MM-DD' for one-off
  startTime: string; // '10:00am'
  endTime: string; // '11:00am'
  location: string;
  description: string;
  colorIndicator: string;
  createdAt?: string;
}
