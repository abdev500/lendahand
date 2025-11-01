import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import './Settings.css'

function Settings() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState('')
  const [activeTab, setActiveTab] = useState('profile')
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    phone: '',
    address: '',
  })
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  })

  useEffect(() => {
    checkAuth()
    fetchUser()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    try {
      await api.get('/users/me/')
    } catch (error) {
      localStorage.removeItem('token')
      navigate('/login')
    }
  }

  const fetchUser = async () => {
    try {
      const response = await api.get('/users/me/')
      setFormData({
        email: response.data.email || '',
        username: response.data.username || '',
        phone: response.data.phone || '',
        address: response.data.address || '',
      })
      setLoading(false)
    } catch (error) {
      console.error('Error fetching user:', error)
      setError(t('settings.profile.loadError'))
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    setError('')
    setSuccessMessage('')
  }

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    })
    setPasswordError('')
    setPasswordSuccessMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setSaving(true)

    try {
      const response = await api.get('/users/me/')
      const userId = response.data.id
      
      await api.patch(`/users/${userId}/`, formData)
      setSuccessMessage(t('settings.profile.updated'))
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (err) {
      console.error('Error updating profile:', err)
      let errorMessage = t('settings.profile.error')
      
      if (err.response?.data) {
        const data = err.response.data
        if (typeof data === 'string') {
          errorMessage = data
        } else if (typeof data === 'object') {
          const errors = Object.values(data).flat()
          errorMessage = errors.length > 0 ? errors.join(', ') : errorMessage
        }
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccessMessage('')

    // Validate passwords match
    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordError(t('settings.password.mismatch'))
      return
    }

    if (passwordData.new_password.length < 8) {
      setPasswordError(t('settings.password.minLength'))
      return
    }

    setPasswordSaving(true)

    try {
      await api.post('/users/change_password/', {
        old_password: passwordData.old_password,
        new_password: passwordData.new_password,
      })
      
      setPasswordSuccessMessage(t('settings.password.changed'))
      setPasswordData({
        old_password: '',
        new_password: '',
        confirm_password: '',
      })
      
      // Clear success message after 5 seconds
      setTimeout(() => setPasswordSuccessMessage(''), 5000)
    } catch (err) {
      console.error('Error changing password:', err)
      let errorMessage = t('settings.password.error')
      
      if (err.response?.data) {
        const data = err.response.data
        if (typeof data === 'string') {
          errorMessage = data
        } else if (typeof data === 'object') {
          const errors = Object.values(data).flat()
          errorMessage = errors.length > 0 ? errors.join(', ') : errorMessage
        }
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setPasswordError(errorMessage)
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="settings">
        <div className="container">
          <div className="loading">{t('common.loading')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="settings">
      <div className="container">
        <h1>{t('settings.title')}</h1>
        
        <div className="settings-tabs">
          <button
            className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            {t('settings.tab.profile')}
          </button>
          <button
            className={`tab ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
          >
            {t('settings.tab.password')}
          </button>
        </div>

        {activeTab === 'profile' && (
          <div className="settings-content">
            <h2>{t('settings.profile.title')}</h2>
            {error && <div className="error-message">{error}</div>}
            {successMessage && <div className="success-message">{successMessage}</div>}
            
            <form onSubmit={handleSubmit} className="settings-form">
              <div className="form-group">
                <label htmlFor="email">{t('settings.profile.email')} *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder={t('settings.profile.email')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="username">{t('settings.profile.username')} *</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  placeholder={t('settings.profile.username')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">{t('settings.profile.phone')}</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder={t('settings.profile.phone')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="address">{t('settings.profile.address')}</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows="4"
                  placeholder={t('settings.profile.address')}
                />
              </div>

              <div className="form-actions">
                <button type="submit" disabled={saving} className="btn-submit">
                  {saving ? t('settings.profile.saving') : t('settings.profile.save')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="btn-cancel"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'password' && (
          <div className="settings-content">
            <h2>{t('settings.password.title')}</h2>
            {passwordError && <div className="error-message">{passwordError}</div>}
            {passwordSuccessMessage && <div className="success-message">{passwordSuccessMessage}</div>}
            
            <form onSubmit={handlePasswordSubmit} className="settings-form">
              <div className="form-group">
                <label htmlFor="old_password">{t('settings.password.current')} *</label>
                <input
                  type="password"
                  id="old_password"
                  name="old_password"
                  value={passwordData.old_password}
                  onChange={handlePasswordChange}
                  required
                  placeholder={t('settings.password.current')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="new_password">{t('settings.password.new')} *</label>
                <input
                  type="password"
                  id="new_password"
                  name="new_password"
                  value={passwordData.new_password}
                  onChange={handlePasswordChange}
                  required
                  minLength="8"
                  placeholder={t('settings.password.new')}
                />
                <small>{t('settings.password.minLength')}</small>
              </div>

              <div className="form-group">
                <label htmlFor="confirm_password">{t('settings.password.confirm')} *</label>
                <input
                  type="password"
                  id="confirm_password"
                  name="confirm_password"
                  value={passwordData.confirm_password}
                  onChange={handlePasswordChange}
                  required
                  minLength="8"
                  placeholder={t('settings.password.confirm')}
                />
              </div>

              <div className="form-actions">
                <button type="submit" disabled={passwordSaving} className="btn-submit">
                  {passwordSaving ? t('settings.password.changing') : t('settings.password.change')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="btn-cancel"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default Settings

