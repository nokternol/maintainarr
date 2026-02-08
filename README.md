# Maintainarr

Task automation and metadata-driven grouping for the \*arr ecosystem.

## Quick Start

### Prerequisites

- **Node.js**: v24.13.0 or higher (automatically managed via `.nvmrc`)
- **Package Manager**: Yarn 1.22+
- **OS**: Linux, macOS, or WSL2

### Setup

1. **Install Node Version Manager (fnm)**

   ```bash
   # Install fnm
   curl -fsSL https://fnm.vercel.app/install | bash

   # Restart your shell or run:
   source ~/.bashrc  # or ~/.zshrc

   # fnm will automatically use the Node version from .nvmrc
   ```

2. **Install Dependencies**

   ```bash
   yarn install
   ```

3. **Setup Cypress (WSL/Linux only)**

   If you're on WSL or Linux and want to run E2E tests:

   ```bash
   ./scripts/setup-cypress-wsl.sh
   ```

### Development

```bash
# Start dev server (port 5056)
yarn dev

# Run all tests and checks (GOD SCRIPT)
yarn verify          # Full: Lint + TypeCheck + Unit Tests + E2E
yarn verify:fast     # Skip E2E tests (faster)

# Individual commands
yarn lint            # Check code quality
yarn lint:fix        # Fix code quality issues
yarn typecheck       # Type check
yarn test            # Unit tests (watch mode)
yarn test:run        # Unit tests (run once)
yarn test:e2e        # E2E tests (interactive)
yarn ladle           # Component stories
```

## Node Version Management

This project uses `.nvmrc` to specify the Node version. We recommend **fnm** (Fast Node Manager) over nvm.

### Why fnm?

- ⚡ **Faster**: Written in Rust
- 🎯 **Auto-switching**: Automatically uses `.nvmrc` when you `cd` into the directory
- 📦 **Lightweight**: Smaller footprint than nvm
- 🔄 **Compatible**: Works with `.nvmrc` files

### Setup fnm

```bash
# Install fnm
curl -fsSL https://fnm.vercel.app/install | bash

# Add to your shell config (~/.bashrc or ~/.zshrc)
eval "$(fnm env --use-on-cd)"

# Install and use Node version from .nvmrc
fnm install
fnm use
```

Now when you `cd` into the project directory, fnm will automatically switch to Node 24.13.0!

## WSL Setup

### Cypress on WSL

Cypress requires additional system libraries on WSL/Linux:

```bash
# Run the setup script
./scripts/setup-cypress-wsl.sh

# Or manually install:
sudo apt-get update
sudo apt-get install -y \
  libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev \
  libnss3 libxss1 libasound2 libxtst6 xauth xvfb
```

### Common WSL Issues

**Issue**: Cypress won't start (missing dependencies)
- **Solution**: Run `./scripts/setup-cypress-wsl.sh` to install required system libraries

**Issue**: Node version mismatch
- **Solution**: Install fnm and run `fnm use`

**Issue**: Port already in use
- **Solution**: Kill process on port 5056: `lsof -ti:5056 | xargs kill -9`

## Scripts Reference

### Development
- `yarn dev` - Start dev server on port 5056
- `yarn build` - Build for production
- `yarn start` - Run production build

### Testing
- `yarn test` - Unit tests (watch mode)
- `yarn test:run` - Unit tests (single run)
- `yarn test:ui` - Unit tests (with UI)
- `yarn test:e2e` - E2E tests (interactive)
- `yarn test:e2e:headless` - E2E tests (headless)
- `yarn ladle` - Component stories

### Code Quality
- `yarn lint` - Check code quality
- `yarn lint:fix` - Fix code quality issues
- `yarn format` - Format code
- `yarn typecheck` - Type check all code

### GOD SCRIPTS (Verify Everything)
- `yarn verify:fast` - Lint + Format + TypeCheck + Unit Tests
- `yarn verify` - Full verification + E2E tests
- `yarn ci:fast` - CI without E2E (no auto-fixes)
- `yarn ci` - Full CI pipeline

## Technology Stack

### Core
- **Node.js**: 24.13.0 (LTS)
- **Next.js**: 15.1.5 (React framework)
- **React**: 18.3.1
- **TypeScript**: 5.7.2
- **Express**: 4.21.2 (API server)

### Testing
- **Vitest**: 2.1.8 (Unit tests)
- **Cypress**: 13.17.0 (E2E tests)
- **Ladle**: 4.1.2 (Component stories)
- **MSW**: 2.7.0 (API mocking)

### Code Quality
- **Biome**: 1.9.4 (Linter + Formatter)

## Testing Architecture

See [TESTING.md](TESTING.md) for comprehensive testing documentation.

### Key Principles

1. **MSW Isolation**: MSW is never imported in application code - only in test frameworks
2. **Shared Handlers**: All test frameworks use the same HTTP handlers from `tests/mocks/handlers/`
3. **Fast Feedback**: GOD scripts provide instant verification of all changes
4. **Framework Ownership**: Each test framework manages its own MSW worker

## Contributing

Before submitting a PR:

```bash
# Run verification
yarn verify:fast

# Or with E2E tests
yarn verify
```

All checks must pass:
- ✅ Code formatted (Biome)
- ✅ No lint errors
- ✅ No type errors
- ✅ All tests passing

## License

MIT

## Links

- **Repository**: https://github.com/nokternol/maintainarr
- **Documentation**: [TESTING.md](TESTING.md)
- **Issues**: https://github.com/nokternol/maintainarr/issues
