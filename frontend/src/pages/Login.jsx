import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import './Auth.css'

function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/auth/login/', {
        email,
        password,
      })

      localStorage.setItem('token', response.data.token)
      // Navigate without reload - React Router will handle the navigation
      navigate('/dashboard')
    } catch (err) {
      let errorMsg = t('login.error', 'Login failed. Please try again.')

      if (err.response?.data) {
        // Handle different error formats
        if (err.response.data.error) {
          errorMsg = err.response.data.error
        } else if (err.response.data.non_field_errors && err.response.data.non_field_errors.length > 0) {
          errorMsg = err.response.data.non_field_errors[0]
        } else if (err.response.data.detail) {
          errorMsg = err.response.data.detail
        } else if (typeof err.response.data === 'string') {
          errorMsg = err.response.data
        } else if (err.response.data.email) {
          errorMsg = err.response.data.email[0]
        } else if (err.response.data.password) {
          errorMsg = err.response.data.password[0]
        }
      }

      setError(errorMsg)
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>{t('login.title')}</h1>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder={t('login.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder={t('login.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? t('common.loading', 'Loading...') : t('login.submit')}
          </button>
        </form>
        <p className="auth-link">
          <Link to="/forgot-password">{t('login.forgotPassword', 'Forgot password?')}</Link>
        </p>
        <p className="auth-link">
          {t('login.noAccount', "Don't have an account?")} <Link to="/register">{t('login.registerLink', 'Register')}</Link>
        </p>
      </div>
    </div>
  )
}

export default Login
