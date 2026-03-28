# scraper/scrape.py
# FINAL VERSION – WITH LIVE PROGRESS FOR DASHBOARD

import json
import os
from datetime import datetime
from playwright.sync_api import sync_playwright

BASE_URL = "https://www.uetmardan.edu.pk"
OUTPUT_FILE = r"D:\fyp chatbot\UniversityChatbotFinal\data\notifications\raw\scraped_notifications.json"
MAX_NEW_ITEMS = 100

os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)


# =====================================
# LOAD EXISTING DATA
# =====================================
def load_existing_data():
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                data = f.read().strip()
                if not data:
                    return []
                return json.loads(data)
        except:
            return []
    return []


# =====================================
# CLEAN TEXT
# =====================================
def clean_text(text):

    remove_words = [
        "HOME","ABOUT UETM","ADMISSIONS",
        "ACADEMICS","QEC","STUDENTS",
        "DOWNLOADS","CONTACTS"
    ]

    for w in remove_words:
        text = text.replace(w,"")

    return text.strip()


# =====================================
# EXTRACT DATE
# =====================================
def extract_date(container):

    try:

        day = container.query_selector("div").inner_text().strip()
        month_year = container.query_selector_all("div")[1].inner_text().strip()

        full = f"{day} {month_year}"

        date_obj = datetime.strptime(full,"%d %b %Y")

        return date_obj.strftime("%Y-%m-%d")

    except:

        return "unknown"


# =====================================
# SCRAPE ARCHIVE WITH PROGRESS
# =====================================
def scrape_archive(page, archive_type, existing_links, progress_start, progress_end):

    results = []
    page_number = 1
    max_pages = 8   # adjust if site grows

    while page_number <= max_pages and len(results) < MAX_NEW_ITEMS:

        url = f"{BASE_URL}/uetm/News/{archive_type}_archive/{page_number}"

        print(f"\nOpening {url}", flush=True)

        try:
            page.goto(url,timeout=90000,wait_until="networkidle")
            page.wait_for_timeout(2000)

        except:
            break

        containers = page.query_selector_all(".col-md-12")

        if not containers:
            break

        for c in containers:

            link_elem = c.query_selector("a")

            if not link_elem:
                continue

            href = link_elem.get_attribute("href")
            title = link_elem.inner_text().strip()

            if not href:
                continue

            if href.startswith("/"):
                href = BASE_URL + href

            if href in existing_links:
                continue

            date = extract_date(c)

            results.append({
                "id": f"{archive_type}-{datetime.utcnow().timestamp()}",
                "type": archive_type,
                "title": title,
                "link": href,
                "date": date,
                "scraped_at": datetime.utcnow().isoformat(),
                "content": ""
            })

            if len(results) >= MAX_NEW_ITEMS:
                break

        # -------- PROGRESS CALCULATION --------
        percent = progress_start + int((page_number / max_pages) * (progress_end - progress_start))
        print(f"PROGRESS:{percent}", flush=True)

        page_number += 1

    return results


# =====================================
# EXTRACT CONTENT
# =====================================
def extract_content(page,item):

    try:

        page.goto(item["link"],timeout=90000,wait_until="networkidle")
        page.wait_for_timeout(2000)

        body = page.query_selector("body")

        text = body.inner_text()

        text = clean_text(text)

        lines = text.split("\n")

        meaningful = [l.strip() for l in lines if len(l.strip()) > 50]

        item["content"] = "\n".join(meaningful)[:5000]

    except Exception as e:

        item["content"] = f"Error {e}"

    return item


# =====================================
# MAIN SCRAPER
# =====================================
def run_scraper():

    existing_data = load_existing_data()

    existing_links = set(x["link"] for x in existing_data)

    new_notifications = []

    with sync_playwright() as p:

        browser = p.chromium.launch(headless=True)

        page = browser.new_page()

        print("\nSCRAPING EVENTS\n", flush=True)

        events = scrape_archive(
            page,
            "events",
            existing_links,
            progress_start=0,
            progress_end=50
        )

        for e in events:

            e = extract_content(page,e)

            new_notifications.append(e)

        print("\nSCRAPING NEWS\n", flush=True)

        news = scrape_archive(
            page,
            "news",
            existing_links,
            progress_start=50,
            progress_end=100
        )

        for n in news:

            n = extract_content(page,n)

            new_notifications.append(n)

        browser.close()

    if new_notifications:

        updated = existing_data + new_notifications

        with open(OUTPUT_FILE,"w",encoding="utf-8") as f:

            json.dump(updated,f,indent=4,ensure_ascii=False)

        print("\nNew items:",len(new_notifications), flush=True)
        print("Total:",len(updated), flush=True)

    else:

        print("No new notifications", flush=True)


if __name__ == "__main__":
    run_scraper()