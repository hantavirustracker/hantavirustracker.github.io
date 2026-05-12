# Hantavirus Tracker Automation Guide

## Overview

This Python automation script runs every 30 minutes to:
- Search for new hantavirus reports from multiple data sources
- Update the `data.json` file with latest outbreak information
- Automatically commit and push changes to GitHub
- Trigger GitHub Pages to redeploy with updated data

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd automation
pip install -r requirements.txt
```

### 2. Configure GitHub Token

The script needs a GitHub token to automatically commit and push changes.

#### Create a GitHub Personal Access Token:
1. Go to https://github.com/settings/tokens/new
2. Select scope: `public_repo` (or `repo` for private repos)
3. Generate and copy the token

#### Create `.env` file:
```bash
cp .env.example .env
```

Edit `.env` and fill in your values:
```env
GITHUB_TOKEN=your_github_token_here
GIT_USER_NAME=HantavirusTracker Bot
GIT_USER_EMAIL=bot@hantavirustracker.github.io
```

### 3. Run the Automation Script

#### Option A: Run Once (Manual Test)
```bash
cd automation
python update_data.py --once
```

This will:
- Fetch data from sources
- Update `../public/data.json`
- Commit and push if changes exist
- Exit

#### Option B: Run as Background Service (30-minute schedule)
```bash
cd automation
python update_data.py
```

The script will:
- Start immediately
- Repeat every 30 minutes
- Log output to `hantavirus_tracker.log` and console
- Keep running until interrupted (Ctrl+C)

### 4. Deploy as a Scheduled Task

#### On Linux/macOS (crontab):
```bash
# Open crontab editor
crontab -e

# Add this line to run every 30 minutes
*/30 * * * * cd /path/to/hantavirustracker/automation && python update_data.py --once >> hantavirus_tracker.log 2>&1
```

#### On Windows (Task Scheduler):
1. Open Task Scheduler
2. Create Basic Task: "Hantavirus Tracker Update"
3. Trigger: "Repeat task every 30 minutes"
4. Action: Start a program
   - Program: `C:\Python\python.exe` (adjust to your Python path)
   - Arguments: `C:\path\to\automation\update_data.py --once`
   - Start in: `C:\path\to\automation`

### 5. Monitor Logs

```bash
# View recent logs
tail -f automation/hantavirus_tracker.log

# Search for errors
grep ERROR automation/hantavirus_tracker.log
```

## Data Sources

The script is configured to fetch from:

1. **ProMED-mail** (https://www.promedmail.org/)
   - RSS feed of infectious disease reports
   - RSS URL: https://www.promedmail.org/rss.php?feed=source_12

2. **Google News** 
   - Current search: hantavirus news
   - Multi-language support planned

3. **CDC** (https://www.cdc.gov/hantavirus/)
   - Official CDC hantavirus page
   - Web scraping for updates

4. **WHO** (https://www.who.int/)
   - World Health Organization disease tracking
   - Web scraping for global alerts

## Data Structure

The script updates `public/data.json` with this structure:

```json
{
  "lastUpdated": "ISO-8601 timestamp",
  "globalStats": {
    "totalCases": number,
    "totalDeaths": number,
    "suspectedCases": number,
    "affectedCountries": number,
    "fatalityRate": number,
    "caseTrend": "rising|stable|declining"
  },
  "outbreaks": [
    {
      "id": "unique_id",
      "country": "Country Name",
      "latitude": number,
      "longitude": number,
      "region": "Region/Province",
      "strain": "Sin Nombre|Andes|Hantaan|...",
      "cases": number,
      "deaths": number,
      "suspected": number,
      "dateReported": "YYYY-MM-DD",
      "dateUpdated": "YYYY-MM-DD",
      "severity": "high|medium|low",
      "notes": "Description of outbreak",
      "source": "Source name",
      "sourceUrl": "https://example.com"
    }
  ],
  "weeklyTrends": [
    {"week": "Date", "cases": number, "deaths": number}
  ],
  "strains": [
    {"name": "Strain", "region": "Region", "cases": number, "mortality": number}
  ]
}
```

## Customization

### Change Schedule

Edit `automation/update_data.py` and modify this line:

```python
scheduler.add_job(
    update_job,
    'interval',
    minutes=30,  # Change this number (e.g., 60 for hourly)
    ...
)
```

### Add Custom Data Sources

In `automation/update_data.py`, add to `DATA_SOURCES` dict:

```python
DATA_SOURCES['your_source'] = {
    'url': 'https://your-api.com/endpoint',
    'type': 'rss'  # or 'json' or 'web_scrape'
}
```

Then implement a `fetch_your_source_data()` function and call it in `update_job()`.

### Filter Results

Customize the `update_data_json()` function to:
- Filter by country
- Filter by severity
- Deduplicate by URL
- Merge with existing data

## Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'apscheduler'"
**Solution**: Make sure dependencies are installed:
```bash
pip install -r requirements.txt
```

### Issue: "Failed to push to GitHub"
**Solution**: Verify your `GITHUB_TOKEN`:
1. Check token is valid and not expired
2. Verify repo URL: `git remote -v`
3. Check token has `public_repo` or `repo` scope

### Issue: "data.json" not found
**Solution**: Ensure script is running from correct directory:
```bash
cd /path/to/hantavirustracker
python automation/update_data.py
```

### Issue: Script runs but data.json doesn't update
**Solution**: 
1. Check logs: `tail -f automation/hantavirus_tracker.log`
2. Verify data sources are accessible
3. Check file permissions on `public/data.json`
4. Run with `--once` flag first for testing

## Next Steps

1. **Implement real data fetching**:
   - Implement ProMED RSS parsing
   - Add Google News article extraction
   - Add CDC web scraping
   - Implement case count regex extraction

2. **Add intelligence**:
   - Natural Language Processing for case number extraction
   - Country name normalization
   - Strain identification from text
   - Deduplication algorithm

3. **Integrate with frontend**:
   - Frontend auto-refreshes from updated data.json
   - Real-time notifications for new outbreaks
   - Visitor analytics tracking

4. **Deploy to cloud**:
   - AWS Lambda + CloudWatch Events (every 30 min)
   - Google Cloud Functions + Cloud Scheduler
   - Azure Functions + Timer Trigger
   - GitHub Actions Workflow

## Architecture Diagram

```
Automation Script (every 30 minutes)
    ↓
Data Sources (ProMED, Google News, CDC, WHO)
    ↓
Parse & Extract (NLP, Regex, Web Scraping)
    ↓
Update data.json
    ↓
Git Commit & Push
    ↓
GitHub Pages Auto-Deploy
    ↓
React Frontend Loads Updated data.json
    ↓
Leaflet Map + Charts Update
```

## License

This automation script is part of HantavirusTracker.

## Support

For issues or questions:
1. Check the logs in `automation/hantavirus_tracker.log`
2. Review error messages and troubleshooting above
3. Test with `--once` flag to debug
