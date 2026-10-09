# scraper.py - UET SCRAPER v9 (MongoDB + Node Logging Enabled)
import sys
sys.stdout.reconfigure(encoding='utf-8')
import json
import os
import re
import hashlib
import logging
import requests   # 🔥 NEW
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# ==============================
# CONFIG
# ==============================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_URL = "https://www.uetmardan.edu.pk"

OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
EVENTS_FILE = os.path.join(OUTPUT_DIR, "events.json")
NEWS_FILE = os.path.join(OUTPUT_DIR, "news.json")
LOG_FILE = os.path.join(OUTPUT_DIR, "scraper.log")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ==============================
# NODE BACKEND LOG API
# ==============================
NODE_LOG_API = "http://localhost:5000/api/scraperlog/log"

def send_to_node(message, type="info"):
    """
    Send logs to Node.js backend → MongoDB → Frontend
    """
    try:
        requests.post(
            NODE_LOG_API,
            json={
                "message": message,
                "type": type
            },
            timeout=3
        )
    except Exception:
        # Don't crash scraper if backend is down
        pass


# ==============================
# LOGGING
# ==============================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


def log(message, type="info"):
    """
    Dual logging:
    - Console + file
    - MongoDB via Node API
    """
    print(message)
    logger.info(message)
    send_to_node(message, type)


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
    if url.startswith("/"):
        url = BASE_URL + url
    return url.rstrip("/")


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
        if i["link"] in seen:
            continue
        seen.add(i["link"])
        out.append(i)
    return out


def load_existing(path):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_json(data, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)


# ==============================
# VALID LINK CHECK
# ==============================
def is_valid_link(link):
    return (
        link and
        "uetmardan.edu.pk" in link and
        ("news_detail" in link or "event_detail" in link)
    )


# ==============================
# SAFE NAVIGATION
# ==============================
def safe_goto(page, url):
    for i in range(3):
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            return True
        except PlaywrightTimeoutError:
            log(f"Timeout retry {i+1}/3: {url}", "error")
        except Exception as e:
            log(f"Navigation error: {e}", "error")

    log(f"FAILED: {url}", "error")
    return False


# ==============================
# HOME SCRAPER
# ==============================
def scrape_home(page):
    if not safe_goto(page, f"{BASE_URL}/uetm/"):
        return [], []

    data = page.evaluate("""() => {
        return Array.from(
            document.querySelectorAll("a[href*='event_detail'], a[href*='news_detail']")
        ).map(a => ({
            title: a.innerText.trim(),
            link: a.href,
            type: a.href.includes('event_detail') ? 'events' : 'news'
        }));
    }""")

    events = []
    news = []

    for d in data:
        if not is_valid_link(d["link"]):
            continue

        item = {
            "id": generate_id(d["type"], d["link"]),
            "type": d["type"],
            "title": normalize_text(d["title"]),
            "link": normalize_url(d["link"]),
            "date": "",
            "description": "",
            "content": "",
            "source": "home"
        }

        if d["type"] == "events":
            events.append(item)
        else:
            news.append(item)

    return events, news


# ==============================
# ARCHIVE SCRAPER
# ==============================
def scrape_archive(page, typ):
    results = []

    for i in range(1, 4):
        url = f"{BASE_URL}/uetm/News/{typ}_archive/{i}"

        if not safe_goto(page, url):
            break

        selector = "a[href*='" + typ[:-1] + "_detail']"

        data = page.evaluate(
            """
            (selector) => {
                return Array.from(document.querySelectorAll(selector)).map(a => ({
                    title: a.innerText.trim(),
                    link: a.href
                }));
            }
            """,
            selector
        )

        if not data:
            break

        for d in data:
            if not is_valid_link(d["link"]):
                continue

            results.append({
                "id": generate_id(typ, d["link"]),
                "type": typ,
                "title": normalize_text(d["title"]),
                "link": normalize_url(d["link"]),
                "date": "",
                "description": "",
                "content": "",
                "source": "archive"
            })

    return results


# ==============================
# CONTENT EXTRACTION
# ==============================
def extract_content(page, item):
    try:
        if not safe_goto(page, item["link"]):
            return item

        data = page.evaluate("""() => {
            const el = document.querySelector(".col-md-9");
            return el ? el.innerText : "";
        }""")

        item["description"] = data[:2000]
        item["content"] = data
        return item

    except Exception as e:
        log(f"Content error: {e}", "error")
        return item


# ==============================
# MAIN PIPELINE
# ==============================
def run_scraper():
    start = datetime.now()
    new_items_count = 0

    log("🚀 Scraper started")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        page = browser.new_page()

        home_events, home_news = scrape_home(page)
        arch_events = scrape_archive(page, "events")
        arch_news = scrape_archive(page, "news")

        for file, home, arch in [
            (EVENTS_FILE, home_events, arch_events),
            (NEWS_FILE, home_news, arch_news)
        ]:
            existing = load_existing(file)
            existing_map = {i["link"]: i for i in existing}

            combined = dedupe_items(home + arch)

            for item in combined:
                if item["link"] in existing_map:
                    continue

                log(f"New item found: {item['title']}", "info")

                existing_map[item["link"]] = extract_content(page, item)
                new_items_count += 1

        save_json(list(existing_map.values()), EVENTS_FILE)
        save_json(list(existing_map.values()), NEWS_FILE)

        browser.close()

    log(f"FINISHED in {(datetime.now()-start).total_seconds():.1f}s", "info")

    return new_items_count


if __name__ == "__main__":
    run_scraper()