import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

const SOUND_ASSETS = {
  checkinSuccess: require('../../assets/sounds/checkin-success.wav'),
  checkinAlready: require('../../assets/sounds/checkin-already.wav'),
  qrInvalid: require('../../assets/sounds/qr-invalid.wav'),
  notification: require('../../assets/sounds/notification.wav'),
};

export type SoundType = keyof typeof SOUND_ASSETS;

let isAudioConfigured = false;
const playerCache: Partial<Record<SoundType, AudioPlayer>> = {};

async function ensureAudioMode() {
  if (isAudioConfigured) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    });
    isAudioConfigured = true;
  } catch {
    // Silent mode audio configuration may fail in certain environments
  }
}

/**
 * Plays an application sound effect.
 */
export async function playSound(type: SoundType): Promise<void> {
  try {
    await ensureAudioMode();
    let player = playerCache[type];
    if (!player) {
      player = createAudioPlayer(SOUND_ASSETS[type]);
      playerCache[type] = player;
    }
    await player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    try {
      const fallback = createAudioPlayer(SOUND_ASSETS[type]);
      fallback.play();
    } catch {
      // Audio unsupported in this environment
    }
  }
}

export const sounds = {
  checkinSuccess: () => playSound('checkinSuccess'),
  checkinAlready: () => playSound('checkinAlready'),
  qrInvalid: () => playSound('qrInvalid'),
  notification: () => playSound('notification'),
};
