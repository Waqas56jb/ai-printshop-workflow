// Pictures and PDFs show on the TV; other design files (AI, PSD, EPS, CDR, TIFF,
// ZIP…) can't be drawn by a browser, so the TV shows a big card naming the file.
function kindOf(art) {
  const name = `${art?.name || ''} ${art?.url || ''}`.toLowerCase();
  const type = String(art?.type || '').toLowerCase();
  if (type === 'application/pdf' || /\.pdf(\?|\s|$)/.test(name)) return 'pdf';
  if (/^image\/(png|jpe?g|gif|webp|svg\+xml|bmp|avif)$/.test(type) || /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|\s|$)/.test(name)) {
    return 'image';
  }
  return 'file';
}

function extOf(art) {
  const match = String(art?.name || art?.url || '').match(/\.([a-z0-9]{1,6})(\?|$)/i);
  return match ? match[1].toUpperCase() : 'FILE';
}

function sizeWords(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return '';
}

export function ArtworkOverlay({ job, liveArtwork, index, zoom, onIndexChange, onZoomToggle, onBackToJob, onBackToBoard }) {
  if (!job) return null;
  const artworks = job.artworks || [];
  const total = liveArtwork?.total || artworks.length;
  const safeIndex = total ? ((index % total) + total) % total : 0;
  const fromList = artworks[safeIndex];
  const art = liveArtwork?.url
    ? {
        url: liveArtwork.url,
        name: liveArtwork.name,
        type: liveArtwork.type,
        size: liveArtwork.size,
        is_approved: liveArtwork.is_approved,
      }
    : fromList;
  const kind = art?.url ? kindOf(art) : null;

  function goNext() {
    if (total > 1) onIndexChange?.((safeIndex + 1) % total);
  }
  function goPrev() {
    if (total > 1) onIndexChange?.((safeIndex - 1 + total) % total);
  }

  return (
    <div className="artwork-overlay" role="dialog" aria-label="Artwork viewer">
      <div className="artwork-topbar">
        <span className="artwork-name">{art?.name || 'No file'}</span>
        {total ? (
          <span className="artwork-count num">
            {safeIndex + 1} of {total}
          </span>
        ) : null}
        {art?.is_approved ? <span className="artwork-approved">Approved</span> : null}
        <button type="button" className="ghost-btn zoom" onClick={() => onZoomToggle?.()}>
          {zoom ? 'Zoom out' : 'Zoom in'}
        </button>
      </div>

      <div className="artwork-stage">
        {total > 1 ? (
          <button type="button" className="artwork-nav prev" aria-label="Previous artwork" onClick={goPrev}>
            ‹
          </button>
        ) : null}

        <div className={`artwork-frame${zoom ? ' zoom' : ''}`}>
          {!art?.url ? (
            <span className="hint muted">No artwork uploaded</span>
          ) : kind === 'pdf' ? (
            <object data={art.url} type="application/pdf" className="artwork-pdf">
              <div className="artwork-file">
                <span className="ext">PDF</span>
                <b>{art.name}</b>
              </div>
            </object>
          ) : kind === 'image' ? (
            <img src={art.url} alt={art.name || 'artwork'} />
          ) : (
            <div className="artwork-file">
              <span className="ext">{extOf(art)}</span>
              <b>{art.name}</b>
              {sizeWords(art.size) ? <span className="size">{sizeWords(art.size)}</span> : null}
              <span className="note">This kind of file can't be shown on the TV — open it on the shop computer.</span>
            </div>
          )}
        </div>

        {total > 1 ? (
          <button type="button" className="artwork-nav next" aria-label="Next artwork" onClick={goNext}>
            ›
          </button>
        ) : null}
      </div>

      <div className="artwork-bottom">
        <button type="button" className="ghost-btn" onClick={() => onBackToJob?.()}>
          Back to job <kbd>B</kbd>
        </button>
        <button type="button" className="ghost-btn back" onClick={() => onBackToBoard?.()}>
          Back to board <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  );
}
