#!/bin/bash

# Configure Google Cloud and create all needed access resources for a GKE cluster
# Usage: ./configure-gcp-cluster.sh <cluster-name> [options]
#
# Options:
#   --project-id PROJECT_ID      GCP Project ID (required if not in gcloud config)
#   --location LOCATION          Cluster location (zone or region, default: us-central1-a)
#   --environment ENV            Environment name (e.g., dev, prod, staging - used for resource naming)
#   --github-repo REPO           GitHub repository (e.g., owner/repo)
#   --skip-cluster               Skip cluster creation, only set up access resources
#   --skip-github                Skip GitHub secrets setup
#   --help                       Show this help message

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Defaults
CLUSTER_NAME=""
PROJECT_ID=""
LOCATION="us-central1-a"
ENVIRONMENT=""
GITHUB_REPO=""
SKIP_CLUSTER=false
SKIP_GITHUB=false

# Functions
print_header() {
    echo -e "\n${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

show_help() {
    cat << EOF
Configure Google Cloud and create all needed access resources for a GKE cluster

Usage: $0 <cluster-name> [options]

Arguments:
  cluster-name                 Name of the GKE cluster

Options:
  --project-id PROJECT_ID      GCP Project ID (required if not in gcloud config)
  --location LOCATION          Cluster location (zone or region, default: us-central1-a)
  --environment ENV           Environment name (e.g., dev, prod, staging - used for resource naming)
  --github-repo REPO          GitHub repository (e.g., owner/repo)
  --skip-cluster               Skip cluster creation, only set up access resources
  --skip-github                Skip GitHub secrets setup
  --help                       Show this help message

Examples:
  $0 my-cluster --project-id my-project-id --environment dev
  $0 my-cluster --project-id my-project-id --environment staging --location us-central1
  $0 my-cluster --project-id my-project-id --environment prod --github-repo owner/repo
EOF
}

# Parse arguments
if [ $# -eq 0 ]; then
    show_help
    exit 1
fi

CLUSTER_NAME=$1
shift

while [[ $# -gt 0 ]]; do
    case $1 in
        --project-id)
            PROJECT_ID="$2"
            shift 2
            ;;
        --location)
            LOCATION="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --github-repo)
            GITHUB_REPO="$2"
            shift 2
            ;;
        --skip-cluster)
            SKIP_CLUSTER=true
            shift
            ;;
        --skip-github)
            SKIP_GITHUB=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate cluster name
if [ -z "$CLUSTER_NAME" ]; then
    print_error "Cluster name is required"
    show_help
    exit 1
fi

# Set environment name - use cluster name if not specified
if [ -z "$ENVIRONMENT" ]; then
    # Extract environment from cluster name or use cluster name itself
    # This allows flexibility for any environment name
    ENVIRONMENT=$(echo "$CLUSTER_NAME" | sed 's/.*-//' || echo "$CLUSTER_NAME")
    print_info "Using environment name: $ENVIRONMENT (from cluster name)"
fi

# Normalize environment name (lowercase, no spaces)
ENVIRONMENT=$(echo "$ENVIRONMENT" | tr '[:upper:]' '[:lower:]' | tr -d ' ')

if [ -z "$ENVIRONMENT" ]; then
    print_error "Environment name cannot be empty"
    exit 1
fi

print_header "GCP Cluster Configuration"
echo "Cluster Name: $CLUSTER_NAME"
echo "Environment: $ENVIRONMENT"
echo "Location: $LOCATION"
echo ""

# Check prerequisites
print_header "Checking Prerequisites"

check_command() {
    if command -v "$1" >/dev/null 2>&1; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

MISSING_TOOLS=0

if ! check_command "gcloud"; then
    print_warning "Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    MISSING_TOOLS=1
fi

if ! check_command "kubectl"; then
    print_warning "Install kubectl: https://kubernetes.io/docs/tasks/tools/"
    MISSING_TOOLS=1
fi

if [ "$SKIP_GITHUB" = false ] && ! check_command "gh"; then
    print_warning "GitHub CLI (gh) is optional but recommended for GitHub secrets setup"
    print_info "Install: brew install gh (macOS) or https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
fi

if [ $MISSING_TOOLS -eq 1 ]; then
    print_error "Please install missing tools and run this script again"
    exit 1
fi

# Authenticate with Google Cloud
print_header "Google Cloud Authentication"

if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    print_info "Authenticating with Google Cloud..."
    gcloud auth login
else
    ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1)
    print_success "Already authenticated as: $ACTIVE_ACCOUNT"
