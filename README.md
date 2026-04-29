# Coffee 4:6 Brew Calculator

A small mobile-first PWA for generating 4:6 pour-over recipes. It is built with plain HTML, CSS, and JavaScript, and is ready for static hosting.

## Features

- Synced coffee, water, and ratio inputs.
- Sweet, balanced, and bright flavor splits.
- Light, medium, and heavy body pour counts.
- Exact pour amounts, cumulative totals, and brew timeline.
- Integrated brew timer with current-pour guidance.
- Copy, share, local favorites, and reset controls.

## Run Locally

From this folder:

```sh
python3 -m http.server 4173
```

Open `http://localhost:4173`.

Service workers require `localhost` or HTTPS, so use a local server instead of opening `index.html` directly when testing PWA behavior.

## PWA Notes

- `manifest.json` provides install metadata.
- `sw.js` caches the app for offline use.
- `icons/` includes Home Screen and manifest icons.
- iPhone Safari can add the hosted app to Home Screen from the share sheet.

## Defaults

- Coffee: 22 g
- Ratio: 1:16.5
- Water: 363 g
- Flavor: Sweet
- Body: Medium
- Temperature: 201°F
