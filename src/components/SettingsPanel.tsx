import { useState } from 'react';
import type { TTSSettings } from '../hooks/useTTS';
import type { TranslateAPI } from '../services/translate';
import { isTTSSupported } from '../hooks/useTTS';
import { isASRSupported } from '../hooks/useASR';

interface DiagResult {
  label: string;
  ok: boolean;
  detail: string;
}

interface SettingsPanelProps {
  ttsSettings: TTSSettings;
  onTTSChange: (s: TTSSettings) => void;
  autoSpeak: boolean;
  onAutoSpeakChange: (v: boolean) => void;
  translateAPI: TranslateAPI;
  onTranslateAPIChange: (api: TranslateAPI) => void;
  voices: SpeechSynthesisVoice[];
  langA: string;
  langB: string;
  voiceOverrideA: string | null;
  voiceOverrideB: string | null;
  onVoiceOverrideAChange: (v: string | null) => void;
  onVoiceOverrideBChange: (v: string | null) => void;
  onClose: () => void;
}

export function SettingsPanel({
  ttsSettings,
  onTTSChange,
  autoSpeak,
  onAutoSpeakChange,
  translateAPI,
  onTranslateAPIChange,
  voices,
  langA,
  langB,
  voiceOverrideA,
  voiceOverrideB,
  onVoiceOverrideAChange,
  onVoiceOverrideBChange,
  onClose,
}: SettingsPanelProps) {
  const [diagResults, setDiagResults] = useState<DiagResult[]>([]);
  const [diagRunning, setDiagRunning] = useState(false);

  const voicesForLangA = voices.filter(v =>
    v.lang.toLowerCase().startsWith(langA.split('-')[0].toLowerCase())
  );
  const voicesForLangB = voices.filter(v =>
    v.lang.toLowerCase().startsWith(langB.split('-')[0].toLowerCase())
  );

  const runDiagnostics = async () => {
    setDiagRunning(true);
    const results: DiagResult[] = [];

    // HTTPS check
    const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';
    results.push({
      label: 'HTTPS / localhost',
      ok: isHTTPS,
      detail: isHTTPS
        ? `${location.protocol}//${location.hostname}`
        : '❗ Нужен HTTPS для микрофона!',
    });

    // ASR check
    const asrOk = isASRSupported();
    results.push({
      label: 'Web Speech API (ASR)',
      ok: asrOk,
      detail: asrOk
        ? 'SpeechRecognition доступен'
        : 'Не поддерживается. Используйте Chrome или Safari.',
    });

    // TTS check
    const ttsOk = isTTSSupported();
    results.push({
      label: 'Speech Synthesis (TTS)',
      ok: ttsOk,
      detail: ttsOk
        ? `${voices.length} голосов загружено`
        : 'Не поддерживается в этом браузере.',
    });

    // Network check (MyMemory API)
    try {
      const res = await Promise.race([
        fetch('https://api.mymemory.translated.net/get?q=test&langpair=en|ru'),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
      ]);
      const ok = (res as Response).ok;
      results.push({
        label: 'MyMemory API',
        ok,
        detail: ok ? 'Соединение OK' : `HTTP ${(res as Response).status}`,
      });
    } catch (e) {
      results.push({
        label: 'MyMemory API',
        ok: false,
        detail: `Недоступен: ${(e as Error).message}`,
      });
    }

    // Microphone permissions
    try {
      const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      results.push({
        label: 'Разрешение микрофона',
        ok: perm.state === 'granted',
        detail: perm.state === 'granted'
          ? 'Доступ разрешён ✓'
          : perm.state === 'prompt'
          ? 'Требует подтверждения'
          : '❗ Запрещён — разрешите в настройках браузера',
      });
    } catch {
      results.push({
        label: 'Разрешение микрофона',
        ok: false,
        detail: 'Невозможно проверить (API недоступен)',
      });
    }

    setDiagResults(results);
    setDiagRunning(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/98 backdrop-blur-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 bg-slate-900 flex-shrink-0">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>⚙️</span> Настройки
        </h2>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition-transform text-sm font-bold"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 pb-12" style={{ overscrollBehavior: 'contain' }}>

        {/* TTS Settings */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span>🔊</span> Голос (TTS)
          </h3>
          <div className="bg-slate-800/60 rounded-2xl p-4 space-y-5 border border-slate-700/40">
            <SliderRow
              label={`Скорость речи: ${ttsSettings.rate.toFixed(1)}×`}
              min={0.5} max={2.0} step={0.1}
              value={ttsSettings.rate}
              onChange={v => onTTSChange({ ...ttsSettings, rate: v })}
            />
            <SliderRow
              label={`Тон голоса: ${ttsSettings.pitch.toFixed(1)}`}
              min={0.5} max={2.0} step={0.1}
              value={ttsSettings.pitch}
              onChange={v => onTTSChange({ ...ttsSettings, pitch: v })}
            />
            <SliderRow
              label={`Громкость: ${Math.round(ttsSettings.volume * 100)}%`}
              min={0} max={1} step={0.05}
              value={ttsSettings.volume}
              onChange={v => onTTSChange({ ...ttsSettings, volume: v })}
            />
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-sm text-slate-300 block">Предпочитать женский голос</span>
                <span className="text-xs text-slate-500">Влияет на автовыбор голоса</span>
              </div>
              <Toggle value={ttsSettings.preferFemale} onChange={v => onTTSChange({ ...ttsSettings, preferFemale: v })} />
            </div>
          </div>
        </section>

        {/* Voice selection */}
        {voices.length > 0 && (
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span>🎙️</span> Выбор голоса
            </h3>
            <div className="space-y-3">
              {voicesForLangA.length > 0 ? (
                <VoiceSelect
                  label={`Голос для A (${langA})`}
                  voices={voicesForLangA}
                  value={voiceOverrideA}
                  onChange={onVoiceOverrideAChange}
                />
              ) : (
                <p className="text-sm text-slate-500 bg-slate-800/40 rounded-xl px-4 py-3">
                  Голоса для языка A ({langA}) не найдены
                </p>
              )}
              {voicesForLangB.length > 0 ? (
                <VoiceSelect
                  label={`Голос для B (${langB})`}
                  voices={voicesForLangB}
                  value={voiceOverrideB}
                  onChange={onVoiceOverrideBChange}
                />
              ) : (
                <p className="text-sm text-slate-500 bg-slate-800/40 rounded-xl px-4 py-3">
                  Голоса для языка B ({langB}) не найдены
                </p>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-2 px-1">
              📱 — встроенный · ☁️ — онлайн
            </p>
          </section>
        )}

        {/* Auto-speak */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span>🤖</span> Автоматизация
          </h3>
          <div className="bg-slate-800/60 rounded-2xl border border-slate-700/40 divide-y divide-slate-700/40">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <span className="text-sm text-slate-200 block font-medium">Автопроизношение</span>
                <span className="text-xs text-slate-500">Перевод зачитывается сразу</span>
              </div>
              <Toggle value={autoSpeak} onChange={onAutoSpeakChange} />
            </div>
          </div>
        </section>

        {/* Translation API */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span>🌍</span> API перевода
          </h3>
          <div className="space-y-2">
            {([
              { id: 'mymemory' as const, name: 'MyMemory', desc: 'Бесплатно · ~5000 зап/день · рекомендуется' },
              { id: 'lingva' as const, name: 'Lingva Translate', desc: 'Бесплатно · без лимитов · на основе Google' },
              { id: 'libretranslate' as const, name: 'LibreTranslate', desc: 'Открытый исходный код · может быть медленнее' },
            ]).map(api => (
              <button
                key={api.id}
                onClick={() => onTranslateAPIChange(api.id)}
                className={`w-full text-left px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] ${
                  translateAPI === api.id
                    ? 'border-indigo-500/70 bg-indigo-900/30 text-white'
                    : 'border-slate-700/60 bg-slate-800/60 text-slate-300'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{api.name}</span>
                  {translateAPI === api.id && (
                    <span className="text-indigo-400 font-bold">✓</span>
                  )}
                </div>
                <span className="text-xs text-slate-500 mt-0.5 block">{api.desc}</span>
              </button>
            ))}
            <p className="text-xs text-slate-600 px-1 mt-1">
              При ошибке автоматически пробует следующий API
            </p>
          </div>
        </section>

        {/* Diagnostics */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span>🔍</span> Диагностика
          </h3>
          <button
            onClick={runDiagnostics}
            disabled={diagRunning}
            className="w-full py-3.5 rounded-2xl bg-slate-700/80 text-slate-200 font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50 border border-slate-600/40"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {diagRunning ? '⏳ Проверка...' : '🔧 Запустить диагностику'}
          </button>

          {diagResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {diagResults.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
                    r.ok
                      ? 'bg-emerald-900/20 border-emerald-700/30'
                      : 'bg-red-900/20 border-red-700/30'
                  }`}
                >
                  <span className="text-lg flex-shrink-0">{r.ok ? '✅' : '❌'}</span>
                  <div>
                    <div className={`text-sm font-semibold ${r.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                      {r.label}
                    </div>
                    <div className={`text-xs mt-0.5 ${r.ok ? 'text-emerald-500' : 'text-red-400'}`}>
                      {r.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Info */}
        <section className="bg-slate-800/30 rounded-2xl p-4 border border-slate-700/30">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">ℹ️ Браузер</h3>
          <p className="text-xs text-slate-600 break-all leading-relaxed">{navigator.userAgent}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-800 rounded-lg p-2 text-center">
              <span className="text-slate-500 block">Голосов</span>
              <span className="text-slate-300 font-bold">{voices.length}</span>
            </div>
            <div className="bg-slate-800 rounded-lg p-2 text-center">
              <span className="text-slate-500 block">Протокол</span>
              <span className="text-slate-300 font-bold">{location.protocol.replace(':', '')}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Internal helpers ──────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}

function SliderRow({ label, min, max, step, value, onChange }: SliderRowProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer"
      />
      <div className="flex justify-between text-xs text-slate-600 mt-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ value, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
        value ? 'bg-indigo-500' : 'bg-slate-600'
      }`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <span
        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${
          value ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

interface VoiceSelectProps {
  label: string;
  voices: SpeechSynthesisVoice[];
  value: string | null;
  onChange: (v: string | null) => void;
}

function VoiceSelect({ label, voices, value, onChange }: VoiceSelectProps) {
  return (
    <div className="bg-slate-800/60 rounded-2xl border border-slate-700/40 px-4 py-3">
      <label className="block text-xs text-slate-400 mb-2 font-medium">{label}</label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value || null)}
        className="w-full bg-slate-700 text-white border border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        style={{ fontSize: '16px' }}
      >
        <option value="">🎲 Автовыбор</option>
        {voices.map(v => (
          <option key={v.name} value={v.name}>
            {v.localService ? '📱' : '☁️'} {v.name}
          </option>
        ))}
      </select>
    </div>
  );
}
