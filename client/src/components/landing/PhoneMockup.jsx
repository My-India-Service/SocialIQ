export default function PhoneMockup({ variant = 'inbox' }) {
  return (
    <div className="phone-mockup" aria-hidden="true">
      <div className="phone-frame">
        <div className="phone-notch" />
        <div className="phone-screen">
          {variant === 'connect' && (
            <div className="phone-ui phone-ui-connect">
              <span className="phone-label">Connect</span>
              <div className="phone-btn-row">
                <span className="phone-pill active">Instagram</span>
                <span className="phone-pill">YouTube</span>
              </div>
              <div className="phone-btn-row">
                <span className="phone-pill">Facebook</span>
                <span className="phone-pill">WhatsApp</span>
              </div>
              <div className="phone-cta">Sync comments</div>
            </div>
          )}
          {variant === 'inbox' && (
            <div className="phone-ui phone-ui-inbox">
              <span className="phone-label">Revenue inbox</span>
              <div className="phone-card hot">
                <span className="phone-tag">Hot lead · 95%</span>
                <strong>Do you deliver in Delhi?</strong>
                <span className="phone-meta">Expected ₹2,374</span>
              </div>
              <div className="phone-card">
                <span className="phone-tag warn">Complaint</span>
                <strong>Zipper broke after two days.</strong>
              </div>
            </div>
          )}
          {variant === 'reply' && (
            <div className="phone-ui phone-ui-reply">
              <span className="phone-label">Suggested reply</span>
              <p className="phone-reply-text">
                Yes! We deliver across India in 3–5 days. DM us your pincode for exact timing.
              </p>
              <div className="phone-cta">Post reply & mark done</div>
            </div>
          )}
          {variant === 'dashboard' && (
            <div className="phone-ui phone-ui-dash">
              <span className="phone-label">CEO dashboard</span>
              <div className="phone-stat-grid">
                <div>
                  <strong>156</strong>
                  <span>Sales opps</span>
                </div>
                <div>
                  <strong>₹3.8L</strong>
                  <span>Pipeline</span>
                </div>
              </div>
              <div className="phone-bar" style={{ width: '71%' }} />
              <span className="phone-meta">71% positive sentiment</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
