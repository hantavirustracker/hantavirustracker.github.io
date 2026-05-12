#!/usr/bin/env python3
"""Update public/data.json with real-source hantavirus reports.

This script is safe to run from:
- local machine (`python automation/update_data.py --once`)
- GitHub Actions every 30 minutes
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import subprocess
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import sleep
from typing import Any

import feedparser
from dotenv import load_dotenv


load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
LOG = logging.getLogger('hantavirus-updater')

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = REPO_ROOT / 'public' / 'data.json'

GIT_USER_NAME = os.getenv('GIT_USER_NAME', 'HantavirusTracker Bot')
GIT_USER_EMAIL = os.getenv('GIT_USER_EMAIL', 'bot@hantavirustracker.github.io')

# Public RSS sources for real reports/news mentioning hantavirus.
SOURCES = [
    {
        'name': 'Google News EN',
        'url': 'https://news.google.com/rss/search?q=hantavirus+outbreak&hl=en-US&gl=US&ceid=US:en',
    },
    {
        'name': 'Google News ES',
        'url': 'https://news.google.com/rss/search?q=hantavirus+brote&hl=es-419&gl=AR&ceid=AR:es-419',
    },
    {
        'name': 'Google News PT',
        'url': 'https://news.google.com/rss/search?q=hantavirus+surtos&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    },
    {
        'name': 'ProMED',
        'url': 'https://promedmail.org/feed/',
    },
]

COUNTRY_GEO = {
    'united states': (37.0902, -95.7129),
    'canada': (56.1304, -106.3468),
    'argentina': (-38.4161, -63.6167),
    'chile': (-35.6751, -71.5430),
    'brazil': (-14.2350, -51.9253),
    'germany': (51.1657, 10.4515),
    'turkey': (38.9637, 35.2433),
    'south korea': (36.5, 127.8),
    'korea': (36.5, 127.8),
    'japan': (36.2048, 138.2529),
    'philippines': (12.8797, 121.7740),
    'australia': (-25.2744, 133.7751),
    'russia': (61.5240, 105.3188),
    'sweden': (60.1282, 18.6435),
    'finland': (61.9241, 25.7482),
    'poland': (51.9194, 19.1451),
    'greece': (39.0742, 21.8243),
    'south africa': (-30.5595, 22.9375),
    'china': (35.8617, 104.1954),
}

COUNTRY_ALIASES = {
    'usa': 'united states',
    'u.s.': 'united states',
    'us': 'united states',
    'republic of korea': 'south korea',
}

STRAIN_HINTS = {
    'sin nombre': 'Sin Nombre',
    'andes': 'Andes',
    'hantaan': 'Hantaan',
    'puumala': 'Puumala',
    'seoul': 'Seoul',
    'dobrava': 'Dobrava',
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_date(raw: str | None) -> datetime:
    if not raw:
        return _utc_now()

    for fmt in (
        '%a, %d %b %Y %H:%M:%S %z',
        '%Y-%m-%dT%H:%M:%S%z',
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d',
    ):
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            continue

    return _utc_now()


def normalize_country(text: str) -> str | None:
    lowered = text.lower()

    for alias, resolved in COUNTRY_ALIASES.items():
        if re.search(rf'\b{re.escape(alias)}\b', lowered):
            return resolved.title()

    for country in COUNTRY_GEO:
        if re.search(rf'\b{re.escape(country)}\b', lowered):
            return country.title()

    return None


def extract_count(pattern: str, text: str) -> int:
    m = re.search(pattern, text, flags=re.IGNORECASE)
    if not m:
        return 0
    try:
        return int(m.group(1).replace(',', ''))
    except ValueError:
        return 0


def infer_severity(cases: int, deaths: int) -> str:
    if deaths >= 5 or cases >= 50:
        return 'high'
    if deaths >= 1 or cases >= 10:
        return 'medium'
    return 'low'


def infer_strain(text: str) -> str:
    lowered = text.lower()
    for key, strain in STRAIN_HINTS.items():
        if key in lowered:
            return strain
    return 'Unspecified Hantavirus'


def collect_reports(max_per_source: int = 40) -> list[dict[str, Any]]:
    reports: list[dict[str, Any]] = []

    for src in SOURCES:
        LOG.info('Fetching feed: %s', src['name'])
        feed = feedparser.parse(src['url'])

        for entry in feed.entries[:max_per_source]:
            title = entry.get('title', '').strip()
            summary = entry.get('summary', '').strip()
            link = entry.get('link', '').strip()
            combined = f'{title} {summary}'

            if 'hantavirus' not in combined.lower():
                continue

            report_dt = parse_date(entry.get('published') or entry.get('updated'))
            if report_dt < _utc_now() - timedelta(days=45):
                continue

            country = normalize_country(combined) or 'Unknown'
            cases = extract_count(r'(\d{1,6})\s+(?:confirmed\s+)?cases?', combined)
            deaths = extract_count(r'(\d{1,6})\s+deaths?', combined)
            suspected = extract_count(r'(\d{1,6})\s+suspected', combined)

            reports.append(
                {
                    'id': f"r-{abs(hash(link))}",
                    'title': title,
                    'summary': re.sub('<[^<]+?>', '', summary)[:600],
                    'link': link,
                    'source': src['name'],
                    'publishedAt': report_dt.isoformat(),
                    'country': country,
                    'cases': cases,
                    'deaths': deaths,
                    'suspected': suspected,
                    'strain': infer_strain(combined),
                }
            )

    # deduplicate by URL
    deduped = {}
    for r in reports:
        deduped[r['link']] = r

    clean = sorted(deduped.values(), key=lambda x: x['publishedAt'], reverse=True)
    LOG.info('Collected %s unique reports', len(clean))
    return clean


def to_outbreaks(reports: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = defaultdict(lambda: {
        'cases': 0,
        'deaths': 0,
        'suspected': 0,
        'dateUpdated': '',
        'source': '',
        'sourceUrl': '',
        'notes': '',
        'strain': 'Unspecified Hantavirus',
    })

    for r in reports:
        country = r['country']
        if country == 'Unknown':
            continue

        item = grouped[country]
        item['cases'] += r['cases']
        item['deaths'] += r['deaths']
        item['suspected'] += r['suspected']
        item['dateUpdated'] = max(item['dateUpdated'], r['publishedAt'])
        item['source'] = r['source']
        item['sourceUrl'] = r['link']
        item['notes'] = r['summary'][:250]
        item['strain'] = r['strain']

    outbreaks = []
    for country, agg in grouped.items():
        latlon = COUNTRY_GEO.get(country.lower())
        if not latlon:
            continue
        cases = int(agg['cases'])
        deaths = int(agg['deaths'])
        suspected = int(agg['suspected'])
        outbreaks.append(
            {
                'id': f"outbreak-{country.lower().replace(' ', '-')}",
                'country': country,
                'latitude': latlon[0],
                'longitude': latlon[1],
                'region': country,
                'strain': agg['strain'],
                'cases': cases,
                'deaths': deaths,
                'suspected': suspected,
                'dateReported': (parse_date(agg['dateUpdated']) - timedelta(days=2)).strftime('%Y-%m-%d'),
                'dateUpdated': parse_date(agg['dateUpdated']).strftime('%Y-%m-%d'),
                'severity': infer_severity(cases, deaths),
                'notes': agg['notes'] or 'Real-time media and bulletin report mentions.',
                'source': agg['source'],
                'sourceUrl': agg['sourceUrl'],
            }
        )

    outbreaks.sort(key=lambda x: (x['cases'], x['deaths']), reverse=True)
    return outbreaks


def build_timeline(reports: list[dict[str, Any]]) -> list[dict[str, Any]]:
    start = (_utc_now() - timedelta(days=13)).date()
    daily = []

    total_cases = 0
    total_deaths = 0
    countries_seen: set[str] = set()

    for i in range(14):
        day = start + timedelta(days=i)
        day_cases = 0
        day_deaths = 0
        day_suspected = 0

        for r in reports:
            rep_day = parse_date(r['publishedAt']).date()
            if rep_day == day:
                day_cases += r['cases']
                day_deaths += r['deaths']
                day_suspected += r['suspected']
                if r['country'] != 'Unknown':
                    countries_seen.add(r['country'])

        total_cases += day_cases
        total_deaths += day_deaths

        daily.append(
            {
                'date': day.isoformat(),
                'cases': total_cases,
                'deaths': total_deaths,
                'suspected': day_suspected,
                'countriesAffected': len(countries_seen),
                'spreadScore': round(total_cases * 0.07 + len(countries_seen) * 2 + total_deaths * 0.9, 2),
            }
        )

    return daily


def build_weekly_trends(timeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for point in timeline[-7:]:
        out.append({'week': point['date'][5:], 'cases': point['cases'], 'deaths': point['deaths']})
    return out


def build_news(reports: list[dict[str, Any]]) -> list[dict[str, Any]]:
    news = []
    for r in reports[:20]:
        news.append(
            {
                'id': r['id'],
                'title': r['title'],
                'source': r['source'],
                'url': r['link'],
                'publishedAt': r['publishedAt'],
                'country': r['country'],
            }
        )
    return news


def build_strains(outbreaks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    agg: dict[str, dict[str, Any]] = defaultdict(lambda: {'cases': 0, 'deaths': 0, 'region': 'Global'})

    for o in outbreaks:
        s = o['strain']
        agg[s]['cases'] += o['cases']
        agg[s]['deaths'] += o['deaths']

    items = []
    for name, values in agg.items():
        cases = values['cases']
        deaths = values['deaths']
        mortality = round((deaths / cases) * 100, 2) if cases > 0 else 0
        items.append({'name': name, 'region': values['region'], 'cases': cases, 'mortality': mortality})

    return sorted(items, key=lambda x: x['cases'], reverse=True)


def build_payload(reports: list[dict[str, Any]]) -> dict[str, Any]:
    outbreaks = to_outbreaks(reports)
    timeline = build_timeline(reports)
    weekly = build_weekly_trends(timeline)

    total_cases = sum(x['cases'] for x in outbreaks)
    total_deaths = sum(x['deaths'] for x in outbreaks)
    total_suspected = sum(x['suspected'] for x in outbreaks)
    affected = len({x['country'] for x in outbreaks})

    return {
        'lastUpdated': _utc_now().isoformat(),
        'globalStats': {
            'totalCases': total_cases,
            'totalDeaths': total_deaths,
            'suspectedCases': total_suspected,
            'affectedCountries': affected,
            'fatalityRate': round((total_deaths / total_cases) * 100, 2) if total_cases > 0 else 0,
            'caseTrend': 'rising' if len(timeline) > 1 and timeline[-1]['cases'] >= timeline[-2]['cases'] else 'steady',
        },
        'outbreaks': outbreaks,
        'weeklyTrends': weekly,
        'strains': build_strains(outbreaks),
        'news': build_news(reports),
        'timeline': timeline,
    }


def write_json(payload: dict[str, Any]) -> None:
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps(payload, indent=2), encoding='utf-8')
    LOG.info('Updated %s', DATA_PATH)


def run_git_publish() -> None:
    os.chdir(REPO_ROOT)

    subprocess.run(['git', 'config', 'user.name', GIT_USER_NAME], check=True)
    subprocess.run(['git', 'config', 'user.email', GIT_USER_EMAIL], check=True)
    subprocess.run(['git', 'add', 'public/data.json'], check=True)

    status = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True, check=True)
    if not status.stdout.strip():
        LOG.info('No changes; skipping commit')
        return

    msg = f"chore(data): refresh live reports {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
    subprocess.run(['git', 'commit', '-m', msg], check=True)
    subprocess.run(['git', 'push', 'origin', 'main'], check=True)
    LOG.info('Pushed updated data.json to main')


def update_once(push: bool = False) -> None:
    reports = collect_reports()
    payload = build_payload(reports)
    write_json(payload)
    if push:
        run_git_publish()


def run_loop(push: bool = False) -> None:
    while True:
        try:
            update_once(push=push)
        except Exception as exc:  # pylint: disable=broad-except
            LOG.exception('Update cycle failed: %s', exc)
        sleep(30 * 60)


def main() -> None:
    parser = argparse.ArgumentParser(description='Refresh live hantavirus data.')
    parser.add_argument('--once', action='store_true', help='Run once and exit.')
    parser.add_argument('--push', action='store_true', help='Commit/push data changes after update.')
    args = parser.parse_args()

    if args.once:
        update_once(push=args.push)
        return

    run_loop(push=args.push)


if __name__ == '__main__':
    main()
