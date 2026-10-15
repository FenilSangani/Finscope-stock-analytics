// The entry point both locally and on Vercel, which runs `npm start` and
// supplies PORT itself.
//
// There is deliberately no api/ directory here: Vercel reserves /api/* for
// file based functions, and a file there would swallow every /api request
// before this app ever saw it.
const app = require('./src/app')
const connectDB = require('./src/config/db')

const PORT = process.env.PORT || 5000

// Start listening straight away; Mongo connects in the background so the
// market data routes stay up even if the database is slow to answer.
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

connectDB().catch(() => {
  console.error('Starting without a database connection — it will retry on the first request.')
})
