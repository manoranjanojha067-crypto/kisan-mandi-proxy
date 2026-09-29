# Kisan Mandi — mandi-price proxy

A small, standalone backend that lets the Kisan Mandi app show official
Government of India mandi prices, without ever putting an API key in
frontend code.

Source dataset: Ministry of Agriculture & Farmers Welfare / Directorate of
Marketing & Inspection, "Current Daily Price of Various Commodities from
Various Markets (Mandi)" (data.gov.in resource id
`9ef84268-d588-465a-a308-a864a43d0070`).

## Files in this folder
- `server.js` — the Express proxy (`/health`, `/api/mandi-prices`)
- `package.json` — dependencies and start command
- `.env.example` — copy to `.env` for local testing only
- `render.yaml` — Render deployment config

## Deploy on Render (free tier)

1. Create a new GitHub repo and push this `mandi-proxy` folder's contents to it
   (or upload it as a new repo — Render deploys from a Git repo).
2. Go to https://dashboard.render.com → **New** → **Web Service**.
3. Connect the repo you just created.
4. Render should detect `render.yaml` and pre-fill the settings. If not, set
   manually:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
5. Under **Environment**, add:
   - `DATA_GOV_API_KEY` = your real data.gov.in key (register free at
     https://data.gov.in → My Account → API key)
   - `ALLOWED_ORIGIN` = `*` for now (tighten later — see below)
6. Click **Create Web Service**. First deploy takes a couple of minutes.
7. Render gives you a URL like:
   `https://kisan-mandi-proxy.onrender.com`

## Test it

- Health check:
  `https://kisan-mandi-proxy.onrender.com/health`
  should return `{"status":"ok","hasApiKey":true,...}`

- Live data:
  `https://kisan-mandi-proxy.onrender.com/api/mandi-prices?commodity=Rice&limit=5`
  should return `{"records":[...], "source":"Government of India / data.gov.in", ...}`

  Try also with `?commodity=Tomato` and `?commodity=Onion`, and add
  `&state=...&district=...&market=...&date=DD/MM/YYYY` as needed.

  If `records` comes back empty, that combination of filters just has no
  data for today in the government dataset — that's a real, honest empty
  result, not a bug to work around by inventing prices.

## Connect it to the Kisan Mandi app

In `kisan-mandi.html`, find this line:

```js
var MANDI_LIVE_PROXY_URL = '';
```

Change it to your deployed URL + `/api/mandi-prices`:

```js
var MANDI_LIVE_PROXY_URL = 'https://kisan-mandi-proxy.onrender.com/api/mandi-prices';
```

That is the only change needed in the app. The app will then attempt a real
request to your proxy; if it succeeds, prices show as **live** with the
"Government of India / data.gov.in" source; if it fails or the proxy isn't
reachable (including from inside the Claude Artifact sandbox, where outbound
requests are restricted by platform policy), the app keeps showing demo data
with the existing DEMO warning.

## Locking down CORS

Once you know the exact origin the frontend will be served from, set
`ALLOWED_ORIGIN` to that exact origin (e.g.
`https://your-deployed-app.example.com`) instead of `*`, and redeploy.

## Local testing (optional)

```
cp .env.example .env
# edit .env and add your real DATA_GOV_API_KEY
npm install
npm start
# then open http://localhost:3000/health
```
