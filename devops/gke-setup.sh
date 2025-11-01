#!/bin/bash

# GKE Setup Script for Lend a Hand Platform
# This script helps set up a GKE cluster and configure it for deployment

set -e

ENVIRONMENT=${1:-dev}
PROJECT_ID=${2:-""}
CLUSTER_NAME=${3:-"lendahand-${ENVIRONMENT}"}
LOCATION=${4:-"us-central1-a"}
MACHINE_TYPE=${5:-"e2-medium"}
NUM_NODES=${6:-2}
MIN_NODES=${7:-1}
MAX_NODES=${8:-5}

if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID is required"
  echo "Usage: $0 [ENVIRONMENT] [PROJECT_ID] [CLUSTER_NAME] [LOCATION] [MACHINE_TYPE] [NUM_NODES] [MIN_NODES] [MAX_NODES]"
  exit 1
fi

echo "=========================================="
echo "GKE Cluster Setup for Lend a Hand"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Project ID: $PROJECT_ID"
echo "Cluster Name: $CLUSTER_NAME"
echo "Location: $LOCATION"
echo "Machine Type: $MACHINE_TYPE"
echo "Initial Nodes: $NUM_NODES"
echo "Auto-scaling: $MIN_NODES - $MAX_NODES nodes"
echo "=========================================="

# Authenticate with Google Cloud
echo "Authenticating with Google Cloud..."
gcloud auth login

# Set the project
echo "Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "Enabling required Google Cloud APIs..."
gcloud services enable \
  container.googleapis.com \
  compute.googleapis.com \
  cloudresourcemanager.googleapis.com \
  artifactregistry.googleapis.com \
  --project=$PROJECT_ID

# Check if cluster exists
if gcloud container clusters describe $CLUSTER_NAME \
  --zone=$LOCATION \
  --project=$PROJECT_ID &>/dev/null; then
  echo "Cluster $CLUSTER_NAME already exists in $LOCATION"
  read -p "Do you want to delete and recreate it? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Deleting existing cluster..."
    gcloud container clusters delete $CLUSTER_NAME \
      --zone=$LOCATION \
      --project=$PROJECT_ID \
      --quiet
  else
    echo "Using existing cluster"
    gcloud container clusters get-credentials $CLUSTER_NAME \
      --zone=$LOCATION \
      --project=$PROJECT_ID
    exit 0
  fi
fi

# Create the cluster
echo "Creating GKE cluster..."
gcloud container clusters create $CLUSTER_NAME \
  --project=$PROJECT_ID \
  --zone=$LOCATION \
  --machine-type=$MACHINE_TYPE \
  --num-nodes=$NUM_NODES \
  --enable-autoscaling \
  --min-nodes=$MIN_NODES \
  --max-nodes=$MAX_NODES \
  --enable-autorepair \
  --enable-autoupgrade \
  --enable-ip-alias \
  --network=default \
  --subnetwork=default \
  --addons=HorizontalPodAutoscaling,HttpLoadBalancing \
  --release-channel=regular \
  --logging=SYSTEM,WORKLOAD \
  --monitoring=SYSTEM

# Configure kubectl
echo "Configuring kubectl..."
gcloud container clusters get-credentials $CLUSTER_NAME \
  --zone=$LOCATION \
  --project=$PROJECT_ID

# Verify cluster connection
echo "Verifying cluster connection..."
kubectl cluster-info
kubectl get nodes

# Create namespace
echo "Creating namespace..."
kubectl create namespace lendahand-$ENVIRONMENT --dry-run=client -o yaml | kubectl apply -f -

# Create service account for GitHub Actions
echo "Creating service account for GitHub Actions..."
SA_NAME="github-actions-$ENVIRONMENT"
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts create $SA_NAME \
  --project=$PROJECT_ID \
  --display-name="GitHub Actions Service Account for $ENVIRONMENT" \
  || echo "Service account may already exist"

# Grant necessary permissions
echo "Granting permissions to service account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/container.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/artifactregistry.admin"

# Create and download key
echo "Creating service account key..."
KEY_FILE="$SA_NAME-key.json"
gcloud iam service-accounts keys create $KEY_FILE \
  --iam-account=$SA_EMAIL \
  --project=$PROJECT_ID

echo ""
echo "=========================================="
echo "GKE Cluster Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Add the following secrets to GitHub:"
echo "   - GCP_SA_KEY_${ENVIRONMENT^^}: Contents of $KEY_FILE"
echo "   - GCP_PROJECT_ID_${ENVIRONMENT^^}: $PROJECT_ID"
echo "   - GKE_CLUSTER_NAME_${ENVIRONMENT^^}: $CLUSTER_NAME"
echo "   - GKE_LOCATION_${ENVIRONMENT^^}: $LOCATION"
echo ""
echo "2. Store the key file securely (it will be needed for GitHub Actions)"
echo "3. Remove the key file from this directory after adding to GitHub secrets"
echo ""
echo "Service Account: $SA_EMAIL"
echo "Key File: $KEY_FILE"
echo "=========================================="

