import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import './Auth.css'

function Register() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    password2: '',
    phone: '',
    address: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.password2) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const response = await api.post('/auth/register/', formData)
      localStorage.setItem('token', response.data.token)
      navigate('/dashboard')
      window.location.reload()
    } catch (err) {
      const errorMessage = err.response?.data || {}
      setError(
        Object.values(errorMessage).flat().join(', ') ||
        'Registration failed. Please try again.'
      )
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>{t('register.title')}</h1>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            name="email"
            placeholder={t('register.email')}
            value={formData.email}
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="username"
            placeholder={t('register.username')}
            value={formData.username}
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="password"
            placeholder={t('register.password')}
            value={formData.password}
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="password2"
            placeholder={t('register.password2')}
            value={formData.password2}
            onChange={handleChange}
            required
          />
          <input
            type="tel"
            name="phone"
            placeholder={t('register.phone')}
            value={formData.phone}
            onChange={handleChange}
          />
          <input
            type="text"
            name="address"
            placeholder={t('register.address')}
            value={formData.address}
            onChange={handleChange}
          />
          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? 'Loading...' : t('register.submit')}
          </button>
        </form>
        <p className="auth-link">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  )
}

export default Register

