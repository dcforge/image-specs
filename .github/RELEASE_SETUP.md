# Release Workflow Setup

This document explains how to configure the automated release workflow to work with branch protection rules.

## Problem

Your repository has branch protection enabled on `main` that requires:
- Changes through pull requests
- Required status checks

The automated release workflow needs to push version bumps and tags directly to `main`, which violates these rules.

## Solution: Personal Access Token (PAT)

Create a Personal Access Token with admin rights to bypass branch protection for automated releases.

### Step 1: Create a Personal Access Token

1. Go to **GitHub Settings**: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Configure the token:
   - **Name**: `image-specs-release-automation` (or any descriptive name)
   - **Expiration**: Choose an appropriate expiration (90 days, 1 year, or no expiration)
   - **Scopes**: Select `repo` (Full control of private repositories)
     - This includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`
4. Click **"Generate token"**
5. **IMPORTANT**: Copy the token immediately - you won't be able to see it again!

### Step 2: Add Token to Repository Secrets

1. Go to your repository: https://github.com/dcforge/image-specs
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Configure the secret:
   - **Name**: `PAT_TOKEN` (must be exactly this name)
   - **Value**: Paste the token you copied in Step 1
5. Click **"Add secret"**

### Step 3: Verify Setup

After adding the token, the release workflow will automatically use it to bypass branch protection when:
- Pushing version bumps to `package.json`
- Creating and pushing release tags

You can test it by:
1. Making a commit with a conventional commit message (e.g., `feat: add new feature`)
2. Pushing to `main` (via PR and merge)
3. The release workflow will trigger automatically

Or manually trigger a release:
1. Go to **Actions** → **Release** workflow
2. Click **"Run workflow"**
3. Select the release type (patch, minor, or major)
4. Click **"Run workflow"**

## Alternative: Temporarily Disable Branch Protection

If you don't want to use a PAT, you can temporarily disable branch protection during releases:

1. Go to **Settings** → **Branches** → **Branch protection rules**
2. Find the rule for `main`
3. Click **"Edit"**
4. Uncheck **"Require a pull request before merging"** under "Bypass list"
5. Add `github-actions[bot]` to the bypass list
6. Save changes

**Note**: This is less secure as it allows the default GitHub Actions token to bypass protection.

## How It Works

The workflow now:
1. Uses `${{ secrets.PAT_TOKEN }}` if available, falls back to `${{ secrets.GITHUB_TOKEN }}`
2. Verifies PAT_TOKEN exists before attempting to push
3. Provides clear error messages if token is missing
4. Pushes version bump commits and tags using the PAT (which has bypass permissions)

## Token Security Best Practices

- ✅ Use token expiration (90 days or 1 year recommended)
- ✅ Use fine-grained tokens if possible (when they support bypassing protection)
- ✅ Rotate tokens before expiration
- ✅ Monitor token usage in GitHub audit log
- ✅ Revoke tokens immediately if compromised
- ❌ Never commit tokens to the repository
- ❌ Never share tokens via insecure channels

## Troubleshooting

### Error: "PAT_TOKEN secret not found"
- The workflow will fail with a clear error message
- Follow Step 2 above to add the token

### Error: "push declined due to repository rule violations"
- The PAT might not have sufficient permissions
- Verify the token has `repo` scope
- Verify the token is from a user with admin access to the repository

### Error: Token expired
- Generate a new token following Step 1
- Update the secret following Step 2

## Questions?

See the full workflow configuration in `.github/workflows/release.yml` for implementation details.
