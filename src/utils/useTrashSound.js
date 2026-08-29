/**
 * useTrashSound.js
 *
 * Preloads the crumple/bin sound so deleting is instant. Loading on demand
 * adds ~200ms, which lands the sound after the animation has already started
 * and reads as a glitch.
 *
 * Fails silently: a missing audio module or asset must never block a delete.
 */

import { useEffect, useRef, useCallback } from 'react';

import { getTrashSound } from './assets';

let Audio = null;
try {
  // eslint-disable-next-line global-require
  Audio = require('expo-av').Audio;
} catch (e) {
  Audio = null;
}

export function useTrashSound() {
  const soundRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!Audio) return undefined;

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
        });
        const asset = getTrashSound();
        if (!asset) return;
        const { sound } = await Audio.Sound.createAsync(asset, { volume: 0.85 });
        if (mounted.current) soundRef.current = sound;
        else sound.unloadAsync().catch(() => {});
      } catch (e) {
        soundRef.current = null;
      }
    })();

    return () => {
      mounted.current = false;
      const s = soundRef.current;
      soundRef.current = null;
      if (s) s.unloadAsync().catch(() => {});
    };
  }, []);

  /** Fire and forget -- never awaited, so the animation is not delayed. */
  return useCallback(() => {
    const s = soundRef.current;
    if (!s) return;
    s.replayAsync().catch(() => {});
  }, []);
}

export default useTrashSound;
