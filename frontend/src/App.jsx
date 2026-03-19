import { useState } from 'react';
import './index.css';

const API_URL = 'http://localhost:8000';

/* ── Toggle Card ──────────────────────────────────────────────────── */
function ToggleCard({ icon, label, checked, onChange }) {
  return (
    <div
      className={`toggle-card ${checked ? 'toggle-card--active' : ''}`}
      onClick={onChange}
    >
      <span className="toggle-card__icon">{icon}</span>
      <label className="toggle">
        <input type="checkbox" checked={checked} readOnly />
        <span className="toggle__track" />
        <span className="toggle__thumb" />
      </label>
      <span className="toggle-card__label">{label}</span>
    </div>
  );
}

/* ── Prediction Result ────────────────────────────────────────────── */
function ResultCard({ result }) {
  if (!result) return null;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dateObj = new Date(result.date + 'T00:00:00');
  const dayName = dayNames[dateObj.getDay()];
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="card result-card">
      <div className="result__header">
        <span className="result__badge">
          <span className="result__badge-icon" />
          Prediction Complete
        </span>
      </div>
      <div className="result__label">Predicted Daily Sales</div>
      <div className="result__value">
        <span className="result__currency">€</span>
        {result.predicted_sales.toLocaleString()}
      </div>
      <div className="result__unit">estimated revenue</div>
      <div className="result__divider" />
      <div className="result__details">
        <div className="result__detail">
          <div className="result__detail-value">#{result.store}</div>
          <div className="result__detail-label">Store</div>
        </div>
        <div className="result__detail">
          <div className="result__detail-value">{dayName}</div>
          <div className="result__detail-label">Day</div>
        </div>
        <div className="result__detail">
          <div className="result__detail-value">{formattedDate}</div>
          <div className="result__detail-label">Date</div>
        </div>
      </div>
    </div>
  );
}

/* ── Feature Chips ────────────────────────────────────────────────── */
function FeaturesBar() {
  const features = [
    'Store Type', 'Assortment', 'Competition Distance',
    'Promo Status', 'Holiday Flags', 'Day of Week',
    'Seasonality', 'Competitor Duration',
  ];
  return (
    <div className="features-bar">
      {features.map((f) => (
        <span key={f} className="feature-chip">
          <span className="feature-chip__dot" />
          {f}
        </span>
      ))}
    </div>
  );
}

/* ── Main App ─────────────────────────────────────────────────────── */
export default function App() {
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    store: 1,
    date: today,
    promo: 0,
    school_holiday: 0,
    is_state_holiday: 0,
  });

  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setField = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.type === 'date' ? e.target.value : Number(e.target.value) }));

  const toggleField = (field) => () =>
    setForm((f) => ({ ...f, [field]: f[field] ? 0 : 1 }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Prediction failed');
      }

      setResult(await res.json());
    } catch (err) {
      setError(err.message || 'Unable to reach the prediction server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      {/* ── Hero ────────────────────────────────────────────────── */}
      <header className="hero">
        <div className="hero__badge">
          <span className="hero__badge-dot" />
          XGBoost Powered
        </div>
        <span className="hero__icon">📈</span>
        <h1 className="hero__title">Demand Forecaster</h1>
        <p className="hero__subtitle">
          Predict daily store revenue with <strong>machine learning</strong>.
          Select your store, pick a date, and get instant forecasts.
        </p>
        <div className="stats-bar">
          <div className="stat">
            <div className="stat__value stat__value--accent">1,115</div>
            <div className="stat__label">Stores</div>
          </div>
          <div className="stat">
            <div className="stat__value stat__value--emerald">16</div>
            <div className="stat__label">Features</div>
          </div>
          <div className="stat">
            <div className="stat__value stat__value--amber">XGBoost</div>
            <div className="stat__label">Model</div>
          </div>
        </div>
      </header>

      {/* ── Form ────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit}>
        {/* Step 1: Store & Date */}
        <div className="section">
          <div className="section__header">
            <span className="section__step">1</span>
            <span className="section__title">Store & Date</span>
          </div>
          <div className="card">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="store">Store ID</label>
                <input
                  id="store"
                  className="form-input"
                  type="number"
                  min={1}
                  max={1115}
                  value={form.store}
                  onChange={setField('store')}
                  placeholder="1 – 1115"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="date">Forecast Date</label>
                <input
                  id="date"
                  className="form-input"
                  type="date"
                  value={form.date}
                  onChange={setField('date')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Business Levers */}
        <div className="section">
          <div className="section__header">
            <span className="section__step">2</span>
            <span className="section__title">Business Conditions</span>
          </div>
          <div className="card">
            <div className="toggles-grid">
              <ToggleCard
                icon="🏷️"
                label="Promo Active"
                checked={!!form.promo}
                onChange={toggleField('promo')}
              />
              <ToggleCard
                icon="🎒"
                label="School Holiday"
                checked={!!form.school_holiday}
                onChange={toggleField('school_holiday')}
              />
              <ToggleCard
                icon="🏛️"
                label="State Holiday"
                checked={!!form.is_state_holiday}
                onChange={toggleField('is_state_holiday')}
              />
            </div>
          </div>
        </div>

        {/* Step 3: Predict */}
        <div className="section">
          <div className="section__header">
            <span className="section__step">3</span>
            <span className="section__title">Get Forecast</span>
          </div>
          <div className="card">
            <button type="submit" className="btn-predict" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" /> Analyzing…
                </>
              ) : (
                '⚡ Generate Sales Forecast'
              )}
            </button>
            {error && <div className="error-msg">⚠️ {error}</div>}
          </div>
        </div>
      </form>

      {/* ── Result ──────────────────────────────────────────────── */}
      <ResultCard result={result} />

      {/* ── Feature Chips ───────────────────────────────────────── */}
      <FeaturesBar />

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="footer">
        <p className="footer__text">
          Built with <strong>XGBoost</strong> · <strong>FastAPI</strong> · <strong>React</strong><br />
          Trained on 1M+ historical transactions from the Rossmann dataset
        </p>
      </footer>
    </div>
  );
}
