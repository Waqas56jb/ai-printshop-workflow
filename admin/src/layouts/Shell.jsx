import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar.jsx';

export function Shell() {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
