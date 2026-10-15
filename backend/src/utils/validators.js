const validator = require('validator')

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

function validateRegisterInput({ name, email, password }) {
  const errors = {}

  if (!name || name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters'
  }

  if (!email || !validator.isEmail(email)) {
    errors.email = 'Enter a valid email address'
  }

  if (!password || !PASSWORD_RULE.test(password)) {
    errors.password =
      'Password must be 8+ characters with an uppercase letter, a lowercase letter, and a number'
  }

  return errors
}

function validateLoginInput({ email, password }) {
  const errors = {}

  if (!email || !validator.isEmail(email)) {
    errors.email = 'Enter a valid email address'
  }

  if (!password) {
    errors.password = 'Password is required'
  }

  return errors
}

module.exports = { validateRegisterInput, validateLoginInput }
