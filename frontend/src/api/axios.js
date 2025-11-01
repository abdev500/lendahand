import axios from 'axios'

// Get API URL from runtime config (set by entrypoint.sh) or use default
const getApiBaseURL = () => {
  // Check if runtime config is available (injected at container startup)
  if (window.__RUNTIME_CONFIG__ && window.__RUNTIME_CONFIG__.REACT_APP_API_URL) {
    const apiUrl = window.__RUNTIME_CONFIG__.REACT_APP_API_URL
    // If it's a full URL, use it directly; otherwise treat as path
    if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) {
      return apiUrl
    }
    // If it starts with /, use it as-is; otherwise prepend /
    return apiUrl.startsWith('/') ? apiUrl : `/${apiUrl}`
  }
  // Default to /api if no runtime config
  return '/api'
}

const api = axios.create({
  baseURL: getApiBaseURL(),
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
