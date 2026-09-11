import { useEffect, useState } from 'react';
import { BoardPage } from './pages/BoardPage.jsx';
import { NoKeyScreen } from './components/NoKeyScreen.jsx';
import { getBoard } from './services/api.js';

function readStoredKey() {
  const params = new URLSearchParams(window.location.search);
  const urlKey = (params.get('key') || '').trim();
  if (urlKey) {
    try {
      sessionStorage.setItem('board_key', urlKey);
    } catch {
      /* ignore */
    }
    return urlKey;
  }
  try {
    return (sessionStorage.getItem('board_key') || '').trim();
  } catch {
    return '';
  }
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const preview = params.get('preview') === '1';
  const label = params.get('label') || '';
  const [boardKey] = useState(readStoredKey);
  // Show board immediately — avoid a second full /api/board round-trip just for access check
  const [access, setAccess] = useState(boardKey ? 'keyed' : 'public');

  if (preview) document.documentElement.classList.add('preview');
  if (!document.title.includes('Job board')) {
    document.title = 'Print Shop · Job board';
  }

  useEffect(() => {
    if (boardKey) {
      setAccess('keyed');
      return undefined;
    }
    let alive = true;
    // Lightweight probe: if public board is locked, show key screen
    getBoard()
      .then(() => {
        if (alive) setAccess('public');
      })
      .catch((error) => {
        if (!alive) return;
        if (error.response?.status === 401 || error.response?.status === 403) {
          setAccess('none');
        }
      });
    return () => {
      alive = false;
    };
  }, [boardKey]);

  if (access === 'none') return <NoKeyScreen />;
  return <BoardPage boardKey={access === 'keyed' ? boardKey : ''} preview={preview} label={label} />;
}
