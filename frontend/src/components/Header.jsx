import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import api from '../api/axios'
import './Header.css'

function Header() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

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
    api.post('/auth/logout/')
    navigate('/')
  }

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang)
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
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">{t('nav.dashboard')}</Link>
                {user?.is_moderator && (
                  <a href="/moderation/" target="_blank">{t('nav.moderation')}</a>
                )}
                {user?.is_staff && (
                  <a href="/admin/" target="_blank">{t('nav.admin')}</a>
                )}
                <button onClick={handleLogout} className="btn-link">
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <Link to="/login">{t('nav.login')}</Link>
            )}
          </nav>
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
        </div>
      </div>
    </header>
  )
}

export default Header

