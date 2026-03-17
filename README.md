# Fanek

**Open-source client information manager for service providers**

Fanek is an open-source client information manager for IT, cloud, telecom, and MSP service providers. Track your clients, their services, and contacts in one place. It is a living inventory of "who has what" -- not a CRM, not a helpdesk, not a billing system.

## What It Is

- A structured registry of customers and the services they subscribe to
- A dynamic service catalog where admins define service types with custom field schemas
- A role-based system (Admin, Editor, Viewer) for team access control
- An auditable record of changes to customer and service data

## What It Is Not

- Not a CRM (no sales pipeline, no leads, no marketing)
- Not a helpdesk (no tickets, no SLAs)
- Not a billing system (no invoices, no payments)

## Key Features

- **Dynamic service catalog** -- Admins define service types with custom field schemas; service records store field values as structured data
- **Admin-configurable customer statuses** -- Ships with sensible defaults; fully customizable via the UI
- **First-run setup wizard** -- Guided flow to create the admin account, set organization details, and choose a starter template
- **Role-based access control** -- Three roles: Admin, Editor, Viewer
- **Audit logging** -- Structured logs for all data changes with user attribution
- **CSV/JSON export** -- Export customer and service data for reporting and integrations
- **OAuth support** -- Enable Google or other OAuth providers via the Admin Settings UI (no file edits required)
- **Docker support** -- Ship and run with a single `docker compose up`

## Quick Start (Docker)

```bash
git clone https://github.com/mulaifi/fanek.git
cd fanek
cp .env.example .env
# Edit .env: set NEXTAUTH_SECRET (generate with: openssl rand -hex 32)
docker compose up
```

Then open [http://localhost:3000](http://localhost:3000) and complete the setup wizard.

## Manual Installation

```bash
git clone https://github.com/mulaifi/fanek.git
cd fanek
npm install
cp .env.example .env          # edit DATABASE_URL and NEXTAUTH_SECRET
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and complete the setup wizard.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (Pages Router, React 19) |
| UI | Mantine v8 |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | NextAuth.js (credentials + configurable OAuth) |
| Logging | Pino (structured JSON) |
| Testing | Jest (unit/integration), Playwright (E2E) |
| Containerization | Docker Compose |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Random secret for session signing |
| `NEXTAUTH_URL` | Yes | Full URL of the app (e.g. `http://localhost:3000`) |
| `PORT` | No | HTTP port (default: 3000) |

## Password Reset

If an admin loses their password, reset it from the command line on the server:

```bash
# Generate a random temporary password (user must change on next login)
npm run reset-password admin@example.com

# Or set a specific password
npm run reset-password admin@example.com -- --password MyNewPass123!
```

Non-admin users can have their passwords reset by an admin via the Users management page.

## Screenshots

Screenshots coming soon.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, project structure, and the PR workflow.

## License

MIT -- see [LICENSE](LICENSE).
