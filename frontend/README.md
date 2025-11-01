# Frontend - Lend a Hand Donation Platform

React-based frontend application for the Lend a Hand donation platform, built with Vite.

## Features

- 🚀 **Fast Development**: Vite for instant HMR (Hot Module Replacement)
- 🌍 **Internationalization**: Multi-language support with react-i18next
- 💳 **Stripe Integration**: Secure payment processing
- 📱 **Responsive Design**: Mobile-first responsive UI
- 🎨 **Modern UI**: Custom CSS with gradients and animations
- 🔐 **Authentication**: Token-based authentication
- 📊 **Dashboard**: User dashboard with campaign and news management
- ⚖️ **Moderation**: Content moderation tools for administrators

## Prerequisites

- **Node.js**: v18 or higher
- **npm**: v9 or higher (comes with Node.js)

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

The dev server includes:
- Hot Module Replacement (HMR) for instant updates
- Proxy configuration for `/api` and `/media` requests to the backend (`http://localhost:8000`)

### 3. Available Scripts

- `npm run dev` - Start development server with HMR
- `npm run build` - Build for production (outputs to `../backend/static`)
- `npm run preview` - Preview production build locally

## Building for Production

### Local Build

```bash
npm run build
```

This will build the application and output the static files to `../backend/static/` (as configured in `vite.config.js`).

### Docker Build

The frontend includes a multi-stage Dockerfile for containerized deployment:

```bash
# Build the Docker image
docker build -t frontend:latest ./frontend

# Run with default API endpoint (/api)
docker run -p 8080:80 frontend:latest

# Run with custom API endpoint
docker run -p 8080:80 -e REACT_APP_API_URL=https://api.example.com frontend:latest
```

## Runtime Configuration

The Docker image supports **runtime configuration** of the API endpoint via environment variables, allowing you to change the API URL without rebuilding the image.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REACT_APP_API_URL` | `/api` | API endpoint URL (supports relative paths like `/api` or full URLs like `https://api.example.com`) |

### Usage Examples

#### Using Relative Paths

```bash
docker run -p 8080:80 -e REACT_APP_API_URL=/api/v1 frontend:latest
```

#### Using Full URLs

```bash
docker run -p 8080:80 -e REACT_APP_API_URL=https://api.production.com frontend:latest
```

#### Using Docker Compose

```yaml
services:
  frontend:
    image: frontend:latest
    ports:
      - "8080:80"
    environment:
      - REACT_APP_API_URL=https://api.production.com
```

### How Runtime Configuration Works

1. **Entrypoint Script**: On container startup, `entrypoint.sh` reads the `REACT_APP_API_URL` environment variable
2. **Config Generation**: Creates `/usr/share/nginx/html/config.js` with the API URL
3. **App Loading**: The HTML loads `config.js` before the main application
4. **Axios Configuration**: The `axios.js` client reads from `window.__RUNTIME_CONFIG__` and uses it as the baseURL

The config file is served without caching to ensure fresh configuration on each request.

## Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   └── axios.js          # Axios client with runtime config support
│   ├── components/
│   │   ├── CampaignCard.jsx   # Campaign card component
│   │   ├── Header.jsx         # Main header with navigation
│   │   ├── ImageCarousel.jsx  # Image carousel for campaigns
│   │   ├── MediaUploader.jsx # Media upload component
│   │   └── RichTextEditor.jsx # WYSIWYG editor component
│   ├── pages/
│   │   ├── CampaignDetail.jsx # Campaign detail view
│   │   ├── Campaigns.jsx      # Campaign listing
│   │   ├── CreateCampaign.jsx # Campaign creation
│   │   ├── Dashboard.jsx      # User dashboard
│   │   ├── Home.jsx            # Landing page
│   │   ├── Login.jsx           # Login page
│   │   ├── Moderation.jsx      # Moderation dashboard
│   │   ├── News.jsx            # News listing
│   │   └── Settings.jsx       # User settings
│   ├── App.jsx                 # Main app component
│   ├── main.jsx                # Entry point
│   └── i18n.js                 # i18n configuration
├── Dockerfile                  # Multi-stage Docker build
├── entrypoint.sh               # Runtime configuration script
├── nginx.conf                  # Nginx configuration
├── index.html                  # HTML template
├── package.json                # Dependencies and scripts
└── vite.config.js              # Vite configuration
```

## Configuration Files

### `vite.config.js`

Vite configuration including:
- React plugin
- Development server proxy for `/api` and `/media`
- Build output directory (`../backend/static`)

### `nginx.conf`

Production nginx configuration with:
- SPA routing support (all routes → `index.html`)
- Gzip compression
- Security headers
- Static asset caching
- Runtime config no-cache (`/config.js`)
- Health check endpoint (`/health`)

### `entrypoint.sh`

Container startup script that:
- Reads `REACT_APP_API_URL` environment variable
- Generates `config.js` with runtime configuration
- Starts nginx

## API Integration

The frontend communicates with the backend API through:

- **Base URL**: Configured at runtime via `REACT_APP_API_URL` (defaults to `/api`)
- **Authentication**: Token-based auth stored in `localStorage`
- **Request Format**: JSON with automatic token injection
- **Error Handling**: Centralized error handling in axios interceptors

### Example API Usage

```javascript
import api from './api/axios'

// API automatically uses runtime config
const response = await api.get('/campaigns/')
const campaign = await api.post('/campaigns/', { title: 'New Campaign' })
```

## Internationalization

The application supports multiple languages using `react-i18next`. Language switching is available through the header component.

## Development Tips

1. **API Proxy**: In development, all `/api/*` requests are proxied to `http://localhost:8000`
2. **Hot Reload**: Vite provides instant HMR - changes appear immediately
3. **Build Output**: Production builds go to `../backend/static` for Django static file serving
4. **Runtime Config**: In Docker, always use `REACT_APP_API_URL` environment variable, not build-time variables

## Troubleshooting

### Docker: API endpoint not working

- Check that `REACT_APP_API_URL` environment variable is set correctly
- Verify the config.js file is generated: `docker exec <container> cat /usr/share/nginx/html/config.js`
- Check browser console for `window.__RUNTIME_CONFIG__` availability

### Build: Output directory issues

- The build outputs to `../backend/static` by default
- For Docker builds, the Dockerfile overrides this to `dist/`
- Ensure the output directory exists and is writable

### Development: Proxy not working

- Verify backend is running on `http://localhost:8000`
- Check `vite.config.js` proxy configuration
- Ensure API requests use relative paths (e.g., `/api/campaigns/` not `http://localhost:8000/api/campaigns/`)

## Production Deployment

### Docker Deployment

1. Build the image:
   ```bash
   docker build -t frontend:latest ./frontend
   ```

2. Run with environment variables:
   ```bash
   docker run -d \
     -p 80:80 \
     -e REACT_APP_API_URL=https://api.example.com \
     --name frontend \
     frontend:latest
   ```

3. Or use docker-compose:
   ```yaml
   version: '3.8'
   services:
     frontend:
       build: ./frontend
       ports:
         - "80:80"
       environment:
         - REACT_APP_API_URL=${API_URL:-/api}
   ```

### Kubernetes Deployment

See the `devops/` directory for Helm charts and Kubernetes manifests.

## Health Check

The application exposes a health check endpoint at `/health`:

```bash
curl http://localhost:8080/health
# Returns: healthy
```

## License

[Add your license here]
