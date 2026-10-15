"""Batch price lookups for the paper trading wallet.

The report pages fetch one stock at a time, which is fine for a single report
but not for a wallet: holdings plus a watchlist can easily be a dozen symbols.
Everything here goes through one yfinance download per request instead, so the
cost does not grow with the number of positions.
"""

import math

import pandas as pd
import yfinance as yf

from . import cache
from .symbols import name_for

QUOTE_TTL = 60
CLOSES_TTL = 1800

# yfinance accepts plain period strings; these are the ones the app asks for.
PERIODS = {"1MO": "1mo", "6MO": "6mo", "1Y": "1y", "2Y": "2y"}


def _num(value):
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else f


def _closes(symbols: list[str], period: str) -> pd.DataFrame | None:
    """Daily closing prices for several symbols in one download."""
    tickers = [f"{s}.NS" for s in symbols]

    try:
        data = yf.download(
            tickers,
            period=period,
            interval="1d",
            auto_adjust=False,
            progress=False,
            threads=True,
        )
    except Exception as err:
        print(f"[market] download failed: {type(err).__name__}: {err}")
        return None

    if data is None or data.empty:
        return None

    # A single ticker comes back with flat columns on some yfinance versions
    # and a (field, ticker) MultiIndex on others, so handle both shapes.
    if isinstance(data.columns, pd.MultiIndex):
        frame = data.xs("Close", axis=1, level=0)
    else:
        frame = data[["Close"]]
        frame.columns = tickers

    frame.columns = [str(c).replace(".NS", "") for c in frame.columns]
    return frame


def fetch_quotes(symbols: list[str]) -> list[dict]:
    """Last traded price and the move since the previous close."""
    wanted = []
    for s in symbols:
        s = s.strip().upper()
        if s and s not in wanted:
            wanted.append(s)

    missing = [s for s in wanted if cache.get(f"pq:{s}") is None]

    if missing:
        frame = _closes(missing, "7d")
        if frame is not None:
            for symbol in missing:
                if symbol not in frame.columns:
                    continue

                series = [_num(v) for v in frame[symbol].tolist()]
                series = [v for v in series if v is not None]
                if not series:
                    continue

                price = round(series[-1], 2)
                prev = round(series[-2], 2) if len(series) > 1 else price
                change = round(price - prev, 2)

                cache.set(
                    f"pq:{symbol}",
                    {
                        "symbol": symbol,
                        "name": name_for(symbol),
                        "price": price,
                        "prevClose": prev,
                        "change": change,
                        "changePct": round((change / prev) * 100, 2) if prev else 0,
                    },
                    ttl_seconds=QUOTE_TTL,
                )

    return [q for q in (cache.get(f"pq:{s}") for s in wanted) if q]


def fetch_closes(symbols: list[str], period: str = "1Y") -> dict:
    """Aligned daily closes, used to rebuild the portfolio value day by day."""
    wanted = sorted({s.strip().upper() for s in symbols if s.strip()})
    if not wanted:
        return {"dates": [], "closes": {}}

    span = PERIODS.get(period.upper(), "1y")
    key = f"closes:{span}:{','.join(wanted)}"
    cached = cache.get(key)
    if cached:
        return cached

    frame = _closes(wanted, span)
    if frame is None:
        return {"dates": [], "closes": {}}

    # A stock that listed part way through the window, or a holiday on one
    # exchange only, leaves gaps; carrying the last close forward keeps every
    # symbol on the same date index.
    frame = frame.ffill()

    payload = {
        "dates": [d.strftime("%Y-%m-%d") for d in frame.index],
        "closes": {
            symbol: [
                round(v, 2) if (v := _num(x)) is not None else None
                for x in frame[symbol].tolist()
            ]
            for symbol in wanted
            if symbol in frame.columns
        },
    }

    cache.set(key, payload, ttl_seconds=CLOSES_TTL)
    return payload
