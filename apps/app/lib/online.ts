import { useSyncExternalStore } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/** Tells the data cache when the device goes on or offline (NetInfo works on the web and iOS). */
export function watchConnection(): () => void {
  onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)));
  return () => onlineManager.setEventListener(() => undefined);
}

/** Whether changes can be saved. Offline, screens stay readable and disable their editing controls. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}
