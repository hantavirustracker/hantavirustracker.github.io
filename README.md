# Hantavirus Tracker

Landing page prototype for a global hantavirus signal tracker.

## What this prototype emphasizes

- Clear caveat that signal counts are mention activity, not confirmed clinical case totals
- Country-level trend snapshots for quick weekly context
- Source pipeline status so reliability is visible at a glance
- Mobile-first responsive layout with strong visual hierarchy

## Local development

1. Install dependencies: npm install
2. Start dev server: npm run dev
3. Build for production: npm run build
4. Preview production build: npm run preview

## Deploy to GitHub Pages

This repo includes a workflow at .github/workflows/deploy.yml that deploys on every push to main.

1. Push this project to GitHub
2. In repository settings, open Pages and set Source to GitHub Actions
3. Ensure your DNS points hantavirustracker.github.io to GitHub Pages if you own that domain

The custom domain file is included at public/CNAME.
