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
  headers: {
    'Content-Type': 'application/json',
  },
})

// Set baseURL dynamically to handle runtime config loading
api.defaults.baseURL = getApiBaseURL()

// Update baseURL if runtime config loads later (for cases where config.js loads async)
if (typeof window !== 'undefined') {
  const updateBaseURL = () => {
    const newBaseURL = getApiBaseURL()
    if (api.defaults.baseURL !== newBaseURL) {
      api.defaults.baseURL = newBaseURL
    }
  }

  // Try to update immediately
  updateBaseURL()

  // Also listen for config to be available (if it loads after this script)
  if (!window.__RUNTIME_CONFIG__) {
    // Wait a bit for config.js to load
    setTimeout(updateBaseURL, 100)
    setTimeout(updateBaseURL, 500)
  }
}

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    // Ensure baseURL is updated before each request (in case config loaded late)
    const currentBaseURL = getApiBaseURL()
    if (config.baseURL !== currentBaseURL) {
      config.baseURL = currentBaseURL
    }

    // Get token from localStorage
    let token = null
    try {
      token = localStorage.getItem('token')
      if (token) {
        // Trim any whitespace that might have been accidentally added
        token = token.trim()
      }
    } catch (e) {
      console.error('[API] Error accessing localStorage:', e)
    }

    if (token) {
      // Set Authorization header - must be exactly "Token <token>" for DRF TokenAuthentication
      // HTTP headers are case-insensitive, but use standard capitalization
      const authHeader = `Token ${token}`
      config.headers['Authorization'] = authHeader

      // Debug logging for token presence
      console.log('[API Request]', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        fullURL: config.baseURL + config.url,
        hasToken: !!token,
        tokenPrefix: token ? token.substring(0, 10) + '...' : 'none',
        authorizationHeader: authHeader.substring(0, 15) + '...'
      })
    } else {
      // Log when token is missing - this helps debug authentication issues
      console.warn('[API Request] No token in localStorage', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        fullURL: config.baseURL + config.url,
        localStorageAvailable: typeof localStorage !== 'undefined'
      })
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
    // Log error details for debugging
    console.error('[API Error]', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers,
      requestHeaders: error.config?.headers
    })

    // Handle 401 Unauthorized - clear token and redirect to login
    if (error.response && error.response.status === 401) {
      console.warn('[API] 401 Unauthorized - clearing token')
      const tokenBefore = localStorage.getItem('token')
      console.log('[API] Token before clearing:', tokenBefore ? tokenBefore.substring(0, 10) + '...' : 'none')

      localStorage.removeItem('token')

      // Only redirect if not already on login page
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        console.log('[API] Redirecting to login page')
        window.location.href = '/login'
      }
    }

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
