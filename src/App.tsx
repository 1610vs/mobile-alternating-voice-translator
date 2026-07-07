import { useState, useCallback, useRef, useEffect } from 'react';
import { useASR } from './hooks/useASR';
import { useTTS, isTTSSupported, type TTSSettings } from './hooks/useTTS';
import { translate, type TranslateAPI } from './services/translate';
import { LanguageSelector, LANGUAGES } from './components/LanguageSelector';
import { DialogBubble, type DialogEntry } from './components/DialogBubble';
import { SettingsPanel } from './components/SettingsPanel';
import { isASRSupported } from './hooks/useASR';

type ActiveSpeaker = 'A' | 'B' | null;
type AppState = 'idle' | 'listening' | 'translating' | 'speaking';

const DEFAULT_TTS: TTSSettings = {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  preferFemale: true,
};

export default function App() {
  // Languages
  const [langA, setLangA] = useState('ru-RU');
  const [langB, setLangB] = useState('en-US');

  // App state
  const [appState, setAppState] = useState<AppState>('idle');
  const [activeSpeaker, setActiveSpeaker] = useState<ActiveSpeaker>(null);
  const [interimText, setInterimText] = useState('');
  const [, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Dialog history
  const [dialog, setDialog] = useState<DialogEntry[]>([]);
  const [repeatingId, setRepeatingId] = useState<string | null>(null);
  const dialogEndRef = useRef<HTMLDivElement>(null);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [ttsSettings, setTtsSettings] = useState<TTSSettings>(DEFAULT_TTS);
  const [translateAPI, setTranslateAPI] = useState<TranslateAPI>('mymemory');
  const [voiceOverrideA, setVoiceOverrideA] = useState<string | null>(null);
  const [voiceOverrideB, setVoiceOverrideB] = useState<string | null>(null);

  // Refs for async callbacks
  const activeSpeakerRef = useRef<ActiveSpeaker>(null);
  const appStateRef = useRef<AppState>('idle');
  const langARef = useRef(langA);
  const langBRef = useRef(langB);
  const translateAPIRef = useRef(translateAPI);
  const autoSpeakRef = useRef(autoSpeak);
  const voiceOverrideARef = useRef(voiceOverrideA);
  const voiceOverrideBRef = useRef(voiceOverrideB);

  useEffect(() => { activeSpeakerRef.current = activeSpeaker; }, [activeSpeaker]);
  useEffect(() => { appStateRef.current = appState; }, [appState]);
  useEffect(() => { langARef.current = langA; }, [langA]);
  useEffect(() => { langBRef.current = langB; }, [langB]);
  useEffect(() => { translateAPIRef.current = translateAPI; }, [translateAPI]);
  useEffect(() => { autoSpeakRef.current = autoSpeak; }, [autoSpeak]);
  useEffect(() => { voiceOverrideARef.current = voiceOverrideA; }, [voiceOverrideA]);
  useEffect(() => { voiceOverrideBRef.current = voiceOverrideB; }, [voiceOverrideB]);

  // TTS hook
  const tts = useTTS(ttsSettings);

  // Capability checks
  const asrSupported = isASRSupported();
  const ttsSupported = isTTSSupported();

  // ASR callbacks
  const handleInterim = useCallback((text: string) => {
    setInterimText(text);
  }, []);

  const handleASREnd = useCallback(() => {
    if (appStateRef.current === 'listening') {
      setAppState('idle');
      setActiveSpeaker(null);
      setInterimText('');
    }
  }, []);

  const handleASRError = useCallback((err: string) => {
    setErrorMsg(err);
    setAppState('idle');
    setActiveSpeaker(null);
    setInterimText('');
    setTimeout(() => setErrorMsg(''), 6000);
  }, []);

  const handleASRResult = useCallback(async (text: string) => {
    const speaker = activeSpeakerRef.current;
    if (!speaker) return;

    setInterimText('');
    setAppState('translating');
    setStatusMsg('Перевод...');

    const fromLang = speaker === 'A' ? langARef.current : langBRef.current;
    const toLang = speaker === 'A' ? langBRef.current : langARef.current;
    const currentAPI = translateAPIRef.current;
    const shouldAutoSpeak = autoSpeakRef.current;

    try {
      const result = await translate(text, fromLang, toLang, currentAPI);

      const entry: DialogEntry = {
        id: Date.now().toString(),
        speaker,
        original: text,
        translated: result.text,
        fromLang,
        toLang,
        timestamp: new Date(),
        apiUsed: result.api,
      };

      setDialog(prev => [...prev, entry]);
      setActiveSpeaker(null);

      if (shouldAutoSpeak && result.text) {
        setAppState('speaking');
        setStatusMsg('Воспроизведение...');

        // Use voice for target language
        const targetVoice = speaker === 'A' ? voiceOverrideBRef.current : voiceOverrideARef.current;
        tts.setVoiceOverride(targetVoice);

        try {
          await tts.speak(result.text, toLang);
        } catch (err) {
          console.warn('[TTS] speak error:', err);
        }
      }

      setAppState('idle');
      setStatusMsg('');
    } catch (err) {
      const errMsg = (err as Error).message;
      setErrorMsg(`Ошибка перевода: ${errMsg}`);
      setAppState('idle');
      setActiveSpeaker(null);
      setStatusMsg('');
      setTimeout(() => setErrorMsg(''), 6000);
    }
  }, [tts]);

  // ASR for speaker A
  const asrA = useASR({
    lang: langA,
    onResult: handleASRResult,
    onInterim: handleInterim,
    onError: handleASRError,
    onEnd: handleASREnd,
  });

  // ASR for speaker B
  const asrB = useASR({
    lang: langB,
    onResult: handleASRResult,
    onInterim: handleInterim,
    onError: handleASRError,
    onEnd: handleASREnd,
  });

  // Scroll to bottom when dialog updates
  useEffect(() => {
    if (dialogEndRef.current) {
      setTimeout(() => {
        dialogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [dialog]);

  // Start listening
  const startListening = useCallback((speaker: 'A' | 'B') => {
    if (appStateRef.current !== 'idle') return;

    if (tts.isSpeaking) {
      tts.stop();
    }

    setActiveSpeaker(speaker);
    activeSpeakerRef.current = speaker;
    setAppState('listening');
    setInterimText('');
    setErrorMsg('');
    setStatusMsg('');

    if (speaker === 'A') {
      asrA.start();
    } else {
      asrB.start();
    }
  }, [tts, asrA, asrB]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (activeSpeakerRef.current === 'A') {
      asrA.stop();
    } else if (activeSpeakerRef.current === 'B') {
      asrB.stop();
    }
  }, [asrA, asrB]);

  // Swap languages
  const swapLanguages = useCallback(() => {
    if (appStateRef.current !== 'idle') return;
    const tmpA = langARef.current;
    const tmpVA = voiceOverrideARef.current;
    setLangA(langBRef.current);
    setLangB(tmpA);
    setVoiceOverrideA(voiceOverrideBRef.current);
    setVoiceOverrideB(tmpVA);
  }, []);

  // Repeat a dialog entry
  const handleRepeat = useCallback(async (entry: DialogEntry) => {
    if (tts.isSpeaking || appStateRef.current !== 'idle') return;

    setRepeatingId(entry.id);

    const targetVoice = entry.speaker === 'A' ? voiceOverrideBRef.current : voiceOverrideARef.current;
    tts.setVoiceOverride(targetVoice);

    try {
      await tts.speak(entry.translated, entry.toLang);
    } catch (err) {
      console.warn('[Repeat] TTS error:', err);
    } finally {
      setRepeatingId(null);
    }
  }, [tts]);

  // Clear dialog
  const clearDialog = useCallback(() => {
    setDialog([]);
  }, []);

  // Computed state
  const isListening = appState === 'listening';
  const isTranslating = appState === 'translating';
  const isSpeaking = appState === 'speaking';
  const isBusy = appState !== 'idle';

  const langAInfo = LANGUAGES.find(l => l.code === langA);
  const langBInfo = LANGUAGES.find(l => l.code === langB);

  return (
    <div className="min-h-[100dvh] bg-slate-900 text-white flex flex-col select-none overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50 px-4 safe-top">
        <div className="flex items-center justify-between max-w-lg mx-auto h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/50">
              <span className="text-lg leading-none">🎙️</span>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-white leading-tight tracking-tight">VoiceSwap</h1>
              <p className="text-[10px] text-slate-400 leading-tight">Голосовой переводчик</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!asrSupported && (
              <span className="text-xs text-red-400 bg-red-900/30 px-2 py-1 rounded-lg">ASR недоступен</span>
            )}
            {dialog.length > 0 && (
              <button
                onClick={clearDialog}
                className="px-3 py-1.5 rounded-xl bg-slate-700/60 text-slate-400 text-xs font-medium active:scale-95 transition-transform border border-slate-600/40"
              >
                🗑 Очистить
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="w-9 h-9 rounded-xl bg-slate-700/60 text-slate-300 flex items-center justify-center active:scale-95 transition-transform border border-slate-600/40"
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      {/* Language selectors + Swap */}
      <div className="px-4 pt-3 pb-1 max-w-lg mx-auto w-full">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <LanguageSelector value={langA} onChange={setLangA} label="Говорит A" />
          </div>
          <button
            onClick={swapLanguages}
            disabled={isBusy}
            className="mb-0.5 w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 border border-slate-500/50 flex items-center justify-center text-xl active:scale-90 transition-all disabled:opacity-40 shadow-lg"
            title="Поменять языки"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            🔄
          </button>
          <div className="flex-1">
            <LanguageSelector value={langB} onChange={setLangB} label="Говорит B" />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="px-4 pt-2 pb-1 max-w-lg mx-auto w-full">
        {errorMsg ? (
          <div className="bg-red-900/40 border border-red-700/40 rounded-2xl px-4 py-3 flex items-start gap-2.5 animate-in slide-in-from-top-1">
            <span className="text-lg mt-0.5 flex-shrink-0">⚠️</span>
            <span className="text-sm text-red-300 leading-snug">{errorMsg}</span>
          </div>
        ) : isListening ? (
          <div className="bg-slate-800/80 border border-red-500/30 rounded-2xl px-4 py-3 shadow-lg shadow-red-900/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)] flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Слушаю {activeSpeaker} • {activeSpeaker === 'A' ? langAInfo?.name : langBInfo?.name}
              </span>
              <div className="ml-auto flex gap-0.5 items-end h-4">
                {[2, 3, 4, 3, 2].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-400 rounded-full"
                    style={{ height: `${h * 3}px`, animation: `wave ${0.3 + i * 0.1}s ease-in-out infinite alternate` }}
                  />
                ))}
              </div>
            </div>
            <p className="text-sm text-white leading-relaxed min-h-[1.25rem]">
              {interimText || <span className="text-slate-500 italic text-xs">Говорите сейчас...</span>}
            </p>
          </div>
        ) : isTranslating ? (
          <div className="bg-indigo-900/30 border border-indigo-700/40 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm text-indigo-300 font-medium">Перевод...</p>
              <p className="text-xs text-indigo-400/60">API: {translateAPI}</p>
            </div>
          </div>
        ) : isSpeaking ? (
          <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-2xl px-4 py-3 flex items-center gap-3">
            <SoundWave />
            <div>
              <p className="text-sm text-emerald-300 font-medium">Воспроизведение...</p>
              <p className="text-xs text-emerald-400/60">Нажмите Стоп чтобы прервать</p>
            </div>
          </div>
        ) : (
          <div className="h-14 flex items-center justify-center">
            {dialog.length === 0 ? (
              <p className="text-xs text-slate-600 text-center">
                {asrSupported
                  ? '👇 Нажмите кнопку A или B и говорите'
                  : '❌ Ваш браузер не поддерживает распознавание речи. Используйте Chrome или Safari.'}
              </p>
            ) : (
              <p className="text-xs text-slate-700">История разговора ↑</p>
            )}
          </div>
        )}
      </div>

      {/* Dialog history */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 max-w-lg mx-auto w-full" style={{ overscrollBehavior: 'contain' }}>
        {dialog.map(entry => (
          <DialogBubble
            key={entry.id}
            entry={entry}
            onRepeat={handleRepeat}
            isRepeating={repeatingId === entry.id}
          />
        ))}
        <div ref={dialogEndRef} className="h-1" />
      </div>

      {/* Main controls */}
      <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 px-4 pt-3 safe-bottom z-30">
        <div className="max-w-lg mx-auto">
          {/* Mic buttons */}
          <div className="flex gap-3 mb-2.5">
            <MicButton
              speaker="A"
              lang={langA}
              langInfo={langAInfo}
              isActive={activeSpeaker === 'A' && isListening}
              isDisabled={isBusy && !(activeSpeaker === 'A' && isListening)}
              onPress={() => startListening('A')}
              gradient="from-indigo-600 to-blue-700"
              activeGradient="from-indigo-500 to-blue-600"
              ringColor="ring-indigo-500/60"
              glowColor="shadow-indigo-900/50"
            />
            <MicButton
              speaker="B"
              lang={langB}
              langInfo={langBInfo}
              isActive={activeSpeaker === 'B' && isListening}
              isDisabled={isBusy && !(activeSpeaker === 'B' && isListening)}
              onPress={() => startListening('B')}
              gradient="from-emerald-600 to-teal-700"
              activeGradient="from-emerald-500 to-teal-600"
              ringColor="ring-emerald-500/60"
              glowColor="shadow-emerald-900/50"
            />
          </div>

          {/* Stop / Silence button */}
          <button
            onClick={isListening ? stopListening : () => { tts.stop(); setAppState('idle'); setStatusMsg(''); }}
            disabled={!isBusy}
            className={`w-full py-3 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 border ${
              isBusy
                ? isListening
                  ? 'bg-red-600/90 text-white border-red-500/60 shadow-lg shadow-red-900/30'
                  : isSpeaking
                  ? 'bg-slate-700 text-slate-200 border-slate-600'
                  : 'bg-slate-800 text-slate-400 border-slate-700 cursor-default'
                : 'bg-slate-800/40 text-slate-600 border-slate-700/40 cursor-not-allowed'
            }`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {isListening ? (
              <><span className="text-base">⏹</span><span>Стоп</span></>
            ) : isSpeaking ? (
              <><span className="text-base">🔇</span><span>Замолчать</span></>
            ) : isTranslating ? (
              <><span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /><span>Переводим...</span></>
            ) : (
              <><span className="text-base">⏹</span><span>Стоп</span></>
            )}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          ttsSettings={ttsSettings}
          onTTSChange={setTtsSettings}
          autoSpeak={autoSpeak}
          onAutoSpeakChange={setAutoSpeak}
          translateAPI={translateAPI}
          onTranslateAPIChange={setTranslateAPI}
          voices={tts.voices}
          langA={langA}
          langB={langB}
          voiceOverrideA={voiceOverrideA}
          voiceOverrideB={voiceOverrideB}
          onVoiceOverrideAChange={setVoiceOverrideA}
          onVoiceOverrideBChange={setVoiceOverrideB}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface MicButtonProps {
  speaker: 'A' | 'B';
  lang: string;
  langInfo?: { flag: string; name: string };
  isActive: boolean;
  isDisabled: boolean;
  onPress: () => void;
  gradient: string;
  activeGradient: string;
  ringColor: string;
  glowColor: string;
}

function MicButton({
  speaker, langInfo, isActive, isDisabled, onPress,
  gradient, activeGradient, ringColor, glowColor,
}: MicButtonProps) {
  return (
    <button
      onClick={onPress}
      disabled={isDisabled}
      className={`flex-1 rounded-3xl font-bold text-white transition-all flex flex-col items-center justify-center gap-1.5 shadow-xl select-none border
        ${isActive
          ? `bg-gradient-to-br ${activeGradient} ring-4 ${ringColor} scale-[0.97] shadow-2xl ${glowColor} border-white/10`
          : isDisabled
          ? `bg-gradient-to-br ${gradient} opacity-25 cursor-not-allowed border-white/5`
          : `bg-gradient-to-br ${gradient} active:scale-[0.96] border-white/10 ${glowColor}`
        }`}
      style={{ WebkitTapHighlightColor: 'transparent', minHeight: '120px' }}
    >
      <div className="relative">
        {isActive ? (
          <>
            <span className="text-5xl">🎙️</span>
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white/30 shadow-[0_0_8px_rgba(239,68,68,1)] animate-pulse" />
          </>
        ) : (
          <span className="text-5xl">🎤</span>
        )}
      </div>

      <div className="text-3xl font-black tracking-tight">{speaker}</div>

      <div className="text-xs font-medium opacity-75 flex items-center gap-1">
        {langInfo && <span>{langInfo.flag}</span>}
        <span className="max-w-[80px] truncate">{langInfo?.name.split(' ')[0] || '...'}</span>
      </div>

      {isActive && (
        <div className="flex gap-1 items-end h-5 mt-0.5">
          {[1.5, 2.5, 3.5, 4, 3.5, 2.5, 1.5].map((h, i) => (
            <div
              key={i}
              className="w-1 bg-white/70 rounded-full"
              style={{
                height: `${h * 5}px`,
                animation: `wave ${0.35 + i * 0.07}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
      )}
    </button>
  );
}

function SoundWave() {
  return (
    <div className="flex gap-0.5 items-end h-6 flex-shrink-0">
      {[2, 3, 5, 4, 6, 4, 5, 3, 2].map((h, i) => (
        <div
          key={i}
          className="w-1 bg-emerald-400 rounded-full"
          style={{
            height: `${h * 4}px`,
            animation: `wave ${0.3 + i * 0.07}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}
