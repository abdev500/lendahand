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
      navigate('/dashboard')
      window.location.reload()
    } catch (err) {
      const errorMsg = err.response?.data?.error || t('login.error', 'Login failed. Please try again.')
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
