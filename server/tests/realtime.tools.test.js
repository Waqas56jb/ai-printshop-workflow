import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createToolExecutor } from '../src/modules/realtime/realtime.tools.js';

function jobs() {
  return [
    { id: 'j1', job_number: 'J-1025', title: '50 T-Shirts', customer_name: 'Sarah', stage_id: 's1', due_date: '2026-09-05' },
    { id: 'j2', job_number: 'J-1023', title: 'Banners', customer_name: 'Metro Gym', stage_id: 's1', due_date: '2026-09-06' },
    { id: 'j3', job_number: 'J-1021', title: 'Flyers', customer_name: 'Fit Zone', stage_id: 's1', due_date: '2026-09-06' },
  ];
}

function stages() {
  return [
    { id: 's1', name: 'Artwork', aliases: ['art'] },
    { id: 's2', name: 'Printing', aliases: ['press'] },
    { id: 's3', name: 'QC', aliases: ['quality'] },
  ];
}

function makeExecutor(extra = {}) {
  const commands = [];
  const notes = [];
  const customers = [];
  const deps = {
    listJobs: async () => ({ items: jobs(), total: 3 }),
    listActiveJobSummaries: async () => jobs(),
    matchJobsByRef: (ref, list) => {
      const q = String(ref || '').toLowerCase();
      return list.filter(
        (job) =>
          job.job_number.toLowerCase() === q ||
          job.customer_name.toLowerCase().includes(q) ||
          job.title.toLowerCase().includes(q)
      );
    },
    getJob: async (id) => jobs().find((job) => job.id === id) || { id, job_number: 'J-X', stage_id: 's1' },
    createJob: async (payload) => ({
      id: 'j-new',
      job_number: 'J-2000',
      title: payload.title,
      customer: { name: customers.at(-1)?.name },
      due_date: payload.due_date,
    }),
    moveJobStage: async (id, stageId) => {
      if (extra.blockArtwork) throw new Error('Approved artwork is required before moving this job to Printing');
      return { id, job_number: 'J-1025', stage_id: stageId, title: '50 T-Shirts' };
    },
    assignJob: async (id) => ({ id, job_number: 'J-1025' }),
    createNote: async (jobId, note) => {
      const row = { id: 'n1', job_id: jobId, note };
      notes.push(row);
      return row;
    },
    findOrCreateByName: async (name) => {
      const row = { id: 'c1', name };
      customers.push(row);
      return row;
    },
    listStages: async () => stages(),
    findStageByName: async (name) => stages().find((stage) => stage.name.toLowerCase() === String(name).toLowerCase()),
    listUsers: async () => [{ id: 'u2', full_name: 'Ayesha' }],
    getSettings: async () => ({ voice_allow_skip: extra.allowSkip || false }),
    saveVoiceCommand: async (row) => {
      commands.push(row);
      return row;
    },
    emitVoiceCommand: () => {},
    ...extra.deps,
  };
  return { execute: createToolExecutor(deps), commands, notes, customers };
}

describe('realtime tools', () => {
  it('get_due_today returns jobs', async () => {
    const { execute, commands } = makeExecutor();
    const result = await execute('get_due_today', {}, { id: 'u1' });
    assert.equal(result.ok, true);
    assert.equal(result.result.count, 3);
    assert.equal(commands[0].source, 'realtime');
    assert.equal(commands[0].action, 'due_today');
  });

  it('resolve_job returns 0, 1, or 2 matches', async () => {
    const { execute } = makeExecutor();
    const none = await execute('resolve_job', { job_ref: 'no-such-job' }, { id: 'u1' });
    const one = await execute('resolve_job', { job_ref: 'J-1025' }, { id: 'u1' });
    const two = await execute('resolve_job', { job_ref: 'gym' }, { id: 'u1' });
    assert.equal(none.result.count, 0);
    assert.equal(one.result.count, 1);
    assert.equal(one.result.candidates[0].job_number, 'J-1025');
    assert.equal(two.result.count, 2);
  });

  it('move_stage adjacent is ok', async () => {
    const { execute } = makeExecutor();
    const result = await execute('move_stage', { job_id: 'j1', stage: 'Printing' }, { id: 'u1' });
    assert.equal(result.ok, true);
    assert.equal(result.result.stage_id, 's2');
  });

  it('move_stage skip is blocked unless confirmed', async () => {
    const { execute } = makeExecutor();
    const blocked = await execute('move_stage', { job_id: 'j1', stage: 'QC' }, { id: 'u1' });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.needs_confirmation, true);
    const allowed = await execute('move_stage', { job_id: 'j1', stage: 'QC', confirmed: true }, { id: 'u1' });
    assert.equal(allowed.ok, true);
  });

  it('move_stage artwork-required is blocked', async () => {
    const { execute } = makeExecutor({ blockArtwork: true });
    const result = await execute('move_stage', { job_id: 'j1', stage: 'Printing' }, { id: 'u1' });
    assert.equal(result.ok, false);
    assert.match(result.error, /artwork/i);
  });

  it('create_job creates a customer inline', async () => {
    const { execute, customers, commands } = makeExecutor();
    const result = await execute(
      'create_job',
      { customer_name: 'Café Nine', title: '120 menu cards', quantity: 120 },
      { id: 'u1' }
    );
    assert.equal(result.ok, true);
    assert.equal(customers[0].name, 'Café Nine');
    assert.equal(commands[0].source, 'realtime');
    assert.equal(commands[0].action, 'create_job');
  });

  it('add_note writes voice_commands with source realtime', async () => {
    const { execute, notes, commands } = makeExecutor();
    const result = await execute('add_note', { job_id: 'j2', note: 'use white ink' }, { id: 'u1' });
    assert.equal(result.ok, true);
    assert.equal(notes[0].note, 'use white ink');
    assert.equal(commands[0].source, 'realtime');
    assert.equal(commands[0].action, 'add_note');
  });
});
