import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import './index.css';

const API_URL = 'http://localhost:8000';

/* ── Toggle Card ──────────────────────────────────────────────────── */
function ToggleCard({ icon, label, checked, onChange, id }) {
  return (
    <div
      id={id}
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

/* ── SHAP Driver Bar ──────────────────────────────────────────────── */
function DriverBar({ driver, maxImpact }) {
  const pct = Math.min((driver.impact / maxImpact) * 100, 100);
  const isUp = driver.direction === 'up';
  return (
    <div className="driver">
      <div className="driver__header">
        <span className="driver__icon">{isUp ? '🟢' : '🔴'}</span>
        <span className="driver__label">{driver.label}</span>
        <span className={`driver__impact ${isUp ? 'driver__impact--up' : 'driver__impact--down'}`}>
          {isUp ? '+' : '−'}€{driver.impact.toLocaleString()}
        </span>
      </div>
      <div className="driver__bar-bg">
        <div
          className={`driver__bar-fill ${isUp ? 'driver__bar-fill--up' : 'driver__bar-fill--down'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Key Drivers Section ──────────────────────────────────────────── */
function DriversSection({ drivers }) {
  if (!drivers || drivers.length === 0) return null;
  const maxImpact = Math.max(...drivers.map((d) => d.impact));
  return (
    <div className="card drivers-card">
      <h3 className="section-card__title">
        <span>🧠</span> Key Drivers <span className="tag">SHAP Explainability</span>
      </h3>
      <p className="section-card__desc">What influenced this prediction the most</p>
      <div className="drivers-list">
        {drivers.map((d) => (
          <DriverBar key={d.feature} driver={d} maxImpact={maxImpact} />
        ))}
      </div>
    </div>
  );
}

/* ── 7-Day Forecast Chart ─────────────────────────────────────────── */
function ForecastChart({ forecast }) {
  if (!forecast || forecast.length === 0) return null;

  const data = forecast.map((d) => ({
    day: d.day_name.slice(0, 3),
    date: d.date.slice(5),
    sales: d.predicted_sales,
    fullDate: d.date,
  }));

  const minSales = Math.min(...data.map((d) => d.sales));
  const maxSales = Math.max(...data.map((d) => d.sales));
  const buffer = (maxSales - minSales) * 0.15 || 500;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip__date">{d.fullDate}</div>
        <div className="chart-tooltip__value">€{d.sales.toLocaleString()}</div>
      </div>
    );
  };

  return (
    <div className="card forecast-card">
      <h3 className="section-card__title">
        <span>📈</span> 7-Day Forecast <span className="tag">Time Series</span>
      </h3>
      <p className="section-card__desc">Predicted revenue for the next 7 days</p>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3861fb" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3861fb" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,97,251,0.08)" />
            <XAxis
              dataKey="day"
              stroke="#5a6b85"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#5a6b85"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={[Math.floor(minSales - buffer), Math.ceil(maxSales + buffer)]}
              tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#3861fb"
              strokeWidth={2.5}
              fill="url(#salesGrad)"
              dot={{ fill: '#3861fb', strokeWidth: 2, r: 4, stroke: '#0b1120' }}
              activeDot={{ r: 6, stroke: '#3861fb', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── What-If Comparison ───────────────────────────────────────────── */
function CompareSection({ store, date }) {
  const [compareResult, setCompareResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runCompare = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store,
          date,
          scenario_a: { promo: 0, school_holiday: 0, is_state_holiday: 0 },
          scenario_b: { promo: 1, school_holiday: 0, is_state_holiday: 0 },
        }),
      });
      if (res.ok) setCompareResult(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div className="card compare-card">
      <h3 className="section-card__title">
        <span>⚖️</span> What-If Analysis <span className="tag">Scenario Comparison</span>
      </h3>
      <p className="section-card__desc">Compare revenue impact of running a promotion</p>

      {!compareResult ? (
        <button
          className="btn-compare"
          onClick={runCompare}
          disabled={loading || !store || !date}
        >
          {loading ? 'Analyzing…' : '🔬 Compare: Promo vs No-Promo'}
        </button>
      ) : (
        <div className="compare-results">
          <div className="compare-scenario">
            <div className="compare-scenario__tag compare-scenario__tag--a">No Promo</div>
            <div className="compare-scenario__value">
              €{compareResult.scenario_a.predicted_sales.toLocaleString()}
            </div>
          </div>
          <div className="compare-vs">VS</div>
          <div className="compare-scenario">
            <div className="compare-scenario__tag compare-scenario__tag--b">With Promo</div>
            <div className="compare-scenario__value compare-scenario__value--highlight">
              €{compareResult.scenario_b.predicted_sales.toLocaleString()}
            </div>
          </div>
          <div className={`compare-delta ${compareResult.difference >= 0 ? 'compare-delta--up' : 'compare-delta--down'}`}>
            {compareResult.difference >= 0 ? '📈' : '📉'}{' '}
            Promo impact: <strong>{compareResult.difference >= 0 ? '+' : ''}€{compareResult.difference.toLocaleString()}</strong>
          </div>
          <button className="btn-compare btn-compare--reset" onClick={() => setCompareResult(null)}>
            ↻ Reset
          </button>
        </div>
      )}
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
    year: 'numeric', month: 'long', day: 'numeric',
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
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setField = (field) => (e) =>
    setForm((f) => ({
      ...f,
      [field]: e.target.type === 'date' ? e.target.value : Number(e.target.value),
    }));

  const toggleField = (field) => () =>
    setForm((f) => ({ ...f, [field]: f[field] ? 0 : 1 }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    setForecast(null);

    try {
      // Run both predict and forecast in parallel
      const [predRes, forecastRes] = await Promise.all([
        fetch(`${API_URL}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }),
        fetch(`${API_URL}/forecast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }),
      ]);

      if (!predRes.ok) {
        const data = await predRes.json();
        throw new Error(data.detail || 'Prediction failed');
      }

      setResult(await predRes.json());
      if (forecastRes.ok) setForecast(await forecastRes.json());
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
          XGBoost + SHAP Powered
        </div>
        <span className="hero__icon">📈</span>
        <h1 className="hero__title">Demand Forecaster</h1>
        <p className="hero__subtitle">
          Predict daily store revenue with <strong>machine learning</strong>.
          7-day forecasts, explainable AI insights, and scenario analysis.
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
            <div className="stat__value stat__value--amber">SHAP</div>
            <div className="stat__label">Explainability</div>
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
                id="toggle-promo"
                icon="🏷️"
                label="Promo Active"
                checked={!!form.promo}
                onChange={toggleField('promo')}
              />
              <ToggleCard
                id="toggle-school"
                icon="🎒"
                label="School Holiday"
                checked={!!form.school_holiday}
                onChange={toggleField('school_holiday')}
              />
              <ToggleCard
                id="toggle-state"
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
            <span className="section__title">Generate Forecast</span>
          </div>
          <div className="card">
            <button id="btn-predict" type="submit" className="btn-predict" disabled={loading}>
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

      {/* ── Results Area ────────────────────────────────────────── */}
      <ResultCard result={result} />

      {result && (
        <div className="insights-grid">
          <DriversSection drivers={result.drivers} />
          <ForecastChart forecast={forecast?.forecast} />
        </div>
      )}

      {result && (
        <CompareSection store={form.store} date={form.date} />
      )}

      {/* ── Feature Chips ───────────────────────────────────────── */}
      <FeaturesBar />

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="footer">
        <p className="footer__text">
          Built with <strong>XGBoost</strong> · <strong>SHAP</strong> · <strong>FastAPI</strong> · <strong>React</strong> · <strong>Recharts</strong><br />
          Trained on 1M+ historical transactions from the Rossmann dataset
        </p>
      </footer>
    </div>
  );
}
