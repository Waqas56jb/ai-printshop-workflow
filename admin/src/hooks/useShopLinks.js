import { useEffect, useState } from 'react';
import { getOmiWebhookUrl } from '../services/dashboard.service.js';
import { getSettings } from '../services/settings.service.js';
import { workerBoardUrl } from '../utils/boardUrl.js';

// The TV board link and the OMI webhook link.
export function useShopLinks() {
  const [boardLink, setBoardLink] = useState('');
  const [omiLink, setOmiLink] = useState('');

  useEffect(() => {
    getSettings()
      .then((settings) => {
        const isPublic = settings.board_public !== false && settings.board_public !== 'false';
        setBoardLink(workerBoardUrl({ key: isPublic ? '' : settings.board_key || '' }));
      })
      .catch(() => setBoardLink(workerBoardUrl()));
    getOmiWebhookUrl()
      .then((result) => setOmiLink(result.url || ''))
      .catch(() => setOmiLink('Could not load the OMI link'));
  }, []);

  return { boardLink, omiLink };
}
