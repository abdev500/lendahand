# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD automation.

## Workflows

### 1. CI (`ci.yml`)

Continuous Integration workflow that runs on pull requests and pushes.

**Triggers:**
- Pull requests to `main` or `develop`
- Pushes to `main`, `develop`, or `feature/*` branches

**Jobs:**
- **lint-backend**: Lint Python code with flake8, black, and isort
- **lint-frontend**: Lint JavaScript/TypeScript code with ESLint
- **test-backend**: Run Django tests with PostgreSQL service
- **test-frontend**: Run React tests (if configured)

### 2. CD (`cd.yml`)

Continuous Deployment workflow that builds and deploys Docker images.

**Triggers:**
- Pushes to `main` or `develop` branches
- Tag pushes (`v*`)

**Jobs:**
- **build-backend**: Build and push Django backend Docker image
- **build-frontend**: Build and push React frontend Docker image
- **deploy-dev**: Deploy to development environment (on `develop` branch)
- **deploy-prod**: Deploy to production environment (on `main` branch)

**Image Tags:**
- Branch name (e.g., `main`, `develop`)
- Commit SHA (e.g., `main-abc123`)
- Semantic version (if tagged)
- Latest (for main branch)

### 3. Release (`release.yml`)

Release workflow for creating production releases.

**Triggers:**
- Tag pushes matching `v*.*.*` (e.g., `v1.0.0`)

**Jobs:**
- **build-and-push**: Build and push versioned Docker images
- **deploy-release**: Deploy tagged release to production
- **Create GitHub Release**: Create release notes and GitHub release

### 4. Helm Lint (`helm-lint.yml`)

Helm chart validation workflow.

**Triggers:**
- Pull requests affecting `devops/**`
- Pushes to `main` or `develop` with changes to `devops/**`

**Jobs:**
- **lint**: Lint Helm charts and validate templates

## Required Secrets

Configure these secrets in your GitHub repository settings:

### For Google Kubernetes Engine (GKE) Deployment

**Workload Identity Federation (Used by infra-gke.yml):**

**Production Environment:**
- `WIF_PROVIDER`: Workload Identity Provider identifier (e.g., `projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider`)
- `WIF_SERVICE_ACCOUNT`: Google Cloud service account email (e.g., `github-actions@test-donate-472114.iam.gserviceaccount.com`)

**Note:** Workload Identity Federation eliminates the need for service account keys and is more secure.

**Setup Instructions:**
1. Create a Workload Identity Pool in Google Cloud:
   ```bash
   gcloud iam workload-identity-pools create github-pool \
     --project="test-donate-472114" \
     --location="global" \
     --display-name="GitHub Actions Pool"
   ```

2. Create a Workload Identity Provider linked to GitHub:
   ```bash
   gcloud iam workload-identity-pools providers create-oidc github-provider \
     --project="test-donate-472114" \
     --location="global" \
     --workload-identity-pool="github-pool" \
     --display-name="GitHub Provider" \
     --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
     --issuer-uri="https://token.actions.githubusercontent.com"
   ```

3. Grant the service account necessary permissions and allow impersonation:
   ```bash
   gcloud iam service-accounts add-iam-policy-binding github-actions@test-donate-472114.iam.gserviceaccount.com \
     --project="test-donate-472114" \
     --role="roles/iam.workloadIdentityUser" \
     --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/abdev500/lendahand"
   ```

4. Configure the secrets `WIF_PROVIDER` and `WIF_SERVICE_ACCOUNT` in GitHub repository settings.

**Development Environment (if needed):**
- `GCP_SA_KEY_DEV`: Google Cloud service account key JSON (for development) - Optional, can also use WIF
- `GCP_PROJECT_ID_DEV`: Google Cloud project ID (for development)
- `GKE_CLUSTER_NAME_DEV`: GKE cluster name (e.g., `lendahand-dev`)
- `GKE_LOCATION_DEV`: GKE cluster location (e.g., `us-central1-a`)

**Stripe Keys (Used by cd.yml):**
- `STRIPE_SECRET_KEY`: Stripe secret API key
- `STRIPE_PUBLISHABLE_KEY`: Stripe publishable API key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret

These secrets are passed to the Helm deployment via `--set` flags in the CD workflow.

### For Build

- `REACT_APP_API_URL`: Frontend API URL (optional, has defaults)
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions (for package registry)

## Environment Configuration

Configure environment-specific settings in GitHub Environments:

### Development Environment
- URL: `https://dev.lendahand.me`
- Protection rules: Optional
- Secrets: `KUBECONFIG_DEV`

### Production Environment
- URL: `https://lendahand.me`
- Protection rules: **Recommended** (require approval)
- Secrets: `KUBECONFIG_PROD`

## Usage

### Automatic Deployment

1. **Development**: Push to `develop` branch
   - Automatically builds images
   - Deploys to development environment

2. **Production**: Push to `main` branch
   - Automatically builds images
   - Deploys to production environment

3. **Release**: Create and push a tag
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
   - Builds versioned images
   - Deploys to production
   - Creates GitHub release

### Manual Deployment

You can also trigger workflows manually from the Actions tab in GitHub.

## Image Registry

Images are pushed to both registries:

**GitHub Container Registry (GHCR):**
- `ghcr.io/abdev500/lendahand-backend:latest`
- `ghcr.io/abdev500/lendahand-frontend:latest`

**Google Container Registry (GCR):**
- `gcr.io/PROJECT_ID/lendahand-backend:latest`
- `gcr.io/PROJECT_ID/lendahand-frontend:latest`

## Kubernetes Deployment

The workflows use Helm to deploy to Kubernetes:

```bash
helm upgrade --install lendahand ./devops/lendahand \
  --namespace lendahand-prod \
  --create-namespace \
  --values devops/lendahand/values-prod.yaml \
  --set backend.image.tag=<commit-sha> \
  --set frontend.image.tag=<commit-sha>
```

## Troubleshooting

### Build Failures

1. Check build logs in GitHub Actions
2. Verify Dockerfiles are correct
3. Check for dependency issues

### Deployment Failures

1. Verify Kubernetes credentials (`KUBECONFIG_*` secrets)
2. Check Helm chart values
3. Verify image tags exist in registry
4. Check Kubernetes cluster resources

### Accessing Logs

View workflow runs in the GitHub Actions tab. Each step shows detailed logs.
