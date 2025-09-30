# GitHub Configuration

This directory contains the complete CI/CD pipeline configuration for the `image-specs` npm package.

## 📁 Directory Structure

```
.github/
├── workflows/
│   ├── ci.yml                    # Continuous Integration pipeline
│   ├── release.yml               # Automated release & npm publish
│   ├── codeql.yml                # Security analysis
│   ├── dependency-review.yml     # Dependency scanning for PRs
│   └── pr-checks.yml             # PR validation & labeling
├── dependabot.yml                # Automated dependency updates
├── labeler.yml                   # Auto-labeling configuration
├── CICD_SETUP.md                 # Complete setup guide
├── WORKFLOWS.md                  # Workflow quick reference
├── SETUP_CHECKLIST.md            # Step-by-step checklist
├── SECURITY.md                   # Security policy
└── README.md                     # This file
```

## 🚀 Quick Start

### For First-Time Setup

1. **Read the setup guide**: [CICD_SETUP.md](CICD_SETUP.md)
2. **Follow the checklist**: [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)
3. **Configure secrets** (see below)

### For Daily Development

1. **Create feature branch**: `git checkout -b feat/your-feature`
2. **Make changes**: Follow conventional commits format
3. **Push and create PR**: `git push origin feat/your-feature`
4. **Wait for CI**: All checks must pass
5. **Merge to main**: Release will be automatic if needed

## 🔑 Required Secrets

Configure these secrets in GitHub repository settings:

| Secret | Required | Purpose | How to Get |
|--------|----------|---------|------------|
| `NPM_TOKEN` | ✅ Yes | Publish to npm | `npm token create --type=automation` |
| `CODECOV_TOKEN` | ❌ Optional | Coverage reports | https://codecov.io |

**Setup Instructions:**
1. Go to: Settings → Secrets and variables → Actions → New repository secret
2. Add each required secret
3. Verify secrets are accessible (check workflow logs)

## 📋 Workflows Overview

### 1. CI Workflow (`ci.yml`)

**Runs on:** Every push and PR

**Jobs:**
- ✅ Lint (ESLint + Prettier)
- ✅ Type Check (TypeScript)
- ✅ Build (tsup)
- ✅ Test (Node 18/20/22 × Ubuntu/Windows/macOS)
- ✅ Package Installation Test
- ✅ Security Audit

**Duration:** 5-8 minutes

### 2. Release Workflow (`release.yml`)

**Runs on:** Push to main (with releasable commits)

**Process:**
1. Analyze commits for conventional format
2. Determine version bump (major/minor/patch)
3. Update package.json version
4. Create Git tag
5. Create GitHub release with changelog
6. Publish to npm registry
7. Verify publication

**Triggered by:**
- `feat:` → minor version bump
- `fix:` → patch version bump
- `BREAKING CHANGE:` → major version bump

### 3. CodeQL Analysis (`codeql.yml`)

**Runs on:** Push, PR, Weekly (Monday 2am UTC)

**Scans for:**
- Security vulnerabilities
- Code quality issues
- Best practice violations

### 4. Dependency Review (`dependency-review.yml`)

**Runs on:** Pull Requests

**Checks:**
- New vulnerabilities (moderate+ severity)
- License compliance (blocks GPL-3.0, AGPL-3.0)
- Dependency changes summary

### 5. PR Checks (`pr-checks.yml`)

**Runs on:** PR opened/updated

**Validates:**
- PR title format (conventional commits)
- PR size (warns if >500 lines)
- Auto-applies labels based on changes

## 🔄 Release Process

### Automated Release (Recommended)

Use conventional commit messages:

```bash
# Patch release (1.0.0 → 1.0.1)
git commit -m "fix: resolve CLI parsing issue"

# Minor release (1.0.0 → 1.1.0)
git commit -m "feat: add AVIF format support"

# Major release (1.0.0 → 2.0.0)
git commit -m "feat!: redesign API

BREAKING CHANGE: getImageSpecs now returns Promise"
```

Push to main:
```bash
git push origin main
```

Release happens automatically!

### Manual Release

Trigger via GitHub Actions:

```bash
gh workflow run release.yml \
  --ref main \
  --field release-type=patch
```

Or via UI:
1. Go to Actions → Release
2. Click "Run workflow"
3. Select release type: major/minor/patch

## 📝 Conventional Commits

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

### Types

| Type | Description | Version Impact |
|------|-------------|----------------|
| `feat` | New feature | Minor (1.X.0) |
| `fix` | Bug fix | Patch (1.0.X) |
| `docs` | Documentation | None |
| `style` | Code style | None |
| `refactor` | Code refactor | None |
| `perf` | Performance | Patch |
| `test` | Tests | None |
| `build` | Build system | None |
| `ci` | CI changes | None |
| `chore` | Maintenance | None |

### Examples

```bash
# Good ✅
git commit -m "feat: add WebP decoder"
git commit -m "fix(cli): handle missing arguments"
git commit -m "docs: update API examples"

# Bad ❌
git commit -m "updated stuff"
git commit -m "fixed bug"
git commit -m "changes"
```

## 🔒 Security

### Reporting Vulnerabilities

**Do not use public issues for security vulnerabilities.**

Instead:
1. Go to Security → Advisories
2. Click "Report a vulnerability"
3. Fill out the form

See [SECURITY.md](SECURITY.md) for full policy.

### Security Features

- ✅ CodeQL security scanning
- ✅ Dependabot alerts & updates
- ✅ Secret scanning with push protection
- ✅ npm 2FA required
- ✅ Token rotation (90-day schedule)

