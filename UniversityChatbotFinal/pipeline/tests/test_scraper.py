from pipeline.notification_pipeline.scraper import scrape_notifications


def run_test():
    print("🔎 Scraping dynamic content from UET Mardan...\n")

    data = scrape_notifications()

    if not data:
        print("❌ No notifications found.")
        return

    print(f"✅ Found {len(data)} items\n")

    for i, item in enumerate(data[:10], start=1):
        print(f"{i}. {item['title']}")
        print(f"   Link: {item['link']}")
        print("-" * 50)


if __name__ == "__main__":
    run_test()