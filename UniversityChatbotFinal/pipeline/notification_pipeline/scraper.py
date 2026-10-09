# pipeline/notification_pipeline/scraper.py
import sys
sys.stdout.reconfigure(encoding='utf-8')
import json
import os
import re
import hashlib
import logging
from datetime import datetime
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

# ==============================
# CONFIG
# ==============================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_URL = "https://www.uetmardan.edu.pk"
HOMEPAGE_URL = f"{BASE_URL}/uetm/"

OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
EVENTS_FILE = os.path.join(OUTPUT_DIR, "events.json")
NEWS_FILE = os.path.join(OUTPUT_DIR, "news.json")
LOG_FILE = os.path.join(OUTPUT_DIR, "scraper.log")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Also ensure data/notifications/raw directory exists for pipeline compatibility
BASE_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
RAW_DIR = os.path.join(BASE_DIR, "data", "notifications", "raw")
os.makedirs(RAW_DIR, exist_ok=True)
RAW_EVENTS_FILE = os.path.join(RAW_DIR, "events.json")
RAW_NEWS_FILE = os.path.join(RAW_DIR, "news.json")

# ==============================
# NODE BACKEND LOG API
# ==============================
NODE_LOG_API = "http://localhost:5000/api/scraperlog/log"

def send_to_node(message, log_type="info"):
    """Send logs to Node.js backend -> MongoDB -> Frontend SSE"""
    try:
        requests.post(
            NODE_LOG_API,
            json={"message": message, "type": log_type},
            timeout=2
        )
    except Exception:
        pass

# ==============================
# LOGGING
# ==============================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def log(message, log_type="info"):
    logger.info(message)
    send_to_node(message, log_type)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
}

# ==============================
# HELPERS
# ==============================
def normalize_text(text):
    if not text:
        return ""
    text = text.replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()

def normalize_url(url):
    if not url:
        return ""
    return urljoin(BASE_URL, url).rstrip("/")

def generate_id(typ, url):
    parts = url.rstrip("/").split("/")
    for i, part in enumerate(parts):
        if part in ("event_detail", "news_detail") and i + 1 < len(parts):
            return f"{typ}-{parts[i + 1]}"
    return f"{typ}-{hashlib.md5(url.encode()).hexdigest()[:8]}"

def dedupe_items(items):
    seen = set()
    out = []
    for i in items:
        link = i.get("link")
        if not link or link in seen:
            continue
        seen.add(link)
        out.append(i)
    return out

def load_existing(path):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_json(data, path):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        log(f"Error saving to {path}: {e}", "error")

def is_valid_link(link):
    return (
        link and
        "uetmardan.edu.pk" in link and
        ("news_detail" in link or "event_detail" in link)
    )

# ==============================
# SCRAPING LOGIC (REQUESTS + BS4)
# ==============================
def fetch_soup(url, timeout=20):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        if resp.status_code == 200:
            return BeautifulSoup(resp.text, "html.parser")
        else:
            log(f"HTTP {resp.status_code} fetching {url}", "error")
            return None
    except Exception as e:
        log(f"Network error on {url}: {e}", "error")
        return None

def scrape_home():
    log("Scanning UET Mardan homepage for active notifications...", "info")
    soup = fetch_soup(HOMEPAGE_URL)
    if not soup:
        return [], []

    events = []
    news = []

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not ("event_detail" in href or "news_detail" in href):
            continue

        full_url = normalize_url(href)
        if not is_valid_link(full_url):
            continue

        title = normalize_text(a.get_text())
        item_type = "events" if "event_detail" in full_url else "news"

        item = {
            "id": generate_id(item_type, full_url),
            "type": item_type,
            "title": title or "UET Mardan Notice",
            "link": full_url,
            "date": "",
            "description": "",
            "content": "",
            "source": "uetm_home"
        }

        if item_type == "events":
            events.append(item)
        else:
            news.append(item)

    log(f"Homepage scan found {len(events)} events and {len(news)} news links.", "info")
    return events, news

