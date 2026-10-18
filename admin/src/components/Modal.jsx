import { useEffect, useId, useRef } from 'react';

// Open dialogs, newest last — Escape only closes the one on top.
const stack = [];

export function Modal({ title, onClose, wide = false, full = false, children }) {
  const id = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    stack.push(id);
    function onKey(event) {
      if (event.key === 'Escape' && stack[stack.length - 1] === id) closeRef.current?.();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      stack.splice(stack.indexOf(id), 1);
      window.removeEventListener('keydown', onKey);
      if (!stack.length) document.body.style.overflow = '';
    };
  }, [id]);

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className={`dialog${wide ? ' wide' : ''}${full ? ' full' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div className="dialog-head">
          <div className="dialog-title">{title}</div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
