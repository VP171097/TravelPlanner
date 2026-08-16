# TravelPlanner

An AI-assisted trip planner that runs **entirely in your browser** — no
backend, no account, no API key. Everything (your trips, itineraries,
budgets, packing lists) is stored locally on your device via
`localStorage`, and the app is a installable Progressive Web App (PWA),
so once it's loaded once it keeps working **with no signal at all**.

## Features

- **Smart itinerary generation** — a rule-based engine builds a
  day-by-day plan (morning / afternoon / evening) matched to the
  interests, pace, and trip length you choose. Tap **Regenerate** any
  time for a fresh mix.
- **Budget estimation** — per-day cost baselines (lodging, food,
  transport, activities, misc) scaled by a regional cost-of-living
  multiplier and your traveler/room count. Adjust any field and totals
  update instantly. Clearly labeled as a planning estimate, not live
  pricing.
- **Hotel & restaurant recommendations** — since the app works fully
  offline it can't fetch live listings, so it gives you the *type* of
  place to look for at your budget level (e.g. "3–4★ boutique hotel",
  "street-food stalls"), each with one-tap links to Google Maps,
  Booking.com, TripAdvisor, or Yelp so you can pull up real, current
  options for your destination when you do have signal.
- **Packing checklist** — auto-built from your trip's climate, trip
  type (beach / hiking / business / ski / …), length, and traveler
  count. Fully editable, checkboxes persist, and you can add your own
  items.
- **Multiple trips**, share/export an itinerary via your phone's native
  share sheet, light/dark mode, and safe-area-aware layout for
  notch/home-indicator devices.

## Use it on your phone

Pick whichever is easiest:

### Option A — GitHub Pages (recommended, easiest to reopen)
1. In this repo: **Settings → Pages → Deploy from a branch**, choose
   this branch and the `/ (root)` folder, save.
2. Open the published URL on your phone.
3. Tap your browser's **Share/menu → "Add to Home Screen"**. It now
   opens full-screen like a native app and works offline after the
   first load.

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
worker, which isn't needed for the app to function since it doesn't
call any network APIs to begin with.

## Project structure

```
index.html            App shell + all views
manifest.webmanifest   PWA metadata (installable, home-screen icon)
service-worker.js      Offline caching of the app shell
css/styles.css          Mobile-first styling, light/dark aware
js/data.js              Offline content: activities, cost tiers, packing lists
js/storage.js           localStorage persistence
js/itinerary.js         Itinerary generation engine
js/budget.js             Budget estimator
js/places.js             Hotel/restaurant recommendation + deep links
js/packing.js            Packing checklist generator
js/app.js                UI wiring / rendering
```

No build step, no dependencies — open `index.html` and go.
