import * as Notifications from 'expo-notifications';
import { TODO_CATEGORY } from '@cocon/schemas';
import { strings } from '../strings/en';
import { supabase } from './supabase';
import { handleTodoAction, isTodoCategory } from './todo-actions';
import { tracker } from './tracker';

/**
 * Spec 059 FR-004 on the iPhone: a reminder's "Done", "In 1 hour" (with a time) and "Tomorrow".
 * They open the app, as spec 047's timer actions do: expo-notifications tells iOS the tap is handled
 * before the app's code runs, so in the background iOS can pause the app first and the action would
 * wait until it's next opened (032-later L120). Opened, it happens at once.
 */
const ignore = () => undefined;
const t = strings.notifications.todo;

void Notifications.setNotificationCategoryAsync(TODO_CATEGORY.timed, [
  { identifier: 'done', buttonTitle: t.done, options: { opensAppToForeground: true } },
  { identifier: 'hour', buttonTitle: t.hour, options: { opensAppToForeground: true } },
  { identifier: 'tomorrow', buttonTitle: t.tomorrow, options: { opensAppToForeground: true } },
]).catch(ignore);
void Notifications.setNotificationCategoryAsync(TODO_CATEGORY.untimed, [
  { identifier: 'done', buttonTitle: t.done, options: { opensAppToForeground: true } },
  { identifier: 'tomorrow', buttonTitle: t.tomorrow, options: { opensAppToForeground: true } },
]).catch(ignore);

// Listened for as soon as the app's code loads, before any screen exists. Each tap is handled once.
const handled = new Set<string>();
function respond(response: Notifications.NotificationResponse) {
  const { request, date } = response.notification;
  if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER || !isTodoCategory(request.content.categoryIdentifier)) return false;
  const key = `${request.identifier}|${response.actionIdentifier}|${date}`;
  if (handled.has(key)) return false;
  handled.add(key);
  void handleTodoAction({ actionIdentifier: response.actionIdentifier, categoryIdentifier: request.content.categoryIdentifier, data: request.content.data }, { client: supabase, tracker }).catch(ignore);
  return true;
}
Notifications.addNotificationResponseReceivedListener(respond);
void Notifications.getLastNotificationResponseAsync()
  .then((r) => {
    // Only an action is cleared: a plain tap stays for spec 046's opening of the reminder.
    if (r && respond(r)) Notifications.clearLastNotificationResponse();
  })
  .catch(ignore);

export const todoNotifications = true;
