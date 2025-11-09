import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useState, useRef } from 'react'
import api from '../api/axios'
import './Header.css'

const getAdminURL = () => {
  if (typeof window === 'undefined') {
    return '/admin/'
  }

  const runtimeConfig = window.__RUNTIME_CONFIG__ || {}
  const runtimeAdminUrl = runtimeConfig.REACT_APP_ADMIN_URL

  const buildAbsoluteAdminURL = (candidate) => {
    const candidateURL = new URL(candidate, window.location.origin)
    const pathSegments = candidateURL.pathname.split('/').filter(Boolean)

    if (pathSegments.length && pathSegments[pathSegments.length - 1] === 'api') {
      pathSegments.pop()
    }

    pathSegments.push('admin')
    candidateURL.pathname = `/${pathSegments.join('/')}/`
    candidateURL.search = ''
    candidateURL.hash = ''
    return candidateURL.toString()
  }

  try {
    if (runtimeAdminUrl) {
      return buildAbsoluteAdminURL(runtimeAdminUrl)
    }

    const runtimeApiUrl = runtimeConfig.REACT_APP_API_URL
    if (runtimeApiUrl) {
      return buildAbsoluteAdminURL(runtimeApiUrl)
    }

    const defaultBase = api.defaults.baseURL || '/api'
    if (defaultBase.startsWith('http://') || defaultBase.startsWith('https://')) {
      return buildAbsoluteAdminURL(defaultBase)
    }

    const hostname = window.location.hostname
    const isLocalhost = ['localhost', '127.0.0.1'].includes(hostname)
    if (isLocalhost) {
      return `${window.location.protocol}//localhost:8000/admin/`
    }

    return `${window.location.origin.replace(/\/$/, '')}/admin/`
  } catch (error) {
    console.error('[Header] Failed to resolve admin URL:', error)
    return '/admin/'
  }
}

function Header() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [adminURL, setAdminURL] = useState('/admin/')
  const dropdownRef = useRef(null)

  useEffect(() => {
    // Check auth on mount and when route changes
    // This ensures the header updates after login navigation
    checkAuth()
  }, [location.pathname])

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

  useEffect(() => {
    // Compute admin URL immediately and refresh shortly after to catch late config updates
    if (typeof window === 'undefined') {
      return
    }

    const updateAdminURL = () => {
      setAdminURL(getAdminURL())
    }

    updateAdminURL()

    const timeoutIds = [setTimeout(updateAdminURL, 100), setTimeout(updateAdminURL, 500)]

    return () => {
      timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId))
    }
  }, [])

  const checkAuth = async () => {
    let token = null
    try {
      token = localStorage.getItem('token')
    } catch (e) {
      console.error('[Header] Error accessing localStorage:', e)
      setIsAuthenticated(false)
      setUser(null)
      return
    }

    if (token) {
      try {
        console.log('[Header] Fetching user data with token:', token.substring(0, 10) + '...')
        const response = await api.get('/users/me/')
        setUser(response.data)
        setIsAuthenticated(true)
        console.log('[Header] User authenticated:', response.data.email)
      } catch (error) {
        console.error('[Header] Error fetching user data:', error)
        // Don't clear token immediately - might be a transient error
        // Only clear if it's definitely a 401 (unauthorized)
        if (error.response && error.response.status === 401) {
          console.warn('[Header] 401 error - clearing token')
          localStorage.removeItem('token')
          setIsAuthenticated(false)
          setUser(null)
        } else {
          // For other errors, still mark as not authenticated but keep token
          setIsAuthenticated(false)
          setUser(null)
        }
      }
    } else {
      // No token - definitely not authenticated
      setIsAuthenticated(false)
      setUser(null)
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
                      {user?.is_staff && (
                        <a
                          href={adminURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setDropdownOpen(false)}
                          className="dropdown-item"
                        >
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
