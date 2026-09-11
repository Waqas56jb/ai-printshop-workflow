import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSharePack } from '../services/api.js';
import '../styles/share.css';

const STATUS = {
  revision: 'Revision',
  proof: 'Proof sent',
  approved: 'Approved',
  print_ready: 'Print ready',
};

function isImage(file) {
  const type = (file.file_type || '').toLowerCase();
  const name = (file.file_name || '').toLowerCase();
  return type.startsWith('image/') || file.kind === 'image' || /\.(png|jpe?g|gif|webp|svg)$/.test(name);
}

function isPdf(file) {
  return (file.file_type || '').includes('pdf') || /\.pdf$/i.test(file.file_name || '') || file.kind === 'pdf';
}

function rank(file) {
  return { print_ready: 0, approved: 1, proof: 2, revision: 3 }[file.proof_status] ?? 4;
}

function groupByFolder(files) {
  const groups = new Map();
  for (const file of [...(files || [])].sort((a, b) => rank(a) - rank(b))) {
    const key = file.folder_path || 'Files';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  }
  return [...groups.entries()];
}

async function copyPath(value) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
}

export function ClientSharePage() {
  const { token } = useParams();
  const [pack, setPack] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let alive = true;
    document.documentElement.dataset.theme = 'light';
    document.body.dataset.theme = 'light';
    getSharePack(token)
      .then((data) => {
        if (!alive) return;
        setPack(data);
        if (data?.customer?.name) document.title = `${data.customer.name} · Client pack`;
      })
      .catch((err) => {
        if (alive) setError(err.response?.data?.message || 'This client link is invalid or expired');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  async function onCopy(value) {
    try {
      await copyPath(value);
      setCopied(value);
      window.setTimeout(() => setCopied(''), 1500);
    } catch {
      setCopied('');
    }
  }

  if (loading) {
    return (
      <div className="share">
        <p className="share-msg">Loading client pack…</p>
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="share">
        <p className="share-msg">{error || 'Not found'}</p>
      </div>
    );
  }

  const customer = pack.customer || {};
  const artifacts = pack.artifacts || [];
  const jobs = pack.jobs || [];
  const ready = artifacts.filter((file) => file.proof_status === 'print_ready' || file.proof_status === 'approved');

  return (
    <div className="share">
      <header className="share-head">
        <div>
          <p className="kicker">Store / printer pack</p>
          <h1>{customer.name}</h1>
          <p className="sub">
            {[customer.company, customer.phone, customer.email].filter(Boolean).join(' · ') || 'Print shop client'}
          </p>
        </div>
        <button type="button" className="print-btn" onClick={() => window.print()}>
          Print
        </button>
      </header>

      <section className="share-card">
        <h2>Client details</h2>
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{customer.name || '—'}</dd>
          </div>
          <div>
            <dt>Company</dt>
            <dd>{customer.company || '—'}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{customer.phone || '—'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{customer.email || '—'}</dd>
          </div>
        </dl>
        {customer.network_folder ? (
          <dl className="net-box">
            <div>
              <dt>Customer folder on the store network</dt>
              <dd>
                <button type="button" className="net-path" onClick={() => onCopy(customer.network_folder)}>
                  {customer.network_folder}
                  {copied === customer.network_folder ? ' · copied' : ' · click to copy'}
                </button>
              </dd>
            </div>
          </dl>
        ) : null}
        {customer.notes ? <p className="notes">{customer.notes}</p> : null}
      </section>

      {ready.length ? (
        <section className="share-card ready">
          <h2>Print-ready files — open these on the store computer</h2>
          {ready.map((file) => (
            <div className="ready-row" key={file.id}>
              <b>{file.file_name}</b>
              <span className={`badge ${file.proof_status}`}>{STATUS[file.proof_status] || file.proof_status}</span>
              <button type="button" className="net-path" onClick={() => onCopy(file.network_path)}>
                {file.network_path || customer.network_folder || 'No network path saved'}
                {copied === file.network_path ? ' · copied' : ''}
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <section className="share-card">
        <h2>Artwork ({artifacts.length})</h2>
        {artifacts.length === 0 ? (
          <p className="muted">No files uploaded yet.</p>
        ) : (
          groupByFolder(artifacts).map(([folder, files]) => (
            <div key={folder} className="folder">
              <h3>{folder}</h3>
              <div className="grid">
                {files.map((file) => (
                  <article key={file.id} className={`art ${file.proof_status || ''}`}>
                    <div className="thumb">
                      {isImage(file) ? (
                        <img src={file.file_url} alt={file.file_name} />
                      ) : isPdf(file) ? (
                        <iframe title={file.file_name} src={file.file_url} />
                      ) : (
                        <span>FILE</span>
                      )}
                    </div>
                    <div className="info">
                      <b>{file.file_name}</b>
                      <span className={`badge ${file.proof_status || ''}`}>
                        {STATUS[file.proof_status] || 'Revision'}
                        {file.revision > 1 ? ` · v${file.revision}` : ''}
                      </span>
                      {file.sku ? <span>SKU {file.sku}</span> : null}
                      <button type="button" className="net-path" onClick={() => onCopy(file.network_path)}>
                        {file.network_path || 'No network path'}
                      </button>
                      <a href={file.file_url} target="_blank" rel="noreferrer">
                        Preview
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="share-card">
        <h2>Jobs ({jobs.length})</h2>
        {jobs.length === 0 ? (
          <p className="muted">No jobs for this client yet.</p>
        ) : (
          jobs.map((job) => (
            <article key={job.id} className="job">
              <div className="job-top">
                <b>{job.job_number}</b>
                <span>{job.stage?.name || job.status}</span>
              </div>
              <p>{job.title}</p>
              <p className="muted">
                {[
                  job.product_type,
                  job.print_type,
                  job.quantity != null ? `×${job.quantity}` : null,
                  job.size_details,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {(job.artworks || []).length ? (
                <div className="grid slim">
                  {job.artworks.map((art) => (
                    <div key={art.id} className="art mini-wrap">
                      <a className="art mini" href={art.file_url} target="_blank" rel="noreferrer">
                        {isImage(art) ? <img src={art.file_url} alt={art.file_name} /> : <span>{art.file_name}</span>}
                      </a>
                      {art.network_path ? (
                        <button type="button" className="net-path" onClick={() => onCopy(art.network_path)}>
                          {art.network_path}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