def scrape_archive(typ, max_pages=2):
    results = []
    log(f"Scanning UET Mardan {typ} archives (up to {max_pages} pages)...", "info")

    for page_num in range(1, max_pages + 1):
        url = f"{BASE_URL}/uetm/News/{typ}_archive/{page_num}"
        soup = fetch_soup(url)
        if not soup:
            break

        count_before = len(results)
        keyword = "event_detail" if typ == "events" else "news_detail"

        for a in soup.find_all("a", href=True):
            href = a["href"]
            if keyword in href:
                full_url = normalize_url(href)
                if not is_valid_link(full_url):
                    continue

                title = normalize_text(a.get_text())
                results.append({
                    "id": generate_id(typ, full_url),
                    "type": typ,
                    "title": title or f"UET Mardan {typ.capitalize()}",
                    "link": full_url,
                    "date": "",
                    "description": "",
                    "content": "",
                    "source": "uetm_archive"
                })

        if len(results) == count_before:
            # No new items on this page, stop pagination
            break

    log(f"Archive scan for {typ} found {len(results)} items.", "info")
    return results

def extract_detail_content(item):
    """
    Extracts high-fidelity notice text and metadata from the detail page
    """
    try:
        soup = fetch_soup(item["link"])
        if not soup:
            return item

        # Target content container
        container = (
            soup.find("div", class_="course-details-inner") or
            soup.find("div", class_="news-details-inner") or
            soup.find("div", class_=re.compile(r"col-md-9|col-lg-9|main-content|news-content"))
        )

        content_text = ""
        if container:
            content_text = container.get_text(separator="\n", strip=True)
        else:
            # Fallback to body
            content_text = soup.body.get_text(separator="\n", strip=True) if soup.body else ""

        # Extract date from page if available
        date_pattern = r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+\d{4}\b"
        date_match = re.search(date_pattern, content_text, re.IGNORECASE)
        if date_match:
            item["date"] = date_match.group(0)

        # Clean title if empty
        if not item.get("title") or item["title"].startswith("UET Mardan"):
            h_tag = soup.find(["h1", "h2", "h3"])
            if h_tag:
                item["title"] = normalize_text(h_tag.get_text())

        # Clean content
        item["content"] = content_text
        item["description"] = content_text[:300].strip()

        return item

    except Exception as e:
        log(f"Content extraction error for {item['link']}: {e}", "error")
        return item

# ==============================
# MAIN PIPELINE FUNCTION
# ==============================
def run_scraper():
    start_time = datetime.now()
    log("==========================================", "info")
    log("🚀 UET MARDAN LIVE SCRAPER STARTED", "info")
    log("==========================================", "info")
    print("PROGRESS: 10", flush=True)

    # 1. Scrape Homepage & Archives
    home_events, home_news = scrape_home()
    print("PROGRESS: 20", flush=True)

    arch_events = scrape_archive("events", max_pages=2)
    print("PROGRESS: 25", flush=True)

    arch_news = scrape_archive("news", max_pages=2)
    print("PROGRESS: 30", flush=True)

    all_scraped_events = dedupe_items(home_events + arch_events)
    all_scraped_news = dedupe_items(home_news + arch_news)

    total_new_items = 0

    # 2. Process Events and News with content extraction
    configs = [
        ("events", EVENTS_FILE, RAW_EVENTS_FILE, all_scraped_events),
        ("news", NEWS_FILE, RAW_NEWS_FILE, all_scraped_news),
    ]

    total_candidates = len(all_scraped_events) + len(all_scraped_news)
    processed_count = 0

    for category, file_path, raw_file_path, items in configs:
        existing = load_existing(file_path)
        existing_map = {i["link"]: i for i in existing if i.get("link")}

        category_new = 0

        for item in items:
            processed_count += 1
            pct = 30 + int((processed_count / max(total_candidates, 1)) * 20)
            print(f"PROGRESS: {pct}", flush=True)

            link = item.get("link")
            if not link:
                continue

            # If already exists and has content, skip
            if link in existing_map and len(existing_map[link].get("content", "")) > 50:
                continue

            log(f"Scraping new {category} notice: {item['title']}", "info")
            item_with_content = extract_detail_content(item)
            existing_map[link] = item_with_content
            category_new += 1
            total_new_items += 1

        # Save to both output/ and raw/
        saved_list = list(existing_map.values())
        save_json(saved_list, file_path)
        save_json(saved_list, raw_file_path)

        log(f"Saved {len(saved_list)} {category} items ({category_new} newly scraped).", "info")

    elapsed = (datetime.now() - start_time).total_seconds()
    log(f"✅ Scraping completed in {elapsed:.1f}s. New items added: {total_new_items}", "info")
    print("PROGRESS: 50", flush=True)

    return total_new_items

if __name__ == "__main__":
    count = run_scraper()
    print(f"Total new items scraped: {count}")