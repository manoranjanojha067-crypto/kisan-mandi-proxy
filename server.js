/**
 * Kisan Mandi - data.gov.in mandi-price proxy
 * Temporary demo mode is enabled when DATA_GOV_API_KEY is missing.
 */

const express = require('express');
const cors = require('cors');

const app = express();

const PORT = process.env.PORT || 3000;

const RESOURCE_ID = '9ef84268-d88-465a-a308-a864a43d0070';
const BASE_URL = `https://api.data.gov.in/resource/${RESOURCE_ID}`;

const allowedOriginEnv = process.env.ALLOWED_ORIGIN || '*';
const allowedOrigins = allowedOriginEnv
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (allowedOriginEnv === '*' || !origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origin not allowed by CORS'));
    }
  },
  methods: ['GET']
}));

/* ---------------- Health check ---------------- */

app.get('/health', function (req, res) {
  res.status(200).json({
    status: 'ok',
    hasApiKey: Boolean(process.env.DATA_GOV_API_KEY),
    demoMode: !process.env.DATA_GOV_API_KEY,
    time: new Date().toISOString()
  });
});

/* ---------------- Temporary demo data ---------------- */

const DEMO_RECORDS = [
  {
    commodity: 'Tomato',
    state: 'Odisha',
    district: 'Khordha',
    market: 'Bhubaneswar',
    variety: 'Local',
    grade: 'FAQ',
    arrival_date: '2026-10-04',
    min_price: 1800,
    max_price: 2200,
    modal_price: 2000
  },
  {
    commodity: 'Potato',
    state: 'Odisha',
    district: 'Khordha',
    market: 'Bhubaneswar',
    variety: 'Potato',
    grade: 'FAQ',
    arrival_date: '2026-10-04',
    min_price: 1400,
    max_price: 1800,
    modal_price: 1600
  },
  {
    commodity: 'Onion',
    state: 'Odisha',
    district: 'Khordha',
    market: 'Bhubaneswar',
    variety: 'Onion',
    grade: 'FAQ',
    arrival_date: '2026-10-04',
    min_price: 2200,
    max_price: 2800,
    modal_price: 2500
  },
  {
    commodity: 'Brinjal',
    state: 'Odisha',
    district: 'Cuttack',
    market: 'Cuttack',
    variety: 'Local',
    grade: 'FAQ',
    arrival_date: '2026-10-04',
    min_price: 2000,
    max_price: 2600,
    modal_price: 2300
  },
  {
    commodity: 'Green Chilli',
    state: 'Odisha',
    district: 'Jagatsinghpur',
    market: 'Jagatsinghpur',
    variety: 'Green Chilli',
    grade: 'FAQ',
    arrival_date: '2026-10-04',
    min_price: 3000,
    max_price: 3800,
    modal_price: 3400
  },
  {
    commodity: 'Brinjal',
    state: 'Odisha',
    district: 'Jagatsinghpur',
    market: 'Jagatsinghpur',
    variety: 'Local',
    grade: 'FAQ',
    arrival_date: '2026-10-04',
    min_price: 1800,
    max_price: 2400,
    modal_price: 2100
  }
];

/* ---------------- Mandi prices ---------------- */

app.get('/api/mandi-prices', async function (req, res) {

  const {
    commodity,
    state,
    district,
    market,
    date,
    limit
  } = req.query;

  /*
   * TEMPORARY DEMO MODE
   * Used while data.gov.in API key is unavailable.
   */
  if (!process.env.DATA_GOV_API_KEY) {

    let records = [...DEMO_RECORDS];

    if (commodity) {
      records = records.filter(r =>
        r.commodity.toLowerCase().includes(commodity.toLowerCase())
      );
    }

    if (state) {
      records = records.filter(r =>
        r.state.toLowerCase() === state.toLowerCase()
      );
    }

    if (district) {
      records = records.filter(r =>
        r.district.toLowerCase().includes(district.toLowerCase())
      );
    }

    if (market) {
      records = records.filter(r =>
        r.market.toLowerCase().includes(market.toLowerCase())
      );
    }

    if (date) {
      records = records.filter(r => r.arrival_date === date);
    }

    const requestedLimit = Math.max(
      1,
      Math.min(parseInt(limit || '100', 10) || 100, 1000)
    );

    records = records.slice(0, requestedLimit);

    return res.status(200).json({
      records,
      count: records.length,
      source: 'DEMO DATA - temporary testing only',
      demo_mode: true,
      resource_id: RESOURCE_ID,
      fetched_at: new Date().toISOString()
    });
  }

  /*
   * REAL data.gov.in MODE
   * Automatically used when DATA_GOV_API_KEY is added.
   */

  const apiKey = process.env.DATA_GOV_API_KEY;

  const params = new URLSearchParams();

  params.set('api-key', apiKey);
  params.set('format', 'json');

  const requestedLimit = Math.max(
    10,
    Math.min(parseInt(limit || '100', 10) || 100, 1000)
  );

  params.set('limit', String(requestedLimit));

  if (commodity) params.set('filters[commodity]', commodity);
  if (state) params.set('filters[state]', state);
  if (district) params.set('filters[district]', district);
  if (market) params.set('filters[market]', market);

  if (date) {
    params.set('filters[arrival_date]', date);
  }

  const upstreamUrl = BASE_URL + '?' + params.toString();

  try {

    const upstreamRes = await fetch(upstreamUrl, {
      method: 'GET'
    });

    if (!upstreamRes.ok) {
      return res.status(502).json({
        error: 'upstream_error',
        message: 'data.gov.in responded with an error.',
        status: upstreamRes.status
      });
    }

    const payload = await upstreamRes.json();

    const rawRecords = Array.isArray(payload.records)
      ? payload.records
      : [];

    const records = rawRecords.map(r => ({
      commodity: r.commodity || null,
      state: r.state || null,
      district: r.district || null,
      market: r.market || null,
      variety: r.variety || null,
      grade: r.grade || null,
      arrival_date: r.arrival_date || null,
      min_price: r.min_price != null ? Number(r.min_price) : null,
      max_price: r.max_price != null ? Number(r.max_price) : null,
      modal_price: r.modal_price != null ? Number(r.modal_price) : null
    }));

    return res.status(200).json({
      records,
      count: records.length,
      source: 'Government of India / data.gov.in',
      demo_mode: false,
      resource_id: RESOURCE_ID,
      fetched_at: new Date().toISOString()
    });

  } catch (err) {

    return res.status(502).json({
      error: 'upstream_unreachable',
      message: 'Could not reach data.gov.in.',
      detail: String(err && err.message || err)
    });
  }
});

/* ---------------- Not found ---------------- */

app.use(function (req, res) {
  res.status(404).json({
    error: 'not_found'
  });
});

/* ---------------- Start server ---------------- */

app.listen(PORT, function () {
  console.log('Kisan Mandi proxy listening on port ' + PORT);
});
