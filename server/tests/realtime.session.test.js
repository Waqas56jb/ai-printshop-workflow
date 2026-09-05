import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createSession } from '../src/modules/realtime/realtime.controller.js';
import * as realtimeService from '../src/modules/realtime/realtime.service.js';

const KEY = 'sk-test-openai-key-should-never-leak';

describe('realtime session', () => {
  let previousKey;

  before(() => {
    previousKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = KEY;
  });

  after(() => {
    process.env.OPENAI_API_KEY = previousKey;
  });

  it('createSession returns client_secret and never includes the API key', async () => {
    const fakeFetch = async () => ({
      ok: true,
      json: async () => ({
        model: 'gpt-4o-realtime-preview',
        expires_at: 1700000000,
        client_secret: { value: 'ek_ephemeral_secret', expires_at: 1700000000 },
      }),
    });

    const data = await realtimeService.createSession(
      { id: 'u1', role: 'staff', profile: { full_name: 'Bilal' }, email: 'b@x.com' },
      fakeFetch,
      {
        getSettings: async () => ({
          voice_agent_enabled: true,
          voice_agent_voice: 'alloy',
          business_name: 'Print Shop',
        }),
        listStages: async () => [{ name: 'Quote', aliases: [] }],
        listJobs: async () => [],
      }
    );

    assert.equal(data.client_secret, 'ek_ephemeral_secret');
    assert.equal(data.model, 'gpt-4o-realtime-preview');
    const body = JSON.stringify(data);
    assert.equal(body.includes(KEY), false);
    assert.equal(body.includes('OPENAI_API_KEY'), false);
    assert.equal(body.toLowerCase().includes('sk-test-openai'), false);
  });

  it('POST /api/realtime/session JSON has no API key', async () => {
    const original = realtimeService.createSession;
    realtimeService.createSession = async () => ({
      client_secret: 'ek_ephemeral_secret',
      model: 'gpt-4o-realtime-preview',
      expires_at: 1700000000,
    });

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: 'u1', role: 'staff', profile: { full_name: 'Bilal' } };
      next();
    });
    app.post('/api/realtime/session', createSession);

    const server = await new Promise((resolve) => {
      const httpServer = app.listen(0, () => resolve(httpServer));
    });
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/realtime/session`, { method: 'POST' });
    const json = await response.json();
    await new Promise((resolve) => server.close(resolve));
    realtimeService.createSession = original;

    assert.equal(response.status, 200);
    assert.equal(json.data.client_secret, 'ek_ephemeral_secret');
    const raw = JSON.stringify(json);
    assert.equal(raw.includes(KEY), false);
    assert.equal(raw.includes('OPENAI_API_KEY'), false);
  });
});
