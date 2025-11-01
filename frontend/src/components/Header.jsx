import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useState, useRef } from 'react'
import api from '../api/axios'
import './Header.css'

function Header() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  const checkAuth = async () => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const response = await api.get('/users/me/')
        setUser(response.data)
        setIsAuthenticated(true)
      } catch (error) {
        localStorage.removeItem('token')
        setIsAuthenticated(false)
      }
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setIsAuthenticated(false)
    setUser(null)
    setDropdownOpen(false)
    api.post('/auth/logout/')
    navigate('/')
  }

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang)
  }

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen)
  }

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <Link to="/" className="logo">
            <h1>Lend a Hand</h1>
          </Link>
          <nav className="nav">
            <Link to="/campaigns">{t('nav.campaigns')}</Link>
            <Link to="/news">{t('nav.news')}</Link>
            {!isAuthenticated && (
              <Link to="/login">{t('nav.login')}</Link>
            )}
          </nav>
          <div className="header-right">
            <div className="language-selector">
              <button
                onClick={() => handleLanguageChange('en')}
                className={i18n.language === 'en' ? 'active' : ''}
              >
                EN
              </button>
              <button
                onClick={() => handleLanguageChange('ru')}
                className={i18n.language === 'ru' ? 'active' : ''}
              >
                RU
              </button>
              <button
                onClick={() => handleLanguageChange('be')}
                className={i18n.language === 'be' ? 'active' : ''}
              >
                BE
              </button>
              <button
                onClick={() => handleLanguageChange('lt')}
                className={i18n.language === 'lt' ? 'active' : ''}
              >
                LT
              </button>
              <button
                onClick={() => handleLanguageChange('uk')}
                className={i18n.language === 'uk' ? 'active' : ''}
              >
                UA
              </button>
            </div>
            {isAuthenticated && (
              <div className="user-menu" ref={dropdownRef}>
                <button className="user-menu-toggle" onClick={toggleDropdown}>
                  <div className="user-avatar">
                    {(user?.username || user?.email || 'U')[0].toUpperCase()}
                  </div>
                  <span className="dropdown-arrow">{dropdownOpen ? '▲' : '▼'}</span>
                </button>
                {dropdownOpen && (
                  <div className="user-dropdown">
                    <div className="user-dropdown-header">
                      <div className="user-status">
                        <span className="status-indicator"></span>
                        <span className="status-text">{t('nav.status.loggedIn')}</span>
                      </div>
                      <div className="user-details">
                        <div className="user-email">{user?.email}</div>
                        {user?.username && (
                          <div className="user-username">@{user?.username}</div>
                        )}
                      </div>
                    </div>
                    <div className="user-dropdown-menu">
                      <Link to="/dashboard" onClick={() => setDropdownOpen(false)} className="dropdown-item">
                        <span className="dropdown-icon">📊</span>
                        {t('nav.dashboard')}
                      </Link>
                      <Link to="/settings" onClick={() => setDropdownOpen(false)} className="dropdown-item">
                        <span className="dropdown-icon">👤</span>
                        {t('nav.settings')}
                      </Link>
                      {user?.is_moderator && (
                        <a href="/moderation/" target="_blank" onClick={() => setDropdownOpen(false)} className="dropdown-item">
                          <span className="dropdown-icon">✅</span>
                          {t('nav.moderation')}
                        </a>
                      )}
                      {user?.is_staff && (
                        <a href="/admin/" target="_blank" onClick={() => setDropdownOpen(false)} className="dropdown-item">
                          <span className="dropdown-icon">⚙️</span>
                          {t('nav.admin')}
                        </a>
                      )}
                      <div className="dropdown-divider"></div>
                      <button onClick={handleLogout} className="dropdown-item logout">
                        <span className="dropdown-icon">🚪</span>
                        {t('nav.logout')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header

