import * as jobsService from '../jobs/jobs.service.js';

// Recognises the everyday board commands directly, so they skip the ~2s GPT round
// trip. Anything it isn't sure about returns null and falls through to GPT.

const LEAD = /^(?:(?:please|can you|could you|would you|will you|hey|ok|okay|now|just|and|so|um|uh|oh)\s+)+/;
const TAIL = /\s+(?:please|now|for me|thanks|thank you|real quick)$/;
const ART = '(?:artwork|artworks|art|design|designs|file|files|proof|proofs|image|images|picture|pictures|mockup|mockups)';
const SELF = /^(?:it|this|that|this job|this order|that job|the job)$/;

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function strip(text) {
  let value = normalize(text);
  let previous;
  do {
    previous = value;
    value = value.replace(LEAD, '').replace(TAIL, '').trim();
  } while (value !== previous);
  return value;
}

function intent(action, extra = {}) {
  return {
    action,
    job_ref: null,
    customer_name: null,
    stage: null,
    note: null,
    quantity: null,
    product_type: null,
    due_date: null,
    artwork_index: null,
    filter: null,
    confidence: 0.95,
    reply: null,
    ...extra,
  };
}

function matchStage(spoken, stages) {
  const q = normalize(spoken).replace(/ stage$/, '');
  return (
    stages.find((stage) => {
      const names = [stage.name, stage.slug, ...(stage.aliases || [])].map(normalize).filter(Boolean);
      return names.some((name) => name === q || `${name}s` === q || name === `${q}s`);
    }) || null
  );
}

function singleJob(ref, jobs) {
  return jobsService.matchJobsByRef(ref, jobs).length === 1;
}

export function fastIntent(transcript, { jobs = [], stages = [] } = {}) {
  const t = strip(transcript);
  if (!t) return null;

  if (
    /^(?:go )?back(?: to (?:the )?(?:main |job )?board)?$|^(?:close|dismiss|clear)(?: (?:it|this|that|the screen))?$|^(?:show|go to) (?:the )?(?:job )?board$/.test(t)
  ) {
    return intent('back_to_board', { reply: 'Back to the board.' });
  }
  if (/^next (?:job|card|order)$/.test(t)) return intent('next_job', { reply: 'Next job.' });
  if (/^(?:previous|prev|last) (?:job|card|order)$/.test(t)) return intent('prev_job', { reply: 'Previous job.' });
  if (new RegExp(`^next ${ART}$`).test(t)) return intent('next_artwork', { reply: 'Next file.' });
  if (new RegExp(`^(?:previous|prev|last) ${ART}$`).test(t)) return intent('prev_artwork', { reply: 'Previous file.' });
  if (/^zoom(?: in| out)?(?: on (?:it|this|the \w+))?$|^(?:make it (?:bigger|larger)|full ?screen(?: it)?)$/.test(t)) {
    return intent('zoom_artwork', { reply: 'Zooming.' });
  }
  if (/^(?:show |open )?(?:me )?(?:the )?(?:more )?(?:details|info|information)$|^tell me more(?: about (?:it|this))?$/.test(t)) {
    return intent('show_details');
  }

  if (/^(?:show|filter|list|what'?s|what is|what are)(?: me)?(?: the| all)? overdue(?: jobs| orders)?$/.test(t)) {
    return intent('filter_jobs', { filter: 'overdue', reply: 'Showing overdue jobs.' });
  }
  if (
    /^(?:show|filter|list|what'?s|what is|what are)(?: me)?(?: the| all)?(?: jobs| orders)?(?: that are| which are)? due today$|^(?:show |filter )?today'?s? (?:jobs|orders)$/.test(t)
  ) {
    return intent('filter_jobs', { filter: 'today', reply: 'Showing jobs due today.' });
  }
  if (/^(?:show|list)(?: me)? (?:all|everything)(?: the)?(?: jobs| orders)?$|^clear (?:the )?filter$/.test(t)) {
    return intent('filter_jobs', { filter: 'all', reply: 'Showing all jobs.' });
  }

  if (new RegExp(`^(?:show|open|display|let me see|see|pull up)(?: me)?(?: the)? ${ART}$`).test(t)) {
    return intent('show_artwork');
  }

  if (
    /^(?:mark (?:it|this|this job|this order)(?: as)? )?(?:done|ready|finished|complete|completed)$|^(?:it'?s|this is|that'?s)(?: all)? (?:done|ready|finished)$|^(?:move|send|push) (?:it|this)(?: to the| to)? (?:forward|along|next stage|next)$|^next stage$/.test(t)
  ) {
    return intent('move_stage', { stage: 'next' });
  }

  let match = t.match(/^(?:move|send|put|take) (.+?) (?:to|into|in) (?:the )?(.+?)$/);
  if (match) {
    const stage = matchStage(match[2], stages);
    if (!stage) return null;
    const who = SELF.test(match[1]) ? null : match[1];
    if (who && !singleJob(who, jobs)) return null;
    return intent('move_stage', { job_ref: who, stage: stage.name });
  }

  match = t.match(new RegExp(`^(?:show|open|display|pull up)(?: me)? (.+?)(?:'s|s)? ${ART}$`));
  if (match) {
    if (!singleJob(match[1], jobs)) return null;
    return intent('show_artwork', { job_ref: match[1] });
  }

  match = t.match(
    /^(?:pull up|bring up|show(?: me)?|open(?: up)?|find|display|go to|look up)(?: the)? (?:job (?:for|of) |order (?:for|of) )?(.+?)(?:'s)?(?: (?:job|order|card|jobs|orders))?$/
  );
  if (match) {
    const ref = match[1].trim();
    if (!ref || SELF.test(ref) || /^(?:the )?(?:job )?board$/.test(ref)) return null;
    // No match at all is usually a mis-hearing — let GPT try. Two or more matches
    // is fine: focus_job itself asks the TV which one.
    if (!jobsService.matchJobsByRef(ref, jobs).length) return null;
    return intent('focus_job', { job_ref: ref });
  }

  return null;
}
