import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import ErrorMessage from '../components/ErrorMessage'
import { extractErrorMessage, logError } from '../utils/errorHandler'
import './Auth.css'

function ForgotPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await api.post('/auth/password-reset/', {
        email,
      })

      setSuccess(response.data.message || t('forgotPassword.success', 'If this email exists, a password reset link has been sent to your email.'))
      setEmail('')
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err) {
      logError(err, 'passwordResetRequest')
      const errorMsg = extractErrorMessage(err, t('forgotPassword.error', 'Failed to send password reset email. Please try again.'))
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>{t('forgotPassword.title', 'Forgot Password')}</h1>
        {success && (
          <div className="success-message" style={{ backgroundColor: '#d4edda', color: '#155724', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
            {success}
          </div>
        )}
        <ErrorMessage
          message={error}
          onClose={() => setError('')}
          autoHide={true}
          duration={5000}
        />
        <p style={{ marginBottom: '20px', color: '#666' }}>
          {t('forgotPassword.description', 'Enter your email address and we\'ll send you a link to reset your password.')}
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder={t('forgotPassword.email', 'Email address')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? t('common.loading', 'Loading...') : t('forgotPassword.submit', 'Send Reset Link')}
          </button>
        </form>
        <p className="auth-link">
          <Link to="/login">{t('forgotPassword.backToLogin', 'Back to Login')}</Link>
        </p>
      </div>
    </div>
  )
}

export default ForgotPassword
