import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { colors } from '../theme';

// Configure how notifications should be handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.log('Must use physical device for push notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('focus', {
      name: 'Focus Sessions',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 500, 500],
      lightColor: colors.primary,
      showBadge: true,
    });
  }

  return finalStatus;
}

export async function scheduleFocusNotification(seconds: number, mode: 'FOCUS' | 'BREAK') {
  const title = mode === 'FOCUS' ? '🎯 Focus Session Complete!' : '☕ Break Over!';
  const body = mode === 'FOCUS' 
    ? "Great job staying focused! Your timer has finished. Ready for a break?" 
    : "Your break is over. Let's get back to those goals!";

  // For Android, we can specify a color and channel
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      color: colors.primary,
      data: { type: 'focus_timer', mode },
      // On some platforms/versions, we can try to attach images, 
      // but standard local notifications usually rely on the app icon/color
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: seconds,
      channelId: 'focus',
    },
  });
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
