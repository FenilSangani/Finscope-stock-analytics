"""Fetch and reshape live market data from Yahoo Finance via yfinance."""

import math
import time
from datetime import datetime

import pandas as pd
import yfinance as yf

from . import cache

CRORE = 10_000_000

# Each display range is sliced out of one of two base history fetches, so a
# full report costs two Yahoo history calls instead of eight.
TIMEFRAMES = [
    {"label": "1 Day", "source": "intraday", "points": 75},
    {"label": "1 Week", "source": "intraday", "points": 390, "every": 3},
    {"label": "1 Month", "source": "daily", "points": 22},
    {"label": "3 Month", "source": "daily", "points": 66},
    {"label": "6 Month", "source": "daily", "points": 126},
    {"label": "1 Year", "source": "daily", "points": 252},
    {"label": "5 Year", "source": "daily", "points": 1260, "every": 5},
    {"label": "All", "source": "daily", "points": None, "every": 21},
]


def _num(value):
    """Return a plain float, or None for NaN / missing values."""
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else f


def _market_cap(info: dict, price: float | None, ticker=None) -> float | None:
    """Market capitalisation, from whichever source actually has the numbers.

    Yahoo drops `marketCap` from its summary for some stocks and not others,
    and which ones varies by where the request comes from — TCS came back
    without it from the deployed service while returning every other field.
    Share count times the live price is the same figure, and the count is
    available from a second endpoint even when the summary omits it, so this
    tries each source in turn rather than giving up and showing a dash.
    """
    direct = _num(info.get("marketCap"))
    if direct:
        return direct

    if not price:
        return None

    shares = _num(info.get("sharesOutstanding")) or _num(info.get("impliedSharesOutstanding"))
    if shares:
        return shares * price

    # fast_info comes from Yahoo's quote endpoint rather than the summary, so
    # it often still has the share count when the summary does not.
    if ticker is not None:
        try:
            shares = _num(ticker.fast_info["shares"])
        except Exception:
            shares = None
        if shares:
            return shares * price

    return None


def _row(frame: pd.DataFrame, *names):
    """First matching row of a yfinance statement, as a list of floats."""
    if frame is None or frame.empty:
        return None
    for name in names:
        if name in frame.index:
            return [_num(v) for v in frame.loc[name].tolist()]
    return None


def fx_to_inr(currency: str) -> float:
    """Live rate to convert a foreign-currency statement into rupees.

    Some Indian companies (Infosys, for one) file their statements in USD even
    though the share trades in rupees, so the raw numbers are ~90x too small.
    """
    if not currency or currency.upper() == "INR":
        return 1.0

    key = f"fx:{currency}"
    cached = cache.get(key)
    if cached:
        return cached

    try:
        info = yf.Ticker(f"{currency.upper()}INR=X").info or {}
        rate = _num(info.get("regularMarketPrice")) or _num(info.get("previousClose"))
    except Exception:
        rate = None

    rate = rate or 1.0
    cache.set(key, rate, ttl_seconds=3600)
    return rate


def _ema(values: list[float], period: int = 200) -> list[float]:
    k = 2 / (period + 1)
    out = []
    prev = values[0]
    for v in values:
        prev = v * k + prev * (1 - k)
        out.append(round(prev, 2))
    return out


def _series_from(closes: list[float], labels: list[str], spec: dict):
    """Slice a display window out of the full history, with EMA over all of it.

    The EMA is computed on the complete history first so the 200 EMA has
    proper lead-in, then the window is cut, then the window is thinned.
    """
    ema_full = _ema(closes, 200)

    points = spec.get("points")
    start = max(0, len(closes) - points) if points else 0

    window_prices = closes[start:]
    window_ema = ema_full[start:]
    window_labels = labels[start:]

    every = spec.get("every", 1)
    if every > 1:
        # Thin from the end so the latest bar is always kept.
        def thin(values):
            return values[::-1][::every][::-1]

        window_prices = thin(window_prices)
        window_ema = thin(window_ema)
        window_labels = thin(window_labels)

    if len(window_prices) < 2:
        return None

    prices = [round(c, 2) for c in window_prices]
    change_pct = round(((prices[-1] - prices[0]) / prices[0]) * 100, 2)
    return {
        "prices": prices,
        "ema200": window_ema,
        "labels": window_labels,
        "changePct": change_pct,
    }


