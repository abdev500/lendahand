#!/bin/bash

# Setup script for GitHub Actions tokens and authorization
# This script helps create and configure necessary tokens and secrets for GitHub Actions workflows

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_NAME="${GITHUB_REPOSITORY:-abdev500/lendahand}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS_FILE="${SCRIPT_DIR}/.github-secrets.env"

# Functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
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

check_command() {
    if command -v "$1" >/dev/null 2>&1; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

# Check prerequisites
print_header "Checking Prerequisites"

MISSING_TOOLS=0

if ! check_command "gh"; then
    print_warning "GitHub CLI (gh) is not installed. Installing instructions:"
    echo "  macOS: brew install gh"
    echo "  Linux: https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    echo "  Windows: https://github.com/cli/cli/blob/trunk/docs/install_windows.md"
    MISSING_TOOLS=1
fi

if ! check_command "gcloud"; then
    print_warning "Google Cloud SDK (gcloud) is not installed. Installing instructions:"
    echo "  https://cloud.google.com/sdk/docs/install"
    MISSING_TOOLS=1
fi

if ! check_command "jq"; then
    print_warning "jq is not installed (needed for JSON parsing). Installing instructions:"
    echo "  macOS: brew install jq"
    echo "  Linux: apt-get install jq or yum install jq"
    MISSING_TOOLS=1
fi

if [ $MISSING_TOOLS -eq 1 ]; then
    print_error "Please install missing tools and run this script again."
    exit 1
fi

# Check GitHub CLI authentication
print_header "Checking GitHub Authentication"

if gh auth status >/dev/null 2>&1; then
    GITHUB_USER=$(gh api user --jq .login)
    print_success "Authenticated as: $GITHUB_USER"
else
    print_error "Not authenticated with GitHub CLI"
    print_info "Authenticating with GitHub CLI..."
    if gh auth login; then
        GITHUB_USER=$(gh api user --jq .login)
        print_success "Authenticated as: $GITHUB_USER"
    else
        print_error "GitHub authentication failed"
        exit 1
    fi
fi

# Extract repository owner and name
REPO_OWNER=$(echo "$REPO_NAME" | cut -d'/' -f1)
REPO_NAME_ONLY=$(echo "$REPO_NAME" | cut -d'/' -f2)

# Check repository access
print_header "Checking Repository Access"

if gh repo view "$REPO_NAME" >/dev/null 2>&1; then
    print_success "Access to repository: $REPO_NAME"
else
    print_error "Cannot access repository: $REPO_NAME"
    print_info "Make sure you have admin access to the repository"
    exit 1
fi

# Setup GitHub Secrets
print_header "Setting up GitHub Secrets"

setup_github_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3

    if [ -z "$secret_value" ]; then
        print_warning "$secret_name: Not provided, skipping"
        return
    fi

    if gh secret set "$secret_name" --repo "$REPO_NAME" --body "$secret_value" >/dev/null 2>&1; then
        print_success "Set secret: $secret_name ($description)"
    else
        print_error "Failed to set secret: $secret_name"
    fi
}

# GCP Service Account Setup
print_header "Google Cloud Platform Setup"

