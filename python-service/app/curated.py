"""India-specific facts that Yahoo Finance does not carry.

HOW THIS FILE WORKS
-------------------
Anything missing here is simply not shown in the report. The UI hides a
section when its data is absent, so an unfilled entry never shows a wrong
number — it just shows less.

Three kinds of fields live here:

1. `founded`, `ipoDate`, `ipoPrice`  — historical facts that never change.
   Pre-filled below for well known companies.

2. `segments`  — revenue split by business line. Comes from the company's
   annual report and changes once a year. Fill `asOf` with the financial
   year the split belongs to.

3. `shareholding` — promoter / FII / DII / public percentages. Companies file
   this with NSE and BSE every quarter, so it needs a quarterly refresh.
   Fill `asOf` with the quarter it belongs to.

VERIFY BEFORE TRUSTING: the values below should be checked against the
company's own filings (nseindia.com or the company's investor relations
page) before this project is shown to anyone as a source of fact.
"""

CURATED: dict[str, dict] = {
    "RELIANCE": {
        "founded": "1966",
        "ipoDate": "November 1977",
        "ipoPrice": "₹10 per share",
    },
    "TCS": {
        "founded": "1968",
        "ipoDate": "August 2004",
        "ipoPrice": "₹850 per share",
    },
    "INFY": {
        "founded": "1981",
        "ipoDate": "June 1993",
        "ipoPrice": "₹95 per share",
    },
    "HDFCBANK": {
        "founded": "1994",
        "ipoDate": "May 1995",
    },
    "ICICIBANK": {
        "founded": "1994",
        "ipoDate": "1997",
    },
    "SBIN": {
        "founded": "1955",
    },
    "BHARTIARTL": {
        "founded": "1995",
        "ipoDate": "February 2002",
        "ipoPrice": "₹45 per share",
    },
    "MARUTI": {
        "founded": "1981",
        "ipoDate": "July 2003",
        "ipoPrice": "₹125 per share",
    },
    "HCLTECH": {
        "founded": "1991",
        "ipoDate": "December 1999",
    },
    "ITC": {
        "founded": "1910",
    },
    "HINDUNILVR": {
        "founded": "1933",
    },
    "LT": {
        "founded": "1938",
    },
    "ONGC": {
        "founded": "1956",
    },
    "NTPC": {
        "founded": "1975",
        "ipoDate": "November 2004",
    },
    "COALINDIA": {
        "founded": "1975",
        "ipoDate": "November 2010",
    },
    "WIPRO": {
        "founded": "1945",
    },
    "SUNPHARMA": {
        "founded": "1983",
    },
    "TATAMOTORS": {
        "founded": "1945",
    },
    "TATASTEEL": {
        "founded": "1907",
    },
    "AXISBANK": {
        "founded": "1993",
    },
}


def curated_for(symbol: str) -> dict | None:
    entry = CURATED.get(symbol.upper())
    if not entry:
        return None
    # Drop empty values so the frontend can hide those cards.
    return {k: v for k, v in entry.items() if v}
