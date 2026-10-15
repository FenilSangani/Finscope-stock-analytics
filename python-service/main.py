import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app import market, yahoo
from app.analysis import build_analysis
from app.curated import curated_for
from app.news import fetch_news
from app.peers import peers_for
from app.symbols import search as search_symbols

app = FastAPI(title="FinScope Market Data Service")

allowed = os.getenv("ALLOWED_ORIGINS", "http://localhost:5000,http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed.split(",")],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/history/{symbol}")
def history(symbol: str, period: str = "3Y"):
    """Daily closing prices, used by the strategy backtester."""
    data = yahoo.fetch_history(symbol, period)
    if not data:
        raise HTTPException(status_code=404, detail=f"No price history for '{symbol}'")

    match = next(
        (s for s in search_symbols(symbol, 5) if s["symbol"] == symbol.upper()),
        None,
    )
    data["name"] = match["name"] if match else symbol.upper()
    return data


@app.get("/quotes")
def quotes(symbols: str):
    """Light price quotes, used by the landing page market strip."""
    wanted = [s.strip().upper() for s in symbols.split(",") if s.strip()][:8]
    results = [q for q in (yahoo.fetch_quote(s) for s in wanted) if q]
    return {"quotes": results}


@app.get("/market/quotes")
def market_quotes(symbols: str):
    """Batch prices for the paper trading wallet, one download for the lot."""
    wanted = [s.strip().upper() for s in symbols.split(",") if s.strip()][:25]
    if not wanted:
        raise HTTPException(status_code=400, detail="Pass at least one symbol")
    return {"quotes": market.fetch_quotes(wanted)}


@app.get("/market/closes")
def market_closes(symbols: str, period: str = "1Y"):
    """Aligned daily closes, used to rebuild past portfolio value."""
    wanted = [s.strip().upper() for s in symbols.split(",") if s.strip()][:25]
    if not wanted:
        raise HTTPException(status_code=400, detail="Pass at least one symbol")
    return market.fetch_closes(wanted, period)


@app.get("/symbols")
def symbols(q: str = "", limit: int = 10):
    """Type-ahead over every NSE listed equity."""
    return {"results": search_symbols(q, min(limit, 25))}


COMPARE_RANGES = ["1 Month", "3 Month", "6 Month", "1 Year", "5 Year"]


@app.get("/compare")
def compare(symbols: str):
    """Trimmed payloads for 2-4 symbols, for the side by side comparison."""
    wanted = [s.strip().upper() for s in symbols.split(",") if s.strip()][:4]
    if len(wanted) < 2:
        raise HTTPException(status_code=400, detail="Pass at least two symbols")

    results, missing = [], []
    for symbol in wanted:
        data = yahoo.fetch_stock(symbol)
        if not data:
            missing.append(symbol)
            continue

        curated = curated_for(symbol) or {}
        results.append(
            {
                "symbol": data["symbol"],
                "name": data["name"],
                "sector": data.get("sector"),
                "industry": data.get("industry"),
                "price": data["price"],
                "change": data["change"],
                "changePct": data["changePct"],
                "marketCap": data.get("marketCap"),
                "high52": data.get("high52"),
                "low52": data.get("low52"),
                "employees": (data.get("overview") or {}).get("employees"),
                "founded": curated.get("founded"),
                "financialCurrency": data.get("financialCurrency"),
                "ratios": data["ratios"],
                "financials": data.get("financials") or [],
                "balanceSheet": data.get("balanceSheet") or {},
                "analystRating": data.get("analystRating"),
                "timeframes": {
                    label: {
                        "prices": frame["prices"],
                        "changePct": frame["changePct"],
                    }
                    for label, frame in (data.get("timeframes") or {}).items()
                    if label in COMPARE_RANGES
                },
            }
        )

    if not results:
        raise HTTPException(status_code=404, detail=f"No NSE data found for {', '.join(wanted)}")

    return {"stocks": results, "missing": missing}


@app.get("/stock/{symbol}")
def stock(symbol: str):
    data = yahoo.fetch_stock(symbol)
    if not data:
        raise HTTPException(status_code=404, detail=f"No NSE data found for '{symbol}'")

    curated = curated_for(symbol)
    if curated:
        data["curated"] = curated
        overview = data.setdefault("overview", {})
        for field in ("founded", "ipoDate", "ipoPrice", "presence"):
            if curated.get(field):
                overview[field] = curated[field]
        if curated.get("segments"):
            data["segments"] = curated["segments"]
        if curated.get("shareholding"):
            data["shareholding"] = curated["shareholding"]

    data.update(build_analysis(data, curated))

    data["news"] = fetch_news(data["name"], symbol)

    peer_symbols = peers_for(symbol, data.get("sector"), data.get("industry"))
    peers = [p for p in (yahoo.fetch_quote(s) for s in peer_symbols) if p]
    if peers:
        data["peers"] = [
            {
                "symbol": data["symbol"],
                "name": data["name"],
                "price": data["price"],
                "peRatio": data["ratios"].get("peRatio"),
                "roe": data["ratios"].get("roe"),
                "marketCap": data.get("marketCap"),
                "self": True,
            },
            *peers,
        ]

    return data
