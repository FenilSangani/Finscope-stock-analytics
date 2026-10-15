const express = require('express')
const { register, login, me, deleteAccount } = require('../controllers/authController')
const asyncHandler = require('../middleware/asyncHandler')
const requireAuth = require('../middleware/requireAuth')

const router = express.Router()

router.post('/register', asyncHandler(register))
router.post('/login', asyncHandler(login))
router.get('/me', requireAuth, asyncHandler(me))
router.delete('/account', requireAuth, asyncHandler(deleteAccount))

module.exports = router
