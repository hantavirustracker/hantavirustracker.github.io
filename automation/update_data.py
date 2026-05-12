#!/usr/bin/env python3
"""
HantavirusTracker Data Automation Script

Runs every 30 minutes to:
1. Search for new hantavirus reports worldwide
2. Update outbreak data
3. Commit and push to GitHub
4. Trigger GitHub Pages redeploy

Requirements:
- pip install apscheduler requests feedparser python-dotenv

Environment Variables:
- GITHUB_TOKEN: GitHub personal access token for commits
- GIT_USER_NAME: Git user name for commits
- GIT_USER_EMAIL: Git user email for commits
"""

import json
import os
import subprocess
from datetime import datetime, timedelta
import logging
from pathlib import Path

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    import requests
    import feedparser
    from dotenv import load_dotenv
except ImportError:
    print("Installing required packages...")
    subprocess.run(["pip", "install", "apscheduler", "requests", "feedparser", "python-dotenv"], check=True)
    from apscheduler.schedulers.background import BackgroundScheduler
    import requests
    import feedparser
    from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('hantavirus_tracker.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN', '')
GIT_USER_NAME = os.getenv('GIT_USER_NAME', 'HantavirusTracker Bot')
GIT_USER_EMAIL = os.getenv('GIT_USER_EMAIL', 'bot@hantavirustracker.github.io')
DATA_FILE = Path(__file__).parent / 'public' / 'data.json'

# API endpoints and feeds for hantavirus data
DATA_SOURCES = {
    'promed': {
        'url': 'https://www.promedmail.org/rss.php?feed=source_12',
        'type': 'rss'
    },
    'google_news_en': {
        'url': 'https://news.google.com/rss/search?q=hantavirus&ceid=US:en',
        'type': 'rss'
    },
    'cdc': {
        'url': 'https://www.cdc.gov/hantavirus/index.html',
        'type': 'web_scrape'
    },
    'who': {
        'url': 'https://www.who.int/search?query=hantavirus',
        'type': 'web_scrape'
    }
}

def fetch_promed_data():
    """Fetch hantavirus reports from ProMED-mail"""
    try:
        logger.info("Fetching ProMED-mail data...")
        feed = feedparser.parse(DATA_SOURCES['promed']['url'])
        reports = []
        
        for entry in feed.entries[:10]:  # Get last 10 entries
            report = {
                'title': entry.get('title', ''),
                'summary': entry.get('summary', '')[:500],
                'link': entry.get('link', ''),
                'date': entry.get('published', '')
            }
            reports.append(report)
        
        logger.info(f"Retrieved {len(reports)} reports from ProMED")
        return reports
    except Exception as e:
        logger.error(f"Error fetching ProMED data: {e}")
        return []

def fetch_google_news_data():
    """Fetch hantavirus news from Google News RSS"""
    try:
        logger.info("Fetching Google News data...")
        feed = feedparser.parse(DATA_SOURCES['google_news_en']['url'])
        reports = []
        
        for entry in feed.entries[:10]:
            report = {
                'title': entry.get('title', ''),
                'summary': entry.get('summary', '')[:500],
                'link': entry.get('link', ''),
                'date': entry.get('published', '')
            }
            reports.append(report)
        
        logger.info(f"Retrieved {len(reports)} news articles from Google News")
        return reports
    except Exception as e:
        logger.error(f"Error fetching Google News data: {e}")
        return []

