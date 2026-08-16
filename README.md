# TravelPlanner

An AI-assisted trip planner that runs **entirely in your browser** — no
account required, and everything (your trips, itineraries, budgets,
packing lists, API settings) is stored **locally on your device** via
`localStorage`. It's also an installable Progressive Web App (PWA), so
once loaded once, planning, budget, places, and packing all keep working
with no signal — the one thing that needs a connection is the optional
real-AI generation (see below).

## Features

- **Smart itinerary generation** — two modes, same UI:
  - **✨ AI mode (optional)** — real Gemini (3.7 Flash) generation, tailored
    to your actual destination with specific, real-world detail. Needs a
    one-time, ~1-minute setup (see **AI setup** below) — paste in a free
    Gemini API key, no server or deploy step required.
  - **Built-in mode (default, always available)** — a rule-based engine
    that builds a day-by-day plan (morning / afternoon / evening) from a
    curated activity bank, matched to your interests/pace/trip length.
    Zero network calls, works with no signal.
  
  Tap **Regenerate** any time for a fresh mix; if AI is configured it's
  tried first and falls back to the built-in generator automatically on
  any failure (offline, bad key, rate limit, etc.) — you always get a
  usable itinerary.
- **Budget estimation** — per-day cost baselines (lodging, food,
  transport, activities, misc) scaled by a regional cost-of-living
  multiplier and your traveler/room count. Pick a specific country
  (e.g. India) or a broad region average, and a display **currency**
  (₹, $, €, and 20+ more) — picking a country auto-suggests its
  currency. Adjust any field and totals update instantly. Clearly
  labeled as a planning estimate at an approximate, static exchange
  rate — not live pricing or live rates.
- **Hotel & restaurant recommendations** — since the app works fully
  offline it can't fetch live listings, so it gives you the *type* of
  place to look for at your budget level (e.g. "3–4★ boutique hotel",
  "street-food stalls"), each with one-tap links to Google Maps,
  Booking.com, TripAdvisor, or Yelp so you can pull up real, current
  options for your destination when you do have signal.
- **Packing checklist** — same AI-with-fallback pattern as the itinerary:
  AI mode tailors the list to your destination's real climate for your
  actual dates; built-in mode auto-builds from your trip's climate, trip
  type (beach / hiking / business / ski / …), length, and traveler count.
  Fully editable either way, checkboxes persist, and you can add your own
  items.
- **Multiple trips**, share/export an itinerary via your phone's native
  share sheet, light/dark mode, and safe-area-aware layout for
  notch/home-indicator devices.

## AI setup (optional)

Tap **🤖** in the header. By default the app uses its offline generator —
you only need this if you want real Gemini-generated itineraries/packing
lists. Google's Generative Language API allows direct browser calls (its
CORS policy isn't restricted like Anthropic's), so there's no server or
deploy step:

1. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Recommended: click into the key's settings in AI Studio and add a
   **website restriction** limiting it to your app's URL (e.g.
   `https://<owner>.github.io/*`), so a copied key can't be used elsewhere.
3. Paste the key into the 🤖 panel and tap **Save**. It's stored only in
   this browser's `localStorage`.

Gemini 3.7 Flash has a generous free tier, so this typically costs
nothing for normal use.

## Use it on your phone

Pick whichever is easiest:

### Option A — GitHub Pages (recommended, easiest to reopen)
Every push to `main` auto-deploys via the `Deploy to GitHub Pages`
GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) — no
manual build step. The very first run also turns Pages on for the repo.
1. Push to `main` (or run the workflow manually from the **Actions** tab)
   and wait for the **Deploy to GitHub Pages** run to go green.
2. The live URL is shown on that run's summary page (and under
   **Settings → Pages** afterwards) — normally
   `https://<owner>.github.io/<repo>/`.
3. Open it on your phone, then tap your browser's **Share/menu → "Add
   to Home Screen"**. It now opens full-screen like a native app and
   works offline after the first load.

### Option B — Run a tiny local server
From a computer on the same Wi-Fi as your phone:
```bash
cd TravelPlanner
python3 -m http.server 8000
```
Then on your phone, browse to `http://<your-computer's-LAN-IP>:8000`
and "Add to Home Screen" as above.

### Option C — Open the file directly
Copy the `TravelPlanner` folder to your phone (e.g. via a file/cloud
app) and open `index.html` in your mobile browser. Everything works
(planning, budget, packing, localStorage) — the only thing that won't
register over a plain `file://` link is the offline-caching service
worker, which isn't required for the built-in generator (no network
calls); AI mode still needs a real connection either way.

## Project structure

```
index.html               App shell + all views
manifest.webmanifest      PWA metadata (installable, home-screen icon)
service-worker.js         Offline caching of the app shell
css/styles.css             Mobile-first styling, light/dark aware
js/data.js                 Offline content: activities, cost tiers, packing lists
js/storage.js              localStorage persistence
js/itinerary.js            Itinerary generation engine (built-in/offline)
js/budget.js                Budget estimator
js/expenses.js              Expense tracking vs. budget
js/places.js                Hotel/restaurant recommendation + deep links
js/packing.js               Packing checklist generator (built-in/offline)
js/ai.js                    Optional real-AI generation, calling the Gemini API directly
js/app.js                   UI wiring / rendering
```

No build step, no dependencies. Open `index.html` and go — AI mode just
needs a Gemini API key pasted into the 🤖 panel, no separate deploy.
