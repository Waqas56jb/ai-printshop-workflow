import { Outlet } from 'react-router-dom';
import { TopBar } from '../components/TopBar.jsx';

export function Shell() {
  return (
    <>
      <TopBar />
      <main>
        <Outlet />
      </main>
    </>
  );
}
