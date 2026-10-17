// Decides which overheard speech is actually a command. OMI listens all day, so
// ordinary shop conversation ("she's coming to pick this up") must never run.
// Default (no wake word): a fast-path match or command shape is a command;
// anything else goes through a cheap GPT COMMAND/CHAT check. If an admin sets
// `voice_wake_word`, the old wake-phrase rule applies instead.
import { classifyCommand, detectFastIntent, looksLikeCommand } from '../voice/intent.service.js';

const LISTEN_WINDOW_MS = 10_000;
const FILLER = /^(uh+|um+|er+|ah+|hmm+|so|okay|ok|yeah|and)$/i;
const windows = new Map();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The admin-configured wake phrases, or null when wake words are off (default).
export function wakePhrases(settings = {}) {
  const configured = String(settings.voice_wake_word || '')
    .split(',')
    .map((phrase) => phrase.trim().toLowerCase())
    .filter(Boolean);
  return configured.length ? configured : null;
}

function phrasePattern(phrase) {
  const words = phrase.split(/\s+/).filter(Boolean).map(escapeRegex);
  return new RegExp(`(?<![\\p{L}\\p{N}])${words.join('[\\s,.!?\\-]*')}(?![\\p{L}\\p{N}])`, 'giu');
}

// Speech-to-text spellings of "hey board" seen in practice ("Hey, Bored.", "Hay board",
// "Okay Ward"). Only used when the configured wake phrase is "hey board".
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
  if (phrases.includes('hey board')) {
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
// or 'command' (text to run). `via` says what made it a command. `fast` may be
// passed in when the caller already ran the fast-path match.
export async function gateUtterance(uid, text, settings = {}, { fast } = {}) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return { kind: 'ignore', reason: 'empty' };
  // OMI sometimes hears speech as Chinese/Korean/Arabic text — its own
  // mis-transcription, never a command.
  if (!isEnglishLike(clean)) return { kind: 'ignore', reason: 'omi_mistranscription' };

  const phrases = wakePhrases(settings);
  if (phrases) {
    const hit = findWake(clean, phrases);
    if (hit) {
      if (isOnlyFiller(hit.command)) {
        openWindow(uid);
        return { kind: 'listening', via: 'wake' };
      }
      return { kind: 'command', command: hit.command, via: 'wake' };
    }
    if (isWindowOpen(uid) && !isOnlyFiller(clean)) return { kind: 'command', command: clean, via: 'follow_up' };
    return { kind: 'ignore', reason: 'no_wake' };
  }

  // Right after the TV answered, short replies ("the hoodie", "yes", "second one")
  // are answers. Longer speech still goes through detection, so people chatting
  // just after a command don't get "Sorry, I didn't catch that."
  if (isWindowOpen(uid) && wordCount(clean) <= 3) {
    if (isOnlyFiller(clean)) return { kind: 'ignore', reason: 'filler' };
    return { kind: 'command', command: clean, via: 'follow_up' };
  }

  const quick = fast === undefined ? await detectFastIntent(clean) : fast;
  if (quick) return { kind: 'command', command: clean, via: 'fast', fast: quick };
  if (looksLikeCommand(clean)) return { kind: 'command', command: clean, via: 'pattern' };
  if (wordCount(clean) < 2 || isOnlyFiller(clean)) return { kind: 'ignore', reason: 'chit_chat' };

  const verdict = await classifyCommand(clean);
  if (verdict === 'COMMAND') return { kind: 'command', command: clean, via: 'classifier' };
  return { kind: 'ignore', reason: 'chit_chat' };
}
