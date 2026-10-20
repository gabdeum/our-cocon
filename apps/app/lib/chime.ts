import { Vibration } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;

/**
 * The soft kitchen-bell chime (FR-005; assets/sounds/kitchen-bell.wav, made for this app).
 * `playsInSilentMode: false` keeps it quiet when the iPhone's silent switch is on.
 * Best effort: a browser can refuse sound before the first tap; the banner still shows.
 */
export function playChime(): void {
  try {
    if (!player) {
      setAudioModeAsync({ playsInSilentMode: false }).catch(() => undefined);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      player = createAudioPlayer(require('../assets/sounds/kitchen-bell.wav') as number);
    }
    const p = player;
    p.seekTo(0)
      .then(() => p.play())
      .catch(() => undefined);
  } catch {
    // No sound on this device; the banner and vibration still tell the cook.
  }
}

/**
 * Two short buzzes. Android follows its vibrate setting; iOS gives apps no way to read the silent
 * switch, so the iPhone buzzes even on silent (noted in spec 010's Changelog).
 */
export function vibrateDone(): void {
  Vibration.vibrate([0, 400, 200, 400]);
}
