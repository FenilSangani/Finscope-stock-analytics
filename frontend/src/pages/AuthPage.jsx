import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  BarChart3,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  X,
} from 'lucide-react'
import { loginUser, registerUser } from '../lib/api'
import { saveSession } from '../lib/auth'

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

function validate(mode, fields) {
  const errors = {}

  if (mode === 'register' && fields.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters'
  }

  if (!EMAIL_RULE.test(fields.email)) {
    errors.email = 'Enter a valid email address'
  }

  if (mode === 'register') {
    if (!PASSWORD_RULE.test(fields.password)) {
      errors.password =
        'Password must be 8+ characters with an uppercase letter, a lowercase letter, and a number'
    }
    if (fields.confirmPassword !== fields.password) {
      errors.confirmPassword = 'Passwords do not match'
    }
  } else if (!fields.password) {
    errors.password = 'Password is required'
  }

  return errors
}

export default function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [fields, setFields] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const isLogin = mode === 'login'

  function updateField(key, value) {
    setFields((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }))
  }

  function switchMode(next) {
    setMode(next)
    setErrors({})
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationErrors = validate(mode, fields)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSubmitting(true)
    setErrors({})
    try {
      const data = isLogin
        ? await loginUser({ email: fields.email, password: fields.password })
        : await registerUser({
            name: fields.name,
            email: fields.email,
            password: fields.password,
          })
      saveSession(data.token, data.user)
      navigate('/dashboard')
    } catch (err) {
      setErrors(err.errors || { form: 'Something went wrong. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#f8f9fb] px-6 py-12">
      <Link
        to="/"
        aria-label="Close and return to home"
        className="absolute top-5 right-5 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-gray-300 hover:text-gray-900 sm:top-8 sm:right-8"
      >
        <X className="h-5 w-5" />
      </Link>

      <Link to="/" className="mb-8 flex items-center gap-2">
        <BarChart3 className="h-7 w-7 text-blue-600" strokeWidth={2.5} />
        <span className="text-xl font-bold text-gray-900">FinScope</span>
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              isLogin
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              !isLogin
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Register
          </button>
        </div>

        <h1 className="text-xl font-bold text-gray-900">
          {isLogin ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isLogin
            ? 'Log in to access your dashboard and portfolio.'
            : 'Start analysing, backtesting, and paper trading for free.'}
        </p>

        {errors.form && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          {!isLogin && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={fields.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Parth Patel"
                  className={`w-full rounded-xl border bg-white py-2.5 pr-4 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:outline-none ${
                    errors.name
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                      : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
              </div>
              {errors.name && (
                <p className="mt-1.5 text-xs text-red-600">{errors.name}</p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={fields.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="you@example.com"
                className={`w-full rounded-xl border bg-white py-2.5 pr-4 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:outline-none ${
                  errors.email
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                    : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-600">{errors.email}</p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              {isLogin && (
                <a href="#" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                  Forgot password?
                </a>
              )}
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={fields.password}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder="••••••••"
                className={`w-full rounded-xl border bg-white py-2.5 pr-10 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:outline-none ${
                  errors.password
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                    : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-3.5 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-600">{errors.password}</p>
            )}
            {!isLogin && !errors.password && (
              <p className="mt-1.5 text-xs text-gray-400">
                8+ characters, with uppercase, lowercase &amp; a number
              </p>
            )}
          </div>

          {!isLogin && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={fields.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  placeholder="••••••••"
                  className={`w-full rounded-xl border bg-white py-2.5 pr-4 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:outline-none ${
                    errors.confirmPassword
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                      : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-red-600">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? 'Please wait…'
              : isLogin
                ? 'Log In'
                : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => switchMode(isLogin ? 'register' : 'login')}
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            {isLogin ? 'Register' : 'Log In'}
          </button>
        </p>
      </div>
    </div>
  )
}
