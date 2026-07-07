// Text-to-Speech hook with voiceschanged event and mobile workarounds
import { useCallback, useEffect, useRef, useState } from 'react';

export interface TTSSettings {
  rate: number;   // 0.5 - 2.0
  pitch: number;  // 0 - 2.0
  volume: number; // 0 - 1.0
  preferFemale: boolean;
}

export function isTTSSupported(): boolean {
  return 'speechSynthesis' in window;
}

function getVoicesForLang(lang: string, preferFemale: boolean): SpeechSynthesisVoice[] {
  const allVoices = window.speechSynthesis.getVoices();
  const langCode = lang.split('-')[0].toLowerCase();

  // Filter by full lang code first, then by language prefix
  let voices = allVoices.filter(v => v.lang.toLowerCase() === lang.toLowerCase());
  if (voices.length === 0) {
    voices = allVoices.filter(v => v.lang.toLowerCase().startsWith(langCode));
  }

  if (voices.length === 0) return [];

  // Try to filter by gender hint in name
  const femaleKeywords = ['female', 'woman', 'girl', 'zira', 'hazel', 'susan', 'kate', 'karen',
    'samantha', 'victoria', 'fiona', 'moira', 'tessa', 'veena', 'yelena', 'alice', 'amelie',
    'anna', 'ioana', 'andreea', 'milena', 'dariya', 'luciana'];
  const maleKeywords = ['male', 'man', 'guy', 'daniel', 'alex', 'fred', 'jorge', 'diego',
    'tarik', 'luca', 'thomas', 'nicolas', 'reed', 'nikos'];

  const keywords = preferFemale ? femaleKeywords : maleKeywords;
  const genderedVoices = voices.filter(v =>
    keywords.some(k => v.name.toLowerCase().includes(k))
  );

  return genderedVoices.length > 0 ? genderedVoices : voices;
}

export function useTTS(settings: TTSSettings) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const androidIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedVoiceOverrideRef = useRef<string | null>(null);

  // Load voices with voiceschanged event (iOS/Android workaround)
  useEffect(() => {
    if (!isTTSSupported()) return;

    let attempts = 0;
    const maxAttempts = 10;

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        setVoices(v);
        setIsLoaded(true);
        return true;
      }
      return false;
    };

    if (loadVoices()) return;

    // iOS: voices load async, need voiceschanged event
    const handler = () => {
      loadVoices();
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);

    // Fallback polling (some Android browsers)
    const interval = setInterval(() => {
      attempts++;
      if (loadVoices() || attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 300);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      clearInterval(interval);
    };
  }, []);

  const setVoiceOverride = useCallback((voiceName: string | null) => {
    selectedVoiceOverrideRef.current = voiceName;
  }, []);

  const speak = useCallback((text: string, lang: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!isTTSSupported()) {
        reject(new Error('TTS не поддерживается'));
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      if (!text.trim()) {
        resolve();
        return;
      }

      // iOS Safari needs a small delay after cancel()
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const delay = isIOS ? 150 : 0;

      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = settings.rate;
        utterance.pitch = settings.pitch;
        utterance.volume = settings.volume;
        utterance.lang = lang;

        // Select voice
        const allVoices = window.speechSynthesis.getVoices();
        if (selectedVoiceOverrideRef.current) {
          const overrideVoice = allVoices.find(
            v => v.name === selectedVoiceOverrideRef.current
          );
          if (overrideVoice) utterance.voice = overrideVoice;
        } else {
          const bestVoices = getVoicesForLang(lang, settings.preferFemale);
          if (bestVoices.length > 0) utterance.voice = bestVoices[0];
        }

        utterance.onstart = () => {
          setIsSpeaking(true);

          // Android Chrome anti-stall: resume() every 500ms
          const isAndroid = /Android/.test(navigator.userAgent);
          if (isAndroid) {
            androidIntervalRef.current = setInterval(() => {
              if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
              }
            }, 500);
          }
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          if (androidIntervalRef.current) {
            clearInterval(androidIntervalRef.current);
            androidIntervalRef.current = null;
          }
          resolve();
        };

        utterance.onerror = (event) => {
          setIsSpeaking(false);
          if (androidIntervalRef.current) {
            clearInterval(androidIntervalRef.current);
            androidIntervalRef.current = null;
          }
          if (event.error === 'interrupted' || event.error === 'canceled') {
            resolve(); // Not really an error
          } else {
            reject(new Error(`TTS ошибка: ${event.error}`));
          }
        };

        try {
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          setIsSpeaking(false);
          reject(err);
        }
      }, delay);
    });
  }, [settings]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    if (androidIntervalRef.current) {
      clearInterval(androidIntervalRef.current);
      androidIntervalRef.current = null;
    }
  }, []);

  const getVoicesForLanguage = useCallback((lang: string): SpeechSynthesisVoice[] => {
    return getVoicesForLang(lang, settings.preferFemale);
  }, [voices, settings.preferFemale]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isSpeaking, speak, stop, voices, isLoaded, getVoicesForLanguage, setVoiceOverride };
}
