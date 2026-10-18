// The white bar at the top of every page: big title, then the page's own controls.
export function PageHeader({ title, children }) {
  return (
    <header className="head">
      <h1>{title}</h1>
      {children}
    </header>
  );
}
