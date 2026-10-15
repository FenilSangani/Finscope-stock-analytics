"""Plain-English analysis generated from the live numbers.

Every sentence here is derived from a real fetched value, so nothing is
invented — if a number is missing, the matching point is simply skipped.
"""


def _growth(rows, key):
    """Percent change between the last two periods of a statement series."""
    usable = [r for r in rows if r.get(key) is not None]
    if len(usable) < 2:
        return None
    prev, last = usable[-2][key], usable[-1][key]
    if not prev:
        return None
    return round(((last - prev) / abs(prev)) * 100, 1)


def build_analysis(stock: dict, curated: dict | None) -> dict:
    ratios = stock.get("ratios") or {}
    balance = stock.get("balanceSheet") or {}
    rating = stock.get("analystRating")
    financials = stock.get("financials") or []
    quarterly = stock.get("quarterly") or []

    pe = ratios.get("peRatio")
    roe = ratios.get("roe")
    de = ratios.get("debtToEquity")
    div = ratios.get("dividendYield")
    margin = ratios.get("profitMargin")
    pb = ratios.get("priceToBook")
    fcf = balance.get("freeCashFlow")
    debt = balance.get("totalDebt")
    cash = balance.get("cash")

    revenue_growth = _growth(financials, "revenue")
    profit_growth = _growth(financials, "profit")

    pros, cons, watch = [], [], []

    # --- Balance sheet strength -------------------------------------------
    if de is not None:
        if de < 0.1:
            pros.append(f"Almost debt free, with a debt to equity ratio of just {de}.")
        elif de < 0.5:
            pros.append(f"Debt is under control, with a debt to equity ratio of {de}.")
        elif de < 1:
            watch.append(
                f"Debt to equity of {de} is still manageable, but worth tracking each quarter."
            )
        else:
            cons.append(
                f"Debt to equity of {de} is high, which means the company relies heavily on borrowed money."
            )

    if cash is not None and debt is not None and debt > 0:
        if cash > debt:
            pros.append(
                f"Holds more cash (₹{cash:,} Cr) than total debt (₹{debt:,} Cr), which is a strong position."
            )

    if fcf is not None:
        if fcf > 0:
            pros.append(
                f"Generates positive free cash flow of ₹{fcf:,} Cr, so the business funds itself."
            )
        else:
            cons.append(
                f"Free cash flow is negative at ₹{fcf:,} Cr, meaning it spends more cash than it brings in."
            )

    # --- Returns and profitability ----------------------------------------
    if roe is not None:
        if roe >= 20:
            pros.append(f"Return on equity of {roe}% shows the company earns well on shareholder money.")
        elif roe >= 12:
            pros.append(f"Return on equity of {roe}% is reasonable for its size.")
        else:
            cons.append(f"Return on equity of {roe}% is on the lower side.")

    if margin is not None:
        if margin >= 20:
            pros.append(f"Net profit margin of {margin}% is healthy.")
        elif margin < 5:
            cons.append(f"Net profit margin of {margin}% is thin, so costs matter a lot.")

    # --- Growth ------------------------------------------------------------
    if revenue_growth is not None:
        if revenue_growth >= 10:
            pros.append(f"Revenue grew {revenue_growth}% in the latest financial year.")
        elif revenue_growth < 0:
            cons.append(f"Revenue fell {abs(revenue_growth)}% in the latest financial year.")
        else:
            watch.append(f"Revenue growth was slow at {revenue_growth}% last year.")

    if profit_growth is not None:
        if profit_growth >= 10:
            pros.append(f"Net profit grew {profit_growth}% in the latest financial year.")
        elif profit_growth < 0:
            cons.append(f"Net profit fell {abs(profit_growth)}% in the latest financial year.")

    # --- Valuation ---------------------------------------------------------
    if pe is not None:
        if pe < 15:
            pros.append(f"Trades at {round(pe, 1)}x earnings, which is on the cheaper side.")
        elif pe > 45:
            cons.append(
                f"Trades at {round(pe, 1)}x earnings, which is expensive and leaves little room for disappointment."
            )
        else:
            watch.append(f"Valuation sits at {round(pe, 1)}x earnings — fair, not cheap.")

    if pb is not None and pb > 8:
        cons.append(f"Price to book of {round(pb, 1)}x means you pay a big premium over book value.")

    # --- Dividend ----------------------------------------------------------
    if div is not None:
        if div >= 2:
            pros.append(f"Pays a regular dividend, currently yielding about {round(div, 2)}%.")
        elif div < 0.5:
            cons.append(
                f"Dividend yield of {round(div, 2)}% is low, so this suits growth investors more than income investors."
            )

    # --- Curated extras ----------------------------------------------------
    if curated:
        holding = curated.get("shareholding") or {}
        promoter = holding.get("promoters")
        if promoter is not None:
            if promoter >= 50:
                pros.append(f"Promoter holding of {promoter}% shows the founders stay invested.")
            elif promoter < 26:
                cons.append(
                    f"Promoter holding is only {promoter}%, so no single owner has a strong controlling stake."
                )

        segments = curated.get("segments") or []
        if segments:
            top = max(segments, key=lambda s: s.get("share", 0))
            watch.append(
                f"{top['share']}% of revenue comes from {top['name']}, so that segment drives the whole result."
            )

    # --- Analyst view ------------------------------------------------------
    if rating and rating.get("upside") is not None:
        upside = rating["upside"]
        if upside > 0:
            watch.append(
                f"{rating['total']} analysts have an average target of ₹{rating['targetPrice']:,}, "
                f"about {upside}% above the current price."
            )
        else:
            watch.append(
                f"{rating['total']} analysts have an average target of ₹{rating['targetPrice']:,}, "
                f"which is {abs(upside)}% below the current price."
            )

    # --- Recent quarter ----------------------------------------------------
    q_profit_growth = _growth(quarterly, "profit")
    if q_profit_growth is not None:
        if q_profit_growth < 0:
            watch.append(
                f"Profit dipped {abs(q_profit_growth)}% in the most recent quarter versus the one before."
            )
        else:
            watch.append(
                f"Profit rose {q_profit_growth}% in the most recent quarter versus the one before."
            )

    key_points = (
        [{"type": "good", "text": t} for t in pros[:2]]
        + [{"type": "watch", "text": t} for t in watch[:2]]
        + [{"type": "bad", "text": t} for t in cons[:1]]
    )

    return {
        "pros": pros[:5],
        "cons": cons[:5],
        "keyPoints": key_points,
    }
