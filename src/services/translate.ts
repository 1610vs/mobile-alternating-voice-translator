// Translation service with multiple API backends and 15s timeout for mobile networks

export type TranslateAPI = 'mymemory' | 'lingva' | 'libretranslate';

interface TranslateResult {
  text: string;
  api: string;
}

const TIMEOUT_MS = 15000;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );
}

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  return Promise.race([fetch(url, options), timeout(TIMEOUT_MS)]) as Promise<Response>;
}

// Split long text into chunks of max 450 chars at word boundaries
function chunkText(text: string, maxLen = 450): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let current = '';
  const words = text.split(' ');
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxLen) {
      if (current) chunks.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

// MyMemory API (free, no key needed)
async function translateMyMemory(text: string, from: string, to: string): Promise<string> {
  const chunks = chunkText(text);
  const results: string[] = [];

  for (const chunk of chunks) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${from}|${to}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
    const data = await res.json();
    if (data.responseStatus === 429) throw new Error('MyMemory rate limit');
    if (data.responseStatus !== 200) throw new Error(`MyMemory error: ${data.responseDetails}`);
    results.push(data.responseData.translatedText);
  }

  return results.join(' ');
}

// Lingva Translate (free, open source frontend for Google Translate)
async function translateLingva(text: string, from: string, to: string): Promise<string> {
  const fromCode = from.split('-')[0];
  const toCode = to.split('-')[0];
  const chunks = chunkText(text);
  const results: string[] = [];

  for (const chunk of chunks) {
    const url = `https://lingva.ml/api/v1/${fromCode}/${toCode}/${encodeURIComponent(chunk)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`Lingva HTTP ${res.status}`);
    const data = await res.json();
    if (!data.translation) throw new Error('Lingva: no translation');
    results.push(data.translation);
  }

  return results.join(' ');
}

// LibreTranslate (free, open source)
async function translateLibre(text: string, from: string, to: string): Promise<string> {
  const fromCode = from.split('-')[0];
  const toCode = to.split('-')[0];
  const chunks = chunkText(text);
  const results: string[] = [];

  for (const chunk of chunks) {
    const res = await fetchWithTimeout('https://libretranslate.com/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: chunk, source: fromCode, target: toCode, format: 'text' }),
    });
    if (!res.ok) throw new Error(`LibreTranslate HTTP ${res.status}`);
    const data = await res.json();
    if (!data.translatedText) throw new Error('LibreTranslate: no translation');
    results.push(data.translatedText);
  }

  return results.join(' ');
}

// Main translate function with fallback chain
export async function translate(
  text: string,
  from: string,
  to: string,
  preferredApi: TranslateAPI = 'mymemory'
): Promise<TranslateResult> {
  if (!text.trim()) return { text: '', api: 'none' };

  const apis: Array<{ name: TranslateAPI; fn: () => Promise<string> }> = [
    { name: 'mymemory', fn: () => translateMyMemory(text, from, to) },
    { name: 'lingva', fn: () => translateLingva(text, from, to) },
    { name: 'libretranslate', fn: () => translateLibre(text, from, to) },
  ];

  // Reorder so preferred API is first
  const ordered = [
    ...apis.filter(a => a.name === preferredApi),
    ...apis.filter(a => a.name !== preferredApi),
  ];

  let lastError: Error | null = null;
  for (const api of ordered) {
    try {
      const translated = await api.fn();
      return { text: translated, api: api.name };
    } catch (err) {
      lastError = err as Error;
      console.warn(`[translate] ${api.name} failed:`, err);
    }
  }

  throw lastError || new Error('All translation APIs failed');
}