def _build_timeframes(ticker: yf.Ticker):
    frames = {}

    try:
        intraday = ticker.history(period="1mo", interval="5m")
    except Exception:
        intraday = pd.DataFrame()

    try:
        daily = ticker.history(period="max", interval="1d")
    except Exception:
        daily = pd.DataFrame()

    sources = {}
    if not intraday.empty:
        sources["intraday"] = (
            [_num(c) for c in intraday["Close"].tolist()],
            [t.strftime("%d %b %Y, %H:%M") for t in intraday.index],
        )
    if not daily.empty:
        sources["daily"] = (
            [_num(c) for c in daily["Close"].tolist()],
            [t.strftime("%d %b %Y") for t in daily.index],
        )

    for spec in TIMEFRAMES:
        source = sources.get(spec["source"])
        if not source:
            continue
        closes, labels = source
        clean = [(c, l) for c, l in zip(closes, labels) if c is not None]
        if len(clean) < 2:
            continue
        series = _series_from([c for c, _ in clean], [l for _, l in clean], spec)
        if series:
            frames[spec["label"]] = series

    return frames


def _statement_series(frame: pd.DataFrame, revenue_row, profit_row, limit, quarterly, eps_row=None, fx=1.0):
    """Turn a yfinance statement into year/quarter rows, oldest first."""
    if frame is None or frame.empty or not revenue_row:
        return []

    rows = []
    for i, col in enumerate(frame.columns):
        revenue = revenue_row[i] if i < len(revenue_row) else None
        profit = profit_row[i] if profit_row and i < len(profit_row) else None
        eps = eps_row[i] if eps_row and i < len(eps_row) else None
        if revenue is None:
            continue

        date = col.date() if hasattr(col, "date") else col
        if quarterly:
            # Indian fiscal year runs Apr-Mar, so Jun 2025 is Q1 of FY26.
            fiscal_q = ((date.month - 4) // 3) % 4 + 1
            fiscal_year = date.year if date.month <= 3 else date.year + 1
            short_label = f"Q{fiscal_q}'{str(fiscal_year)[-2:]}"
            label = f"{date.strftime('%b %Y')} ({short_label})"
        else:
            short_label = None
            # Indian fiscal years end in March, so FY is the calendar year of
            # the closing date when the month is Jan-Mar.
            fy = date.year if date.month <= 3 else date.year + 1
            label = f"FY{str(fy)[-2:]}"

        rows.append(
            {
                "period": label,
                "shortPeriod": short_label or label,
                "revenue": round(revenue * fx / CRORE),
                "profit": round(profit * fx / CRORE) if profit is not None else None,
                "eps": round(eps * fx, 2) if eps is not None else None,
            }
        )

    rows.reverse()
    return rows[-limit:]


def _analyst(ticker: yf.Ticker, price, info):
    counts = {"buy": 0, "hold": 0, "sell": 0}
    try:
        recs = ticker.recommendations
        if recs is not None and not recs.empty:
            latest = recs.iloc[0]
            counts["buy"] = int(latest.get("strongBuy", 0)) + int(latest.get("buy", 0))
            counts["hold"] = int(latest.get("hold", 0))
            counts["sell"] = int(latest.get("sell", 0)) + int(latest.get("strongSell", 0))
    except Exception:
        pass

    total = counts["buy"] + counts["hold"] + counts["sell"]
    if total == 0:
        return None

    if counts["buy"] / total >= 0.5:
        consensus = "BUY"
    elif counts["sell"] / total >= 0.4:
        consensus = "SELL"
    else:
        consensus = "HOLD"

    target = _num(info.get("targetMeanPrice"))
    upside = None
    if target and price:
        upside = round(((target - price) / price) * 100, 1)

    return {
        **counts,
        "total": total,
        "consensus": consensus,
        "targetPrice": round(target, 2) if target else None,
        "upside": upside,
    }


def fetch_stock(symbol: str) -> dict | None:
    """Full live payload for one NSE symbol. Returns None if Yahoo has no data."""
    symbol = symbol.upper().strip()
    cached = cache.get(f"stock:{symbol}")
    if cached:
        return cached

    ticker = yf.Ticker(f"{symbol}.NS")

    try:
        info = ticker.info or {}
    except Exception:
        return None

    price = _num(info.get("currentPrice")) or _num(info.get("regularMarketPrice"))
    if not price or not info.get("longName"):
        return None

    prev_close = _num(info.get("previousClose")) or price
    change = round(price - prev_close, 2)
    change_pct = round((change / prev_close) * 100, 2) if prev_close else 0

    income = ticker.income_stmt
    q_income = ticker.quarterly_income_stmt
    balance = ticker.balance_sheet
    cashflow = ticker.cashflow

    financial_currency = info.get("financialCurrency") or "INR"
    fx = fx_to_inr(financial_currency)

    yearly = _statement_series(
        income,
        _row(income, "Total Revenue", "Operating Revenue"),
        _row(income, "Net Income", "Net Income Common Stockholders"),
        limit=5,
        quarterly=False,
        eps_row=_row(income, "Diluted EPS", "Basic EPS"),
        fx=fx,
    )
    quarterly = _statement_series(
        q_income,
        _row(q_income, "Total Revenue", "Operating Revenue"),
        _row(q_income, "Net Income", "Net Income Common Stockholders"),
        limit=4,
        quarterly=True,
        fx=fx,
    )

    def latest(frame, *names):
        values = _row(frame, *names)
        return values[0] if values else None

    total_assets = latest(balance, "Total Assets")
    total_liabilities = latest(balance, "Total Liabilities Net Minority Interest")
    equity = latest(balance, "Stockholders Equity", "Common Stock Equity")
    cash = latest(balance, "Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments")
    debt = latest(balance, "Total Debt")
    fcf = latest(cashflow, "Free Cash Flow")

    # yfinance reports debtToEquity as a percentage (46.3 means 0.46x).
    raw_de = _num(info.get("debtToEquity"))
    debt_to_equity = round(raw_de / 100, 2) if raw_de is not None else None

    roe = _num(info.get("returnOnEquity"))
    if roe is not None:
        roe = round(roe * 100, 2)
    elif equity and yearly and yearly[-1]["profit"]:
        roe = round((yearly[-1]["profit"] * CRORE / equity) * 100, 2)

    # ROCE = EBIT / capital employed, where capital employed is total assets
    # minus what the company owes within the year.
    ebit_row = _row(income, "EBIT", "Operating Income")
    ebit = ebit_row[0] if ebit_row else None
    current_liabilities = latest(balance, "Current Liabilities")
    roce = None
    if ebit and total_assets and current_liabilities:
        capital_employed = total_assets - current_liabilities
        if capital_employed > 0:
            roce = round((ebit / capital_employed) * 100, 2)

    operating_margin = _num(info.get("operatingMargins"))
    if operating_margin is not None:
        operating_margin = round(operating_margin * 100, 2)
    elif ebit and yearly and yearly[-1]["revenue"]:
        operating_margin = round((ebit / (yearly[-1]["revenue"] * CRORE)) * 100, 2)

    def crore(value, convert=True):
        if value is None:
            return None
        return round(value * (fx if convert else 1) / CRORE)

    market_cap = _market_cap(info, price, ticker)

    payload = {
        "symbol": symbol,
        "name": info.get("longName"),
        "exchange": "NSE",
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "price": round(price, 2),
        "change": change,
        "changePct": change_pct,
        # Market cap follows the share price currency, not the statements.
        "marketCap": crore(market_cap, convert=False),
        "financialCurrency": financial_currency,
        "high52": _num(info.get("fiftyTwoWeekHigh")),
        "low52": _num(info.get("fiftyTwoWeekLow")),
        "overview": {
            "description": info.get("longBusinessSummary"),
            "headquarters": ", ".join(
                p for p in [info.get("city"), info.get("country")] if p
            )
            or None,
            "employees": _num(info.get("fullTimeEmployees")),
            "website": info.get("website"),
        },
        "ratios": {
            "peRatio": _num(info.get("trailingPE")),
            "roe": roe,
            "roa": round(_num(info.get("returnOnAssets")) * 100, 2)
            if _num(info.get("returnOnAssets")) is not None
            else None,
            "debtToEquity": debt_to_equity,
            "eps": _num(info.get("trailingEps")),
            "bookValue": _num(info.get("bookValue")),
            "dividendYield": _num(info.get("dividendYield")),
            "priceToBook": _num(info.get("priceToBook")),
            "profitMargin": round(_num(info.get("profitMargins")) * 100, 2)
            if _num(info.get("profitMargins")) is not None
            else None,
            "roce": roce,
            "operatingMargin": operating_margin,
        },
        "financials": yearly,
        "quarterly": quarterly,
        "balanceSheet": {
            "totalAssets": crore(total_assets),
            "totalLiabilities": crore(total_liabilities),
            "totalEquity": crore(equity),
            "cash": crore(cash),
            "totalDebt": crore(debt),
            "freeCashFlow": crore(fcf),
        },
        "analystRating": _analyst(ticker, price, info),
        "timeframes": _build_timeframes(ticker),
        "fetchedAt": datetime.now().isoformat(timespec="seconds"),
    }

    cache.set(f"stock:{symbol}", payload, ttl_seconds=600)
    return payload


HISTORY_PERIODS = {"1Y": 252, "3Y": 756, "5Y": 1260}


def fetch_history(symbol: str, period: str = "3Y") -> dict | None:
    """Daily closing prices for backtesting, oldest first."""
    symbol = symbol.upper().strip()
    period = period.upper()
    bars = HISTORY_PERIODS.get(period, 756)

    key = f"history:{symbol}"
    frame = cache.get(key)

    if frame is None:
        try:
            frame = yf.Ticker(f"{symbol}.NS").history(period="max", interval="1d")
        except Exception:
            return None
        if frame is None or frame.empty:
            return None
        cache.set(key, frame, ttl_seconds=3600)

    window = frame.tail(bars)
    closes = [_num(c) for c in window["Close"].tolist()]
    dates = [t.strftime("%d %b %y") for t in window.index]

    clean = [(c, d) for c, d in zip(closes, dates) if c is not None]
    if len(clean) < 30:
        return None

    return {
        "symbol": symbol,
        "period": period,
        "prices": [round(c, 2) for c, _ in clean],
        "dates": [d for _, d in clean],
        "tradingDays": len(clean),
    }


def fetch_quote(symbol: str) -> dict | None:
    """Light payload used for peer rows."""
    symbol = symbol.upper().strip()
    cached = cache.get(f"quote:{symbol}")
    if cached:
        return cached

    # Yahoo rate limits a long running process from time to time, and the
    # next call usually succeeds, so give it one more go before giving up.
    ticker = yf.Ticker(f"{symbol}.NS")
    info = {}
    for attempt in (1, 2):
        try:
            info = ticker.info or {}
            if info:
                break
        except Exception as err:
            print(f"[quote] {symbol} attempt {attempt} failed: {type(err).__name__}: {err}")
            if attempt == 1:
                time.sleep(1)

    price = _num(info.get("currentPrice")) or _num(info.get("regularMarketPrice"))
    if not price:
        print(f"[quote] {symbol} returned no price")
        return None

    roe = _num(info.get("returnOnEquity"))
    prev_close = _num(info.get("previousClose")) or price
    change = round(price - prev_close, 2)

    quote = {
        "symbol": symbol,
        "name": info.get("shortName") or info.get("longName") or symbol,
        "price": round(price, 2),
        "change": change,
        "changePct": round((change / prev_close) * 100, 2) if prev_close else 0,
        "peRatio": _num(info.get("trailingPE")),
        "roe": round(roe * 100, 2) if roe is not None else None,
        "marketCap": round(cap / CRORE) if (cap := _market_cap(info, price, ticker)) else None,
    }
    cache.set(f"quote:{symbol}", quote, ttl_seconds=900)
    return quote
