use axum::{
    Json, Router,
    extract::{Query, State},
    routing::get,
};
use serde::{Deserialize, Serialize};
use std::{cmp::Reverse, net::SocketAddr};
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CountryNode {
    code: &'static str,
    name: &'static str,
    x: u8,
    y: u8,
    trend: &'static str,
    mentions: u16,
    active_alerts: u8,
    confirmed_cases: u8,
    last_update: &'static str,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Mention {
    id: &'static str,
    country: &'static str,
    headline: &'static str,
    source: &'static str,
    published_at: &'static str,
    impact: u8,
    severity: &'static str,
    summary: &'static str,
    link: &'static str,
}

#[derive(Clone)]
struct AppState {
    countries: Vec<CountryNode>,
    mentions: Vec<Mention>,
    weekly_mentions: Vec<u8>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Stats {
    total_mentions: u32,
    confirmed_cases: u32,
    active_alerts: u32,
    average_impact: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapPayload {
    countries: Vec<CountryNode>,
    mentions: Vec<Mention>,
    weekly_mentions: Vec<u8>,
    stats: Stats,
    latest_alert: Mention,
}

#[derive(Deserialize)]
struct MentionQuery {
    limit: Option<usize>,
}

#[tokio::main]
async fn main() {
    let state = AppState {
        countries: seed_countries(),
        mentions: seed_mentions(),
        weekly_mentions: vec![44, 51, 47, 64, 69, 73, 77],
    };

    let cors = CorsLayer::new()
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_origin(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/countries", get(get_countries))
        .route("/api/mentions/latest", get(get_mentions_latest))
        .route("/api/stats", get(get_stats))
        .route("/api/trends/weekly", get(get_weekly_trends))
        .route("/api/alerts/latest", get(get_latest_alert))
        .route("/api/bootstrap", get(get_bootstrap))
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind backend server to 127.0.0.1:8080");

    println!("Rust API listening on http://{}", addr);
    axum::serve(listener, app)
        .await
        .expect("backend server crashed unexpectedly");
}

async fn health() -> &'static str {
    "ok"
}

async fn get_countries(State(state): State<AppState>) -> Json<Vec<CountryNode>> {
    Json(state.countries)
}

async fn get_mentions_latest(
    State(state): State<AppState>,
    Query(query): Query<MentionQuery>,
) -> Json<Vec<Mention>> {
    let mut mentions = state.mentions;
    mentions.sort_by_key(|mention| Reverse(mention.impact));

    let limit = query.limit.unwrap_or(6).max(1);
    Json(mentions.into_iter().take(limit).collect())
}

async fn get_stats(State(state): State<AppState>) -> Json<Stats> {
    Json(compute_stats(&state))
}

async fn get_weekly_trends(State(state): State<AppState>) -> Json<Vec<u8>> {
    Json(state.weekly_mentions)
}

async fn get_latest_alert(State(state): State<AppState>) -> Json<Mention> {
    let latest = state
        .mentions
        .iter()
        .filter(|mention| mention.severity == "high")
        .max_by_key(|mention| mention.impact)
        .expect("seed mentions must include at least one high severity item")
        .clone();

    Json(latest)
}

async fn get_bootstrap(State(state): State<AppState>) -> Json<BootstrapPayload> {
    let stats = compute_stats(&state);
    let countries = state.countries.clone();
    let weekly_mentions = state.weekly_mentions.clone();

    let mut mentions = state.mentions.clone();
    mentions.sort_by_key(|mention| Reverse(mention.impact));

    let latest_alert = mentions
        .iter()
        .find(|mention| mention.severity == "high")
        .expect("seed mentions must include at least one high severity item")
        .clone();

    Json(BootstrapPayload {
        countries,
        mentions,
        weekly_mentions,
        stats,
        latest_alert,
    })
}

fn compute_stats(state: &AppState) -> Stats {
    let total_mentions = state
        .countries
        .iter()
        .map(|country| u32::from(country.mentions))
        .sum();

    let confirmed_cases = state
        .countries
        .iter()
        .map(|country| u32::from(country.confirmed_cases))
        .sum();

    let active_alerts = state
        .countries
        .iter()
        .map(|country| u32::from(country.active_alerts))
        .sum();

    let total_impact: u32 = state.mentions.iter().map(|mention| u32::from(mention.impact)).sum();
    let average_impact = total_impact / u32::try_from(state.mentions.len()).unwrap_or(1);

    Stats {
        total_mentions,
        confirmed_cases,
        active_alerts,
        average_impact,
    }
}

fn seed_countries() -> Vec<CountryNode> {
    vec![
        CountryNode { code: "US", name: "United States", x: 20, y: 36, trend: "rising", mentions: 31, active_alerts: 4, confirmed_cases: 7, last_update: "20:10 UTC" },
        CountryNode { code: "CA", name: "Canada", x: 18, y: 26, trend: "steady", mentions: 14, active_alerts: 1, confirmed_cases: 2, last_update: "19:30 UTC" },
        CountryNode { code: "AR", name: "Argentina", x: 31, y: 78, trend: "rising", mentions: 21, active_alerts: 3, confirmed_cases: 5, last_update: "20:25 UTC" },
        CountryNode { code: "DE", name: "Germany", x: 52, y: 31, trend: "easing", mentions: 9, active_alerts: 0, confirmed_cases: 1, last_update: "18:58 UTC" },
        CountryNode { code: "TR", name: "Turkey", x: 58, y: 35, trend: "steady", mentions: 11, active_alerts: 1, confirmed_cases: 2, last_update: "19:50 UTC" },
        CountryNode { code: "KR", name: "South Korea", x: 79, y: 34, trend: "rising", mentions: 18, active_alerts: 2, confirmed_cases: 4, last_update: "20:41 UTC" },
        CountryNode { code: "JP", name: "Japan", x: 84, y: 35, trend: "steady", mentions: 8, active_alerts: 0, confirmed_cases: 1, last_update: "19:42 UTC" },
        CountryNode { code: "PH", name: "Philippines", x: 81, y: 50, trend: "rising", mentions: 12, active_alerts: 1, confirmed_cases: 2, last_update: "20:03 UTC" },
        CountryNode { code: "ZA", name: "South Africa", x: 55, y: 80, trend: "steady", mentions: 7, active_alerts: 1, confirmed_cases: 1, last_update: "18:21 UTC" },
        CountryNode { code: "AU", name: "Australia", x: 86, y: 77, trend: "easing", mentions: 6, active_alerts: 0, confirmed_cases: 0, last_update: "17:59 UTC" },
    ]
}

fn seed_mentions() -> Vec<Mention> {
    vec![
        Mention {
            id: "m-01",
            country: "United States",
            headline: "Clustered respiratory admissions linked to rodent exposure in Four Corners region",
            source: "Regional Health Dispatch",
            published_at: "2026-05-12T19:34:00Z",
            impact: 95,
            severity: "high",
            summary: "Emergency departments issued a red advisory after multiple severe cases were reported in a 24-hour window.",
            link: "https://example.com/mentions/m-01",
        },
        Mention {
            id: "m-02",
            country: "Argentina",
            headline: "Local authorities escalate field surveillance in southern provinces",
            source: "Andes Public Health Wire",
            published_at: "2026-05-12T18:58:00Z",
            impact: 90,
            severity: "high",
            summary: "Cross-border surveillance teams increased trap monitoring and clinical screening in high-risk districts.",
            link: "https://example.com/mentions/m-02",
        },
        Mention {
            id: "m-03",
            country: "South Korea",
            headline: "Mentions spike after two regional hospitals activate enhanced triage protocol",
            source: "Seoul Daily Bulletin",
            published_at: "2026-05-12T18:45:00Z",
            impact: 84,
            severity: "medium",
            summary: "Hospitals moved to caution mode and requested accelerated lab reporting for suspected cases.",
            link: "https://example.com/mentions/m-03",
        },
        Mention {
            id: "m-04",
            country: "Turkey",
            headline: "Rural outbreak watch expanded to three additional districts",
            source: "Anatolia News Service",
            published_at: "2026-05-12T18:03:00Z",
            impact: 79,
            severity: "medium",
            summary: "Public bulletin calls for rapid referral pathways and updates to local case definitions.",
            link: "https://example.com/mentions/m-04",
        },
        Mention {
            id: "m-05",
            country: "Canada",
            headline: "Northern provinces report stable but persistent rodent-borne risk indicators",
            source: "Prairie Health Monitor",
            published_at: "2026-05-12T17:42:00Z",
            impact: 68,
            severity: "low",
            summary: "No surge signal yet, but sustained mention volume keeps northern communities on watch.",
            link: "https://example.com/mentions/m-05",
        },
        Mention {
            id: "m-06",
            country: "Philippines",
            headline: "Local press highlights increased fever-case tracing in peri-urban areas",
            source: "Metro Desk PH",
            published_at: "2026-05-12T17:10:00Z",
            impact: 65,
            severity: "medium",
            summary: "Community clinics began weekly reporting consolidation to reduce undercounting.",
            link: "https://example.com/mentions/m-06",
        },
        Mention {
            id: "m-07",
            country: "Germany",
            headline: "Case mentions cool after targeted awareness campaign",
            source: "European Epidemiology Watch",
            published_at: "2026-05-12T16:55:00Z",
            impact: 53,
            severity: "low",
            summary: "Regional trends are flattening, but rural alerts remain active in two areas.",
            link: "https://example.com/mentions/m-07",
        },
        Mention {
            id: "m-08",
            country: "South Africa",
            headline: "Provincial health unit issues cautionary advisory for high-density settlements",
            source: "Cape Health Line",
            published_at: "2026-05-12T16:21:00Z",
            impact: 57,
            severity: "medium",
            summary: "Authorities recommend rodent-proofing campaigns and faster referral workflows.",
            link: "https://example.com/mentions/m-08",
        },
    ]
}
