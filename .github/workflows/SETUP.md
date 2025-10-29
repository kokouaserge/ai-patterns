# GitHub Release Workflow Setup

This document explains how to configure the automatic release workflow for this project.

## Prerequisites: Create a Personal Access Token (PAT)

The workflow requires a GitHub Personal Access Token with appropriate permissions.

### Steps to create the PAT:

1. **Access GitHub settings:**
   - Go to [GitHub.com](https://github.com)
   - Click on your profile picture (top right corner)
   - Select **Settings**

2. **Access Developer settings:**
   - In the left sidebar, scroll down to **Developer settings**

3. **Create a new token:**
   - Click on **Personal access tokens** → **Tokens (classic)**
   - Click on **Generate new token** → **Generate new token (classic)**

4. **Configure the token:**
   - **Note:** Give it a descriptive name (e.g., "ai-patterns-release-workflow")
   - **Expiration:** Choose a duration (recommended: 90 days or more)
   - **Select scopes:** Check the following permissions:
     - ✅ `repo` (Full control of private repositories)
       - This automatically includes: repo:status, repo_deployment, public_repo, repo:invite, security_events
     - ✅ `workflow` (Update GitHub Action workflows)
     - ✅ `write:packages` (Upload packages to GitHub Package Registry) - optional

5. **Generate and copy the token:**
   - Click on **Generate token** at the bottom of the page
   - **IMPORTANT:** Copy the token immediately - you won't be able to see it again!
   - Format: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Add the token to the repository:

1. **Access repository secrets:**
   - Go to your repository: https://github.com/kokouaserge/ai-patterns
   - Click on **Settings** (top tab)
   - In the left sidebar: **Secrets and variables** → **Actions**

2. **Create the secret:**
   - Click on **New repository secret**
   - **Name:** `PAT_TOKEN`
   - **Secret:** Paste the token you copied
   - Click on **Add secret**

3. **Verification:**
   - The secret `PAT_TOKEN` should now appear in the list
   - You won't be able to see its value anymore (this is normal and secure)

## How the workflow works

The workflow triggers automatically on push to the `main` branch:

1. **Runs tests** to ensure code quality
2. **Determines the version bump type** based on commit messages:
   - `BREAKING CHANGE`, `feat!`, `fix!` → **Major** version (e.g., 1.0.0 → 2.0.0)
   - `feat:` → **Minor** version (e.g., 1.0.0 → 1.1.0)
   - `fix:`, `chore:`, etc. → **Patch** version (e.g., 1.0.0 → 1.0.1)
3. **Updates `package.json`** with the new version
4. **Creates a commit** with message "chore: bump version to X.X.X"
5. **Creates a Git tag** (e.g., v1.1.4)
6. **Generates a changelog** from commit messages
7. **Creates a GitHub Release** with the changelog

## Commit conventions

For the workflow to work correctly, use the following prefixes in your commits:

- `feat:` - New feature (minor version)
- `fix:` - Bug fix (patch version)
- `chore:` - Maintenance tasks (patch version)
- `docs:` - Documentation (patch version)
- `BREAKING CHANGE:` - Incompatible change (major version)
- `feat!:` or `fix!:` - With `!` to indicate a breaking change (major version)

### Examples:

```bash
git commit -m "feat: add retry mechanism for API calls"        # → 1.0.0 → 1.1.0
git commit -m "fix: resolve memory leak in cache cleanup"     # → 1.1.0 → 1.1.1
git commit -m "feat!: change API signature for withRetry"     # → 1.1.1 → 2.0.0
git commit -m "chore: update dependencies"                     # → 2.0.0 → 2.0.1
```

## Troubleshooting

### Workflow fails with "Resource not accessible by integration"
- Verify that the `PAT_TOKEN` secret is properly created
- Verify that the token has `repo` and `workflow` permissions

### Workflow doesn't trigger
- Verify that the workflow is enabled in **Actions** → **Release**
- Verify that you pushed to the `main` branch

### Token has expired
- Create a new token following the steps above
- Update the `PAT_TOKEN` secret in repository settings

## Security

- NEVER share your Personal Access Token
- NEVER commit the token in the code
- Always use GitHub Secrets to store tokens
- Regularly renew your tokens
