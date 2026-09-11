import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSharePack } from '../../services/artifacts.service.js';
import '../../styles/share.css';

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

function PathCopy({ value, copied, onCopy, hint }) {
  if (!value) return <span className="muted">No network path saved</span>;
  const isCopied = copied === value;
  return (
    <div className="net-box">
      {hint ? <span className="net-label">{hint}</span> : null}
      <div className="net-row">
        <button
          type="button"
          className={`net-path${isCopied ? ' is-copied' : ''}`}
          title={value}
          onClick={() => onCopy(value)}
        >
          {value}
        </button>
        <button type="button" className="net-copy" onClick={() => onCopy(value)}>
          {isCopied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="net-hint">{isCopied ? 'Path copied — paste on the store computer' : 'Tap copy, then open this folder on the store PC'}</p>
    </div>
  );
}

export default function ClientSharePage() {
  const { token } = useParams();
  const [pack, setPack] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let alive = true;
    const html = document.documentElement;
    const body = document.body;
    html.classList.add('share-page');
    body.classList.add('share-page');
    getSharePack(token)
      .then((data) => {
        if (!alive) return;
        setPack(data);
        if (data?.customer?.name) document.title = `${data.customer.name} · Printer pack`;
      })
      .catch((err) => {
        if (alive) setError(err.response?.data?.message || 'This client link is invalid or expired');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      html.classList.remove('share-page');
      body.classList.remove('share-page');
    };
  }, [token]);

  async function onCopy(value) {
    try {
      await copyPath(value);
      setCopied(value);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopied('');
    }
  }

  if (loading) return <div className="share"><p className="share-msg">Loading printer pack…</p></div>;
  if (error || !pack) return <div className="share"><p className="share-msg err">{error || 'Not found'}</p></div>;

  const customer = pack.customer || {};
  const artifacts = pack.artifacts || [];
  const jobs = pack.jobs || [];
  const ready = artifacts.filter((file) => file.proof_status === 'print_ready' || file.proof_status === 'approved');
  const contact = [customer.company, customer.phone, customer.email].filter(Boolean);

  return (
    <div className="share">
      <header className="share-head">
        <div>
          <div className="share-brand">Store · Printer pack</div>
          <h1>{customer.name || 'Client'}</h1>
          {contact.length ? <p className="sub">{contact.join(' · ')}</p> : null}
          <div className="share-meta">
            <span className="share-chip">Artwork <b>{artifacts.length}</b></span>
            <span className="share-chip">Print-ready <b>{ready.length}</b></span>
            <span className="share-chip">Jobs <b>{jobs.length}</b></span>
          </div>
        </div>
        <button type="button" className="print-btn" onClick={() => window.print()}>Print pack</button>
      </header>

      <section className="share-card">
        <h2>Client details</h2>
        <dl>
          <div><dt>Name</dt><dd>{customer.name || '—'}</dd></div>
          <div><dt>Company</dt><dd>{customer.company || '—'}</dd></div>
          <div><dt>Phone</dt><dd>{customer.phone || '—'}</dd></div>
          <div><dt>Email</dt><dd>{customer.email || '—'}</dd></div>
        </dl>
        {customer.network_folder ? (
          <PathCopy
            value={customer.network_folder}
            copied={copied}
            onCopy={onCopy}
            hint="Customer folder on the store network"
          />
        ) : null}
        {customer.notes ? <p className="notes">{customer.notes}</p> : null}
      </section>

      {ready.length ? (
        <section className="share-card ready">
          <h2>
            Print-ready on the store PC
            <span className="count">{ready.length} file{ready.length === 1 ? '' : 's'}</span>
          </h2>
          {ready.map((file) => (
            <div className="ready-row" key={file.id}>
              <b>{file.file_name}</b>
              <span className={`badge ${file.proof_status}`}>{STATUS[file.proof_status] || file.proof_status}</span>
              <button
                type="button"
                className={`net-path${copied === file.network_path ? ' is-copied' : ''}`}
                title={file.network_path || customer.network_folder || ''}
                onClick={() => onCopy(file.network_path || customer.network_folder)}
              >
                {file.network_path || customer.network_folder || 'No network path saved'}
                {copied === (file.network_path || customer.network_folder) ? ' · copied' : ''}
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <section className="share-card">
        <h2>
          Artwork
          <span className="count">{artifacts.length}</span>
        </h2>
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
                      <b title={file.file_name}>{file.file_name}</b>
                      <div className="meta">
                        <span className={`badge ${file.proof_status || 'revision'}`}>
                          {STATUS[file.proof_status] || 'Revision'}
                          {file.revision > 1 ? ` · v${file.revision}` : ''}
                        </span>
                        {file.sku ? <span className="sku">SKU {file.sku}</span> : null}
                      </div>
                      {file.network_path ? (
                        <button
                          type="button"
                          className={`net-path${copied === file.network_path ? ' is-copied' : ''}`}
                          title={file.network_path}
                          onClick={() => onCopy(file.network_path)}
                        >
                          {file.network_path}
                        </button>
                      ) : (
                        <span className="muted">No network path</span>
                      )}
                      <div className="actions">
                        <a className="preview" href={file.file_url} target="_blank" rel="noreferrer">
                          Preview
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="share-card">
        <h2>
          Jobs
          <span className="count">{jobs.length}</span>
        </h2>
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
                {[job.product_type, job.print_type, job.quantity != null ? `×${job.quantity}` : null, job.size_details]
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
                        <button
                          type="button"
                          className={`net-path${copied === art.network_path ? ' is-copied' : ''}`}
                          title={art.network_path}
                          onClick={() => onCopy(art.network_path)}
                        >
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
