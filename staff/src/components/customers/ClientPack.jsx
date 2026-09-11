import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, FileText, FolderUp, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  clientPackUrl,
  getShareLink,
  updateArtifact,
  uploadArtifacts,
} from '../../services/artifacts.service.js';
import { updateCustomer } from '../../services/jobs.service.js';
import { Button } from '../ui/Button.jsx';

const STATUSES = [
  { id: 'revision', label: 'Revision' },
  { id: 'proof', label: 'Proof sent' },
  { id: 'approved', label: 'Approved' },
  { id: 'print_ready', label: 'Print ready' },
];

function isImage(file) {
  const type = (file.file_type || '').toLowerCase();
  const name = (file.file_name || '').toLowerCase();
  return type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(name);
}

function sizeLabel(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function copyText(value) {
  await navigator.clipboard.writeText(value);
}

export function ClientPack({ customer, onChanged }) {
  const fileRef = useRef(null);
  const folderRef = useRef(null);
  const [sku, setSku] = useState('');
  const [networkFolder, setNetworkFolder] = useState(customer?.network_folder || '');
  const [status, setStatus] = useState('revision');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [link, setLink] = useState(customer?.share_path ? clientPackUrl(customer.share_path) : '');

  useEffect(() => {
    setNetworkFolder(customer?.network_folder || '');
    setLink(customer?.share_path ? clientPackUrl(customer.share_path) : '');
  }, [customer?.id, customer?.network_folder, customer?.share_path]);

  const files = customer?.artifacts || [];

  async function saveFolder() {
    if (!customer?.id) return;
    try {
      await updateCustomer(customer.id, { network_folder: networkFolder.trim() || null });
      toast('Network folder saved');
      onChanged?.();
    } catch (error) {
      toast(error.response?.data?.message || 'Could not save folder');
    }
  }

  async function upload(list) {
    const selected = Array.from(list || []);
    if (!selected.length || !customer?.id) return;
    if (!networkFolder.trim()) {
      toast('Enter the store network folder first, e.g. P:\\CUSTOMER FOLDERS\\AVON ATHLETICS-STEPHANIE KIESEL');
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      await uploadArtifacts(customer.id, selected, {
        sku,
        network_folder: networkFolder.trim(),
        proof_status: status,
        onProgress: setProgress,
      });
      setSku('');
      toast(selected.length === 1 ? 'File uploaded' : `${selected.length} files uploaded`);
      onChanged?.();
    } catch (error) {
      toast(error.response?.data?.message || 'Upload failed');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  async function copyLink() {
    try {
      const data = await getShareLink(customer.id);
      const url = clientPackUrl(data.path || data.token);
      setLink(url);
      await copyText(url);
      toast('Printer link copied');
    } catch (error) {
      toast(error.response?.data?.message || 'Could not create link');
    }
  }

  async function openLink() {
    try {
      const data = await getShareLink(customer.id);
      const url = clientPackUrl(data.path || data.token);
      setLink(url);
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      toast(error.response?.data?.message || 'Could not open link');
    }
  }

  async function copyPath(value) {
    if (!value) return;
    try {
      await copyText(value);
      toast('Network path copied — open this on the store computer / printer');
    } catch {
      toast('Could not copy path');
    }
  }

  async function setProof(id, proof_status) {
    try {
      await updateArtifact(id, { proof_status });
      onChanged?.();
    } catch (error) {
      toast(error.response?.data?.message || 'Could not update status');
    }
  }

  if (!customer) return null;

  return (
    <div className="panel pack">
      <div className="card-head" style={{ borderBottom: '1px solid var(--rule-2)' }}>
        <div>
          <h2 style={{ fontSize: 15 }}>Artwork on the network</h2>
          <div className="c">Preview here · print-ready file stays on P:\CUSTOMER FOLDERS</div>
        </div>
      </div>
      <div className="pack-actions">
        <label className="f">
          <span>Store network folder</span>
          <label className="field">
            <input
              placeholder="P:\CUSTOMER FOLDERS\AVON ATHLETICS-STEPHANIE KIESEL"
              value={networkFolder}
              onChange={(event) => setNetworkFolder(event.target.value)}
              onBlur={saveFolder}
            />
          </label>
        </label>
        <label className="f">
          <span>SKU / job name (optional)</span>
          <label className="field">
            <input placeholder="RON NIGHT PUZZLE" value={sku} onChange={(event) => setSku(event.target.value)} />
          </label>
        </label>
        <div className="pack-status">
          {STATUSES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={status === item.id ? 'on' : ''}
              onClick={() => setStatus(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="pack-btns">
          <Button variant="ghost" className="btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload />
            Files
          </Button>
          <Button variant="ghost" className="btn-sm" onClick={() => folderRef.current?.click()} disabled={busy}>
            <FolderUp />
            Customer folder
          </Button>
          <Button className="btn-sm" onClick={copyLink}>
            <Copy />
            Copy printer link
          </Button>
          <button type="button" className="icon-btn" title="Open pack" onClick={openLink}>
            <ExternalLink />
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          onChange={(event) => {
            upload(event.target.files);
            event.target.value = '';
          }}
        />
        <input
          ref={folderRef}
          type="file"
          hidden
          multiple
          webkitdirectory=""
          directory=""
          onChange={(event) => {
            upload(event.target.files);
            event.target.value = '';
          }}
        />
        {busy ? <div className="c">Uploading preview… {progress}%</div> : null}
        {link ? (
          <div className="pack-link">
            <span>Printer link</span>
            <code>{link}</code>
          </div>
        ) : null}
      </div>
      <div className="sec-h">
        Files <span className="c">{files.length}</span>
      </div>
      {files.length === 0 ? (
        <div className="pack-empty">Upload a file or the customer folder. The dashboard keeps a preview; the printer uses the network path.</div>
      ) : (
        files.map((file) => (
          <div className={`pack-row ${file.proof_status || ''}`} key={file.id}>
            <div className="pack-thumb">
              {isImage(file) ? <img src={file.file_url} alt="" /> : <FileText />}
            </div>
            <div className="pack-meta">
              <b>
                {file.file_name}
                {file.revision > 1 ? ` · v${file.revision}` : ''}
              </b>
              <span>
                {[file.sku ? `SKU ${file.sku}` : null, sizeLabel(file.size_bytes), STATUSES.find((row) => row.id === file.proof_status)?.label]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <button type="button" className="net-path" onClick={() => copyPath(file.network_path)}>
                {file.network_path || 'No network path — add the P:\\ folder above and re-upload'}
              </button>
            </div>
            <div className="pack-ops">
              {file.proof_status !== 'approved' && file.proof_status !== 'print_ready' ? (
                <button type="button" className="approve" onClick={() => setProof(file.id, 'approved')}>
                  <Check />
                  Approve
                </button>
              ) : null}
              {file.proof_status !== 'print_ready' ? (
                <button type="button" className="approve" onClick={() => setProof(file.id, 'print_ready')}>
                  Print ready
                </button>
              ) : null}
              <a href={file.file_url} target="_blank" rel="noreferrer">
                Preview
              </a>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
