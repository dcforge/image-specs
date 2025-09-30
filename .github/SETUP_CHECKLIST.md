# CI/CD Setup Checklist

Complete this checklist to ensure your CI/CD pipeline is fully configured and operational.

## Phase 1: Initial Setup

### 1. Repository Configuration

- [ ] **Verify repository access**
  - [ ] Admin access to `https://github.com/dcforge/image-specs`
  - [ ] Repository is public (for npm publishing)
  - [ ] Repository has description and topics

- [ ] **Configure repository settings**
  - [ ] Go to Settings → General
  - [ ] Enable "Allow merge commits" or "Squash merging"
  - [ ] Enable "Automatically delete head branches"
  - [ ] Disable "Allow rebase merging" (optional)

### 2. Secrets Configuration

- [ ] **npm Token** (Required)
  ```bash
  # Step 1: Generate token
  npm login
  npm token create --type=automation
  ```
  - [ ] Copy token (starts with `npm_...`)
  - [ ] Add to GitHub: Settings → Secrets → Actions → New secret
  - [ ] Name: `NPM_TOKEN`
  - [ ] Test token: `npm whoami --registry=https://registry.npmjs.org`

- [ ] **Codecov Token** (Optional)
  - [ ] Sign up at https://codecov.io
  - [ ] Add repository to Codecov
  - [ ] Copy upload token
  - [ ] Add to GitHub: Name: `CODECOV_TOKEN`

### 3. Branch Protection

- [ ] **Configure main branch protection**
  - [ ] Go to Settings → Branches → Add rule
  - [ ] Branch name pattern: `main`
  - [ ] Enable required settings:
    - [ ] ✅ Require a pull request before merging
    - [ ] ✅ Require approvals (1 minimum)
    - [ ] ✅ Require status checks to pass
      - [ ] Add: `CI Success`
      - [ ] Add: `Validate PR Title`
    - [ ] ✅ Require branches to be up to date
    - [ ] ✅ Require conversation resolution
    - [ ] ✅ Do not allow bypassing

- [ ] **Configure develop branch** (if used)
  - [ ] Same as main, but allow bypassing for maintainers

## Phase 2: Security & Compliance

### 4. Code Security

- [ ] **Enable CodeQL**
  - [ ] Go to Settings → Code security and analysis
  - [ ] Click "Set up" for CodeQL analysis
  - [ ] Select default configuration
  - [ ] Or use provided `.github/workflows/codeql.yml`

- [ ] **Enable Secret Scanning**
  - [ ] Settings → Code security and analysis
  - [ ] Enable "Secret scanning"
  - [ ] Enable "Push protection" (prevents committing secrets)

- [ ] **Enable Dependabot**
  - [ ] Settings → Code security and analysis
  - [ ] Enable "Dependabot alerts"
  - [ ] Enable "Dependabot security updates"
  - [ ] Enable "Dependabot version updates"
  - [ ] Verify `.github/dependabot.yml` exists

### 5. Actions Configuration

- [ ] **Set workflow permissions**
  - [ ] Go to Settings → Actions → General
  - [ ] Workflow permissions: Select "Read and write permissions"
  - [ ] Enable "Allow GitHub Actions to create and approve pull requests"

- [ ] **Configure Actions runners** (if using self-hosted)
  - [ ] Skip this for GitHub-hosted runners (default)

## Phase 3: Workflow Validation

### 6. Test CI Workflow

- [ ] **Create test branch**
  ```bash
  git checkout -b test/ci-validation
  echo "# CI Test" >> .github/test.txt
  git add .
  git commit -m "test: validate CI pipeline"
  git push origin test/ci-validation
  ```

- [ ] **Verify CI runs**
  - [ ] Go to Actions tab
  - [ ] Find "CI" workflow run
  - [ ] Verify all jobs pass:
    - [ ] Lint ✅
    - [ ] Type Check ✅
    - [ ] Build ✅
    - [ ] Test (all matrix combinations) ✅
    - [ ] Test Package ✅
    - [ ] Security ✅
    - [ ] CI Success ✅

- [ ] **Check execution time**
  - [ ] CI should complete in 5-12 minutes
  - [ ] If slower, check cache configuration

### 7. Test PR Workflow

- [ ] **Create Pull Request**
  ```bash
  gh pr create \
    --title "test: validate PR checks" \
    --body "Testing PR validation workflows"
  ```

- [ ] **Verify PR checks**
  - [ ] CI workflow runs ✅
  - [ ] PR title validation ✅
  - [ ] Dependency review runs ✅
  - [ ] Auto-labeling applies labels ✅
  - [ ] All required checks pass ✅

- [ ] **Test PR size warning**
  - [ ] Make large change (>500 lines)
  - [ ] Verify warning comment appears

- [ ] **Clean up test**
  - [ ] Close PR without merging
  - [ ] Delete test branch

