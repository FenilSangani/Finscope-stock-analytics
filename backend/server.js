// Local entry point. On Vercel the same app is exported from api/index.js
// instead, because serverless functions are handed a request rather than a port.
const app = require('./src/app')
const connectDB = require('./src/config/db')

const PORT = process.env.PORT || 5000

// Start listening straight away; Mongo connects in the background so the
// market data routes stay up even if the database is slow to answer.
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

connectDB().catch(() => {
  console.error('Starting without a database connection — it will retry on the first request.')
})
