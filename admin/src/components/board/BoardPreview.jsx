import { useRef } from 'react';
import { workerBoardUrl } from '../../utils/boardUrl.js';

export function BoardPreview({ boardKey, reloadKey }) {
  const iframeRef = useRef(null);
  const src = workerBoardUrl({ key: boardKey, preview: true, label: 'Admin preview' });

  function goFullscreen() {
    iframeRef.current?.requestFullscreen?.().catch(() => {});
  }

  return (
    <>
      <div className="frame">
        <div className="bezel"></div>
        {boardKey ? (
          <iframe
            key={reloadKey}
            ref={iframeRef}
            title="Job board preview"
            src={src}
            allow="fullscreen"
          />
        ) : null}
        <button type="button" className="fs" onClick={goFullscreen}>
          <svg viewBox="0 0 24 24">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
          Fullscreen
        </button>
      </div>
      <div className="stand">Live preview — exactly what the shop TV shows</div>
    </>
  );
}
