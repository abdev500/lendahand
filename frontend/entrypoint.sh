#!/bin/sh
set -e

# Default API URL if not provided
API_URL=${REACT_APP_API_URL:-/api}

# Create runtime config file that can be loaded by the app
# This file is served by nginx and loaded before the main app
cat > /usr/share/nginx/html/config.js <<EOF
window.__RUNTIME_CONFIG__ = {
  REACT_APP_API_URL: "${API_URL}"
};
EOF

echo "Runtime config created with API_URL: ${API_URL}"
echo "Config file created at /usr/share/nginx/html/config.js"

# Start nginx
exec nginx -g "daemon off;"
