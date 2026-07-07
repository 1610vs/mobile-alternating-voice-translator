import { LANGUAGES } from './LanguageSelector';

export interface DialogEntry {
  id: string;
  speaker: 'A' | 'B';
  original: string;
  translated: string;
  fromLang: string;
  toLang: string;
  timestamp: Date;
  apiUsed?: string;
}

interface DialogBubbleProps {
  entry: DialogEntry;
  onRepeat: (entry: DialogEntry) => void;
  isRepeating?: boolean;
}

export function DialogBubble({ entry, onRepeat, isRepeating = false }: DialogBubbleProps) {
  const isA = entry.speaker === 'A';

  const fromLang = LANGUAGES.find(l => l.code === entry.fromLang);
  const toLang = LANGUAGES.find(l => l.code === entry.toLang);

  const timeStr = entry.timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex flex-col mb-4 ${isA ? 'items-start' : 'items-end'}`}>
      {/* Speaker label */}
      <div className={`flex items-center gap-1.5 mb-1.5 ${isA ? 'flex-row' : 'flex-row-reverse'}`}>
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shadow-lg ${
            isA
              ? 'bg-gradient-to-br from-indigo-500 to-blue-600'
              : 'bg-gradient-to-br from-emerald-500 to-teal-600'
          }`}
        >
          {entry.speaker}
        </div>
        <span className="text-xs text-slate-500">{timeStr}</span>
        {fromLang && <span className="text-sm">{fromLang.flag}</span>}
        <span className="text-xs text-slate-600">→</span>
        {toLang && <span className="text-sm">{toLang.flag}</span>}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[88%] rounded-2xl shadow-lg overflow-hidden ${
          isA ? 'rounded-tl-sm' : 'rounded-tr-sm'
        }`}
      >
        {/* Original text */}
        <div className="px-4 pt-3 pb-2 text-sm text-slate-300 border-b bg-slate-700/80 border-slate-600/50">
          <span className="text-[10px] text-slate-500 block mb-0.5 uppercase tracking-wider">
            {fromLang?.name || entry.fromLang}
          </span>
          <span className="leading-snug">{entry.original}</span>
        </div>

        {/* Translated text */}
        <div
          className={`px-4 pt-2.5 pb-3 text-base font-medium leading-snug ${
            isA
              ? 'bg-gradient-to-br from-indigo-900/70 to-blue-900/70 text-blue-100'
              : 'bg-gradient-to-br from-emerald-900/70 to-teal-900/70 text-emerald-100'
          }`}
        >
          <span className="text-[10px] opacity-50 block mb-0.5 uppercase tracking-wider">
            {toLang?.name || entry.toLang}
          </span>
          {entry.translated}
        </div>
      </div>

      {/* Actions */}
      <div className={`flex items-center gap-2 mt-1.5 ${isA ? 'flex-row' : 'flex-row-reverse'}`}>
        <button
          onClick={() => onRepeat(entry)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all active:scale-95 ${
            isRepeating
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'bg-slate-700/60 text-slate-400 border border-slate-600/40 active:text-slate-200'
          }`}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {isRepeating ? (
            <>
              <span className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>Звучит...</span>
            </>
          ) : (
            <>
              <span>🔊</span>
              <span>Повтор</span>
            </>
          )}
        </button>
        {entry.apiUsed && (
          <span className="text-[10px] text-slate-700">via {entry.apiUsed}</span>
        )}
      </div>
    </div>
  );
}
