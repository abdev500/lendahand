/**
 * Utility function to extract error message from API error responses
 * Handles various error response formats from Django REST Framework
 */
export function extractErrorMessage(error, defaultMessage = 'An error occurred. Please try again.') {
  // No error object
  if (!error) {
    return defaultMessage
  }

  // Network error or no response
  if (!error.response) {
    if (error.message) {
      // Check for common network errors
      if (error.message.includes('Network Error') || error.message.includes('timeout')) {
        return 'Network error. Please check your connection and try again.'
      }
      return error.message
    }
    return defaultMessage
  }

  const { data, status } = error.response

  // String error message
  if (typeof data === 'string') {
    return data
  }

  // Object with error field
  if (data && typeof data === 'object') {
    // Single error message
    if (data.error) {
      return data.error
    }

    // Detail field (DRF standard)
    if (data.detail) {
      return data.detail
    }

    // Message field
    if (data.message) {
      return data.message
    }

    // Multiple field errors (validation errors)
    if (Object.keys(data).length > 0) {
      const errorMessages = []

      Object.keys(data).forEach((field) => {
        const fieldErrors = data[field]
        if (Array.isArray(fieldErrors)) {
          fieldErrors.forEach((err) => {
            errorMessages.push(`${field}: ${err}`)
          })
        } else if (typeof fieldErrors === 'string') {
          errorMessages.push(`${field}: ${fieldErrors}`)
        } else if (Array.isArray(fieldErrors)) {
          fieldErrors.forEach((err) => {
            if (typeof err === 'string') {
              errorMessages.push(`${field}: ${err}`)
            } else if (err.message) {
              errorMessages.push(`${field}: ${err.message}`)
            }
          })
        }
      })

      if (errorMessages.length > 0) {
        return errorMessages.join('. ')
      }
    }

    // Non-field errors array
    if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
      return data.non_field_errors.join('. ')
    }
  }

  // HTTP status code based messages
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input and try again.'
    case 401:
      return 'Authentication required. Please login again.'
    case 403:
      return 'You do not have permission to perform this action.'
    case 404:
      return 'Resource not found.'
    case 405:
      return 'Method not allowed.'
    case 422:
      return 'Validation error. Please check your input.'
    case 429:
      return 'Too many requests. Please try again later.'
    case 500:
      return 'Server error. Please try again later.'
    case 502:
      return 'Bad gateway. The server is temporarily unavailable.'
    case 503:
      return 'Service unavailable. Please try again later.'
    default:
      return defaultMessage
  }
}

/**
 * Log error details for debugging (only in development)
 */
export function logError(error, context = '') {
  if (process.env.NODE_ENV === 'development') {
    console.error(`Error${context ? ` in ${context}` : ''}:`, error)
    if (error.response) {
      console.error('Response:', error.response.data)
      console.error('Status:', error.response.status)
    }
  }
}
