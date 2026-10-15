const dns = require('dns')
const mongoose = require('mongoose')

// Some home networks refuse the SRV/TXT lookups that a mongodb+srv:// URI
// needs, so resolve through public DNS locally. Vercel's own resolver handles
// them fine, and overriding it there would only add a hop.
if (!process.env.VERCEL) {
  dns.setServers(['8.8.8.8', '1.1.1.1'])
}

// One warm serverless instance handles many requests, so the connection is
// opened once and the same promise handed to everyone after that. Without this
// every request would open its own pool and quickly exhaust the Atlas limit.
let pending = null

function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose.connection)
  }

  if (!pending) {
    pending = mongoose
      .connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 20000,
        maxPoolSize: 10,
      })
      .then((instance) => {
        console.log('MongoDB connected')
        return instance.connection
      })
      .catch((err) => {
        // Clear the cache so the next request gets a fresh attempt rather than
        // being handed the same rejected promise forever.
        pending = null
        console.error(`MongoDB connection failed: ${err.message}`)
        throw err
      })
  }

  return pending
}

module.exports = connectDB
