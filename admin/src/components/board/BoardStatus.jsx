import { workerBoardUrl } from '../../utils/boardUrl.js';

export function BoardStatus({ stats, settings, onPatch }) {
  const live = Boolean(stats?.live || stats?.screens_online > 0);
  const n = stats?.screens_online || 0;
  const updated = stats?.updatedLabel;
  const theme = settings.board_theme || 'dark';
  const size = settings.board_card_size || 'normal';

  return (
    <div className="status">
      <span className={`live${live ? '' : ' off'}`}>
        <i></i>
        {live ? 'Board is live' : 'No screens connected'}
      </span>
      <span className="screens">
        {live ? (
          <>
            <b>
              {n} screen{n === 1 ? '' : 's'}
            </b>{' '}
            showing it right now{updated ? ` · updated ${updated}` : ''}
          </>
        ) : (
          <>{updated ? `updated ${updated}` : 'No TV connected yet'}</>
        )}
      </span>
      <span className="spacer"></span>
      <div className="seg">
        <button type="button" className={theme === 'dark' ? 'on' : ''} onClick={() => onPatch({ board_theme: 'dark' })}>
          Dark
        </button>
        <button type="button" className={theme === 'light' ? 'on' : ''} onClick={() => onPatch({ board_theme: 'light' })}>
          Light
        </button>
      </div>
      <div className="seg">
        <button type="button" className={size === 'normal' ? 'on' : ''} onClick={() => onPatch({ board_card_size: 'normal' })}>
          Normal
        </button>
        <button type="button" className={size === 'large' ? 'on' : ''} onClick={() => onPatch({ board_card_size: 'large' })}>
          Large
        </button>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() =>
          window.open(
            workerBoardUrl({ key: settings.board_public === false ? settings.board_key : '' }),
            '_blank'
          )
        }
      >
        <svg viewBox="0 0 24 24">
          <path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
        </svg>
        Open on this screen
      </button>
    </div>
  );
}
