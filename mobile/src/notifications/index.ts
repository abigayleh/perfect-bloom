import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Plant } from '@/api/types';
import { buildPlan, digestBody, digestTitle } from '@/notifications/plan';

const CHANNEL_ID = 'watering';

/** Required for a notification to surface while the app is foregrounded. */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Watering reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function hasPermission(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

export async function requestPermission(): Promise<boolean> {
  const { granted } = await Notifications.requestPermissionsAsync();
  if (granted) await ensureAndroidChannel();
  return granted;
}

/**
 * Replace every pending reminder with one built from current data.
 *
 * Cancel-then-reschedule rather than diffing: the plan is cheap to rebuild and
 * a stale reminder is worse than a redundant write. Called on launch and after
 * anything that moves a due date.
 */
export async function syncReminders(plants: Plant[], now: Date = new Date()): Promise<number> {
  if (!(await hasPermission())) return 0;

  await ensureAndroidChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();

  const plan = buildPlan(plants, now);
  for (const reminder of plan) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: digestTitle(reminder.names),
        body: digestBody(reminder.names),
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.at,
      },
    });
  }
  return plan.length;
}

export async function clearReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
