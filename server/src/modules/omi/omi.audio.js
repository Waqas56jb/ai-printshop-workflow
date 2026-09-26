import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import * as jobsService from '../jobs/jobs.service.js';
import * as stagesService from '../stages/stages.service.js';
import * as settingsService from '../settings/settings.service.js';
import { wakePhrases } from './commandGate.js';

// OMI "Realtime audio bytes" sends raw PCM16 little-endian mono chunks every few
// seconds. We cut them into utterances with a simple energy detector and
// transcribe each one ourselves, locked to English and primed with this shop's
// customer names / job numbers so names like "Sarah Khan" come out right.

const FRAME_MS = 20;
const PREROLL_MS = 400;
const END_SILENCE_MS = 700;
const MIN_SPEECH_MS = 300;
const MAX_UTTERANCE_MS = 15_000;
const IDLE_FLUSH_MS = 2500;
// Speech threshold adapts to each device's background noise (3x the running
// noise floor), clamped so a very quiet mic still triggers and a noisy shop floor
// doesn't count machine hum as speech.
const VAD_MIN_RMS = Number(process.env.OMI_VAD_MIN_RMS) || 180;
const VAD_MAX_RMS = Number(process.env.OMI_VAD_MAX_RMS) || 2500;
const NOISE_FACTOR = 3;
const TRANSCRIBE_MODEL = process.env.TRANSCRIBE_MODEL || 'gpt-4o-transcribe';
const TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';

const streams = new Map();

function streamFor(uid, sampleRate) {
  let stream = streams.get(uid);
  if (!stream || stream.sampleRate !== sampleRate) {
    stream = {
      sampleRate,
      leftover: null,
      preroll: [],
      prerollBytes: 0,
      frames: [],
      speechMs: 0,
      silenceMs: 0,
      active: false,
      timer: null,
      noise: 150,
    };
    streams.set(uid, stream);
  }
  return stream;
}

function frameRms(frame) {
  let sum = 0;
  const samples = Math.floor(frame.length / 2);
  for (let i = 0; i < samples * 2; i += 2) {
    const value = frame.readInt16LE(i);
    sum += value * value;
  }
  return samples ? Math.sqrt(sum / samples) : 0;
}

function finalize(stream, onUtterance) {
  clearTimeout(stream.timer);
  const { frames, speechMs, sampleRate } = stream;
  stream.active = false;
  stream.frames = [];
  stream.speechMs = 0;
  stream.silenceMs = 0;
  if (speechMs < MIN_SPEECH_MS) return;
  onUtterance(Buffer.concat(frames), sampleRate);
}

export function ingestAudio(uid, chunk, sampleRate, onUtterance) {
  const stream = streamFor(uid, sampleRate);
  const frameBytes = Math.max(2, Math.round((sampleRate * FRAME_MS) / 1000) * 2);
  const prerollMax = Math.round((sampleRate * PREROLL_MS) / 1000) * 2;
  const data = stream.leftover ? Buffer.concat([stream.leftover, chunk]) : chunk;

  let offset = 0;
  for (; offset + frameBytes <= data.length; offset += frameBytes) {
    const frame = Buffer.from(data.subarray(offset, offset + frameBytes));
    const rms = frameRms(frame);
    const threshold = Math.min(VAD_MAX_RMS, Math.max(VAD_MIN_RMS, stream.noise * NOISE_FACTOR));
    const loud = rms >= threshold;
    if (!loud) stream.noise = stream.noise * 0.97 + rms * 0.03;

    if (!stream.active) {
      if (loud) {
        stream.active = true;
        stream.frames = [...stream.preroll, frame];
        stream.preroll = [];
        stream.prerollBytes = 0;
        stream.speechMs = FRAME_MS;
        stream.silenceMs = 0;
      } else {
        stream.preroll.push(frame);
        stream.prerollBytes += frame.length;
        while (stream.prerollBytes > prerollMax) stream.prerollBytes -= stream.preroll.shift().length;
      }
      continue;
    }

    stream.frames.push(frame);
    if (loud) {
      stream.speechMs += FRAME_MS;
      stream.silenceMs = 0;
    } else {
      stream.silenceMs += FRAME_MS;
    }
    if (stream.silenceMs >= END_SILENCE_MS || stream.frames.length * FRAME_MS >= MAX_UTTERANCE_MS) {
      finalize(stream, onUtterance);
    }
  }

  stream.leftover = offset < data.length ? Buffer.from(data.subarray(offset)) : null;
  clearTimeout(stream.timer);
  // If the device stops sending mid-sentence, close the utterance anyway.
  if (stream.active) stream.timer = setTimeout(() => finalize(stream, onUtterance), IDLE_FLUSH_MS);
}

export function pcmToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

let vocabCache = { at: 0, text: '' };

async function vocabularyPrompt() {
  if (vocabCache.text && Date.now() - vocabCache.at < 60_000) return vocabCache.text;
  try {
    const [settings, jobs, stages] = await Promise.all([
      settingsService.getSettings(),
      jobsService.listActiveJobSummaries(),
      stagesService.listStages(),
    ]);
    const wake = wakePhrases(settings)[0] || 'hey board';
    const customers = [...new Set(jobs.map((job) => job.customer_name).filter(Boolean))].slice(0, 40);
    const numbers = jobs.map((job) => job.job_number).filter(Boolean).slice(0, 30);
    const text = [
      `${wake.replace(/\b\w/g, (c) => c.toUpperCase())}, pull up the job. Show the artwork. Mark it done.`,
      customers.length ? `Customers: ${customers.join(', ')}.` : '',
      numbers.length ? `Jobs: ${numbers.join(', ')}.` : '',
      `Stages: ${stages.map((stage) => stage.name).join(', ')}.`,
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 900);
    vocabCache = { at: Date.now(), text };
    return text;
  } catch (error) {
    logger.warn(`transcription vocabulary unavailable: ${error.message}`);
    return vocabCache.text;
  }
}

export async function transcribeEnglish(pcm, sampleRate) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('Audio transcription skipped: OPENAI_API_KEY is not configured');
    return '';
  }
  const wav = pcmToWav(pcm, sampleRate);
  const prompt = await vocabularyPrompt();
  const models = [...new Set([TRANSCRIBE_MODEL, 'whisper-1'])];

  for (const model of models) {
    const form = new FormData();
    form.append('file', new Blob([wav], { type: 'audio/wav' }), 'utterance.wav');
    form.append('model', model);
    form.append('language', 'en');
    form.append('response_format', 'json');
    if (prompt) form.append('prompt', prompt);
    try {
      const response = await fetch(TRANSCRIBE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (response.ok) {
        const json = await response.json();
        return String(json.text || '').trim();
      }
      logger.error(`transcription ${model} failed: ${response.status} ${await response.text().catch(() => '')}`);
    } catch (error) {
      logger.error(`transcription ${model} errored: ${error.message}`);
    }
  }
  return '';
}
