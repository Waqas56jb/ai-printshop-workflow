import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Icon } from '../components/Icon.jsx';
import { Modal } from '../components/Modal.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useSocket } from '../hooks/useSocket.js';
import { createFolder, deleteItem, downloadLink, listFiles, renameItem, uploadFile } from '../services/files.service.js';
import { errorWords, isImageFile } from '../utils/plain.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function sizeWords(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} bytes`;
}

function fileSub(item) {
  const date = item.created_at ? new Date(item.created_at) : null;
  return [item.size_bytes ? sizeWords(item.size_bytes) : null, date ? `${date.getDate()} ${MONTHS[date.getMonth()]}` : null]
    .filter(Boolean)
    .join(' · ');
}

function NameDialog({ title, label, initial = '', action, onSave, onClose }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    const ok = await onSave(value.trim());
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field">
          <span>{label}</span>
          <input className="input" value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !value.trim()}>
            {busy ? 'Saving…' : action}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmDelete({ item, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Delete ${item.name}?`} onClose={onClose}>
      <p style={{ fontSize: 18 }}>
        {item.type === 'folder' ? 'The folder will be removed.' : 'The file will be gone for good.'}
        {item.id.startsWith('a:') ? ' It will also disappear from the job card and the TV.' : ''}
      </p>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>
          Keep it
        </button>
        <button
          type="button"
          className="btn btn-danger-solid"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await onConfirm();
            setBusy(false);
            if (ok) onClose();
          }}
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}

function ItemCard({ item, menuOpen, onOpen, onMenu, onAction }) {
  const isFolder = item.type === 'folder';
  const canChange = !item.auto;
  return (
    <div
      className={`fitem${isFolder ? '' : ' file'}${item.job ? ' job-folder' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target === event.currentTarget) onOpen(item);
      }}
    >
      {!isFolder && isImageFile({ file_type: item.file_type, file_name: item.name }) && item.url ? (
        <img className="thumb-img" src={item.url} alt="" loading="lazy" />
      ) : (
        <div className="fic">
          <Icon name={isFolder ? 'folder' : 'file'} />
        </div>
      )}
      <div className="nm">{item.name}</div>
      <div className="sub">{isFolder ? item.sub : fileSub(item)}</div>
      {!isFolder || canChange ? (
        <button
          type="button"
          className="dots"
          aria-label={`More for ${item.name}`}
          aria-expanded={menuOpen}
          onClick={(event) => {
            event.stopPropagation();
            onMenu(menuOpen ? null : item.id);
          }}
        >
          <Icon name="dots" />
        </button>
      ) : null}
      {menuOpen ? (
        <div className="ctx" role="menu" onClick={(event) => event.stopPropagation()}>
          <button type="button" role="menuitem" onClick={() => onAction('open', item)}>
            <Icon name="open" />
            Open
          </button>
          {!isFolder ? (
            <button type="button" role="menuitem" onClick={() => onAction('download', item)}>
              <Icon name="download" />
              Download
            </button>
          ) : null}
          {canChange ? (
            <button type="button" role="menuitem" onClick={() => onAction('rename', item)}>
              <Icon name="edit" />
              Rename
            </button>
          ) : null}
          {canChange ? (
            <button type="button" role="menuitem" className="del" onClick={() => onAction('delete', item)}>
              <Icon name="trash" />
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function FilesPage() {
  const [params, setParams] = useSearchParams();
  const path = params.get('path') || '';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuId, setMenuId] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  const pathRef = useRef(path);

  const load = useCallback(async () => {
    const asked = path;
    try {
      const next = await listFiles(asked);
      if (pathRef.current !== asked) return;
      setData(next);
      setError('');
    } catch (err) {
      if (pathRef.current === asked) setError(errorWords(err, 'Could not open this folder.'));
    } finally {
      if (pathRef.current === asked) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    pathRef.current = path;
    setLoading(true);
    setMenuId(null);
    load();
  }, [path, load]);

  // A job's files can change from the job sheet, voice, or another screen.
  const onLive = useCallback(
    (_payload, event) => {
      if (event?.startsWith('job:')) load();
    },
    [load]
  );
  useSocket(onLive);

  // Close the ⋮ menu on any outside click or Escape.
  useEffect(() => {
    if (!menuId) return undefined;
    const close = () => setMenuId(null);
    const onKey = (event) => event.key === 'Escape' && close();
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuId]);

  function go(nextPath) {
    setParams(nextPath ? { path: nextPath } : {});
  }

  async function download(item) {
    try {
      const { url } = await downloadLink(item.id);
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast(errorWords(err, 'Could not download the file.'));
    }
  }

  function open(item) {
    setMenuId(null);
    if (item.type === 'folder') return go(item.id);
    if (isImageFile({ file_type: item.file_type, file_name: item.name }) && item.url) return setViewing(item);
    if (item.url) window.open(item.url, '_blank', 'noopener');
    else download(item);
  }

  function onAction(kind, item) {
    setMenuId(null);
    if (kind === 'open') open(item);
    if (kind === 'download') download(item);
    if (kind === 'rename') setDialog({ kind: 'rename', item });
    if (kind === 'delete') setDialog({ kind: 'delete', item });
  }

  async function save(work, message) {
    try {
      await work();
      if (message) toast(message);
      await load();
      return true;
    } catch (err) {
      toast(errorWords(err));
      return false;
    }
  }

  async function uploadAll(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length || !data?.can_upload) return;
    const target = path;
    const where = data.crumbs?.[data.crumbs.length - 1]?.name || 'this folder';
    const rows = files.map((file, index) => ({ key: `${Date.now()}-${index}`, name: file.name, pct: 0, state: 'busy' }));
    setUploads((current) => [...current, ...rows]);
    const update = (key, patch) => setUploads((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    let done = 0;
    // Two at a time keeps the bars moving without flooding a slow shop connection.
    const queue = files.map((file, index) => ({ file, row: rows[index] }));
    async function worker() {
      while (queue.length) {
        const { file, row } = queue.shift();
        try {
          await uploadFile(target, file, (pct) => update(row.key, { pct }));
          update(row.key, { pct: 100, state: 'done' });
          done += 1;
        } catch (err) {
          update(row.key, { state: 'failed', message: errorWords(err, 'Did not upload') });
        }
      }
    }
    await Promise.all([worker(), worker()]);
    if (done) toast(`${done} file${done === 1 ? '' : 's'} added to ${where}`);
    if (pathRef.current === target) await load();
    setTimeout(() => setUploads((current) => current.filter((row) => !rows.some((r) => r.key === row.key) || row.state === 'failed')), 2500);
  }

  const crumbs = data?.crumbs || [{ path: '', name: 'All customers' }];
  const inJob = path.startsWith('j:');

  return (
    <>
      <PageHeader title="Files">
        <nav className="crumbs" aria-label="Folder path">
          {crumbs.map((crumb, index) =>
            index === crumbs.length - 1 ? (
              <span key={crumb.path || 'root'} className="here">
                {crumb.name}
              </span>
            ) : (
              <span key={crumb.path || 'root'} style={{ display: 'contents' }}>
                <button type="button" onClick={() => go(crumb.path)}>
                  {crumb.name}
                </button>
                <span className="sep">›</span>
              </span>
            )
          )}
        </nav>
        {data?.can_new_folder ? (
          <button type="button" className="btn" onClick={() => setDialog({ kind: 'folder' })}>
            <Icon name="folderPlus" />
            New folder
          </button>
        ) : null}
        {data?.can_upload ? (
          <button type="button" className="btn btn-primary" onClick={() => fileInput.current?.click()}>
            <Icon name="upload" />
            Upload
          </button>
        ) : null}
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          accept={inJob ? 'image/*,.pdf,.ai,.svg' : undefined}
          onChange={(event) => {
            uploadAll(event.target.files);
            event.target.value = '';
          }}
        />
      </PageHeader>

      <main
        className="content"
        onDragOver={(event) => {
          if (!data?.can_upload) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          uploadAll(event.dataTransfer.files);
        }}
      >
        <div className="section-note">
          {inJob
            ? 'Files in this job folder are the job’s files — they show on the job card and the shop TV straight away.'
            : 'Files uploaded inside a job folder attach to that job — they show on the job card and the shop TV straight away.'}
        </div>

        {uploads.length ? (
          <div className="uploads" aria-live="polite">
            {uploads.map((row) => (
              <div key={row.key} className={`upload-row ${row.state}`}>
                <b>{row.name}</b>
                <span>{row.state === 'failed' ? row.message : row.state === 'done' ? 'Done ✓' : `${row.pct}%`}</span>
                <div className="bar">
                  <i style={{ width: `${row.state === 'failed' ? 100 : row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {error ? <div className="banner-error">{error}</div> : null}

        {loading && !data ? (
          <div className="loading">Opening…</div>
        ) : (
          <div className="fgrid">
            {data?.can_upload ? (
              <div
                className={`upload-zone${dragging ? ' drag' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => fileInput.current?.click()}
                onKeyDown={(event) => event.key === 'Enter' && fileInput.current?.click()}
              >
                <span>
                  Drag files here, or press <b>Upload</b>
                </span>
              </div>
            ) : null}
            {(data?.items || []).map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                menuOpen={menuId === item.id}
                onOpen={open}
                onMenu={setMenuId}
                onAction={onAction}
              />
            ))}
            {data && !data.items.length ? (
              <p className="hint" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 20 }}>
                Nothing in here yet.
              </p>
            ) : null}
          </div>
        )}
      </main>

      {dialog?.kind === 'folder' ? (
        <NameDialog
          title="New folder"
          label="Folder name"
          action="Make folder"
          onClose={() => setDialog(null)}
          onSave={(name) => save(() => createFolder(path, name), `Folder ${name} made`)}
        />
      ) : null}
      {dialog?.kind === 'rename' ? (
        <NameDialog
          title={`Rename ${dialog.item.type === 'folder' ? 'folder' : 'file'}`}
          label="New name"
          initial={dialog.item.name}
          action="Save name"
          onClose={() => setDialog(null)}
          onSave={(name) => save(() => renameItem(dialog.item.id, name), `Renamed to ${name}`)}
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <ConfirmDelete
          item={dialog.item}
          onClose={() => setDialog(null)}
          onConfirm={() => save(() => deleteItem(dialog.item.id), `${dialog.item.name} deleted`)}
        />
      ) : null}
      {viewing ? (
        <Modal wide title={viewing.name} onClose={() => setViewing(null)}>
          <img className="viewer" src={viewing.url} alt={viewing.name} />
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={() => download(viewing)}>
              <Icon name="download" />
              Download
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
