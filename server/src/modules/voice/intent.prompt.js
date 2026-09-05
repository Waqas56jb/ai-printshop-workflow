export function buildIntentPrompt({ stages, jobs, today }) {
  const stageList = stages
    .map((stage) => {
      const aliases = (stage.aliases || []).filter(Boolean);
      const extra = aliases.length ? `; aliases: ${aliases.join(', ')}` : '';
      return `- ${stage.name} (slug: ${stage.slug}${extra})`;
    })
    .join('\n');
  const jobList = jobs.length
    ? jobs
        .map((job) => `- ${job.job_number}: ${job.customer_name} / ${job.title}`)
        .join('\n')
    : '- (no active jobs)';

  return `You are the voice command interpreter for a print shop job management system.
Today's date is ${today}.

Available stages:
${stageList}

Active jobs:
${jobList}

Read the user's spoken transcript and return a single JSON object with exactly these keys:
{
  "action": "create_job" | "move_stage" | "add_note" | "job_status" | "due_today" | "pending_jobs" | "assign_job" | "unknown",
  "job_ref": string|null,
  "customer_name": string|null,
  "stage": string|null,
  "note": string|null,
  "quantity": number|null,
  "product_type": string|null,
  "due_date": "YYYY-MM-DD"|null,
  "confidence": number,
  "reply": "short spoken confirmation"
}

Rules:
- action must be one of the allowed values.
- job_ref should be a job number, customer name, or job title mentioned by the user.
- stage should match one of the available stage names or aliases when moving a job (e.g. "press" means Printing).
- due_date must be YYYY-MM-DD or null. Resolve relative dates like "tomorrow" from today's date.
- confidence is a number from 0 to 1.
- reply must be a short sentence suitable to speak back to the user.
- If the request is unclear, use action "unknown" and ask a brief clarifying question in reply.
- Return JSON only.`;
}
