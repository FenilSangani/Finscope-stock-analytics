# FinScope

An Indian stock market analytics and paper trading platform. Search any NSE listed
company, read a plain-English report on it, compare companies side by side, backtest
trading strategies on real price history, and practise trading with a virtual
₹10,00,000 wallet.

Every number on screen comes from live market data or from the user's own saved
trades. Nothing is mocked, and where a figure cannot be sourced the interface says so
rather than estimating it.

## Live demo

| | |
|---|---|
| App | _add your Vercel URL here_ |
| API | _add your Vercel URL here_ |

## What it does

**Stock Analyser** — a full company report for any NSE equity: price with a 200 EMA
overlay, five years of revenue and profit, quarterly results, balance sheet, key
ratios, analyst ratings, recent news, and plain-English pros and cons generated only
from figures that were actually fetched.

**Stock Comparison** — two to four companies side by side, rebased price performance
so they can be compared fairly, plus head-to-head growth, margin and return metrics.

**Strategy Backtester** — three strategies (buy the dip, moving average crossover, RSI
oversold) run over one, three or five years of real closing prices, with total and
annualised return, maximum drawdown, win rate, a trade-by-trade log, and a buy-and-hold
benchmark to beat.

**Paper Trading** — a virtual wallet that starts at ₹10,00,000. Orders fill at the live
market price, and holdings, average cost, realised and unrealised profit and the order
book are all stored per user. The portfolio value chart is rebuilt from the order log
against real closing prices, so it always agrees with the trades that were placed.

**Watchlist** — up to five lists of thirty stocks each, with live prices, daily moves
and one-month trend lines.

**Dashboard** — the wallet, the holdings and the first watchlist in one view.

## Architecture

```
React (Vite)  ──►  Express API  ──►  FastAPI market service  ──►  Yahoo Finance
                        │                      │
                        └──►  MongoDB  ◄───────┘
                              users, wallets, watchlists, cached market data
```

Three deployable pieces:

| Folder | Stack | Role |
|---|---|---|
| `frontend/` | React 19, Vite, Tailwind CSS v4, Chart.js | The interface |
| `backend/` | Node, Express 5, Mongoose, JWT | Auth, wallets, watchlists, API gateway |
| `python-service/` | FastAPI, yfinance, pandas | Market data, shaped for the UI |

### Decisions worth explaining

**Only trade facts are stored.** A wallet row holds the symbol, quantity and average
cost — never a price or a profit figure. Everything else is derived from a live quote
when the page loads, so the database cannot drift out of step with the market.

**Orders are priced on the server.** The browser never sends a price. The API fetches
the live quote itself before filling an order, so a tampered request cannot buy at a
price of its choosing.

**Portfolio history is reconstructed, not snapshotted.** The wallet as it stands today
is wound back through the order log to recover the balance at the start of the window,
then replayed forward against real daily closes. The line is therefore always
consistent with the orders that were actually placed.

**Market data is cached in MongoDB.** Serverless functions do not share memory, so an
in-process cache is wasted there — each invocation could land on a cold instance and
re-fetch the same prices. Caching upstream responses in Mongo with a TTL index means
one fetch serves every instance. A company report drops from about nine seconds to
under one on a repeat view.

**Missing data is shown as missing.** If a quote fails to load, a holding is valued at
cost and labelled as such; a stock with no figures simply hides that section. No
placeholder numbers are ever displayed.

## Running it locally

You need Node 18+, Python 3.11+, and a free MongoDB Atlas cluster.

```bash
git clone https://github.com/<your-username>/finscope-stock-analytics.git
cd finscope-stock-analytics
```

**1. Market data service**

```bash
cd python-service
python -m venv venv
venv\Scripts\activate          # macOS or Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**2. API**

```bash
cd backend
npm install
cp .env.example .env           # then fill in MONGO_URI and JWT_SECRET
npm run dev
```

**3. Front end**

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173.

## Environment variables

Each folder has a `.env.example` listing what it needs. The real `.env` files are
gitignored and never committed.

| Where | Variable | What it is |
|---|---|---|
| `backend` | `MONGO_URI` | MongoDB Atlas connection string, with a database name on the end |
| `backend` | `JWT_SECRET` | Any long random string used to sign login tokens |
| `backend` | `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `backend` | `CLIENT_URL` | Sites allowed to call the API, comma separated |
| `backend` | `MARKET_SERVICE_URL` | Where the FastAPI service is running |
| `frontend` | `VITE_API_URL` | Where the Express API is running |
| `python-service` | `ALLOWED_ORIGINS` | Browser origins allowed to call it directly |

## API

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Sign in, returns a JWT |
| `GET` | `/api/auth/me` | The signed-in account |
| `DELETE` | `/api/auth/account` | Delete the account and everything belonging to it |
| `GET` | `/api/stocks/:symbol` | Full company report |
| `GET` | `/api/stocks/compare/batch` | Trimmed reports for two to four symbols |
| `GET` | `/api/stocks/history/:symbol` | Daily closes for backtesting |
| `GET` | `/api/stocks/symbols/search` | Type-ahead over every NSE equity |
| `GET` | `/api/market/quotes` | Batch live prices |
| `GET` | `/api/market/closes` | Batch daily closes |
| `GET` | `/api/paper/account` | The wallet |
| `POST` | `/api/paper/order` | Place a buy or sell |
| `POST` | `/api/paper/reset` | Start the wallet again |
| `GET` | `/api/watchlists` | All lists |
| `POST` | `/api/watchlists` | Create a list |
| `POST` | `/api/watchlists/:id/stocks` | Add a stock |

Everything under `/api/paper` and `/api/watchlists` needs a `Bearer` token.

## Deploying to Vercel

The repository holds three Vercel projects, all from this one repo, each with its own
root directory:

| Project | Root directory | Environment variables |
|---|---|---|
| Market service | `python-service` | — |
| API | `backend` | `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`, `MARKET_SERVICE_URL` |
| Front end | `frontend` | `VITE_API_URL` |

Deploy in that order, because each one needs the URL of the one before it. In MongoDB
Atlas, allow access from anywhere (`0.0.0.0/0`) under Network Access, since serverless
functions do not have fixed IP addresses.

## Notes

Prices come from Yahoo Finance and can be delayed by a few minutes. Paper trading fills
orders instantly and in full, and ignores brokerage, taxes and slippage. This is a
learning project, not investment advice.