fi

# Set application default credentials
print_info "Setting application default credentials..."
gcloud auth application-default login --no-launch-browser 2>/dev/null || true

# Get or set project ID
print_header "Configuring GCP Project"

if [ -z "$PROJECT_ID" ]; then
    CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
    if [ -n "$CURRENT_PROJECT" ]; then
        read -p "Use current project '$CURRENT_PROJECT'? (y/n): " use_current
        if [ "$use_current" = "y" ]; then
            PROJECT_ID="$CURRENT_PROJECT"
        else
            read -p "Enter GCP Project ID: " PROJECT_ID
        fi
    else
        read -p "Enter GCP Project ID: " PROJECT_ID
    fi
fi

if [ -z "$PROJECT_ID" ]; then
    print_error "Project ID is required"
    exit 1
fi

print_info "Setting project to: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

# Verify project access
if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
    print_error "Cannot access project: $PROJECT_ID"
    print_info "Make sure you have access or create the project first"
    read -p "Do you want to create this project? (y/n): " create_project
    if [ "$create_project" = "y" ]; then
        gcloud projects create "$PROJECT_ID" --name="Lendahand $ENVIRONMENT"
        print_success "Created project: $PROJECT_ID"
    else
        exit 1
    fi
fi

print_success "Project configured: $PROJECT_ID"

# Enable required APIs
print_header "Enabling Required GCP APIs"

print_info "Enabling GCP APIs (this may take a few minutes)..."
gcloud services enable \
    container.googleapis.com \
    compute.googleapis.com \
    cloudresourcemanager.googleapis.com \
    containerregistry.googleapis.com \
    artifactregistry.googleapis.com \
    iam.googleapis.com \
    --project="$PROJECT_ID"

print_success "All required APIs enabled"

# Create or verify network resources
print_header "Configuring Network Resources"

NETWORK_NAME="default"
SUBNET_NAME="default"

# Check if custom network exists, otherwise use default
if gcloud compute networks describe "$NETWORK_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
    print_success "Using network: $NETWORK_NAME"
else
    print_info "Using default network (will be created if needed)"
fi

# Create GKE cluster
if [ "$SKIP_CLUSTER" = false ]; then
    print_header "Creating GKE Cluster"

    # Check if cluster already exists
    if gcloud container clusters describe "$CLUSTER_NAME" \
        --location="$LOCATION" \
        --project="$PROJECT_ID" >/dev/null 2>&1; then
        print_warning "Cluster '$CLUSTER_NAME' already exists in '$LOCATION'"
        read -p "Do you want to use the existing cluster? (y/n): " use_existing
        if [ "$use_existing" != "y" ]; then
            print_error "Cluster exists. Delete it first or use --skip-cluster to only configure access"
            exit 1
        fi
        print_info "Using existing cluster"
    else
        print_info "Creating GKE cluster: $CLUSTER_NAME"
        print_info "This may take 10-15 minutes..."

        # Default cluster configuration (auto-sized based on environment name)
        # Environments with "prod" in the name get larger nodes, others get standard size
        if [[ "$ENVIRONMENT" == *"prod"* ]] || [[ "$ENVIRONMENT" == *"production"* ]]; then
            MACHINE_TYPE="e2-standard-4"
            NUM_NODES=3
            MIN_NODES=2
            MAX_NODES=10
        else
            # Standard configuration for non-production environments (dev, staging, test, etc.)
            MACHINE_TYPE="e2-medium"
            NUM_NODES=2
            MIN_NODES=1
            MAX_NODES=5
        fi

        print_info "Cluster configuration:"
        print_info "  Machine Type: $MACHINE_TYPE"
        print_info "  Nodes: $NUM_NODES (min: $MIN_NODES, max: $MAX_NODES)"

        gcloud container clusters create "$CLUSTER_NAME" \
            --project="$PROJECT_ID" \
            --location="$LOCATION" \
            --machine-type="$MACHINE_TYPE" \
            --num-nodes="$NUM_NODES" \
            --enable-autoscaling \
            --min-nodes="$MIN_NODES" \
            --max-nodes="$MAX_NODES" \
            --enable-autorepair \
            --enable-autoupgrade \
            --enable-ip-alias \
            --network="$NETWORK_NAME" \
            --subnetwork="$SUBNET_NAME" \
            --addons=HorizontalPodAutoscaling,HttpLoadBalancing \
            --release-channel=regular \
            --logging=SYSTEM,WORKLOAD \
            --monitoring=SYSTEM \
            --enable-network-policy

        print_success "Cluster created: $CLUSTER_NAME"
    fi

    # Configure kubectl
    print_info "Configuring kubectl credentials..."
    gcloud container clusters get-credentials "$CLUSTER_NAME" \
        --location="$LOCATION" \
        --project="$PROJECT_ID"

    # Verify cluster connection
    print_info "Verifying cluster connection..."
    kubectl cluster-info >/dev/null 2>&1 && print_success "Cluster connection verified" || print_warning "Could not verify cluster connection"

    # Create namespace
    NAMESPACE="lendahand-$ENVIRONMENT"
    print_info "Creating namespace: $NAMESPACE"
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    print_success "Namespace ready: $NAMESPACE"
fi

