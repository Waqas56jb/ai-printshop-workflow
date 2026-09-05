export function RolesCard() {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>What each role can do</h3>
      </div>
      <div className="roles">
        <div className="role">
          <h4>
            <span className="pill admin">Admin</span>
          </h4>
          <ul>
            <li>Everything in this panel</li>
            <li>Stages, settings, OMI setup</li>
            <li>Add and remove people</li>
          </ul>
        </div>
        <div className="role">
          <h4>
            <span className="pill staff">Staff</span>
          </h4>
          <ul>
            <li>Staff panel login</li>
            <li>Create and move jobs, upload artwork</li>
            <li>Confirm voice commands</li>
          </ul>
        </div>
        <div className="role">
          <h4>
            <span className="pill worker">Worker</span>
          </h4>
          <ul>
            <li>No login — OMI voice only</li>
            <li>Move jobs and add notes by voice</li>
            <li>Sees the TV board</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
