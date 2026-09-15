function isPdf(url = '') {
  return /\.pdf(\?|$)/i.test(url);
}

function isImage(url = '') {
  return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
}

export function ArtworkOverlay({ job, liveArtwork, index, zoom, onIndexChange, onZoomToggle, onBackToJob, onBackToBoard }) {
  if (!job) return null;
  const artworks = job.artworks || [];
  const total = liveArtwork?.total || artworks.length;
  const safeIndex = total ? ((index % total) + total) % total : 0;
  const fromList = artworks[safeIndex];
  const art = liveArtwork?.url
    ? { url: liveArtwork.url, name: liveArtwork.name, is_approved: liveArtwork.is_approved }
    : fromList;

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
          ) : isPdf(art.url) ? (
            <object data={art.url} type="application/pdf" className="artwork-pdf">
              <a href={art.url} target="_blank" rel="noreferrer" className="ghost-btn">
                Download {art.name}
              </a>
            </object>
          ) : isImage(art.url) ? (
            <img src={art.url} alt={art.name || 'artwork'} />
          ) : (
            <a href={art.url} target="_blank" rel="noreferrer" className="ghost-btn">
              Download {art.name}
            </a>
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