# Create service account for GitHub Actions
print_header "Creating Service Account for GitHub Actions"

SA_NAME="github-actions-$ENVIRONMENT"
SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
    print_warning "Service account already exists: $SA_EMAIL"
    read -p "Do you want to recreate it? (y/n): " recreate_sa
    if [ "$recreate_sa" = "y" ]; then
        print_info "Deleting existing service account..."
        gcloud iam service-accounts delete "$SA_EMAIL" --project="$PROJECT_ID" --quiet || true
        gcloud iam service-accounts create "$SA_NAME" \
            --project="$PROJECT_ID" \
            --display-name="GitHub Actions Service Account - $ENVIRONMENT"
        print_success "Service account recreated"
    else
        print_info "Using existing service account"
    fi
else
    print_info "Creating service account: $SA_NAME"
    gcloud iam service-accounts create "$SA_NAME" \
        --project="$PROJECT_ID" \
        --display-name="GitHub Actions Service Account - $ENVIRONMENT"
    print_success "Service account created: $SA_EMAIL"
fi

# Grant IAM roles
print_header "Granting IAM Roles"

print_info "Granting necessary IAM roles to service account..."

ROLES=(
    "roles/container.developer"
    "roles/storage.admin"
    "roles/artifactregistry.writer"
    "roles/iam.serviceAccountUser"
)

for ROLE in "${ROLES[@]}"; do
    if gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SA_EMAIL" \
        --role="$ROLE" \
        --condition=None \
        --quiet >/dev/null 2>&1; then
        print_success "Granted role: $ROLE"
    else
        print_warning "Could not grant role: $ROLE (may already be granted)"
    fi
done

# Grant cluster-specific permissions
if [ "$SKIP_CLUSTER" = false ]; then
    print_info "Granting cluster-specific permissions..."

    # Get cluster service account email
    CLUSTER_SA_EMAIL=$(gcloud container clusters describe "$CLUSTER_NAME" \
        --location="$LOCATION" \
        --project="$PROJECT_ID" \
        --format="value(serviceAccount)" 2>/dev/null || echo "")

    if [ -n "$CLUSTER_SA_EMAIL" ]; then
        gcloud projects add-iam-policy-binding "$PROJECT_ID" \
            --member="serviceAccount:$SA_EMAIL" \
            --role="roles/container.clusterAdmin" \
            --condition=None \
            --quiet >/dev/null 2>&1 || true
    fi
fi

# Create service account key
print_header "Creating Service Account Key"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEY_FILE="${SCRIPT_DIR}/.${SA_NAME}-key.json"

if [ -f "$KEY_FILE" ]; then
    read -p "Key file already exists. Regenerate? (y/n): " regenerate_key
    if [ "$regenerate_key" = "y" ]; then
        print_info "Creating new service account key..."
        gcloud iam service-accounts keys create "$KEY_FILE" \
            --iam-account="$SA_EMAIL" \
            --project="$PROJECT_ID"
        print_success "New key created: $KEY_FILE"
    else
        print_info "Using existing key file"
    fi
else
    print_info "Creating service account key..."
    gcloud iam service-accounts keys create "$KEY_FILE" \
        --iam-account="$SA_EMAIL" \
        --project="$PROJECT_ID"
    print_success "Key created: $KEY_FILE"
fi

# Read key content
SA_KEY=$(cat "$KEY_FILE")

