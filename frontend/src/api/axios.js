import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Token ${token}`
    }
    // Don't set Content-Type for FormData - let browser set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Handle errors properly
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If we get HTML instead of JSON, try to extract error message
    if (error.response && typeof error.response.data === 'string' && error.response.data.trim().startsWith('<!')) {
      // It's HTML, likely an error page
      const status = error.response.status
      let message = `Server error (${status})`
      
      if (status === 400) {
        message = 'Bad request. Please check your input.'
      } else if (status === 401) {
        message = 'Authentication required. Please login again.'
      } else if (status === 403) {
        message = 'You do not have permission to perform this action.'
      } else if (status === 404) {
        message = 'Resource not found.'
      } else if (status === 500) {
        message = 'Internal server error. Please try again later.'
      }
      
      error.response.data = { error: message }
    }
    return Promise.reject(error)
  }
)

export default api

