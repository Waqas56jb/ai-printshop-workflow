const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

export function sortBoardJobs(jobs) {
  return [...jobs].sort((a, b) => {
    if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
    if (a.is_due_today !== b.is_due_today) return a.is_due_today ? -1 : 1;
    const ad = a.due_date || '9999-12-31';
    const bd = b.due_date || '9999-12-31';
    if (ad !== bd) return ad < bd ? -1 : 1;
    return (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4);
  });
}

export function flattenBoardJobs(stages) {
  return (stages || []).flatMap((stage) => sortBoardJobs(stage.jobs || []));
}

export function filterBoardJobs(stages, filter) {
  if (!filter || filter === 'all') return stages;
  return (stages || []).map((stage) => ({
    ...stage,
    jobs: (stage.jobs || []).filter((job) =>
      filter === 'overdue' ? job.is_overdue : filter === 'today' ? job.is_due_today : true
    ),
  }));
}