setup_gcp_service_account() {
    local env=$1

    # Validate environment name
    if [ -z "$env" ]; then
        print_error "Environment name cannot be empty"
        return 1
    fi

    # Normalize to uppercase for consistency (secrets use uppercase)
    local env_upper=$(echo "$env" | tr '[:lower:]' '[:upper:]' | tr -d ' ')
    local env_lower=$(echo "$env_upper" | tr '[:upper:]' '[:lower:]')

    # Validate normalized environment name
    if [ -z "$env_upper" ] || [ -z "$env_lower" ]; then
        print_error "Invalid environment name: '$env' (must contain at least one alphanumeric character)"
        return 1
    fi

    # Clean environment name for GCP (service account names must match [a-zA-Z][a-zA-Z\d\-]*[a-zA-Z\d])
    # Remove any invalid characters and ensure it doesn't start/end with hyphen
    # First, remove all non-alphanumeric except hyphens
    env_lower_clean=$(echo "$env_lower" | sed 's/[^a-z0-9-]//g')
    # Remove leading and trailing hyphens
    env_lower_clean=$(echo "$env_lower_clean" | sed 's/^-\+//' | sed 's/-\+$//')
    # Replace multiple consecutive hyphens with single hyphen
    env_lower_clean=$(echo "$env_lower_clean" | sed 's/-\{2,\}/-/g')

    # Validate cleaned name
    if [ -z "$env_lower_clean" ]; then
        print_error "Environment name '$env' contains no valid alphanumeric characters for GCP service account"
        print_error "GCP service account names must contain at least one letter or number"
        return 1
    fi

    # Ensure it starts with a letter (GCP requirement)
    if ! echo "$env_lower_clean" | grep -q '^[a-z]'; then
        # If it doesn't start with a letter, prepend 'env'
        env_lower_clean="env-${env_lower_clean}"
        print_info "Service account name adjusted to start with a letter: $env_lower_clean"
    fi

    local project_id_var="GCP_PROJECT_ID_${env_upper}"
    local sa_key_var="GCP_SA_KEY_${env_upper}"

    print_info "Setting up GCP service account for '$env_upper' environment"

    # Get project ID
    read -p "Enter GCP Project ID for $env_upper: " project_id
    if [ -z "$project_id" ]; then
        print_warning "Project ID not provided, skipping GCP setup for $env_upper"
        return
    fi

    # Check if project exists
    if ! gcloud projects describe "$project_id" >/dev/null 2>&1; then
        print_error "Project $project_id does not exist or you don't have access"
        read -p "Do you want to create it? (y/n): " create_project
        if [ "$create_project" = "y" ]; then
            gcloud projects create "$project_id" --name="Lendahand $env_upper"
            print_success "Created project: $project_id"
        else
            print_warning "Skipping GCP setup for $env_upper"
            return
        fi
    fi

    # Set project
    gcloud config set project "$project_id"

    # Enable required APIs
    print_info "Enabling required GCP APIs..."
    gcloud services enable container.googleapis.com \
        containerregistry.googleapis.com \
        artifactregistry.googleapis.com \
        --project="$project_id"

    # Create service account (use cleaned lowercase for service account name)
    # GCP service account names must match: [a-zA-Z][a-zA-Z\d\-]*[a-zA-Z\d]
    SA_NAME="github-actions-${env_lower_clean}"
    SA_EMAIL="$SA_NAME@$project_id.iam.gserviceaccount.com"

    if gcloud iam service-accounts describe "$SA_EMAIL" --project="$project_id" >/dev/null 2>&1; then
        print_info "Service account already exists: $SA_EMAIL"
    else
        print_info "Creating service account: $SA_NAME"
        gcloud iam service-accounts create "$SA_NAME" \
            --display-name="GitHub Actions Service Account - $env_upper" \
            --project="$project_id"
        print_success "Created service account: $SA_EMAIL"
    fi

    # Grant necessary roles
    print_info "Granting IAM roles to service account..."
    gcloud projects add-iam-policy-binding "$project_id" \
        --member="serviceAccount:$SA_EMAIL" \
        --role="roles/container.developer" \
        --condition=None

    gcloud projects add-iam-policy-binding "$project_id" \
        --member="serviceAccount:$SA_EMAIL" \
        --role="roles/storage.admin" \
        --condition=None

    gcloud projects add-iam-policy-binding "$project_id" \
        --role="roles/artifactregistry.writer" \
        --member="serviceAccount:$SA_EMAIL" \
        --condition=None

    print_success "Granted IAM roles to service account"

    # Create and download key
    KEY_FILE="${SCRIPT_DIR}/.${SA_NAME}-key.json"
    print_info "Creating service account key..."

    if [ -f "$KEY_FILE" ]; then
        read -p "Key file already exists. Regenerate? (y/n): " regenerate
        if [ "$regenerate" != "y" ]; then
            print_info "Using existing key file"
        else
            gcloud iam service-accounts keys create "$KEY_FILE" \
                --iam-account="$SA_EMAIL" \
                --project="$project_id"
            print_success "Created new service account key"
        fi
    else
        gcloud iam service-accounts keys create "$KEY_FILE" \
            --iam-account="$SA_EMAIL" \
            --project="$project_id"
        print_success "Created service account key"
    fi

    # Read key content
    SA_KEY=$(cat "$KEY_FILE")

    # Set GitHub secrets
    print_info "Setting GitHub secrets for $env_upper..."
    setup_github_secret "${project_id_var}" "$project_id" "GCP Project ID for $env_upper"
    setup_github_secret "${sa_key_var}" "$SA_KEY" "GCP Service Account Key for $env_upper"

    # Clean up key file (optional, commented out for safety)
    # rm -f "$KEY_FILE"
    print_warning "Service account key saved at: $KEY_FILE"
    print_warning "Keep this file secure and do not commit it to git!"

    # GKE Cluster information
    read -p "Enter GKE cluster name for $env_upper (or press Enter to skip): " cluster_name
    if [ -n "$cluster_name" ]; then
        read -p "Enter GKE cluster location/region for $env_upper (e.g., us-central1-a): " cluster_location
        if [ -n "$cluster_location" ]; then
            setup_github_secret "GKE_CLUSTER_NAME_${env_upper}" "$cluster_name" "GKE Cluster Name for $env_upper"
            setup_github_secret "GKE_LOCATION_${env_upper}" "$cluster_location" "GKE Cluster Location for $env_upper"
        fi
    fi

    # Return success
    return 0
}

