# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via GitHub Security Advisories:

1. Go to the [Security Advisories](https://github.com/dcforge/image-specs/security/advisories) page
2. Click "Report a vulnerability"
3. Fill out the form with details about the vulnerability

You can expect:
- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity (see below)

### What to Include

When reporting a vulnerability, please include:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if any)
- Your contact information (for follow-up)

### Severity Levels

| Severity | Response Time | Fix Timeline |
|----------|--------------|--------------|
| Critical | < 24 hours | < 7 days |
| High | < 48 hours | < 14 days |
| Medium | < 7 days | < 30 days |
| Low | < 14 days | Next release |

## Security Best Practices for Contributors

### Code Review

All code changes must:
- Pass CodeQL security analysis
- Pass Dependabot dependency review
- Be reviewed by at least one maintainer
- Have no known security vulnerabilities

### Dependencies

We use automated tools to keep dependencies secure:

- **Dependabot**: Weekly dependency updates
- **npm audit**: Runs on every CI build
- **Dependency Review**: Analyzes new dependencies in PRs

### Secrets Management

**Never commit sensitive data:**
- API keys
- Access tokens
- Passwords
- Private keys
- Environment variables with secrets

**What to do if you commit a secret:**
1. Immediately revoke/rotate the secret
2. Report it via Security Advisories
3. Force push to remove from history (coordinate with maintainers)
4. Update documentation

### CI/CD Security

Our CI/CD pipeline implements:

- **Minimal Permissions**: Each workflow has least-privilege access
- **Token Expiration**: GITHUB_TOKEN expires after each run
- **Secret Scanning**: Push protection prevents committing secrets
- **CodeQL Analysis**: Weekly security scans
- **Signed Commits**: Recommended (optional)

## Security Features

### Automated Security Scanning

1. **CodeQL Analysis**
   - Runs on every push and PR
   - Weekly scheduled scans
   - Detects common vulnerabilities (SQL injection, XSS, etc.)

2. **Dependency Scanning**
   - Dependabot alerts for vulnerable dependencies
   - Automated security updates
   - PR reviews for new dependencies

3. **Secret Scanning**
   - Detects committed secrets
   - Push protection enabled
   - Automatic alert notifications

### Branch Protection

The `main` branch is protected with:
- Required PR reviews
- Required status checks (CI must pass)
- No force pushes
- No deletions
- Conversation resolution required

### npm Package Security

- **2FA Required**: npm account has 2FA enabled
- **Automation Token**: Scoped to publish only
- **Token Rotation**: Every 90 days
- **Package Provenance**: Enabled via npm publish

## Security Checklist for Releases

Before each release:

- [ ] All dependencies up to date
- [ ] No known security vulnerabilities
- [ ] CodeQL analysis passed
- [ ] npm audit shows no issues
- [ ] Security advisory review completed
- [ ] Changelog includes security fixes (if any)

## Known Security Considerations

### Image Processing

This package processes potentially untrusted image data. Security considerations:

1. **Buffer Overflows**:
   - All buffer reads are bounds-checked
   - Maximum file size limits enforced
   - Stream processing prevents memory exhaustion

2. **Denial of Service**:
   - Configurable timeouts
   - Memory limits on stream processing
   - Invalid format rejection

3. **Path Traversal**:
   - CLI validates input paths
   - No arbitrary file system access
   - URL fetching uses safe HTTP client

### Dependencies

We minimize dependencies to reduce attack surface:
- Zero runtime dependencies
- Development dependencies carefully vetted
- Regular security audits

## Security Updates

Security updates are:
- Released as patch versions (e.g., 1.0.1 → 1.0.2)
- Announced in release notes
- Published to GitHub Security Advisories
- Documented in CHANGELOG.md

## Contact

For security concerns that don't fit the above:

- **GitHub**: [@rgdcastro](https://github.com/rgdcastro)
- **Security Email**: Create a GitHub Security Advisory

## Acknowledgments

We thank the following security researchers for responsible disclosure:

_(None yet - but we'd love to acknowledge your contributions!)_

## Further Reading

- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [npm Security Best Practices](https://docs.npmjs.com/packages-and-modules/securing-your-code)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)

---

**Last Updated:** 2025-10-01
**Policy Version:** 1.0.0
