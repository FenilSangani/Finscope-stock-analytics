const mongoose = require('mongoose')

const MAX_LISTS = 5
const MAX_SYMBOLS = 30

// A new user gets one list with a few well known names in it, so the module
// has something to show before they add anything of their own.
const DEFAULT_LIST_NAME = 'Main Watchlist'
const DEFAULT_SYMBOLS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK']

// Only the ticker is stored. The company name and every price come from the
// market service when the page loads, so nothing here can go stale.
const entrySchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const listSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'A watchlist needs a name'],
    trim: true,
    maxlength: [30, 'Keep the name under 30 characters'],
  },
  stocks: { type: [entrySchema], default: [] },
})

const watchlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    lists: {
      type: [listSchema],
      default: () => [
        {
          name: DEFAULT_LIST_NAME,
          stocks: DEFAULT_SYMBOLS.map((symbol) => ({ symbol })),
        },
      ],
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Watchlist', watchlistSchema)
module.exports.MAX_LISTS = MAX_LISTS
module.exports.MAX_SYMBOLS = MAX_SYMBOLS
module.exports.DEFAULT_LIST_NAME = DEFAULT_LIST_NAME
