<p align="center">
  <img src="public/fanek-logo-full.svg" alt="Fanek" width="320" />
</p>

<p align="center">
  <strong>Open-source client information manager for service providers</strong>
</p>

<p align="center">
  <a href="https://github.com/mulaifi/fanek/actions/workflows/ci.yml"><img src="https://github.com/mulaifi/fanek/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/mulaifi/fanek/blob/main/LICENSE"><img src="https://img.shields.io/github/license/mulaifi/fanek" alt="License" /></a>
  <a href="https://github.com/mulaifi/fanek/releases"><img src="https://img.shields.io/github/v/release/mulaifi/fanek?include_prereleases" alt="Release" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node" />
  <img src="https://img.shields.io/badge/PostgreSQL-16+-blue" alt="PostgreSQL" />
</p>

<p align="center">
  Track your clients, their services, and contacts in one place.<br />
  A living inventory of <em>"who has what"</em> for IT, cloud, telecom, and MSP service providers.
</p>

## What Fanek Is

- A structured registry of customers and the services they subscribe to
- A dynamic service catalog where admins define service types with custom field schemas
- A role-based system (Admin, Editor, Viewer) for team access control
- An auditable record of changes to customer and service data

## What Fanek Is Not

- Not a CRM (no sales pipeline, no leads, no marketing)
- Not a helpdesk (no tickets, no SLAs)
- Not a billing system (no invoices, no payments)

## Key Features

| Feature | Description |
|---------|-------------|
| **Dynamic Service Catalog** | Admins define service types with custom field schemas; service records store field values as structured data |
| **Inline Editing** | All editing happens in context, no modal popups. Clean view/edit separation throughout |
| **Setup Wizard** | Guided first-run flow: create admin, set org details, pick a starter template (Cloud, Telecom, MSP, or Blank) |
| **Role-Based Access** | Three roles: Admin (full access), Editor (create/edit), Viewer (read-only) |
| **Configurable Statuses** | Customer statuses ship with sensible defaults, fully customizable via the UI |
| **Contacts Manager** | Multiple contacts per customer/partner, each with multiple emails and phones |
| **Audit Log** | Structured logs for all data changes with user attribution and JSON detail |
| **Global Search** | Spotlight-style search (Cmd+K) across customers, partners, and services |
| **CSV/JSON Export** | Export customer and partner data for reporting and integrations |
| **OAuth Support** | Enable Google or other OAuth providers via Admin Settings (no file edits) |
| **Dark/Light Mode** | Toggle between dark (default) and light themes |
| **Docker Ready** | Ship and run with a single `docker compose up` |
| **CLI Admin Tools** | `npm run reset-password` and `npm run list-users` for server-side admin |

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/mulaifi/fanek.git
cd fanek
cp .env.example .env
# Edit .env: set NEXTAUTH_SECRET (generate with: openssl rand -hex 32)
docker compose up
```

### Manual Installation

```bash
git clone https://github.com/mulaifi/fanek.git
cd fanek
npm install
cp .env.example .env          # edit DATABASE_URL and NEXTAUTH_SECRET
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and complete the setup wizard.

## Documentation

**English:**
- [Admin Guide](docs/en/admin-guide.md) -- Installation, setup, user management, service catalog configuration
- [User Guide](docs/en/user-guide.md) -- Day-to-day usage: customers, services, partners, search

**العربية:**
- [دليل المسؤول](docs/ar/admin-guide.md) -- التثبيت، الإعداد، إدارة المستخدمين، تهيئة كتالوج الخدمات
- [دليل المستخدم](docs/ar/user-guide.md) -- الاستخدام اليومي: العملاء، الخدمات، الشركاء، البحث

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js](https://nextjs.org/) 16 (Pages Router) |
| UI | [Tailwind CSS](https://tailwindcss.com/) v4 + [shadcn/ui](https://ui.shadcn.com/) |
| Database | [PostgreSQL](https://www.postgresql.org/) 16+ |
| ORM | [Prisma](https://www.prisma.io/) 7 |
| Auth | [NextAuth.js](https://next-auth.js.org/) (credentials + OAuth) |
| Logging | [Pino](https://getpino.io/) (structured JSON) |
| Testing | [Jest](https://jestjs.io/) + [Playwright](https://playwright.dev/) |
| Container | [Docker Compose](https://docs.docker.com/compose/) |

## Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Random secret for session signing (`openssl rand -hex 32`) |
| `NEXTAUTH_URL` | Yes | Full URL of the app (e.g. `http://localhost:3000`) |
| `PORT` | No | HTTP port (default: 3000) |

## Project Structure

```
fanek/
├── prisma/           # Schema and seed data (starter templates)
├── lib/              # Utilities: auth, encryption, validation, logging, audit
├── pages/            # Next.js pages and API routes
│   └── api/          # REST API handlers
├── components/       # React UI components
├── styles/           # Global CSS
├── public/           # Static assets and logos
├── scripts/          # CLI admin tools (reset-password, list-users)
├── __tests__/        # Jest unit/integration + Playwright E2E
└── docs/             # Testing plans and documentation
```

## Admin CLI Tools

If an admin loses their password, reset it from the server command line:

```bash
# Generate a random temporary password (user must change on next login)
npm run reset-password admin@example.com

# Set a specific password
npm run reset-password admin@example.com -- --password MyNewPass123!

# List all users
npm run list-users
```

## Screenshots

*Coming soon*

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, project structure, and the PR workflow.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## License

[MIT](LICENSE) -- Made in Kuwait 🇰🇼
