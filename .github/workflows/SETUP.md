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

## Prerequisites: Create an NPM Token

To publish packages to npm automatically, you need an npm authentication token.

### Steps to create the NPM token:

1. **Access npmjs.com:**
   - Go to [npmjs.com](https://www.npmjs.com) and log in to your account
   - If you don't have an account, create one first

2. **Generate an access token:**
   - Click on your avatar (top right) → **Access Tokens**
   - Click on **Generate New Token** → **Classic Token**

3. **Configure the token:**
   - **Token Type:** Select **Automation** (for CI/CD workflows)
   - This type of token can be used in automated publishing workflows

4. **Copy the token:**
   - **IMPORTANT:** Copy the token immediately - you won't be able to see it again!
   - Format: `npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Add the NPM token to the repository:

1. **Access repository secrets:**
   - Go to your repository: https://github.com/kokouaserge/ai-patterns
   - Click on **Settings** (top tab)
   - In the left sidebar: **Secrets and variables** → **Actions**

2. **Create the secret:**
   - Click on **New repository secret**
   - **Name:** `NPM_TOKEN`
   - **Secret:** Paste the npm token you copied
   - Click on **Add secret**

3. **Verification:**
   - Both `PAT_TOKEN` and `NPM_TOKEN` should now appear in the secrets list

## How the workflows work

### Automatic Release Workflow (release.yml)

The workflow triggers automatically on push to the `main` branch:

1. **Runs linter** to ensure code quality standards
2. **Runs tests** to ensure all tests pass
3. **Runs prepublishOnly** (clean + build) to prepare the package
4. **Determines the version bump type** based on commit messages:
   - `BREAKING CHANGE`, `feat!`, `fix!` → **Major** version (e.g., 1.0.0 → 2.0.0)
   - `feat:` → **Minor** version (e.g., 1.0.0 → 1.1.0)
   - `fix:`, `chore:`, etc. → **Patch** version (e.g., 1.0.0 → 1.0.1)
5. **Updates `package.json`** with the new version
6. **Creates a commit** with message "chore: bump version to X.X.X"
7. **Creates a Git tag** (e.g., v1.1.4)
8. **Generates a changelog** from commit messages
9. **Creates a GitHub Release** with the changelog
10. **Publishes to npm** automatically (only if all previous steps succeed)

### Manual Publish Workflow (manual-publish.yml)

You can trigger this workflow manually from GitHub Actions:

1. **Go to Actions tab** in your repository
2. **Select "Manual Publish to NPM"** workflow
3. **Click "Run workflow"** button
4. **Choose version bump type:**
   - `patch` - Bug fixes (1.0.0 → 1.0.1)
   - `minor` - New features (1.0.0 → 1.1.0)
   - `major` - Breaking changes (1.0.0 → 2.0.0)
5. **Click "Run workflow"** to start

The workflow will:
- Run all quality checks (linter, tests, prepublishOnly)
- Bump the version
- Create a release
- Publish to npm

**Use this when:**
- You want to control the exact version bump type
- You need to publish outside of the normal merge cycle
- You want to manually trigger a release

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

### NPM publish fails with "403 Forbidden" or authentication error
- Verify that the `NPM_TOKEN` secret is properly created
- Verify that you're logged into the correct npm account
- Verify that the token type is "Automation"
- Check that you have publishing rights to the package name

### Tests fail during workflow
- The workflow will NOT publish if tests fail
- Check the workflow logs to see which tests failed
- Fix the tests and push again

### Token has expired
- Create a new token following the steps above
- Update the `PAT_TOKEN` or `NPM_TOKEN` secret in repository settings

## Security

- NEVER share your Personal Access Token or NPM Token
- NEVER commit tokens in the code
- Always use GitHub Secrets to store tokens
- Regularly renew your tokens
- Use "Automation" type tokens for npm (more secure for CI/CD)
- Monitor your npm account for unauthorized publishes

## Summary

### Required Secrets:
1. **PAT_TOKEN** - GitHub Personal Access Token (for git operations and releases)
2. **NPM_TOKEN** - NPM Automation Token (for publishing packages)

### Available Workflows:
1. **release.yml** - Automatic release on push to main (with npm publish)
2. **manual-publish.yml** - Manual release triggered from GitHub Actions UI

### Quality Checks (both workflows):
- ✅ Linter must pass
- ✅ All tests must pass
- ✅ prepublishOnly (clean + build) must succeed
- ✅ Only publishes if all checks pass
