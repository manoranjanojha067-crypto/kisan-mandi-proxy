/**
 * Kisan Mandi — data.gov.in mandi-price proxy
 * ---------------------------------------------
 * Calls the official Government of India dataset:
 *   Ministry of Agriculture & Farmers Welfare / Directorate of Marketing & Inspection
 *   "Current Daily Price of Various Commodities from Various Markets (Mandi)"
 *   data.gov.in resource id: 9ef84268-d588-465a-a308-a864a43d0070
 *
 * The API key lives ONLY in process.env.DATA_GOV_API_KEY. It is read on the
 * server and is never sent to, or visible from, the frontend.
 *
 * Endpoints:
 *   GET /health            -> liveness check for the hosting platform
 *   GET /api/mandi-prices  -> proxied, filtered government mandi price records
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const BASE_URL = `https://api.data.gov.in/resource/${RESOURCE_ID}`;

/* ---------------- CORS ----------------
   ALLOWED_ORIGIN can be a single origin ("https://claude.ai") or a
   comma-separated list. Leave unset ("*") only while first testing —
   lock it down to your real frontend origin(s) before real use. */
const allowedOriginEnv = process.env.ALLOWED_ORIGIN || '*';
const allowedOrigins = allowedOriginEnv.split(',').map(function (s) { return s.trim(); });
app.use(cors({
  origin: function (origin, callback) {
    if (allowedOriginEnv === '*' || !origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Origin not allowed by CORS'));
    }
  },
  methods: ['GET'],
}));

/* ---------------- Health check ---------------- */
app.get('/health', function (req, res) {
  res.status(200).json({
    status: 'ok',
    hasApiKey: Boolean(process.env.DATA_GOV_API_KEY),
    time: new Date().toISOString(),
  });
});

/* ---------------- Mandi prices ---------------- */
app.get('/api/mandi-prices', async function (req, res) {
  const apiKey = process.env.DATA_GOV_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'server_misconfigured',
      message: 'DATA_GOV_API_KEY is not set on the server.',
    });
  }

  const { commodity, state, district, market, date, limit } = req.query;

  const params = new URLSearchParams();
  params.set('api-key', apiKey);
  params.set('format', 'json');
  params.set('limit', String(Math.min(parseInt(limit, 10) || 100, 1000)));
  if (commodity) params.set('filters[commodity]', commodity);
  if (state) params.set('filters[state]', state);
  if (district) params.set('filters[district]', district);
  if (market) params.set('filters[market]', market);
  // The dataset's date filter field is arrival_date; supported when the
  // upstream resource honours it for a given day (format DD/MM/YYYY).
  if (date) params.set('filters[arrival_date]', date);

  const upstreamUrl = BASE_URL + '?' + params.toString();

  let upstreamRes;
  try {
    upstreamRes = await fetch(upstreamUrl, { method: 'GET' });
  } catch (err) {
    return res.status(502).json({
      error: 'upstream_unreachable',
      message: 'Could not reach data.gov.in.',
      detail: String((err && err.message) || err),
    });
  }

  if (!upstreamRes.ok) {
    return res.status(502).json({
      error: 'upstream_error',
      message: 'data.gov.in responded with an error.',
      status: upstreamRes.status,
    });
  }

  let payload;
  try {
    payload = await upstreamRes.json();
  } catch (err) {
    return res.status(502).json({
      error: 'upstream_bad_response',
      message: 'data.gov.in returned a response that could not be parsed.',
    });
  }

  const rawRecords = Array.isArray(payload.records) ? payload.records : [];

  // Pass through only the fields the frontend expects — never invent a value
  // for a field the government dataset didn't return.
  const records = rawRecords.map(function (r) {
    return {
      commodity: r.commodity || null,
      state: r.state || null,
      district: r.district || null,
      market: r.market || null,
      variety: r.variety || null,
      grade: r.grade || null,
      arrival_date: r.arrival_date || null,
      min_price: r.min_price != null ? Number(r.min_price) : null,
      max_price: r.max_price != null ? Number(r.max_price) : null,
      modal_price: r.modal_price != null ? Number(r.modal_price) : null,
    };
  });

  res.status(200).json({
    records: records,
    count: records.length,
    source: 'Government of India / data.gov.in',
    resource_id: RESOURCE_ID,
    fetched_at: new Date().toISOString(),
  });
});

app.use(function (req, res) {
  res.status(404).json({ error: 'not_found' });
});

app.listen(PORT, function () {
  console.log('Kisan Mandi proxy listening on port ' + PORT);
});