# Setup for environments
ENVIRONMENTS_SETUP=()

read -p "Do you want to set up GCP service accounts? (y/n): " setup_gcp
if [ "$setup_gcp" = "y" ]; then
    print_info "You can set up any number of environments (e.g., dev, prod, staging, test)"

    while true; do
        read -p "Enter environment name (or press Enter to finish): " env_name
        if [ -z "$env_name" ]; then
            break
        fi

        # Normalize environment name (uppercase for consistency)
        env_name_normalized=$(echo "$env_name" | tr '[:lower:]' '[:upper:]' | tr -d ' ')

        if [ -z "$env_name_normalized" ]; then
            print_warning "Environment name cannot be empty or contain only special characters"
            continue
        fi

        # Validate that it contains at least one alphanumeric character
        if ! echo "$env_name_normalized" | grep -q '[A-Z0-9]'; then
            print_warning "Environment name must contain at least one alphanumeric character"
            continue
        fi

        print_info "Setting up environment: $env_name_normalized"
        if setup_gcp_service_account "$env_name_normalized"; then
            ENVIRONMENTS_SETUP+=("$env_name_normalized")
        else
            print_error "Failed to set up environment: $env_name_normalized"
        fi

        read -p "Set up another environment? (y/n): " another
        if [ "$another" != "y" ]; then
            break
        fi
    done
fi

# Optional secrets
print_header "Optional Secrets"

read -p "Enter REACT_APP_API_URL (or press Enter to skip): " react_api_url
if [ -n "$react_api_url" ]; then
    setup_github_secret "REACT_APP_API_URL" "$react_api_url" "Frontend API URL"
fi

# Verify secrets
print_header "Verifying GitHub Secrets"

print_info "Current secrets in repository:"
gh secret list --repo "$REPO_NAME"

# Summary
print_header "Setup Summary"

print_success "GitHub Actions setup complete!"
echo ""
if [ ${#ENVIRONMENTS_SETUP[@]} -gt 0 ]; then
    echo "Required secrets for configured environments:"
    for env in "${ENVIRONMENTS_SETUP[@]}"; do
        env_lower=$(echo "$env" | tr '[:upper:]' '[:lower:]')
        echo "  Environment: $env"
        echo "    - GCP_SA_KEY_${env}"
        echo "    - GCP_PROJECT_ID_${env}"
        echo "    - GKE_CLUSTER_NAME_${env} (if cluster configured)"
        echo "    - GKE_LOCATION_${env} (if cluster configured)"
    done
else
    echo "No environments were configured."
    echo ""
    echo "To set up an environment, run this script again and specify environment names"
    echo "(e.g., dev, prod, staging, test, etc.)"
fi
echo "  - REACT_APP_API_URL (optional)"
echo ""
print_info "Note: GITHUB_TOKEN is automatically provided by GitHub Actions"
echo ""
print_info "The environment names will be selected by your CI/CD workflow based on branch name"
echo "(e.g., 'develop' branch → DEV secrets, 'main' branch → PROD secrets)"
echo ""
print_warning "Make sure to:"
echo "  1. Store service account key files securely"
echo "  2. Do not commit key files to git"
echo "  3. Set up GitHub Environments if needed (matching your environment names)"
echo "  4. Configure branch protection rules for production environments"
echo ""

# Create .gitignore entry for key files
if ! grep -q ".github-secrets.env" "${SCRIPT_DIR}/../.gitignore" 2>/dev/null; then
    echo "" >> "${SCRIPT_DIR}/../.gitignore"
    echo "# GitHub Actions setup files" >> "${SCRIPT_DIR}/../.gitignore"
    echo "devops/.github-secrets.env" >> "${SCRIPT_DIR}/../.gitignore"
    echo "devops/.*-key.json" >> "${SCRIPT_DIR}/../.gitignore"
    print_success "Added key files to .gitignore"
fi

print_success "Setup complete!"
