import { PageHeader } from '../components/PageHeader.jsx';

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers" />
      <main className="content">
        <div className="placeholder">
          <h2>Customers</h2>
          <p>Everyone who orders from the shop, with their phone number and jobs.</p>
          <p className="hint" style={{ marginTop: 12 }}>
            Coming next.
          </p>
        </div>
      </main>
    </>
  );
}
