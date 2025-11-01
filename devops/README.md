# Lend a Hand - DevOps

This directory contains Kubernetes manifests and Helm charts for deploying the Lend a Hand platform.

## Structure

```
devops/
├── lendahand/          # Main Helm chart
│   ├── Chart.yaml      # Chart metadata
│   ├── values.yaml     # Default configuration values
│   ├── values-prod.yaml # Production configuration
│   ├── values-dev.yaml # Development configuration
│   └── templates/       # Kubernetes manifests
│       ├── backend/     # Backend (Django) resources
│       ├── frontend/     # Frontend (React) resources
│       └── _helpers.tpl  # Template helpers
└── README.md           # This file
```

## Prerequisites

- Kubernetes cluster (1.19+)
- Helm 3.0+
- kubectl configured to access your cluster
- Docker images built and pushed to a registry

## Quick Start

### 1. Build and Push Docker Images

First, build and push your Docker images to a container registry:

```bash
# Build backend image
docker build -t your-registry/lendahand-backend:latest .
docker push your-registry/lendahand-backend:latest

# Build frontend image (requires Dockerfile for frontend)
cd frontend
docker build -t your-registry/lendahand-frontend:latest .
docker push your-registry/lendahand-frontend:latest
```

### 2. Update values.yaml

Edit `devops/lendahand/values.yaml` or create environment-specific values files:

- Set image registry and tags
- Configure environment variables (secrets)
- Set up ingress hosts
- Configure database credentials

### 3. Install Dependencies

The chart depends on PostgreSQL. Install the Bitnami PostgreSQL chart:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

### 4. Deploy

```bash
# Install the chart
helm install lendahand ./devops/lendahand

# Or with custom values
helm install lendahand ./devops/lendahand -f devops/lendahand/values-prod.yaml

# Or upgrade existing deployment
helm upgrade lendahand ./devops/lendahand
```

## Configuration

### Environment Variables

Key environment variables that should be set via secrets:

- `DJANGO_SECRET_KEY`: Django secret key (required)
- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_PUBLISHABLE_KEY`: Stripe publishable key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret
- `DATABASE_URL`: PostgreSQL connection string

### Production Deployment

For production, create a `values-prod.yaml`:

```yaml
backend:
  replicaCount: 3
  resources:
    limits:
      cpu: 2000m
      memory: 2Gi
    requests:
      cpu: 1000m
      memory: 1Gi

frontend:
  replicaCount: 3
  resources:
    limits:
      cpu: 1000m
      memory: 1Gi
    requests:
      cpu: 500m
      memory: 512Mi

postgresql:
  auth:
    postgresPassword: "secure-password"
    password: "secure-password"
  persistence:
    size: 50Gi

ingress:
  enabled: true
  tls:
    enabled: true
```

Deploy with:

```bash
helm install lendahand ./devops/lendahand -f devops/lendahand/values-prod.yaml
```

## Components

### Backend (Django)

- **Deployment**: Django backend service
- **Service**: ClusterIP service on port 8000
- **Ingress**: Optional ingress for API access
- **PVC**: Persistent volume for media files
- **ConfigMap**: Non-sensitive configuration
- **Secret**: Sensitive environment variables

### Frontend (React)

- **Deployment**: React frontend service
- **Service**: ClusterIP service on port 80
- **Ingress**: Optional ingress for web access

### PostgreSQL

- Uses Bitnami PostgreSQL Helm chart
- Configurable persistence
- Automatic backup support (if configured)

## Health Checks

Both backend and frontend include:

- **Liveness Probe**: Checks if container is running
- **Readiness Probe**: Checks if container is ready to serve traffic

Backend health check endpoint: `/api/health/` (you may need to implement this)

## Scaling

Scale deployments manually:

```bash
# Scale backend
kubectl scale deployment lendahand-backend --replicas=5

# Scale frontend
kubectl scale deployment lendahand-frontend --replicas=5
```

Or update in values.yaml and upgrade:

```bash
helm upgrade lendahand ./devops/lendahand
```

## Troubleshooting

### Check pod status

```bash
kubectl get pods -l app.kubernetes.io/name=lendahand
```

### View logs

```bash
# Backend logs
kubectl logs -l app.kubernetes.io/component=backend

# Frontend logs
kubectl logs -l app.kubernetes.io/component=frontend
```

### Access pods

```bash
# Backend shell
kubectl exec -it $(kubectl get pod -l app.kubernetes.io/component=backend -o jsonpath='{.items[0].metadata.name}') -- /bin/bash

# Run migrations
kubectl exec -it $(kubectl get pod -l app.kubernetes.io/component=backend -o jsonpath='{.items[0].metadata.name}') -- python manage.py migrate
```

### Database connection

```bash
# Connect to PostgreSQL
kubectl exec -it $(kubectl get pod -l app.kubernetes.io/name=postgresql -o jsonpath='{.items[0].metadata.name}') -- psql -U lendahand -d lendahand
```

## Uninstall

```bash
helm uninstall lendahand
```

## Additional Resources

- [Helm Documentation](https://helm.sh/docs/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Bitnami PostgreSQL Chart](https://github.com/bitnami/charts/tree/main/bitnami/postgresql)