### 8. Test Release Workflow

- [ ] **Merge first releasable commit**
  ```bash
  git checkout main
  git pull origin main
  git commit --allow-empty -m "feat: initialize CI/CD pipeline"
  git push origin main
  ```

- [ ] **Monitor release workflow**
  - [ ] Go to Actions → Release workflow
  - [ ] Verify jobs run:
    - [ ] Analyze ✅
    - [ ] Release ✅
    - [ ] Publish ✅
    - [ ] Notify ✅

- [ ] **Verify release artifacts**
  - [ ] GitHub release created
  - [ ] Git tag created: `v1.0.1` (or appropriate version)
  - [ ] Release notes generated
  - [ ] npm package published

- [ ] **Test npm package**
  ```bash
  # Wait 30 seconds for npm registry sync
  npm view @dcforge/image-specs version

  # Test installation
  mkdir -p /tmp/test && cd /tmp/test
  npm init -y
  npm install @dcforge/image-specs

  # Test imports
  node -e "import('@dcforge/image-specs').then(m => console.log('ESM:', typeof m.getImageSpecs))"
  node -e "const m = require('@dcforge/image-specs'); console.log('CJS:', typeof m.getImageSpecs)"

  # Test CLI
  npx @dcforge/image-specs --version
  ```

### 9. Test Manual Release

- [ ] **Trigger manual release**
  ```bash
  gh workflow run release.yml \
    --ref main \
    --field release-type=patch
  ```

- [ ] **Verify manual release works**
  - [ ] Release created
  - [ ] Version bumped correctly
  - [ ] npm package updated

## Phase 4: Documentation & Monitoring

### 10. Update Documentation

- [ ] **Add badges to README.md**
  - [ ] CI status badge
  - [ ] npm version badge
  - [ ] npm downloads badge
  - [ ] Codecov badge (if configured)
  - [ ] License badge
  - [ ] Node.js version badge
  - [ ] CodeQL badge

- [ ] **Copy badge code:**
  ```markdown
  [![npm version](https://badge.fury.io/js/@dcforge%2Fimage-specs.svg)](https://badge.fury.io/js/@dcforge%2Fimage-specs)
  [![npm downloads](https://img.shields.io/npm/dm/@dcforge/image-specs.svg)](https://www.npmjs.com/package/@dcforge/image-specs)
  [![Build Status](https://img.shields.io/github/actions/workflow/status/dcforge/image-specs/ci.yml?branch=main)](https://github.com/dcforge/image-specs/actions)
  [![Coverage Status](https://img.shields.io/codecov/c/github/dcforge/image-specs/main.svg)](https://codecov.io/gh/dcforge/image-specs)
  [![TypeScript](https://badges.frapsoft.com/typescript/love/typescript.svg?v=101)](https://github.com/ellerbrock/typescript-badges/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  ```

- [ ] **Update CONTRIBUTING.md**
  - [ ] Add conventional commit guidelines
  - [ ] Document release process
  - [ ] Link to CI/CD documentation

### 11. Configure Notifications

- [ ] **GitHub notifications**
  - [ ] Go to repository → Watch → Custom
  - [ ] Enable "Actions" notifications
  - [ ] Select preferred notification channel

- [ ] **Optional: Slack integration**
  - [ ] Add Slack app to workspace
  - [ ] Configure webhook in workflow files
  - [ ] Test notifications

- [ ] **Optional: Discord webhook**
  - [ ] Create webhook in Discord server
  - [ ] Add to GitHub secrets: `DISCORD_WEBHOOK`
  - [ ] Configure in workflow files

### 12. Monitoring Setup

- [ ] **Set up monitoring dashboard**
  - [ ] Bookmark Actions page
  - [ ] Monitor workflow success rate
  - [ ] Track average execution time

- [ ] **Configure alerts**
  - [ ] Email: Settings → Notifications → Actions
  - [ ] Enable "Notify me when a workflow run fails"

- [ ] **Track metrics**
  - [ ] npm download trends: https://npmtrends.com/image-specs
  - [ ] GitHub insights: Insights → Community
  - [ ] Security advisories: Security → Advisories

## Phase 5: Team Onboarding

### 13. Team Access

- [ ] **Configure collaborators**
  - [ ] Settings → Collaborators and teams
  - [ ] Add team members with appropriate roles:
    - [ ] **Admin**: Full access
    - [ ] **Maintain**: Manage without destructive actions
    - [ ] **Write**: Push access
    - [ ] **Triage**: Issue management
    - [ ] **Read**: Read-only access

### 14. Document Processes

- [ ] **Share documentation**
  - [ ] `.github/CICD_SETUP.md` - Complete setup guide
  - [ ] `.github/WORKFLOWS.md` - Workflow reference
  - [ ] `.github/SETUP_CHECKLIST.md` - This checklist

