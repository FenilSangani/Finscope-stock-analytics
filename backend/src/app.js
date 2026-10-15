require('dotenv').config()
const express = require('express')
const cors = require('cors')
const connectDB = require('./config/db')
const authRoutes = require('./routes/authRoutes')
const stockRoutes = require('./routes/stockRoutes')
const paperRoutes = require('./routes/paperRoutes')
const marketRoutes = require('./routes/marketRoutes')
const watchlistRoutes = require('./routes/watchlistRoutes')
const errorHandler = require('./middleware/errorHandler')

// Fail loudly at boot rather than with a confusing 500 on the first login.
for (const name of ['MONGO_URI', 'JWT_SECRET']) {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}. See .env.example.`)
  }
}

const app = express()

// CLIENT_URL holds the sites allowed to call this API, comma separated so a
// local dev server and the deployed front end can both be listed.
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      // No origin means a server to server call or a health check, not a browser.
      if (!origin) return callback(null, true)

      const clean = origin.replace(/\/$/, '')
      if (allowedOrigins.includes(clean)) return callback(null, true)

      // Every Vercel preview build gets its own hostname, so allow the ones
      // that belong to a project already on the list.
      const previewOk = allowedOrigins.some((allowed) => {
        const project = allowed.match(/^https:\/\/([^.]+)\.vercel\.app$/)
        return project && clean.startsWith(`https://${project[1]}-`) && clean.endsWith('.vercel.app')
      })
      if (previewOk) return callback(null, true)

      callback(new Error(`Origin ${origin} is not allowed by CORS`))
    },
    credentials: true,
  }),
)

app.use(express.json())

/**
 * Routes that read or write user data wait for Mongo. Market data routes are
 * deliberately left out so prices keep working even if the database is down.
 */
async function requireDB(req, res, next) {
  try {
    await connectDB()
    next()
  } catch {
    res.status(503).json({
      errors: { form: 'The database is unavailable right now. Please try again in a moment.' },
    })
  }
}

// A plain index, so opening the API root says what it is rather than 404ing.
app.get('/', (req, res) =>
  res.json({
    service: 'FinScope API',
    status: 'ok',
    endpoints: [
      '/api/health',
      '/api/auth/login',
      '/api/stocks/:symbol',
      '/api/market/quotes?symbols=RELIANCE,TCS',
      '/api/paper/account',
      '/api/watchlists',
    ],
  }),
)

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

app.use('/api/auth', requireDB, authRoutes)
app.use('/api/paper', requireDB, paperRoutes)
app.use('/api/watchlists', requireDB, watchlistRoutes)
app.use('/api/stocks', stockRoutes)
app.use('/api/market', marketRoutes)

// Registered after every route, so it only sees requests nothing matched. It
// names the path that actually arrived, which separates a typo from a host
// rewriting the path before the app ever sees it.
app.use((req, res) => {
  res.status(404).json({
    errors: { form: `No endpoint at '${req.path}'. See / for the list of endpoints.` },
  })
})

app.use(errorHandler)

module.exports = app
module.exports.connectDB = connectDB
