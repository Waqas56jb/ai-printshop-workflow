import { useState } from 'react';
import { ArrowRight, ImageIcon, Pencil } from 'lucide-react';
import { Avatar } from '../ui/Avatar.jsx';
import { Chip } from '../ui/Chip.jsx';
import { Pagination } from '../ui/Pagination.jsx';
import { dueTone, formatDueLabel } from '../../utils/date.js';

export function JobsTable({
  jobs = [],
  loading,
  selected,
  onToggle,
  onToggleAll,
  onRow,
  onMove,
  onEdit,
  stages = [],
  page,
  total,
  limit,
  onPage,
}) {
  const [openMove, setOpenMove] = useState(null);
  const allChecked = jobs.length > 0 && jobs.every((job) => selected.includes(job.id));

  return (
    <div className="panel">
      <table>
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <input type="checkbox" checked={allChecked} onChange={onToggleAll} />
            </th>
            <th>Job</th>
            <th>Customer</th>
            <th>Stage</th>
            <th>Qty</th>
            <th className="sort">Due ↓</th>
            <th>Assigned</th>
            <th>Artwork</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <tr key={index}>
                  <td colSpan={9}>
                    <div className="skel skel-row" />
                  </td>
                </tr>
              ))
            : jobs.map((job) => {
                const files = job.artworks?.length || 0;
                return (
                  <tr key={job.id} onClick={() => onRow(job.id)}>
                    <td onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.includes(job.id)}
                        onChange={() => onToggle(job.id)}
                      />
                    </td>
                    <td>
                      <span className={`prio ${job.priority || 'normal'}`}></span>
                      <span className="job-no">{job.job_number}</span>
                    </td>
                    <td>
                      <div className="title">{job.title}</div>
                      <div className="sub">{job.customer?.name || '—'}</div>
                    </td>
                    <td>
                      <Chip stage={job.stage?.name}>{job.stage?.name}</Chip>
                    </td>
                    <td className="num">{job.quantity}</td>
                    <td className={`due ${dueTone(job.due_date)}`}>{formatDueLabel(job.due_date)}</td>
                    <td>
                      {job.assignee ? (
                        <div className="who">
                          <Avatar name={job.assignee.full_name} />
                          {job.assignee.full_name.split(' ')[0]}
                        </div>
                      ) : (
                        <span className="sub">Unassigned</span>
                      )}
                    </td>
                    <td>
                      {files ? (
                        <span className="art">
                          <ImageIcon />
                          {files} file{files === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span className="art none">No artwork yet</span>
                      )}
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title="Move stage"
                          onClick={() => setOpenMove(openMove === job.id ? null : job.id)}
                        >
                          <ArrowRight />
                          {openMove === job.id ? (
                            <div className="stage-pop">
                              {stages.map((stage) => (
                                <button
                                  key={stage.id}
                                  type="button"
                                  onClick={() => {
                                    onMove(job.id, stage.id);
                                    setOpenMove(null);
                                  }}
                                >
                                  {stage.name}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </button>
                        <button type="button" className="icon-btn" title="Edit" onClick={() => onEdit(job)}>
                          <Pencil />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
      <Pagination page={page} total={total} limit={limit} onPage={onPage} />
    </div>
  );
}
