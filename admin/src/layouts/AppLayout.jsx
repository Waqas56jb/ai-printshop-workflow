import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useUiStore } from '../store/uiStore.js';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';

export function AppLayout() {
  const navOpen = useUiStore((state) => state.navOpen);
  const closeNav = useUiStore((state) => state.closeNav);

  useEffect(() => {
    document.body.classList.toggle('nav-lock', navOpen);
    return () => document.body.classList.remove('nav-lock');
  }, [navOpen]);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 900) closeNav();
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [closeNav]);

  return (
    <div className="app">
      {navOpen ? <div className="nav-scrim" onClick={closeNav} /> : null}
      <Sidebar />
      <div className="main">
        <Topbar />
        <Outlet />
      </div>
    </div>
  );
}
