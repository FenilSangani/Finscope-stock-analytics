function errorHandler(err, req, res, next) {
  console.error(err)

  if (err.code === 11000) {
    return res.status(409).json({ errors: { email: 'Email is already registered' } })
  }

  if (err.name === 'ValidationError') {
    const errors = {}
    for (const field in err.errors) {
      errors[field] = err.errors[field].message
    }
    return res.status(400).json({ errors })
  }

  res.status(500).json({ errors: { form: 'Something went wrong. Please try again.' } })
}

module.exports = errorHandler
