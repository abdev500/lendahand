import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import ErrorMessage from '../components/ErrorMessage'
import { extractErrorMessage, logError } from '../utils/errorHandler'
import './Auth.css'

function ResetPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { uid, token } = useParams()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!uid || !token) {
      setError(t('resetPassword.invalidLink', 'Invalid reset link. Please request a new password reset.'))
      setTimeout(() => {
        navigate('/forgot-password')
      }, 3000)
    }
  }, [uid, token, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== password2) {
      setError(t('register.passwordMismatch', 'Passwords do not match'))
      return
    }

    if (password.length < 8) {
      setError(t('register.passwordTooShort', 'Password must be at least 8 characters long'))
      return
    }

    setLoading(true)

    try {
      const response = await api.post('/auth/password-reset-confirm/', {
        uid,
        token,
        new_password: password,
        new_password2: password2,
      })

      setSuccess(response.data.message || t('resetPassword.success', 'Password has been reset successfully.'))
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      logError(err, 'passwordResetConfirm')
      const errorMsg = extractErrorMessage(err, t('resetPassword.error', 'Failed to reset password. Please try again.'))
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>{t('resetPassword.title', 'Reset Password')}</h1>
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
          {t('resetPassword.description', 'Enter your new password below.')}
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder={t('resetPassword.newPassword', 'New Password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            minLength={8}
          />
          <input
            type="password"
            placeholder={t('resetPassword.confirmPassword', 'Confirm New Password')}
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            required
            disabled={loading}
            minLength={8}
          />
          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? t('common.loading', 'Loading...') : t('resetPassword.submit', 'Reset Password')}
          </button>
        </form>
        <p className="auth-link">
          <Link to="/login">{t('resetPassword.backToLogin', 'Back to Login')}</Link>
        </p>
      </div>
    </div>
  )
}

export default ResetPassword
