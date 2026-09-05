import { BoardPage } from './pages/BoardPage.jsx';
import { NoKeyScreen } from './components/NoKeyScreen.jsx';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const boardKey = (params.get('key') || '').trim();
  const preview = params.get('preview') === '1';
  const label = params.get('label') || '';
  if (preview) document.documentElement.classList.add('preview');
  if (!document.title.includes('Job board')) {
    document.title = 'Print Shop · Job board';
  }
  if (!boardKey) return <NoKeyScreen />;
  return <BoardPage boardKey={boardKey} preview={preview} label={label} />;
}
