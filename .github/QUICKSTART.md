# CI/CD Quick Start Guide

Get your CI/CD pipeline up and running in 15 minutes.

## ⚡ 5-Minute Setup

### Prerequisites
- Admin access to GitHub repository
- npm account with 2FA enabled

### Step 1: Configure npm Token (2 min)

```bash
# Generate npm token
npm login
npm token create --type=automation
```

Copy the token (starts with `npm_...`)

### Step 2: Add GitHub Secret (1 min)

1. Go to: https://github.com/dcforge/image-specs/settings/secrets/actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: Paste your npm token
5. Click "Add secret"

### Step 3: Enable Branch Protection (2 min)

1. Go to: https://github.com/dcforge/image-specs/settings/branches
2. Click "Add rule"
3. Branch name pattern: `main`
4. Check:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
5. Save changes

### Step 4: Enable Security Features (< 1 min)

1. Go to: https://github.com/dcforge/image-specs/settings/security_analysis
2. Enable all available features:
   - ✅ CodeQL analysis
   - ✅ Secret scanning
   - ✅ Dependabot alerts
   - ✅ Dependabot security updates
   - ✅ Dependabot version updates

### Step 5: Test the Pipeline (< 5 min)

```bash
# Create test commit
git checkout -b test/pipeline-validation
echo "# Test" >> .github/test.md
git add .
git commit -m "test: validate CI/CD pipeline"
git push origin test/pipeline-validation

# Create PR
gh pr create --title "test: validate CI/CD pipeline" --body "Testing pipeline"

# Watch Actions
gh run watch
```

**Expected Results:**
- CI workflow runs and passes ✅
- PR checks validate title ✅
- All status checks green ✅

**Clean up:**
```bash
gh pr close 1 --delete-branch
```

### Step 6: First Release (< 5 min)

```bash
# Merge a releasable commit to main
git checkout main
git pull origin main

# Create feature commit
git commit --allow-empty -m "feat: initialize CI/CD pipeline"
git push origin main

# Watch release
gh run list --workflow=release.yml
gh run watch
```

**Expected Results:**
- Release workflow runs ✅
- GitHub release created ✅
- npm package published ✅
- Version bumped to 1.1.0 ✅

Verify:
```bash
npm view image-specs version
```

## ✅ You're Done!

Your CI/CD pipeline is now operational. 🎉

## 📚 Next Steps

### For Daily Development

**Making changes:**
```bash
git checkout -b feat/my-feature
# Make changes
git commit -m "feat: add new feature"
git push origin feat/my-feature
gh pr create --title "feat: add new feature"
```

**After PR approval:**
```bash
gh pr merge --squash  # Merge PR
# Release happens automatically!
```

### Conventional Commits Quick Reference

```bash
# Patch version (1.0.X)
git commit -m "fix: resolve bug"

# Minor version (1.X.0)
git commit -m "feat: add feature"

# Major version (X.0.0)
git commit -m "feat!: breaking change

BREAKING CHANGE: API redesigned"
```

### Manual Release

```bash
gh workflow run release.yml \
  --ref main \
  --field release-type=patch
```

## 🔍 Monitoring

### Check CI Status
```bash
# List recent runs
gh run list --limit 10

# Watch current run
gh run watch

# View specific run
gh run view <run-id>
```

### Check npm Package
```bash
# View published version
npm view image-specs

# Check downloads
npm view image-specs downloads
```

### View Releases
```bash
# List releases
gh release list

# View latest release
gh release view latest
```

## 🐛 Troubleshooting

### Issue: CI Failing

**Check logs:**
```bash
gh run view <run-id> --log
```

**Common fixes:**
- Ensure all tests pass locally: `npm test`
- Fix linting errors: `npm run lint:fix`
- Check TypeScript: `npm run typecheck`
- Rebuild: `npm run build`

### Issue: Release Not Created

**Check if commit is releasable:**
```bash
git log --oneline -5
```

Commits must start with:
- `feat:` (minor version)
- `fix:` (patch version)
- `BREAKING CHANGE:` (major version)

**Force manual release:**
```bash
gh workflow run release.yml --field release-type=patch
```

### Issue: npm Publish Fails

**Verify token:**
```bash
npm whoami --registry=https://registry.npmjs.org
```

**If invalid, regenerate:**
```bash
npm token create --type=automation
# Update NPM_TOKEN secret in GitHub
```

## 📖 Full Documentation

For complete details, see:

- **[CICD_SETUP.md](CICD_SETUP.md)** - Comprehensive setup guide
- **[WORKFLOWS.md](WORKFLOWS.md)** - Workflow reference & commands
- **[SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)** - Complete checklist
- **[SECURITY.md](SECURITY.md)** - Security policy
- **[README.md](README.md)** - GitHub configuration overview

## 🎓 Learning Resources

### Conventional Commits
- Format: `<type>: <description>`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`
- More info: https://www.conventionalcommits.org/

### Semantic Versioning
- Major: Breaking changes (X.0.0)
- Minor: New features (1.X.0)
- Patch: Bug fixes (1.0.X)
- More info: https://semver.org/

### GitHub Actions
- Documentation: https://docs.github.com/en/actions
- Workflow syntax: https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions

## 🆘 Getting Help

- 📖 Read the [full documentation](CICD_SETUP.md)
- 💬 Open a [discussion](https://github.com/dcforge/image-specs/discussions)
- 🐛 Report [issues](https://github.com/dcforge/image-specs/issues)
- 🔒 Report security via [Security Advisories](https://github.com/dcforge/image-specs/security/advisories)

## ✨ Tips & Tricks

### Speed Up Local Development

```bash
# Run checks before pushing (CI will be faster)
npm run lint
npm run typecheck
npm run build
npm test
```

### View Actions in Browser
```bash
# Open Actions page
gh browse /actions

# Open specific workflow
gh workflow view ci.yml --web
```

### Badges for README

```markdown
[![CI](https://github.com/dcforge/image-specs/actions/workflows/ci.yml/badge.svg)](https://github.com/dcforge/image-specs/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/image-specs.svg)](https://www.npmjs.com/package/image-specs)
```

### Debug Workflows

Add to repository secrets:
- `ACTIONS_RUNNER_DEBUG` = `true`
- `ACTIONS_STEP_DEBUG` = `true`

Then re-run workflow for detailed logs.

## 📊 Success Metrics

Your pipeline is working well if:

- ✅ CI passes consistently (>95% success rate)
- ✅ Releases happen automatically on releasable commits
- ✅ npm package updates within minutes of merge
- ✅ Security scans run without issues
- ✅ Team follows conventional commit format

## 🎯 What's Next?

After setup:

1. **Add badges** to README.md
2. **Configure Codecov** (optional) for coverage reports
3. **Set up notifications** (Slack, Discord)
4. **Train team** on conventional commits
5. **Monitor metrics** (downloads, CI success rate)

---

**Setup Time:** ~15 minutes
**Maintenance:** ~1 hour/month
**ROI:** Massive! Automated releases, testing, and security

Enjoy your new CI/CD pipeline! 🚀
