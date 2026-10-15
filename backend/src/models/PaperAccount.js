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
    // An order placed outside market hours waits for the opening bell, so it
    // has no price or amount until it actually fills.
    status: {
      type: String,
      enum: ['EXECUTED', 'PENDING', 'REJECTED', 'CANCELLED'],
      // Orders saved before this field existed were all immediate fills.
      default: 'EXECUTED',
    },
    price: { type: Number, default: null, min: 0 },
    amount: { type: Number, default: null, min: 0 },
    // Only set on a sell: the profit or loss booked by closing that quantity.
    realised: { type: Number, default: null },
    // Why a queued order could not be filled, shown as it is in the order book.
    note: { type: String, default: null },
    placedAt: { type: Date, default: Date.now },
    executedAt: { type: Date, default: null },
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
