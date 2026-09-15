import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const TTS_URL = 'https://api.openai.com/v1/audio/speech';
const MAX_CHARS = 100;

export function trimForSpeech(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_CHARS) return clean;
  return `${clean.slice(0, MAX_CHARS - 1).trimEnd()}…`;
}

export async function generateSpeech(text, voice = 'alloy') {
  const input = trimForSpeech(text);
  if (!input) return null;
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('TTS skipped: OPENAI_API_KEY is not configured');
    return null;
  }

  try {
    const response = await fetch(TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: voice || 'alloy',
        input,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      logger.error(`TTS request failed: ${response.status} ${detail}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return { audio_base64: buffer.toString('base64'), mime: 'audio/mpeg' };
  } catch (error) {
    logger.error(`TTS request errored: ${error.message}`);
    return null;
  }
}
