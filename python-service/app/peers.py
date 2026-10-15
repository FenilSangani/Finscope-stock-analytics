"""Peer groups by sector. Peer numbers themselves come live from Yahoo."""

PEER_GROUPS = {
    "it": ["TCS", "INFY", "HCLTECH", "WIPRO", "TECHM", "LTIM"],
    "banking": ["HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK", "INDUSINDBK"],
    "nbfc": ["BAJFINANCE", "BAJAJFINSV", "SHRIRAMFIN", "CHOLAFIN", "MUTHOOTFIN"],
    "oil_gas": ["RELIANCE", "ONGC", "BPCL", "IOC", "HINDPETRO", "GAIL"],
    "auto": ["MARUTI", "TATAMOTORS", "M&M", "BAJAJ-AUTO", "HEROMOTOCO", "EICHERMOT"],
    "pharma": ["SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "TORNTPHARM", "LUPIN"],
    "fmcg": ["HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR", "GODREJCP"],
    "metals": ["TATASTEEL", "JSWSTEEL", "HINDALCO", "VEDL", "SAIL", "JINDALSTEL"],
    "cement": ["ULTRACEMCO", "GRASIM", "SHREECEM", "AMBUJACEM", "ACC", "DALBHARAT"],
    "power": ["NTPC", "POWERGRID", "TATAPOWER", "ADANIPOWER", "JSWENERGY", "NHPC"],
    "telecom": ["BHARTIARTL", "IDEA", "INDUSTOWER", "TATACOMM"],
    "infra": ["LT", "ADANIPORTS", "GMRINFRA", "IRB", "NBCC"],
    "insurance": ["SBILIFE", "HDFCLIFE", "ICICIGI", "ICICIPRULI", "LICI"],
    "consumer_durables": ["TITAN", "HAVELLS", "VOLTAS", "WHIRLPOOL", "CROMPTON"],
    "chemicals": ["PIDILITIND", "SRF", "UPL", "AARTIIND", "DEEPAKNTR"],
}

# Maps a Yahoo sector/industry string to one of the groups above.
SECTOR_HINTS = [
    ("software", "it"),
    ("information technology", "it"),
    ("technology", "it"),
    ("banks", "banking"),
    ("bank", "banking"),
    ("credit", "nbfc"),
    ("capital markets", "nbfc"),
    ("financial", "nbfc"),
    ("oil", "oil_gas"),
    ("gas", "oil_gas"),
    ("energy", "oil_gas"),
    ("auto", "auto"),
    ("vehicle", "auto"),
    ("drug", "pharma"),
    ("pharma", "pharma"),
    ("healthcare", "pharma"),
    ("household", "fmcg"),
    ("packaged foods", "fmcg"),
    ("beverages", "fmcg"),
    ("tobacco", "fmcg"),
    ("consumer defensive", "fmcg"),
    ("steel", "metals"),
    ("aluminum", "metals"),
    ("copper", "metals"),
    ("metal", "metals"),
    ("basic materials", "metals"),
    ("cement", "cement"),
    ("building materials", "cement"),
    ("utilities", "power"),
    ("power", "power"),
    ("telecom", "telecom"),
    ("communication", "telecom"),
    ("engineering", "infra"),
    ("construction", "infra"),
    ("infrastructure", "infra"),
    ("insurance", "insurance"),
    ("furnishings", "consumer_durables"),
    ("appliances", "consumer_durables"),
    ("luxury", "consumer_durables"),
    ("chemical", "chemicals"),
]


def peers_for(symbol: str, sector: str | None, industry: str | None) -> list[str]:
    """Up to 4 peer symbols for this stock, excluding the stock itself."""
    symbol = symbol.upper()

    for group, members in PEER_GROUPS.items():
        if symbol in members:
            return [s for s in members if s != symbol][:4]

    haystack = f"{industry or ''} {sector or ''}".lower()
    for hint, group in SECTOR_HINTS:
        if hint in haystack:
            return [s for s in PEER_GROUPS[group] if s != symbol][:4]

    return []
