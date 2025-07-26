# Cloudflare Workers GitHub Actions Bundle

Reusable GitHub Actions workflows and scripts for deploying Cloudflare Workers applications, extracted from the heyarma-frontend project.

## What's Included

- **GitHub Actions workflows** for multi-environment deployment (dev, qa, prod)
- **Tag management scripts** for version control and deployment
- **Dependabot configuration** for automated dependency updates
- **Simple setup** with clear documentation

## Quick Start

### 1. Authenticate with Cloudflare

```bash
# Authenticate with Cloudflare (one time)
wrangler login

# Verify your account
wrangler whoami
```

### 2. Create Configuration

**Create `worker-config.json`:**
```json
{
  "serviceName": "my-service",
  "workersDomain": "my-domain.workers.dev",
  "accountId": "your-cloudflare-account-id"
}
```

### 3. Wrangler Config Files

The `npm run init` script can create these automatically, or you can create them manually:

<details>
<summary>Manual creation (click to expand)</summary>

Create `wrangler.dev.toml`:
```toml
name = "my-service-dev"
main = "dist/index.js"
compatibility_date = "2025-01-01"
```

Create `wrangler.qa.toml`:
```toml
name = "my-service-qa" 
main = "dist/index.js"
compatibility_date = "2025-01-01"
```

Create `wrangler.prod.toml`:
```toml
name = "my-service-prod"  # Internal worker name includes -prod
main = "dist/index.js"
compatibility_date = "2025-01-01"
# Note: Production URL will be clean: https://my-service.domain.workers.dev
```

</details>

### 4. Copy Bundle Files

```bash
# Copy workflows and scripts to your Cloudflare Workers project
cp -r .github/ /path/to/your/project/
cp -r scripts/ /path/to/your/project/
cd /path/to/your/project
```

### 5. Update Your Project

**All remaining steps are run from your Cloudflare Workers project directory.**

Add these scripts to your `package.json`:
```json
{
  "scripts": {
    "build": "your-build-command",
    "build:dev": "npm run build",
    "build:qa": "npm run build",
    "build:prod": "npm run build",
    "init": "node scripts/init-environment.js",
    "tag:create": "node scripts/create-tag.js",
    "tag:status": "node scripts/deployment-status.js"
  }
}
```

### 6. Configure Cloudflare Authentication

**For Local Development & CLI Scripts:**
```bash
# Interactive browser login (recommended for local use)
wrangler login

# Verify authentication
wrangler whoami
```

All CLI scripts (`npm run init`, `npm run tag:create`, `npm run tag:status`) use your local wrangler authentication.

**Alternative: Environment Variables**
You can also set these environment variables for the CLI scripts:
```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
```

**For GitHub Actions (CI/CD):**
Create these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

**To get your API credentials:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token" → "Custom token"
3. Set permissions:
   - **Account**: Cloudflare Workers:Edit  
   - **Zone**: Zone:Read, Zone:Edit (if using custom domains)
4. Copy the token and your Account ID from the dashboard

### 7. Alternative: Manual Configuration

If you prefer manual setup instead of using `npm run init`:

**Option A: Semi-automatic with init script**
Create `worker-config.json` and run `npm run init` - it will offer to create/update files automatically.

**Option B: Fully manual**
1. Create the 3 wrangler config files manually (see step 3 above)
2. Edit workflow files manually:
   - `.github/workflows/deploy-dev.yml`
   - `.github/workflows/deploy-qa.yml` 
   - `.github/workflows/deploy-prod.yml`

   Change the values:
   ```yaml
   service_name: your-actual-service-name
   workers_domain: 'your-actual-domain.workers.dev'
   ```

The CLI scripts (`npm run init`, `npm run tag:status`) will auto-detect settings from `worker-config.json` or fall back to your `package.json` name.

## Setup & Provisioning

After configuration, initialize your environment:

```bash
npm run init
```

This will:
- ✅ Check prerequisites (Node.js, npm, Git, Wrangler)
- ✅ Verify Git repository access
- ✅ Confirm Cloudflare authentication
- ✅ Validate required files exist
- ✅ Check if workers are created
- ✅ **Offer to create missing workers automatically**
- ✅ **Offer to create missing wrangler config files**
- ✅ **Offer to update GitHub Actions workflow files**
- ✅ Verify package.json scripts

The init script will automatically:
- **Create wrangler configs** (wrangler.dev.toml, wrangler.qa.toml, wrangler.prod.toml)
- **Create workers** if missing and you have complete config
- **Update workflow files** with your service name and domain from `worker-config.json`

## Usage

### Development Deployment
Push to `main` branch - automatically deploys to dev environment

### QA/Production Deployment
```bash
# Create deployment tags interactively
npm run tag:create

# Check deployment status
npm run tag:status
```

### Manual Tag Creation
```bash
# QA deployment
git tag qa-1.0.0
git push origin qa-1.0.0

# Production deployment  
git tag prod-1.0.0
git push origin prod-1.0.0
```

## Architecture

- **Centralized workflow** (`deploy.yml`) handles all deployment logic
- **Environment-specific workflows** call the main workflow with parameters
- **Tag-based versioning** with semantic versioning (qa-1.0.0, prod-1.0.0)
- **Security scanning** with npm audit before deployment
- **Deployment tracking** via GitHub deployments API

## File Structure

```
your-project/
├── .github/
│   ├── workflows/
│   │   ├── deploy.yml              # Main deployment workflow
│   │   ├── deploy-dev.yml          # Dev environment (auto-deploy on main)
│   │   ├── deploy-qa.yml           # QA environment (qa-* tags)
│   │   ├── deploy-prod.yml         # Prod environment (prod-* tags)
│   │   ├── tag-management.yml      # Manual tag creation via GitHub UI
│   │   └── auto-merge-dependabot.yml
│   └── dependabot.yml
├── scripts/
│   ├── create-tag.js               # Interactive tag creation
│   ├── deployment-status.js        # Check deployment status
│   └── init-environment.js         # Environment validation
├── worker-config.json              # Service configuration
├── wrangler.dev.toml
├── wrangler.qa.toml
├── wrangler.prod.toml
├── package.json
└── .gitignore
```

## Customization

### Service Name & Domain
Update these in each deployment workflow:
```yaml
service_name: your-service-name
workers_domain: 'your-domain.workers.dev'
```

### Custom Production URL
For custom domains, update `deploy-prod.yml`:
```yaml
deployment_url_pattern: 'https://app.yourdomain.com'
```

### Build Commands
Customize build commands per environment in your `package.json`:
```json
{
  "scripts": {
    "build:dev": "vite build --mode development",
    "build:qa": "vite build --mode qa", 
    "build:prod": "vite build --mode production"
  }
}
```

## Troubleshooting

**Build fails**: Ensure your build command outputs to `dist/` directory  
**Deployment fails**: Check Cloudflare secrets are set correctly  
**Worker not found**: Verify workers were created with correct names  
**Tag creation fails**: Ensure you have write access to repository

That's it! Simple provisioning, powerful CI/CD, familiar tag management.