def update_data_json(new_data=None):
    """Update data.json with latest information"""
    try:
        logger.info("Updating data.json...")
        
        # Load existing data
        if DATA_FILE.exists():
            with open(DATA_FILE, 'r') as f:
                data = json.load(f)
        else:
            logger.warning("data.json not found, creating new file")
            data = {
                'lastUpdated': datetime.utcnow().isoformat() + 'Z',
                'globalStats': {
                    'totalCases': 0,
                    'totalDeaths': 0,
                    'suspectedCases': 0,
                    'affectedCountries': 0,
                    'fatalityRate': 0,
                    'caseTrend': 'stable'
                },
                'outbreaks': [],
                'weeklyTrends': [],
                'strains': []
            }
        
        # Update timestamp
        data['lastUpdated'] = datetime.utcnow().isoformat() + 'Z'
        
        # Update global stats by aggregating outbreak data
        if data.get('outbreaks'):
            data['globalStats']['totalCases'] = sum(o.get('cases', 0) for o in data['outbreaks'])
            data['globalStats']['totalDeaths'] = sum(o.get('deaths', 0) for o in data['outbreaks'])
            data['globalStats']['suspectedCases'] = sum(o.get('suspected', 0) for o in data['outbreaks'])
            data['globalStats']['affectedCountries'] = len(set(o.get('country') for o in data['outbreaks']))
            
            if data['globalStats']['totalCases'] > 0:
                data['globalStats']['fatalityRate'] = round(
                    data['globalStats']['totalDeaths'] / data['globalStats']['totalCases'] * 100, 2
                )
        
        # TODO: Here you would implement logic to:
        # 1. Fetch new reports from ProMED, Google News, CDC, WHO
        # 2. Parse country, case, death counts using NLP/regex
        # 3. Match to existing outbreaks or create new ones
        # 4. Update weekly trends
        # 5. Dedup by URL
        
        # Save updated data
        with open(DATA_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        
        logger.info("data.json updated successfully")
        return True
    except Exception as e:
        logger.error(f"Error updating data.json: {e}")
        return False

def git_commit_and_push():
    """Commit changes and push to GitHub"""
    try:
        repo_path = Path(__file__).parent
        os.chdir(repo_path)
        
        # Configure git
        subprocess.run(['git', 'config', 'user.name', GIT_USER_NAME], check=True)
        subprocess.run(['git', 'config', 'user.email', GIT_USER_EMAIL], check=True)
        
        # Check if there are changes
        result = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True)
        if not result.stdout:
            logger.info("No changes to commit")
            return True
        
        logger.info("Changes detected, committing...")
        
        # Stage changes
        subprocess.run(['git', 'add', 'public/data.json'], check=True)
        
        # Commit
        commit_msg = f"Update outbreak data - {datetime.now().isoformat()}"
        subprocess.run(['git', 'commit', '-m', commit_msg], check=True)
        
        # Push (with token for authentication if set)
        if GITHUB_TOKEN:
            # Use token-based authentication
            remote_url = subprocess.run(['git', 'config', '--get', 'remote.origin.url'],
                                      capture_output=True, text=True).stdout.strip()
            
            if 'github.com' in remote_url:
                # Convert to HTTPS URL with token
                if remote_url.startswith('git@'):
                    remote_url = remote_url.replace('git@github.com:', 'https://github.com/')
                    remote_url = remote_url.replace('.git', '')
                
                # Add token
                token_url = remote_url.replace('https://github.com/',
                                             f'https://x-access-token:{GITHUB_TOKEN}@github.com/')
                subprocess.run(['git', 'remote', 'set-url', 'origin', token_url], check=True)
        
        # Push to origin main
        result = subprocess.run(['git', 'push', 'origin', 'main'],
                              capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            logger.info("Successfully pushed to GitHub")
            return True
        else:
            logger.error(f"Push failed: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        logger.error("Git push timed out")
        return False
    except Exception as e:
        logger.error(f"Error in git commit and push: {e}")
        return False

def update_job():
    """Main job that runs every 30 minutes"""
    logger.info("=" * 50)
    logger.info("Starting scheduled data update")
    logger.info("=" * 50)
    
    try:
        # Fetch latest data from sources
        promed_data = fetch_promed_data()
        news_data = fetch_google_news_data()
        
        # Update data.json
        update_data_json()
        
        # Commit and push changes
        git_commit_and_push()
        
        logger.info("Scheduled update completed successfully")
    except Exception as e:
        logger.error(f"Scheduled update failed: {e}")

def start_scheduler():
    """Start the APScheduler background job"""
    scheduler = BackgroundScheduler()
    
    # Schedule job to run every 30 minutes
    scheduler.add_job(
        update_job,
        'interval',
        minutes=30,
        id='hantavirus_update',
        name='Hantavirus Data Update',
        replace_existing=True
    )
    
    # Also run immediately on start
    scheduler.add_job(
        update_job,
        'date',
        run_date=datetime.now()
    )
    
    scheduler.start()
    logger.info("Scheduler started - job will run every 30 minutes")
    
    try:
        # Keep the scheduler running
        while True:
            pass
    except KeyboardInterrupt:
        scheduler.shutdown()
        logger.info("Scheduler shut down")

def manual_update():
    """Manual update - run once and exit"""
    logger.info("Running manual data update...")
    update_job()
    logger.info("Manual update completed")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == '--once':
        # Run once and exit
        manual_update()
    else:
        # Start scheduler
        logger.info("HantavirusTracker Data Automation Script starting...")
        logger.info(f"Data file: {DATA_FILE}")
        start_scheduler()