## 📊 Status Badges

Add to your README.md:

```markdown
[![CI](https://github.com/dcforge/image-specs/actions/workflows/ci.yml/badge.svg)](https://github.com/dcforge/image-specs/actions/workflows/ci.yml)
[![CodeQL](https://github.com/dcforge/image-specs/actions/workflows/codeql.yml/badge.svg)](https://github.com/dcforge/image-specs/actions/workflows/codeql.yml)
[![npm version](https://img.shields.io/npm/v/image-specs.svg)](https://www.npmjs.com/package/image-specs)
[![npm downloads](https://img.shields.io/npm/dm/image-specs.svg)](https://www.npmjs.com/package/image-specs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

## 🛠️ Troubleshooting

### Common Issues

**1. CI takes too long**
- Check npm cache is working
- Review matrix configuration
- Consider reducing matrix for PRs

**2. Release not triggered**
- Verify commit follows conventional format
- Check workflow logs for analysis results
- Manually trigger via `gh workflow run release.yml`

**3. npm publish fails**
- Verify NPM_TOKEN is valid: `npm whoami`
- Check 2FA is enabled on npm account
- Regenerate token if needed

**4. PR checks fail**
- Fix PR title to match conventional format
- Ensure all CI checks pass
- Resolve conversation threads

### Get Help

- 📖 [Complete Setup Guide](CICD_SETUP.md)
- 🔧 [Workflow Reference](WORKFLOWS.md)
- ✅ [Setup Checklist](SETUP_CHECKLIST.md)
- 🔒 [Security Policy](SECURITY.md)
- 🐛 [GitHub Issues](https://github.com/dcforge/image-specs/issues)

## 📚 Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| [CICD_SETUP.md](CICD_SETUP.md) | Complete setup guide with troubleshooting | Maintainers, New contributors |
| [WORKFLOWS.md](WORKFLOWS.md) | Workflow reference and commands | Daily development |
| [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md) | Step-by-step setup checklist | Initial setup |
| [SECURITY.md](SECURITY.md) | Security policy and reporting | Security researchers |

## 🎯 Best Practices

### Development Workflow

1. **Create feature branch** from `main`
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make atomic commits** with conventional format
   ```bash
   git commit -m "feat: add new feature"
   ```

3. **Push and create PR**
   ```bash
   git push origin feat/my-feature
   gh pr create --title "feat: add new feature"
   ```

4. **Wait for CI** to pass (all checks must be green)

5. **Address review feedback**

6. **Merge to main** (use squash or merge commit)

7. **Automatic release** happens if commits are releasable

### Commit Guidelines

✅ **Do:**
- Use conventional commit format
- Write clear, descriptive messages
- Keep commits focused and atomic
- Reference issues: `fix: resolve #123`

❌ **Don't:**
- Make large, unfocused commits
- Use vague messages ("updated code")
- Skip commit message body when needed
- Commit secrets or sensitive data

### PR Guidelines

✅ **Do:**
- Write descriptive PR titles (conventional format)
- Provide context in PR description
- Keep PRs small and focused (<500 lines)
- Respond to review comments
- Ensure all checks pass

❌ **Don't:**
- Create massive PRs (>500 lines)
- Use generic PR titles ("updates")
- Merge with failing checks
- Skip code review

## 🔄 Maintenance

### Regular Tasks

**Weekly:**
- [ ] Review Dependabot PRs
- [ ] Check CI success rate
- [ ] Monitor npm downloads

**Monthly:**
- [ ] Review security advisories
- [ ] Audit workflow logs
- [ ] Update documentation

**Quarterly:**
- [ ] Rotate npm tokens (90 days)
- [ ] Update GitHub Actions versions
- [ ] Review and optimize workflows
- [ ] Security audit

### Metrics to Track

- ✅ CI success rate (target: >95%)
- ⏱️ Average workflow duration
- 📦 npm weekly downloads
- 🔒 Security vulnerabilities
- 📊 Code coverage percentage

## 🚀 Performance

### Optimization Strategies

1. **npm Caching**: Saves ~30-60s per job
2. **Parallel Jobs**: Independent jobs run simultaneously
3. **Matrix Reduction**: PRs use reduced matrix for speed
4. **Artifact Reuse**: Build artifacts shared between jobs
5. **Concurrency Groups**: Cancels outdated runs

### Typical Execution Times

| Workflow | Duration | Jobs |
|----------|----------|------|
| CI (PR) | 5-7 min | 10 parallel |
| CI (Full) | 8-12 min | 15 parallel |
| Release | 10-15 min | Sequential |
| CodeQL | 3-5 min | Single |
| PR Checks | 1-2 min | 3 parallel |

## 🤝 Contributing

Contributions are welcome! Please:

1. Read [CONTRIBUTING.md](../CONTRIBUTING.md)
2. Follow conventional commit format
3. Ensure all CI checks pass
4. Request review from maintainers

## 📞 Support

Need help?

- 📖 Read the documentation
- 💬 Open a [discussion](https://github.com/dcforge/image-specs/discussions)
- 🐛 Report bugs via [issues](https://github.com/dcforge/image-specs/issues)
- 🔒 Report security issues via Security Advisories

## 📄 License

MIT License - See [LICENSE](../LICENSE) for details

---

**Last Updated:** 2025-10-01
**Maintained by:** [@rgdcastro](https://github.com/rgdcastro)
**CI/CD Version:** 1.0.0
