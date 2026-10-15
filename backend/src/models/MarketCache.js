const mongoose = require('mongoose')

/**
 * Upstream market data, cached where every instance can see it.
 *
 * The Python service keeps its own in-process cache, which works well on one
 * long running machine but is useless on serverless: each invocation may land
 * on a fresh instance with an empty cache, so the same prices would be pulled
 * from Yahoo over and over. Mongo is shared by every instance, so one fetch
 * serves them all.
 */
const marketCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  // Mongo deletes the document itself once this time passes.
  expiresAt: { type: Date, required: true, expires: 0 },
})

module.exports = mongoose.model('MarketCache', marketCacheSchema)
