# Hantavirus Tracker

Interactive global hantavirus dashboard with a Rust API backend and React frontend.

## What this prototype emphasizes

- Clear caveat that signal counts are mention activity, not confirmed clinical case totals
- Clickable map pins and country-focused logic
- Latest popular mention intelligence side panel
- Live red-alert headline line
- Computed statistics and weekly trend view

## Local development

1. Install dependencies: npm install
2. Start Rust API backend in one terminal: npm run dev:api
3. Start frontend in a second terminal: npm run dev
4. Build frontend for production: npm run build
5. Preview production build: npm run preview

The frontend uses `/api/bootstrap` and automatically falls back to a local snapshot if the API is unavailable.

## Backend API

Rust backend lives in `backend` and exposes:

- `GET /health`
- `GET /api/countries`
- `GET /api/mentions/latest?limit=6`
- `GET /api/stats`
- `GET /api/trends/weekly`
- `GET /api/alerts/latest`
- `GET /api/bootstrap`

Default backend host: `http://127.0.0.1:8080`

## Deploy to GitHub Pages

This repo includes a workflow at .github/workflows/deploy.yml that deploys on every push to main.

1. Push this project to GitHub
2. In repository settings, open Pages and set Source to GitHub Actions
3. Ensure your DNS points hantavirustracker.github.io to GitHub Pages if you own that domain

The custom domain file is included at public/CNAME.

## Donations

- DOGE: `DFLGr4UwumxE8iMonTNBxq4ZCRFSQmbUwX`
- SOL: `EJRnh4xfA8SxcNZSR6hMsoTFPQnHAqA7sxBan19btcbE`
