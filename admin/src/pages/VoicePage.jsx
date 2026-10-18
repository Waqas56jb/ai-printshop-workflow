import { PageHeader } from '../components/PageHeader.jsx';

export default function VoicePage() {
  return (
    <>
      <PageHeader title="Voice" />
      <main className="content">
        <div className="placeholder">
          <h2>Voice</h2>
          <p>What the OMI heard, and what the TV board did. The TV and OMI links are under “Links” at the bottom of the sidebar for now.</p>
          <p className="hint" style={{ marginTop: 12 }}>
            Coming next.
          </p>
        </div>
      </main>
    </>
  );
}
