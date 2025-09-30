# Contributing to image-specs

Thank you for your interest in contributing to image-specs! We welcome contributions from the community and are grateful for any help you can provide.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Development Guidelines](#development-guidelines)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Adding New Image Format Support](#adding-new-image-format-support)
- [Documentation](#documentation)
- [Questions and Support](#questions-and-support)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please be respectful and professional in all interactions.

- Be welcoming and inclusive
- Respect differing viewpoints and experiences
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other community members

## Getting Started

1. **Fork the Repository**: Click the "Fork" button on the GitHub repository page
2. **Clone Your Fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/image-specs.git
   cd image-specs
   ```
3. **Add Upstream Remote**:
   ```bash
   git remote add upstream https://github.com/dcforge/image-specs.git
   ```

## Development Setup

### Prerequisites

- Node.js 18.x or higher
- npm, yarn, or pnpm
- Git

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests to verify setup
npm test
```

### Available Scripts

```bash
npm run dev          # Build in watch mode
npm run build        # Build production bundle
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
npm run test:ui      # Open test UI
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run typecheck    # Run TypeScript type checking
npm run clean        # Clean build artifacts
```

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates. When creating a bug report, include:

1. **Clear Title**: Descriptive summary of the issue
2. **Description**: Detailed explanation of the bug
3. **Steps to Reproduce**: List of steps to reproduce the behavior
4. **Expected Behavior**: What you expected to happen
5. **Actual Behavior**: What actually happened
6. **Environment**:
   - OS and version
   - Node.js version
   - Package version
7. **Code Sample**: Minimal reproducible example
8. **Error Messages**: Any error messages or stack traces

### Suggesting Enhancements

Enhancement suggestions are welcome! Please provide:

1. **Use Case**: Explain the problem you're trying to solve
2. **Proposed Solution**: Describe your suggested implementation
3. **Alternatives**: Any alternative solutions you've considered
4. **Additional Context**: Any other relevant information

### Your First Contribution

Look for issues labeled with:
- `good first issue` - Simple issues good for beginners
- `help wanted` - Issues where we need community help
- `documentation` - Documentation improvements

## Pull Request Process

1. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**:
   - Write clean, readable code
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**:
   ```bash
   npm run test
   npm run lint
   npm run typecheck
   ```

4. **Commit Your Changes**:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

5. **Push to Your Fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create Pull Request**:
   - Go to your fork on GitHub
   - Click "New Pull Request"
   - Select your feature branch
   - Fill in the PR template
   - Submit the PR

### PR Requirements

- ✅ All tests must pass
- ✅ No linting errors
- ✅ Code coverage should not decrease
- ✅ Documentation updated if needed
- ✅ Follows code style guidelines
- ✅ Includes tests for new features
- ✅ Commits follow conventional commit format

## Development Guidelines

### Project Structure

```
image-specs/
├── src/
│   ├── parsers/       # Image format parsers
│   │   ├── jpeg.ts
│   │   ├── png.ts
│   │   ├── gif.ts
│   │   └── ...
│   ├── utils/         # Utility functions
│   │   ├── buffer-reader.ts
│   │   ├── bit-reader.ts
│   │   └── image-utils.ts
│   ├── types.ts       # TypeScript type definitions
│   ├── index.ts       # Main entry point
│   └── cli.ts         # CLI implementation
├── tests/             # Test files
├── dist/              # Build output (generated)
└── docs/              # Documentation
```

### Key Principles

1. **Zero Dependencies**: Keep the library dependency-free
2. **Performance First**: Optimize for minimal byte reading
3. **Type Safety**: Use TypeScript strictly
4. **Test Coverage**: Maintain high test coverage
5. **Documentation**: Keep docs up-to-date

## Testing

### Writing Tests

Tests are written using Vitest. Place test files in the `tests/` directory.

```typescript
import { describe, it, expect } from 'vitest';
import { parseJPEG } from '../src/parsers/jpeg';

describe('JPEG Parser', () => {
  it('should parse valid JPEG header', () => {
    const buffer = Buffer.from([/* ... */]);
    const result = parseJPEG(buffer);
    expect(result).toEqual({
      width: 100,
      height: 100,
      // ...
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/parsers.test.ts
```

## Code Style

### TypeScript Guidelines

- Use strict TypeScript settings
- Avoid `any` types
- Prefer interfaces over type aliases for objects
- Use const assertions where appropriate
- Document complex types

### Formatting

We use Prettier for code formatting and ESLint for linting.

```bash
# Format code
npm run format

# Check linting
npm run lint

# Fix linting issues
npm run lint -- --fix
```

### Best Practices

1. **Buffer Reading**: Use `BufferReader` utility for consistent buffer operations
2. **Error Handling**: Return `null` for invalid data, throw for unexpected errors
3. **Performance**: Read only necessary bytes, use early returns
4. **Comments**: Add comments for complex logic, avoid obvious comments

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions or changes
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other changes

### Examples
```bash
feat(parser): add HEIC image format support

fix(jpeg): correctly parse EXIF orientation data

docs(readme): update installation instructions

perf(png): optimize chunk reading for large files

test(webp): add tests for VP8X extended format
```

## Adding New Image Format Support

To add support for a new image format:

1. **Create Parser File**: `src/parsers/[format].ts`
   ```typescript
   import type { ParseResult } from '../types.js';
   import { BufferReader } from '../utils/index.js';

   export function parse[FORMAT](buffer: Buffer): ParseResult | null {
     // Validate minimum buffer size
     if (buffer.length < MINIMUM_SIZE) {
       return null;
     }

     const reader = new BufferReader(buffer, isLittleEndian);

     // Check file signature
     // Parse header
     // Extract metadata

     return {
       width,
       height,
       type: 'format',
       mime: 'image/format',
       // ... additional metadata
     };
   }
   ```

2. **Add to Index**: Update `src/parsers/index.ts`
   ```typescript
   import { parse[FORMAT] } from './[format].js';

   export const parsers: readonly Parser[] = [
     // ... existing parsers
     parse[FORMAT],
   ];
   ```

3. **Add Tests**: Create `tests/[format].test.ts`
   ```typescript
   describe('parse[FORMAT]', () => {
     it('should parse valid [format] header', () => {
       // Test implementation
     });
   });
   ```

4. **Update Documentation**:
   - Add format to README.md supported formats table
   - Update type definitions if needed
   - Add CLI examples if applicable

## Documentation

### Code Documentation

- Use JSDoc comments for public APIs
- Include parameter descriptions
- Add usage examples for complex functions

```typescript
/**
 * Parse PNG image format
 * @param buffer - Image data buffer
 * @returns Parsed image specifications or null if invalid
 * @example
 * const specs = parsePNG(buffer);
 * console.log(`${specs.width}x${specs.height}`);
 */
export function parsePNG(buffer: Buffer): ParseResult | null {
  // ...
}
```

### README Updates

When updating the README:
- Keep examples simple and clear
- Ensure code examples are tested
- Update bundle size if it changes significantly
- Keep feature list current

## Questions and Support

### Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and general discussion
- **Stack Overflow**: Tag with `image-specs`

### Contact

- Open an issue for questions about contributing
- Tag maintainers in PR for review: @rgdcastro

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to image-specs! 🎉