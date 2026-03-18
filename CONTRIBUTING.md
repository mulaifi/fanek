# Contributing to Fanek

Thank you for your interest in contributing. This document covers how to set up a development environment, run the tests, and submit changes.

## Development Setup

```bash
# 1. Clone the repo
git clone https://github.com/mulaifi/fanek.git
cd fanek

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env: set DATABASE_URL (PostgreSQL) and NEXTAUTH_SECRET

# 4. Apply database migrations
npx prisma db push

# 5. Start the dev server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
fanek/
├── prisma/           # Schema and seed data (starter templates)
├── lib/              # Utilities: auth, encryption, validation, logging, audit
├── pages/            # Next.js pages and API routes
│   └── api/          # REST API handlers
├── components/       # React UI components
├── styles/           # Global CSS
├── public/           # Static assets
├── __tests__/        # Jest unit/integration + Playwright E2E
│   ├── api/          # API route tests
│   ├── lib/          # Library utility tests
│   └── e2e/          # Playwright E2E tests
└── docs/             # Specs and implementation plans
```

## Running Tests

```bash
# Unit and integration tests
npm test

# Unit tests in watch mode
npm run test:watch

# E2E tests (requires a running app and database)
npm run test:e2e
```

## PR Workflow

1. Fork the repository and create a branch from `main`.
2. Make your changes with tests where applicable.
3. Ensure all unit tests pass (`npm test`).
4. Push your branch and open a pull request against `main`.
5. Fill in the pull request template.
6. Address any review feedback.

## Commit Message Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <short description>

[optional body]
```

Common types:

| Type | When to use |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `test` | Adding or updating tests |
| `refactor` | Code change that is not a feature or bug fix |
| `chore` | Build process, dependency updates, tooling |

Examples:

```
feat(api): add CSV export endpoint for customers
fix(auth): redirect to login when session expires
docs: update installation steps in README
```

## Code Style

- JavaScript files use CommonJS (`require`/`module.exports`) to match the existing codebase.
- API routes follow the pattern in `pages/api/`.
- All sensitive operations should go through the utilities in `lib/` (auth, encryption, audit).
- Keep API handlers thin; put business logic in `lib/`.

## Reporting Issues

Use the GitHub issue templates:

- **Bug report** -- Something is broken
- **Feature request** -- Something useful is missing
