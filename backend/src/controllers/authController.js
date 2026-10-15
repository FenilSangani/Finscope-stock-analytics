const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const PaperAccount = require('../models/PaperAccount')
const Watchlist = require('../models/Watchlist')
const { validateRegisterInput, validateLoginInput } = require('../utils/validators')

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

function toPublicUser(user) {
  return { id: user._id, name: user.name, email: user.email }
}

async function register(req, res) {
  const { name, email, password } = req.body

  const errors = validateRegisterInput({ name, email, password })
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors })
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() })
  if (existing) {
    return res.status(409).json({ errors: { email: 'Email is already registered' } })
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
  })

  const token = signToken(user._id)
  res.status(201).json({ token, user: toPublicUser(user) })
}

async function login(req, res) {
  const { email, password } = req.body

  const errors = validateLoginInput({ email, password })
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors })
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password')
  if (!user) {
    return res.status(401).json({ errors: { form: 'Invalid email or password' } })
  }

  const isMatch = await bcrypt.compare(password, user.password)
  if (!isMatch) {
    return res.status(401).json({ errors: { form: 'Invalid email or password' } })
  }

  const token = signToken(user._id)
  res.status(200).json({ token, user: toPublicUser(user) })
}

async function me(req, res) {
  const user = await User.findById(req.userId)
  if (!user) {
    return res.status(404).json({ errors: { form: 'Account not found' } })
  }
  res.json({ user: { ...toPublicUser(user), createdAt: user.createdAt } })
}

async function deleteAccount(req, res) {
  const deleted = await User.findByIdAndDelete(req.userId)
  if (!deleted) {
    return res.status(404).json({ errors: { form: 'Account not found' } })
  }

  // Everything else that belongs to this user goes with it, so deleting an
  // account really does leave nothing behind.
  await Promise.all([
    PaperAccount.deleteOne({ user: req.userId }),
    Watchlist.deleteOne({ user: req.userId }),
  ])

  res.json({ deleted: true })
}

module.exports = { register, login, me, deleteAccount }
