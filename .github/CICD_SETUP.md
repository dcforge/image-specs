# CI/CD Pipeline Setup Guide

This document provides complete instructions for setting up and using the GitHub Actions CI/CD pipeline for the `image-specs` package.

## Table of Contents

- [Overview](#overview)
- [Workflows](#workflows)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Security Configuration](#security-configuration)
- [Release Process](#release-process)
- [Conventional Commits](#conventional-commits)
- [Badge Setup](#badge-setup)
- [Troubleshooting](#troubleshooting)

## Overview

The CI/CD pipeline consists of five main workflows:

1. **CI** - Continuous Integration checks on every push and PR
2. **Release** - Automated versioning, tagging, and GitHub releases
3. **CodeQL** - Security vulnerability scanning
4. **Dependency Review** - Analyze dependency changes in PRs
5. **PR Checks** - Validate PR titles, size, and auto-labeling

### Architecture Highlights

**Quality Gates:**
- Multi-stage validation: lint → typecheck → build → test
- Parallel job execution for speed
- Matrix testing across Node.js versions (18, 20, 22) and OS (Ubuntu, Windows, macOS)
- Package installation verification (ESM/CJS dual exports)
- Security audits and dependency reviews

**Performance Optimizations:**
- npm cache reuse across jobs
- Concurrent test execution with fail-fast: false
- Reduced matrix on PRs for faster feedback
- Build artifact caching and reuse

**Security Best Practices:**
- Minimal permissions (principle of least privilege)
- Secret scanning with CodeQL
- Dependency vulnerability checks
- Token expiration handling
- No force pushes to protected branches

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Trigger:** Push to `main`/`develop`, Pull Requests

**Jobs:**
- **Lint**: ESLint + Prettier format checking
- **Type Check**: TypeScript compilation validation
- **Build**: tsup build + artifact verification
- **Test**: Multi-matrix testing (Node 18/20/22, Ubuntu/Windows/macOS)
- **Test Package**: Verify ESM/CJS imports and CLI binary
- **Security**: npm audit for vulnerabilities
- **CI Success**: Aggregate check for required jobs

**Duration:** ~5-8 minutes (parallelized)

**Concurrency:** Cancels in-progress runs for the same ref

### 2. Release Workflow (`.github/workflows/release.yml`)

**Trigger:** Push to `main`, Manual dispatch

**Jobs:**
- **Analyze**: Determine if release needed via conventional commits
- **Release**: Version bump, changelog generation, GitHub release
- **Publish**: npm package publication
- **Notify**: Success/failure notifications

**Versioning Strategy:**
- Automated via conventional commits:
  - `feat:` → minor version bump
  - `fix:` → patch version bump
  - `BREAKING CHANGE:` → major version bump
- Manual via workflow dispatch (major/minor/patch)

**Release Process:**
1. Analyzes commits since last tag
2. Determines semantic version bump
3. Updates package.json version
4. Runs full CI suite
5. Generates changelog from commits
6. Creates Git tag and GitHub release
7. Publishes to npm registry
8. Verifies publication success

### 3. CodeQL Analysis (`.github/workflows/codeql.yml`)

**Trigger:** Push, PR, Weekly schedule (Monday 2am UTC)

**Analysis:**
- Security vulnerabilities (SQL injection, XSS, etc.)
- Code quality issues
- Best practice violations

**Language:** JavaScript/TypeScript

### 4. Dependency Review (`.github/workflows/dependency-review.yml`)

**Trigger:** Pull Requests only

**Checks:**
- New dependency vulnerabilities (moderate+ severity)
- License compliance (blocks GPL-3.0, AGPL-3.0)
- Dependency changes summary in PR

### 5. PR Checks (`.github/workflows/pr-checks.yml`)

**Trigger:** PR opened, synchronized, edited

**Validations:**
- **PR Title**: Enforces conventional commits format
- **PR Size**: Warns on large PRs (>500 lines changed)
- **Auto-labeling**: Applies labels based on changed files

## Prerequisites

Before setting up the pipeline, ensure you have:

1. **GitHub Repository**
   - Admin access to `https://github.com/dcforge/image-specs`
   - Branch protection rules recommended (see below)

2. **npm Account**
   - Active npm account
   - 2FA enabled (required for publishing)
   - Access token with publish permissions

3. **Optional Services**
   - Codecov account (for coverage reports)

## Setup Instructions

### Step 1: Configure npm Token

1. **Generate npm Access Token:**
   ```bash
   npm login
   npm token create --type=automation
   ```

   - Choose token type: **Automation**
   - Copy the generated token (starts with `npm_...`)
   - **Store securely** - it won't be shown again!

2. **Add to GitHub Secrets:**
   - Navigate to: `https://github.com/dcforge/image-specs/settings/secrets/actions`
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click "Add secret"

### Step 2: Configure Codecov (Optional)

1. **Sign up at codecov.io** with your GitHub account

2. **Add repository** to Codecov

3. **Get Codecov token:**
   - Go to repository settings on Codecov
   - Copy the upload token

4. **Add to GitHub Secrets:**
   - Name: `CODECOV_TOKEN`
   - Value: Paste Codecov token

### Step 3: Branch Protection Rules

Protect your `main` branch:

1. Go to: `Settings` → `Branches` → `Add rule`
2. Branch name pattern: `main`
3. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
     - Required checks: `CI Success`, `Validate PR Title`
   - ✅ Require branches to be up to date before merging
   - ✅ Require conversation resolution before merging
   - ✅ Do not allow bypassing the above settings
   - ✅ Restrict who can push to matching branches

### Step 4: Enable Dependabot

1. Go to: `Settings` → `Code security and analysis`
2. Enable:
   - ✅ Dependabot alerts
   - ✅ Dependabot security updates
   - ✅ Dependabot version updates (uses `.github/dependabot.yml`)

### Step 5: Enable CodeQL

1. Go to: `Settings` → `Code security and analysis`
2. Enable:
   - ✅ CodeQL analysis
   - ✅ Secret scanning
   - ✅ Push protection (prevents committing secrets)

### Step 6: Configure GitHub Actions Permissions

1. Go to: `Settings` → `Actions` → `General`
2. Workflow permissions:
   - Select: **Read and write permissions**
   - ✅ Allow GitHub Actions to create and approve pull requests
3. Save changes

### Step 7: Verify Setup

1. **Test CI Workflow:**
   ```bash
   # Create a test branch
   git checkout -b test/ci-setup

   # Make a small change
   echo "# CI Test" >> .github/test.txt

   # Commit and push
   git add .
   git commit -m "test: verify CI pipeline"
   git push origin test/ci-setup

   # Create PR and verify all checks pass
   gh pr create --title "test: verify CI pipeline" --body "Testing CI setup"
   ```

2. **Test Release Workflow:**
   ```bash
   # After merging test PR to main
   git checkout main
   git pull origin main

   # Make a releasable commit
   git commit --allow-empty -m "feat: trigger test release"
   git push origin main

   # Watch release workflow at:
   # https://github.com/dcforge/image-specs/actions
   ```

## Security Configuration

### Secrets Management

**Required Secrets:**

| Secret Name | Description | Format | Usage |
|------------|-------------|--------|-------|
| `NPM_TOKEN` | npm automation token | `npm_xxx...` | Publishing to npm |
| `CODECOV_TOKEN` | Codecov upload token | UUID | Coverage reports (optional) |

**Built-in Secrets (Auto-provided by GitHub):**

- `GITHUB_TOKEN`: Automatic authentication for GitHub API
- Scoped per workflow run
- Expires after workflow completion

### Token Security Best Practices

1. **Rotation Schedule:**
   - Rotate `NPM_TOKEN` every 90 days
   - Monitor npm token usage in npm account

2. **Minimal Permissions:**
   - npm token: Automation (publish only)
   - No read tokens in CI/CD

3. **Audit Trail:**
   - Review GitHub Actions logs regularly
   - Monitor npm package downloads/publishes
   - Enable GitHub security advisories

4. **Secret Scanning:**
   - Push protection enabled (prevents committing secrets)
   - Secret scanning alerts for leaked tokens

### Permissions Model

Each workflow uses minimal required permissions:

```yaml
permissions:
  contents: write      # Create releases, push tags
  issues: write        # Comment on issues
  pull-requests: write # Comment on PRs
  security-events: write # CodeQL results
```

## Release Process

### Automated Releases (Recommended)

**Using Conventional Commits:**

1. **Commit changes with conventional format:**
   ```bash
   # Patch release (1.0.0 → 1.0.1)
   git commit -m "fix: resolve CLI argument parsing"

   # Minor release (1.0.0 → 1.1.0)
   git commit -m "feat: add WebP support"

   # Major release (1.0.0 → 2.0.0)
   git commit -m "feat!: redesign API\n\nBREAKING CHANGE: removed deprecated methods"
   ```

2. **Push to main:**
   ```bash
   git push origin main
   ```

3. **Automated steps:**
   - CI runs all checks
   - Release workflow analyzes commits
   - Determines version bump
   - Creates GitHub release
   - Publishes to npm

### Manual Releases

**Trigger manual release via GitHub UI:**

1. Go to: `Actions` → `Release` → `Run workflow`
2. Select branch: `main`
3. Choose release type: `major`, `minor`, or `patch`
4. Click "Run workflow"

**Or via GitHub CLI:**
```bash
gh workflow run release.yml \
  --ref main \
  --field release-type=minor
```

### Release Checklist

Before releasing:

- ✅ All CI checks pass
- ✅ Version bump is appropriate (semver)
- ✅ CHANGELOG.md is accurate (auto-generated)
- ✅ Documentation is up to date
- ✅ No breaking changes without major version bump
- ✅ Test package locally: `npm pack && npm install ./image-specs-*.tgz`

### Post-Release Verification

```bash
# Verify npm publication
npm view image-specs version
npm view image-specs

# Test installation
mkdir -p /tmp/test-install && cd /tmp/test-install
npm init -y
npm install image-specs

# Test imports
node -e "import('image-specs').then(m => console.log(m))"
node -e "console.log(require('image-specs'))"

# Test CLI
npx image-specs --version
```

## Conventional Commits

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description | Version Bump |
|------|-------------|--------------|
| `feat` | New feature | minor |
| `fix` | Bug fix | patch |
| `docs` | Documentation only | none |
| `style` | Formatting, white-space | none |
| `refactor` | Code change (no features/fixes) | none |
| `perf` | Performance improvement | patch |
| `test` | Adding/updating tests | none |
| `build` | Build system/dependencies | none |
| `ci` | CI configuration | none |
| `chore` | Maintenance tasks | none |
| `revert` | Revert previous commit | patch |

### Examples

**Feature (Minor Version):**
```bash
git commit -m "feat: add AVIF image format support"
```

**Bug Fix (Patch Version):**
```bash
git commit -m "fix: handle corrupted image headers gracefully"
```

**Breaking Change (Major Version):**
```bash
git commit -m "feat!: redesign getImageSpecs API

BREAKING CHANGE: getImageSpecs now returns Promise<ImageSpecs> instead of ImageSpecs | null"
```

**With Scope:**
```bash
git commit -m "feat(cli): add --format json option"
git commit -m "fix(parser): correct PNG chunk size calculation"
```

### Commit Message Validation

PR titles are validated automatically:
- Must follow conventional commit format
- Subject must start with lowercase
- Type must be valid (feat, fix, docs, etc.)
- Fails PR check if invalid

## Badge Setup

Add status badges to your `README.md`:

### 1. CI Status Badge

```markdown
[![CI](https://github.com/dcforge/image-specs/actions/workflows/ci.yml/badge.svg)](https://github.com/dcforge/image-specs/actions/workflows/ci.yml)
```

### 2. npm Version Badge

```markdown
[![npm version](https://img.shields.io/npm/v/image-specs.svg)](https://www.npmjs.com/package/image-specs)
```

### 3. npm Downloads Badge

```markdown
[![npm downloads](https://img.shields.io/npm/dm/image-specs.svg)](https://www.npmjs.com/package/image-specs)
```

### 4. Codecov Badge

```markdown
[![codecov](https://codecov.io/gh/rgdcastro/image-specs/branch/main/graph/badge.svg)](https://codecov.io/gh/rgdcastro/image-specs)
```

### 5. License Badge

```markdown
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

### 6. Node.js Version Badge

```markdown
[![Node.js Version](https://img.shields.io/node/v/image-specs.svg)](https://nodejs.org)
```

### 7. CodeQL Badge

```markdown
[![CodeQL](https://github.com/dcforge/image-specs/actions/workflows/codeql.yml/badge.svg)](https://github.com/dcforge/image-specs/actions/workflows/codeql.yml)
```

### Complete Badge Section

```markdown
# image-specs

[![CI](https://github.com/dcforge/image-specs/actions/workflows/ci.yml/badge.svg)](https://github.com/dcforge/image-specs/actions/workflows/ci.yml)
[![CodeQL](https://github.com/dcforge/image-specs/actions/workflows/codeql.yml/badge.svg)](https://github.com/dcforge/image-specs/actions/workflows/codeql.yml)
[![npm version](https://img.shields.io/npm/v/image-specs.svg)](https://www.npmjs.com/package/image-specs)
[![npm downloads](https://img.shields.io/npm/dm/image-specs.svg)](https://www.npmjs.com/package/image-specs)
[![codecov](https://codecov.io/gh/rgdcastro/image-specs/branch/main/graph/badge.svg)](https://codecov.io/gh/rgdcastro/image-specs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/image-specs.svg)](https://nodejs.org)

Extract image specifications from URLs or streams with TypeScript support
```

## Troubleshooting

### Common Issues

#### 1. npm Publish Fails with Authentication Error

**Error:** `Unable to authenticate, need: Basic realm="npm"`

**Solution:**
```bash
# Verify NPM_TOKEN secret is set correctly
# Regenerate token:
npm token create --type=automation

# Update GitHub secret with new token
```

#### 2. Release Workflow Doesn't Trigger

**Error:** No release created despite pushing to main

**Solution:**
- Verify commits follow conventional commit format
- Check if commits contain `feat:`, `fix:`, or `BREAKING CHANGE:`
- Manually trigger release: `gh workflow run release.yml --field release-type=patch`

#### 3. CI Tests Fail on Windows

**Error:** Path separator or line ending issues

**Solution:**
- Ensure `.gitattributes` normalizes line endings:
  ```
  * text=auto eol=lf
  ```
- Use `path.join()` instead of string concatenation

#### 4. CodeQL Analysis Fails

**Error:** Out of memory or timeout

**Solution:**
- Increase timeout in workflow (default: 15 min)
- Exclude large generated files in `.github/codeql/config.yml`

#### 5. PR Title Validation Fails

**Error:** `PR title doesn't match conventional commit format`

**Solution:**
- Update PR title to match: `type: description`
- Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Example: `feat: add new image format support`

#### 6. Coverage Upload Fails

**Error:** `Codecov token not found`

**Solution:**
- Add `CODECOV_TOKEN` to GitHub secrets
- Or remove Codecov step from CI workflow (optional)

### Debug Workflows

**Enable debug logging:**

1. Go to: `Settings` → `Secrets` → `Actions`
2. Add secrets:
   - `ACTIONS_RUNNER_DEBUG` = `true`
   - `ACTIONS_STEP_DEBUG` = `true`
3. Re-run workflow to see detailed logs

**View workflow logs:**
```bash
# List workflow runs
gh run list --workflow=ci.yml

# View specific run
gh run view <run-id> --log

# Download logs
gh run download <run-id>
```

### Contact & Support

- **Issues:** https://github.com/dcforge/image-specs/issues
- **Discussions:** https://github.com/dcforge/image-specs/discussions
- **Security:** Report via GitHub Security Advisories

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [CodeQL Documentation](https://codeql.github.com/docs/)
