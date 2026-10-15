const mongoose = require('mongoose')

// Every new wallet starts with ten lakh of virtual money and nothing bought.
const STARTING_CAPITAL = 1000000

// Only the trade facts are stored. Prices, values and profit are worked out
// from live quotes when the page loads, so nothing in the database can go
// stale or disagree with the market.
const holdingSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, trim: true },
    qty: { type: Number, required: true, min: 1 },
    avgPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const orderSchema = new mongoose.Schema(
  {
    ref: { type: String, required: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, trim: true },
    action: { type: String, required: true, enum: ['BUY', 'SELL'] },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    // Only set on a sell: the profit or loss booked by closing that quantity.
    realised: { type: Number, default: null },
    placedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const paperAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    cash: { type: Number, default: STARTING_CAPITAL },
    realised: { type: Number, default: 0 },
    holdings: { type: [holdingSchema], default: [] },
    orders: { type: [orderSchema], default: [] },
  },
  { timestamps: true },
)

module.exports = mongoose.model('PaperAccount', paperAccountSchema)
module.exports.STARTING_CAPITAL = STARTING_CAPITAL
