import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './ErrorMessage.css'

function ErrorMessage({ message, onClose, autoHide = true, duration = 5000 }) {
  const { t } = useTranslation()

  // Auto-hide after duration
  useEffect(() => {
    if (autoHide && message && onClose) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [message, autoHide, duration, onClose])

  if (!message) return null

  return (
    <div className="error-message" role="alert">
      <div className="error-content">
        <span className="error-icon">⚠️</span>
        <span className="error-text">{message}</span>
      </div>
      {onClose && (
        <button
          className="error-close"
          onClick={onClose}
          aria-label={t('common.close', 'Close')}
        >
          ×
        </button>
      )}
    </div>
  )
}

export default ErrorMessage
