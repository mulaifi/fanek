# Operations Runbook

Fanek's operational runbook — deployment, backups, rollback, and incident
response — lives in the **[Production Guide](en/production-guide.md)**, a
comprehensive guide covering:

- Deployment (Docker Compose, environment configuration, HTTPS/reverse proxy)
- Database backups and restore (`pg_dump`/`pg_restore`)
- Upgrades and rollback procedures
- Health checks (`/api/health`) and monitoring
- Troubleshooting common failures

For incident response, start with the **Troubleshooting** and **Backups &
Restore** sections of the Production Guide.

## Changelog / release notes

Per-version release notes are published on the project's
[GitHub Releases](https://github.com/mulaifi/fanek/releases) page.
