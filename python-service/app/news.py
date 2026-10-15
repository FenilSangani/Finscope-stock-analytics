"""Latest news headlines from the Google News RSS feed (free, no API key)."""

import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from . import cache

FEED = "https://news.google.com/rss/search?q={query}&hl=en-IN&gl=IN&ceid=IN:en"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FinScope/1.0)"}


def _relative(published: datetime) -> str:
    delta = datetime.now(timezone.utc) - published
    hours = delta.total_seconds() / 3600
    if hours < 1:
        return f"{max(1, int(delta.total_seconds() // 60))} min ago"
    if hours < 24:
        return f"{int(hours)} hour{'s' if int(hours) != 1 else ''} ago"
    days = int(hours // 24)
    if days < 30:
        return f"{days} day{'s' if days != 1 else ''} ago"
    return published.strftime("%d %b %Y")


def fetch_news(company: str, symbol: str, limit: int = 6) -> list[dict]:
    key = f"news:{symbol}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    # Trim the legal suffix so the search matches how media name the company.
    name = company
    for suffix in (" Limited", " Ltd.", " Ltd", " Corporation", " Corp."):
        name = name.replace(suffix, "")

    # "when:14d" keeps the feed to the last two weeks so headlines stay current.
    query = urllib.parse.quote(f"{name.strip()} stock news when:14d")
    request = urllib.request.Request(FEED.format(query=query), headers=HEADERS)

    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            root = ET.fromstring(response.read())
    except Exception:
        return []

    items = []
    for item in root.findall(".//item")[: limit * 2]:
        title = (item.findtext("title") or "").strip()
        if not title:
            continue

        source_el = item.find("source")
        source = source_el.text if source_el is not None else None

        # Yahoo's own quote pages surface here as "news" but carry no story.
        if source and "yahoo finance" in source.lower():
            continue

        # Google appends " - Publisher" to every headline; the publisher is
        # shown separately, so drop it from the title.
        if source and title.endswith(f" - {source}"):
            title = title[: -(len(source) + 3)].strip()

        published_raw = item.findtext("pubDate")
        published, ago = None, None
        if published_raw:
            try:
                parsed = parsedate_to_datetime(published_raw)
                published = parsed.isoformat()
                ago = _relative(parsed)
            except Exception:
                pass

        items.append(
            {
                "title": title,
                "source": source,
                "link": item.findtext("link"),
                "published": published,
                "ago": ago,
            }
        )
        if len(items) >= limit:
            break

    cache.set(key, items, ttl_seconds=900)
    return items
