// Decides which overheard speech is actually a command. OMI listens all day, so
// without a wake phrase every sentence of normal shop conversation ("she's coming
// to pick this up") gets parsed and executed. Only speech that follows the wake
// phrase — or arrives inside the short listening window it opens — gets through.

export const DEFAULT_WAKE_PHRASES = [
  'hey board',
  'hi board',
  'ok board',
  'okay board',
  'hey bored',
  'ok bored',
  'okay bored',
];

const LISTEN_WINDOW_MS = 10_000;
const FILLER = /^(uh+|um+|er+|ah+|hmm+|so|okay|ok|yeah|and)$/i;
const windows = new Map();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function wakePhrases(settings = {}) {
  const configured = String(settings.voice_trigger_word || '')
    .split(',')
    .map((phrase) => phrase.trim().toLowerCase())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_WAKE_PHRASES;
}

function phrasePattern(phrase) {
  const words = phrase.split(/\s+/).filter(Boolean).map(escapeRegex);
  return new RegExp(`(?<![\\p{L}\\p{N}])${words.join('[\\s,.!?\\-]*')}(?![\\p{L}\\p{N}])`, 'giu');
}

// Speech-to-text spellings of "hey board" seen in practice ("Hey, Bored.", "Hay board",
// "Okay Ward"). Only used with the default wake phrase, not a custom one.
const FUZZY_WAKE = /(?<![\p{L}\p{N}])(?:hey|hay|hi|ok|okay)[\s,.!-]*(?:board|boards|bored|bord|bard|ward)(?![\p{L}\p{N}])/giu;
// "Board, show me…" at the very start of an utterance, but only when a command verb
// follows — so "board" in normal shop talk ("foam board is ready") doesn't trigger.
const LEADING_BOARD =
  /^[\s,.!-]*(?:board|bored)[\s,.!-]+(?=(?:pull|show|open|move|mark|next|previous|prev|back|go|zoom|what|filter|create|add|assign|find|bring|display|close)\b)/iu;

// Returns the text spoken after the LAST wake phrase, or null if none was said.
export function findWake(text, phrases) {
  let end = -1;
  for (const phrase of phrases) {
    for (const match of text.matchAll(phrasePattern(phrase))) {
      end = Math.max(end, match.index + match[0].length);
    }
  }
  if (phrases === DEFAULT_WAKE_PHRASES) {
    for (const match of text.matchAll(FUZZY_WAKE)) {
      end = Math.max(end, match.index + match[0].length);
    }
    const leading = LEADING_BOARD.exec(text);
    if (leading) end = Math.max(end, leading[0].length);
  }
  if (end < 0) return null;
  return { command: text.slice(end).replace(/^[\s,.!?:;-]+/, '').trim() };
}

export function isEnglishLike(text) {
  const letters = text.match(/\p{L}/gu) || [];
  if (!letters.length) return false;
  const latin = text.match(/\p{Script=Latin}/gu) || [];
  return latin.length / letters.length >= 0.7;
}

export function wordCount(text) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

export function openWindow(uid, ms = LISTEN_WINDOW_MS) {
  windows.set(uid, Date.now() + ms);
}

export function closeWindow(uid) {
  windows.delete(uid);
}

export function isWindowOpen(uid) {
  const until = windows.get(uid);
  if (!until) return false;
  if (Date.now() > until) {
    windows.delete(uid);
    return false;
  }
  return true;
}

function isOnlyFiller(text) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return !words.length || words.every((word) => FILLER.test(word));
}

// kind: 'ignore' (not for us), 'listening' (wake phrase only, command coming next),
// or 'command' (text to run). `woke` is true when this text contained the wake phrase.
export function gateUtterance(uid, text, settings = {}) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return { kind: 'ignore', reason: 'empty' };
  if (!isEnglishLike(clean)) return { kind: 'ignore', reason: 'non_english' };

  if (settings.omi_require_wake_word === false) {
    return { kind: 'command', command: clean, woke: false };
  }

  const hit = findWake(clean, wakePhrases(settings));
  if (hit) {
    if (isOnlyFiller(hit.command)) {
      openWindow(uid);
      return { kind: 'listening', woke: true };
    }
    return { kind: 'command', command: hit.command, woke: true };
  }

  if (isWindowOpen(uid)) {
    if (isOnlyFiller(clean)) return { kind: 'listening', woke: false };
    return { kind: 'command', command: clean, woke: false };
  }

  return { kind: 'ignore', reason: 'no_wake' };
}
