# Google Kubernetes Engine (GKE) Setup Guide

This guide explains how to set up Google Kubernetes Engine for deploying the Lend a Hand platform.

## Prerequisites

1. Google Cloud Platform account with billing enabled
2. `gcloud` CLI installed and configured
3. `kubectl` installed
4. GitHub repository with Actions enabled

## Quick Setup

### Option 1: Automated Setup Script

Use the provided setup script:

```bash
cd devops
./gke-setup.sh dev your-project-id lendahand-dev us-central1-a
```

### Option 2: Manual Setup

Follow the manual steps below.

## Manual Setup Steps

### 1. Enable Required APIs

```bash
gcloud services enable \
  container.googleapis.com \
  compute.googleapis.com \
  cloudresourcemanager.googleapis.com \
  artifactregistry.googleapis.com
```

### 2. Create GKE Cluster

**Development:**
```bash
gcloud container clusters create lendahand-dev \
  --project=your-project-id \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --num-nodes=2 \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=5 \
  --enable-autorepair \
  --enable-autoupgrade \
  --enable-ip-alias \
  --addons=HorizontalPodAutoscaling,HttpLoadBalancing
```

**Production:**
```bash
gcloud container clusters create lendahand-prod \
  --project=your-project-id \
  --zone=us-central1-a \
  --machine-type=e2-standard-4 \
  --num-nodes=3 \
  --enable-autoscaling \
  --min-nodes=2 \
  --max-nodes=10 \
  --enable-autorepair \
  --enable-autoupgrade \
  --enable-ip-alias \
  --addons=HorizontalPodAutoscaling,HttpLoadBalancing
```

### 3. Configure kubectl

```bash
gcloud container clusters get-credentials lendahand-dev \
  --zone=us-central1-a \
  --project=your-project-id
```

### 4. Create Service Account for GitHub Actions

```bash
# Development
SA_NAME="github-actions-dev"
gcloud iam service-accounts create $SA_NAME \
  --display-name="GitHub Actions Service Account for Development"

SA_EMAIL="$SA_NAME@your-project-id.iam.gserviceaccount.com"

# Grant permissions
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/container.admin"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/artifactregistry.admin"

# Create and download key
gcloud iam service-accounts keys create github-actions-dev-key.json \
  --iam-account=$SA_EMAIL
```

### 5. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

**For Development:**
- `GCP_SA_KEY_DEV`: Contents of `github-actions-dev-key.json`
- `GCP_PROJECT_ID_DEV`: Your GCP project ID
- `GKE_CLUSTER_NAME_DEV`: `lendahand-dev`
- `GKE_LOCATION_DEV`: `us-central1-a`

**For Production:**
- `GCP_SA_KEY_PROD`: Contents of production service account key
- `GCP_PROJECT_ID_PROD`: Your GCP project ID
- `GKE_CLUSTER_NAME_PROD`: `lendahand-prod`
- `GKE_LOCATION_PROD`: `us-central1-a`

### 6. Configure Container Registry

The workflows automatically push to both GitHub Container Registry (GHCR) and Google Container Registry (GCR).

To pull from GCR, ensure the service account has:
- `roles/storage.admin` (for GCR)
- `roles/artifactregistry.admin` (for Artifact Registry)

### 7. Create Namespaces

```bash
kubectl create namespace lendahand-dev
kubectl create namespace lendahand-prod
```

## Workflow Integration

The GitHub Actions workflows automatically:

1. Authenticate with Google Cloud using service account keys
2. Configure kubectl for GKE
3. Build and push Docker images to GCR
4. Deploy using Helm to the appropriate namespace

## Verification

### Test Cluster Connection

```bash
kubectl cluster-info
kubectl get nodes
```

### Test Deployment

Deploy a test pod:

```bash
kubectl run test-pod --image=nginx --namespace=lendahand-dev
kubectl get pods --namespace=lendahand-dev
```

## Monitoring and Logging

GKE clusters come with monitoring and logging enabled by default. Access them via:

- [Google Cloud Console](https://console.cloud.google.com)
- [GKE Dashboard](https://console.cloud.google.com/kubernetes)
- [Logs Explorer](https://console.cloud.google.com/logs)

## Cost Optimization

### Development Cluster

- Use smaller machine types (`e2-medium`)
- Enable auto-scaling with lower min/max nodes
- Consider using preemptible VMs for development

### Production Cluster

- Use appropriate machine types for workload
- Enable auto-scaling
- Monitor resource usage
- Consider committed use discounts for long-term use

## Security Best Practices

1. **Use separate service accounts** for dev and prod
2. **Limit permissions** - Grant only necessary roles
3. **Enable workload identity** (recommended for production)
4. **Enable network policies** for pod-to-pod communication
5. **Regularly rotate service account keys**
6. **Use private GKE clusters** for production
7. **Enable binary authorization** for production workloads

## Troubleshooting

### Authentication Issues

```bash
# Re-authenticate
gcloud auth login
gcloud auth application-default login

# Check service account permissions
gcloud projects get-iam-policy your-project-id
```

### Cluster Access Issues

```bash
# Get credentials again
gcloud container clusters get-credentials CLUSTER_NAME --zone=ZONE

# Check kubectl context
kubectl config current-context
kubectl config get-contexts
```

### Image Pull Errors

Ensure the service account has `roles/storage.admin` for GCR access.

### Deployment Issues

Check Helm deployment status:

```bash
helm list --namespace lendahand-dev
helm status lendahand --namespace lendahand-dev
kubectl get pods --namespace lendahand-dev
```

## Additional Resources

- [GKE Documentation](https://cloud.google.com/kubernetes-engine/docs)
- [GKE Best Practices](https://cloud.google.com/kubernetes-engine/docs/best-practices)
- [GitHub Actions GKE](https://github.com/google-github-actions/setup-gcloud)

