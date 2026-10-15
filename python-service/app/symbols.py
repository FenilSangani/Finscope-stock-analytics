"""The full list of NSE listed equities, straight from NSE's own CSV."""

import csv
import io
import urllib.request

from . import cache

EQUITY_LIST = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
CACHE_KEY = "nse:equities"

# Kept as a last resort so search still works if NSE is unreachable.
FALLBACK = [
    {"symbol": "RELIANCE", "name": "Reliance Industries Limited"},
    {"symbol": "TCS", "name": "Tata Consultancy Services Limited"},
    {"symbol": "INFY", "name": "Infosys Limited"},
    {"symbol": "HDFCBANK", "name": "HDFC Bank Limited"},
    {"symbol": "ICICIBANK", "name": "ICICI Bank Limited"},
    {"symbol": "SBIN", "name": "State Bank of India"},
    {"symbol": "BHARTIARTL", "name": "Bharti Airtel Limited"},
    {"symbol": "ITC", "name": "ITC Limited"},
    {"symbol": "LT", "name": "Larsen & Toubro Limited"},
    {"symbol": "WIPRO", "name": "Wipro Limited"},
]


def all_symbols() -> list[dict]:
    cached = cache.get(CACHE_KEY)
    if cached:
        return cached

    try:
        request = urllib.request.Request(EQUITY_LIST, headers=HEADERS)
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8", "ignore")

        rows = []
        for row in csv.DictReader(io.StringIO(raw)):
            symbol = (row.get("SYMBOL") or "").strip()
            name = (row.get("NAME OF COMPANY") or "").strip()
            # EQ is the normal rolling settlement series; the rest are
            # illiquid or special categories we do not want to surface.
            series = (row.get(" SERIES") or row.get("SERIES") or "").strip()
            if symbol and name and series in ("EQ", "BE"):
                rows.append({"symbol": symbol, "name": name})

        if rows:
            cache.set(CACHE_KEY, rows, ttl_seconds=86400)
            return rows
    except Exception:
        pass

    cache.set(CACHE_KEY, FALLBACK, ttl_seconds=600)
    return FALLBACK


def name_for(symbol: str) -> str:
    """Company name for an exact ticker, falling back to the ticker itself."""
    wanted = symbol.strip().upper()
    for row in all_symbols():
        if row["symbol"] == wanted:
            return row["name"]
    return wanted


def search(query: str, limit: int = 10) -> list[dict]:
    rows = all_symbols()
    q = query.strip().lower()
    if not q:
        return rows[:limit]

    starts_symbol, starts_name, contains = [], [], []
    for row in rows:
        symbol = row["symbol"].lower()
        name = row["name"].lower()
        if symbol.startswith(q):
            starts_symbol.append(row)
        elif name.startswith(q):
            starts_name.append(row)
        elif q in symbol or q in name:
            contains.append(row)

    # Exact ticker prefix first, then company name, then anything containing it.
    return (starts_symbol + starts_name + contains)[:limit]
