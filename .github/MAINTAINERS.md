# Maintainer Guide

## Local verification

Use Node.js 22.22.1 or newer and install the locked dependencies before running the same checks as CI:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test -- --run
npm run test:coverage -- --run
npm pack --dry-run
```

## Pull requests

The repository workflows expose two stable checks for branch protection:

- `CI Success` aggregates the quality job and the complete Node/operating-system test matrix.
- `Validate PR Title` enforces the conventional-commit title used by release analysis.

CodeQL, dependency review, size guidance, and automatic labels remain separate workflows. Require `CI Success` and `Validate PR Title` on protected branches; add the security checks when their event coverage matches the repository policy.

## Repository secrets

- `PAT_TOKEN`: a repository-scoped token allowed to push the version commit and tag to protected `main`.
- `NPM_TOKEN`: an npm automation token allowed to publish `@dcforge/image-specs`.
- `CODECOV_TOKEN`: optional for private Codecov uploads; coverage upload is non-blocking.

Keep credentials in GitHub Actions secrets. Never place them in workflow files, package configuration, logs, or local documentation.

## Release flow

Pushes to `main` inspect conventional commit subjects since the latest tag. Breaking changes take precedence over features, which take precedence over fixes. A manual dispatch can explicitly select patch, minor, or major.

The workflow then:

1. Runs formatting, linting, type checking, and tests.
2. Updates `package.json` and `package-lock.json`.
3. Commits the version, creates the tag, and pushes both with `PAT_TOKEN`.
4. Creates a GitHub release with generated notes.
5. Checks out the tag and publishes it to npm with `NPM_TOKEN`; `prepublishOnly` performs the clean build and tests once.

## Release recovery

- Before the version commit is pushed: fix the failure and rerun the workflow.
- After the tag exists but npm publication fails: use **Re-run failed jobs** so the existing release is published without creating another version.
- Before retrying publication, confirm the version is absent with `npm view @dcforge/image-specs@<version> version`.
- If the package is already published but the GitHub release is missing, create the release from the existing tag; never reuse or move a published tag.