- [ ] **Conduct team review**
  - [ ] Walk through CI/CD pipeline
  - [ ] Demonstrate release process
  - [ ] Review conventional commit format
  - [ ] Practice creating PRs

### 15. Establish Guidelines

- [ ] **Commit message format**
  - [ ] Document required format: `type: description`
  - [ ] Share examples (feat, fix, docs, etc.)
  - [ ] Enforce via PR title validation

- [ ] **Release schedule**
  - [ ] Define release cadence (on-demand, weekly, etc.)
  - [ ] Document who can trigger releases
  - [ ] Establish emergency hotfix process

- [ ] **Code review process**
  - [ ] Require 1+ approvals
  - [ ] Require passing CI checks
  - [ ] Establish review turnaround time SLA

## Phase 6: Optimization & Maintenance

### 16. Performance Tuning

- [ ] **Optimize workflow speed**
  - [ ] Monitor average execution time
  - [ ] Identify slow jobs
  - [ ] Enable caching where applicable
  - [ ] Consider larger runners (if needed)

- [ ] **Reduce redundant runs**
  - [ ] Verify concurrency groups configured
  - [ ] Cancel in-progress runs on new pushes
  - [ ] Skip CI on documentation-only changes

### 17. Regular Maintenance

- [ ] **Schedule recurring tasks**
  - [ ] Review Dependabot PRs weekly
  - [ ] Rotate npm tokens every 90 days
  - [ ] Update workflow actions quarterly
  - [ ] Review security advisories monthly

- [ ] **Set calendar reminders**
  - [ ] Token rotation (every 90 days)
  - [ ] Dependency updates (weekly)
  - [ ] Security review (monthly)
  - [ ] Workflow audit (quarterly)

### 18. Continuous Improvement

- [ ] **Collect metrics**
  - [ ] Track CI success rate (target: >95%)
  - [ ] Monitor average workflow duration
  - [ ] Measure time-to-merge for PRs
  - [ ] Track npm download growth

- [ ] **Iterate on processes**
  - [ ] Gather team feedback
  - [ ] Identify bottlenecks
  - [ ] Propose improvements
  - [ ] Document changes

## Verification Checklist

### Final Validation

- [ ] **All workflows operational**
  - [ ] CI ✅
  - [ ] Release ✅
  - [ ] CodeQL ✅
  - [ ] Dependency Review ✅
  - [ ] PR Checks ✅

- [ ] **All secrets configured**
  - [ ] NPM_TOKEN ✅
  - [ ] CODECOV_TOKEN ✅ (optional)

- [ ] **Branch protection active**
  - [ ] main branch protected ✅
  - [ ] Required checks enforced ✅

- [ ] **Security features enabled**
  - [ ] CodeQL analysis ✅
  - [ ] Secret scanning ✅
  - [ ] Dependabot updates ✅

- [ ] **Documentation complete**
  - [ ] README badges ✅
  - [ ] Setup guides ✅
  - [ ] Contributing guidelines ✅

- [ ] **Team onboarded**
  - [ ] Access granted ✅
  - [ ] Training completed ✅
  - [ ] Processes documented ✅

## Success Criteria

Your CI/CD pipeline is fully operational when:

✅ **Automated Testing**: Every push triggers comprehensive CI checks
✅ **Quality Gates**: PRs require passing checks before merge
✅ **Semantic Releases**: Conventional commits trigger automatic releases
✅ **npm Publication**: Releases automatically publish to npm registry
✅ **Security Scanning**: CodeQL and Dependabot monitor vulnerabilities
✅ **Documentation**: Team understands processes and workflows
✅ **Monitoring**: Metrics tracked and alerts configured

## Troubleshooting

If any step fails, refer to:
- `.github/CICD_SETUP.md` - Detailed troubleshooting section
- `.github/WORKFLOWS.md` - Quick fixes and commands
- GitHub Actions logs - Detailed error messages

## Next Steps

After completing this checklist:

1. **Monitor first few releases** - Ensure smooth operation
2. **Gather team feedback** - Identify pain points
3. **Optimize workflows** - Improve speed and reliability
4. **Document learnings** - Update guides based on experience
5. **Share success** - Communicate improvements to stakeholders

## Completion

- [ ] **All checklist items completed**
- [ ] **CI/CD pipeline fully operational**
- [ ] **Team trained and confident**
- [ ] **Documentation reviewed and approved**
- [ ] **Ready for production use**

**Date Completed:** _______________
**Completed By:** _______________
**Reviewed By:** _______________

---

**Congratulations!** Your CI/CD pipeline is ready. 🎉

For ongoing support, refer to:
- 📖 [CI/CD Setup Guide](.github/CICD_SETUP.md)
- 🔧 [Workflows Reference](.github/WORKFLOWS.md)
- 🐛 [GitHub Issues](https://github.com/dcforge/image-specs/issues)