# Setup GitHub secrets
if [ "$SKIP_GITHUB" = false ]; then
    print_header "Setting up GitHub Secrets"

    if ! command -v gh >/dev/null 2>&1; then
        print_warning "GitHub CLI (gh) not installed, skipping GitHub secrets setup"
        print_info "Install with: brew install gh (macOS)"
        SKIP_GITHUB=true
    elif ! gh auth status >/dev/null 2>&1; then
        print_warning "GitHub CLI not authenticated, skipping GitHub secrets setup"
        print_info "Authenticate with: gh auth login"
        SKIP_GITHUB=true
    else
        if [ -z "$GITHUB_REPO" ]; then
            # Try to get repo from git remote
            if [ -d "$SCRIPT_DIR/../.git" ]; then
                GIT_REMOTE=$(cd "$SCRIPT_DIR/.." && git remote get-url origin 2>/dev/null || echo "")
                if [[ "$GIT_REMOTE" =~ github.com[:/]([^/]+/[^/]+)\.git ]]; then
                    GITHUB_REPO="${BASH_REMATCH[1]}"
                fi
            fi

            if [ -z "$GITHUB_REPO" ]; then
                read -p "Enter GitHub repository (owner/repo): " GITHUB_REPO
            fi
        fi

        if [ -n "$GITHUB_REPO" ]; then
            print_info "Setting up GitHub secrets for: $GITHUB_REPO"

            # Set secrets
            setup_github_secret() {
                local secret_name=$1
                local secret_value=$2
                local description=$3

                if gh secret set "$secret_name" --repo "$GITHUB_REPO" --body "$secret_value" >/dev/null 2>&1; then
                    print_success "Set secret: $secret_name ($description)"
                else
                    print_warning "Failed to set secret: $secret_name (may already exist)"
                fi
            }

            # Use environment name in uppercase for secret names
            ENV_UPPER=$(echo "$ENVIRONMENT" | tr '[:lower:]' '[:upper:]')

            setup_github_secret "GCP_SA_KEY_${ENV_UPPER}" "$SA_KEY" "GCP Service Account Key for $ENVIRONMENT"
            setup_github_secret "GCP_PROJECT_ID_${ENV_UPPER}" "$PROJECT_ID" "GCP Project ID for $ENVIRONMENT"
            setup_github_secret "GKE_CLUSTER_NAME_${ENV_UPPER}" "$CLUSTER_NAME" "GKE Cluster Name for $ENVIRONMENT"
            setup_github_secret "GKE_LOCATION_${ENV_UPPER}" "$LOCATION" "GKE Cluster Location for $ENVIRONMENT"

            print_success "GitHub secrets configured"
        else
            print_warning "GitHub repository not specified, skipping GitHub secrets setup"
        fi
    fi
fi

# Summary
print_header "Configuration Complete"

echo -e "${GREEN}Summary:${NC}"
echo "  Cluster Name: $CLUSTER_NAME"
echo "  Environment: $ENVIRONMENT"
echo "  Location: $LOCATION"
echo "  Project ID: $PROJECT_ID"
echo "  Service Account: $SA_EMAIL"
echo "  Key File: $KEY_FILE"
if [ -n "$GITHUB_REPO" ] && [ "$SKIP_GITHUB" = false ]; then
    echo "  GitHub Repo: $GITHUB_REPO"
fi
echo ""

print_warning "Security Notes:"
echo "  1. Keep the key file ($KEY_FILE) secure"
echo "  2. Do not commit the key file to git"
echo "  3. Delete the key file after adding to GitHub secrets (if needed)"
echo "  4. Rotate keys regularly"
echo ""

if [ "$SKIP_CLUSTER" = false ]; then
    print_info "Next Steps:"
    echo "  1. Verify cluster is running: kubectl get nodes"
    echo "  2. Test deployment: kubectl get pods -n $NAMESPACE"
    echo "  3. Configure ingress and load balancer as needed"
    echo ""
fi

if [ "$SKIP_GITHUB" = true ] || [ -z "$GITHUB_REPO" ]; then
    ENV_UPPER=$(echo "$ENVIRONMENT" | tr '[:lower:]' '[:upper:]')
    print_info "To set up GitHub secrets manually:"
    echo "  1. Go to your GitHub repository → Settings → Secrets and variables → Actions"
    echo "  2. Add the following secrets:"
    echo "     - GCP_SA_KEY_${ENV_UPPER}: Contents of $KEY_FILE"
    echo "     - GCP_PROJECT_ID_${ENV_UPPER}: $PROJECT_ID"
    echo "     - GKE_CLUSTER_NAME_${ENV_UPPER}: $CLUSTER_NAME"
    echo "     - GKE_LOCATION_${ENV_UPPER}: $LOCATION"
    echo ""
    echo "  Note: The environment name '${ENV_UPPER}' will be selected by your CI/CD workflow"
    echo "        based on the branch name (e.g., 'develop' → DEV, 'main' → PROD)"
    echo ""
fi

print_success "All resources configured successfully!"
