import { useRef, useState } from 'react';
import { Check, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../ui/Button.jsx';
import { approveArtwork, deleteArtwork, uploadArtwork } from '../../../services/jobs.service.js';
import { formatShortDate } from '../../../utils/date.js';
import { firstName } from '../../../utils/format.js';

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

export function ArtworkGallery({ job, users = [], currentUserId, onChanged }) {
  const inputRef = useRef(null);
  const [lightbox, setLightbox] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const files = [...(job.artworks || [])].sort((a, b) => (b.version || 0) - (a.version || 0));
  const approved = files.find((file) => file.is_approved);

  async function upload(list) {
    const selected = Array.from(list || []);
    if (!selected.length) return;
    setUploading(true);
    setProgress(0);
    try {
      for (const file of selected) {
        await uploadArtwork(job.id, file, setProgress);
      }
      toast('Artwork uploaded');
      onChanged();
    } catch (error) {
      toast(error.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function handleApprove(id) {
    try {
      await approveArtwork(id);
      toast('Artwork approved');
      onChanged();
    } catch (error) {
      toast(error.response?.data?.message || 'Could not approve artwork');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this artwork?')) return;
    try {
      await deleteArtwork(id);
      toast('Artwork deleted');
      onChanged();
    } catch (error) {
      toast(error.response?.data?.message || 'Could not delete artwork');
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>
          Artwork{' '}
          <span className="sub">
            {files.length} file{files.length === 1 ? '' : 's'}
            {approved ? ` · v${approved.version} approved` : ''}
          </span>
        </h3>
        <Button variant="ghost" className="btn-sm" onClick={() => inputRef.current?.click()}>
          <Upload />
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.ai"
          onChange={(event) => {
            upload(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      <div className="art-grid">
        {files.map((file) => {
          const uploader = users.find((user) => user.id === file.uploaded_by);
          return (
            <div className="art" key={file.id}>
              <div className="thumb">
                {isImage(file) ? <img src={file.file_url} alt={file.file_name} /> : <FileText />}
                <span className="v">v{file.version}</span>
                {file.is_approved ? (
                  <span className="ok">
                    <Check />
                    Approved
                  </span>
                ) : null}
                {!isImage(file) ? file.file_name : null}
              </div>
              <div className="info">
                <div className="name">{file.file_name}</div>
                <div className="by">
                  {[uploader ? firstName(uploader.full_name) : null, formatShortDate(file.created_at), sizeLabel(file.size_bytes)]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <div className="ops">
                  <button type="button" onClick={() => (isImage(file) ? setLightbox(file) : window.open(file.file_url, '_blank'))}>
                    View
                  </button>
                  <button type="button" onClick={() => window.open(file.file_url, '_blank')}>
                    Download
                  </button>
                  {!file.is_approved ? (
                    <button type="button" className="approve" onClick={() => handleApprove(file.id)}>
                      Approve
                    </button>
                  ) : null}
                  {file.uploaded_by === currentUserId ? (
                    <button type="button" className="btn-danger" onClick={() => handleDelete(file.id)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        <label
          className="art add"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            upload(event.dataTransfer.files);
          }}
        >
          <div>
            <b>{uploading ? `Uploading… ${progress}%` : 'Add artwork'}</b>
            drag files or click
          </div>
          <input
            type="file"
            hidden
            multiple
            accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.ai"
            onChange={(event) => {
              upload(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
      </div>
      {lightbox ? (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox.file_url} alt={lightbox.file_name} />
        </div>
      ) : null}
    </section>
  );
}
