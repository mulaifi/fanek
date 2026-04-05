# Production Deployment Guide

This guide walks you through deploying Fanek on a production server. It covers server setup, reverse proxy configuration with SSL, firewall rules, backups, and ongoing maintenance.

Fanek's application configuration (organization name, service catalog, users) is done entirely through the Admin UI after deployment. This guide covers only the infrastructure setup: installing the app, making it accessible via HTTPS, and keeping it secure.

## Contents

1. [Prerequisites](#1-prerequisites)
2. [Deploy Fanek](#2-deploy-fanek)
3. [DNS Configuration](#3-dns-configuration)
4. [Reverse Proxy Setup](#4-reverse-proxy-setup)
5. [Firewall and Security Hardening](#5-firewall-and-security-hardening)
6. [Backups](#6-backups)
7. [Updates and Upgrades](#7-updates-and-upgrades)
8. [Troubleshooting](#8-troubleshooting)


## 1. Prerequisites

You will need:

- **A Linux server** -- Ubuntu 22.04, Ubuntu 24.04, or Debian 12. Other distributions work but commands in this guide target apt-based systems.
- **A domain name** -- e.g. `fanek.example.com`. For internet-facing deployments, point it to your server's IP address before starting (see [Section 3](#3-dns-configuration)). For internal/LAN deployments, you can use `/etc/hosts` entries instead.
- **SSH access** -- with a non-root user that has `sudo` privileges.
- **Open ports** -- 22 (SSH), 80 (HTTP), and 443 (HTTPS).

Choose one of these deployment methods:

| Method | You provide | Fanek handles |
|--------|------------|---------------|
| **Docker** (recommended) | Docker and Docker Compose | Database, secrets, migrations, process management |
| **Bare-metal** | Node.js 20+, PostgreSQL 16+ | Application only |

The Docker method is recommended because the entrypoint script automatically handles secret generation, database readiness checks, and schema migrations. With bare-metal, you manage these steps yourself.

### Installing Docker (if using Docker method)

```bash
# Install prerequisite packages for adding the Docker repository
sudo apt update
sudo apt install -y ca-certificates curl

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the Docker repository to apt sources
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine, CLI, and Compose plugin
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Allow your user to run Docker without sudo
sudo usermod -aG docker $USER

# To apply the group changes, you must log out and log back in.

# After logging back in, verify the installation:
docker --version
docker compose version
```

For Debian, replace `ubuntu` with `debian` in the repository URL above. See the [official Docker docs](https://docs.docker.com/engine/install/) for other distributions.


## 2. Deploy Fanek

### Option A: Docker (recommended)

**Step 1: Clone the repository.**

```bash
# Clone Fanek into /opt/fanek
sudo mkdir -p /opt/fanek
sudo chown $USER:$USER /opt/fanek
git clone https://github.com/mulaifi/fanek.git /opt/fanek
cd /opt/fanek
```

**Step 2: Create the `.env` file.**

```bash
# Copy the example environment file
cp .env.example .env
```

Edit `.env` and set these values:

```bash
# Set the application URL to your domain (must match how users access it in the browser)
NEXTAUTH_URL=https://fanek.example.com

# Set the environment to production
NODE_ENV=production
```

You do not need to set `NEXTAUTH_SECRET` for Docker deployments. The entrypoint script automatically generates a secure secret on first start and persists it in the `data` volume at `/data/secrets/nextauth_secret`. You also do not need to set `DATABASE_URL`, as Docker Compose provides the database connection internally.

**Step 3: Bind the app to localhost only.**

By default, `docker-compose.yml` exposes Fanek on all interfaces and exposes the PostgreSQL port. In production, the reverse proxy handles external traffic, so Fanek should only listen on `127.0.0.1`. Create a `docker-compose.override.yml` file:

```yaml
# docker-compose.override.yml
# Restricts Fanek to localhost (reverse proxy forwards traffic to it)
# and removes the exposed PostgreSQL port for security.
#
# NOTE: The !reset syntax requires Docker Compose v2.24.6 or later.
# Check your version with: docker compose version
services:
  app:
    ports:
      # Bind Fanek to localhost only, so it is not directly accessible from outside
      - "127.0.0.1:${PORT:-8080}:${PORT:-8080}"
  db:
    # Remove the exposed PostgreSQL port entirely
    ports: !reset []
```

> **Important:** The `!reset` syntax requires Docker Compose v2.24.6 or later. Check your version with `docker compose version`. If your version is older, upgrade Docker Compose or remove the `ports` key from the base `docker-compose.yml` manually instead.

**Step 4: Start the application.**

```bash
# Build and start all containers in detached mode
docker compose up -d --build
```

**Step 5: Verify Fanek is running.**

```bash
# Check that the app responds on localhost
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080
# Expected output: 200 (or 302 if redirecting to login/setup)
```

You can also check the container logs:

```bash
# View recent app logs
docker compose logs --tail 50 app
```

### Option B: Bare-metal

**Step 1: Install Node.js 20.**

```bash
# Add the NodeSource repository for Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify
node --version
npm --version
```

**Step 2: Install PostgreSQL 16.**

```bash
# Add the PostgreSQL repository
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y

# Install PostgreSQL 16
sudo apt install -y postgresql-16

# Start and enable the service
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

**Step 3: Create the database and user.**

```bash
# Create a PostgreSQL user (you will be prompted for a password)
sudo -u postgres createuser --pwprompt fanek

# Create the database, owned by the fanek user
sudo -u postgres createdb -O fanek fanek
```

Save the password you chose. You will need it for the `DATABASE_URL` in the next step.

**Step 4: Clone and build the application.**

```bash
# Create a system user for running Fanek
sudo useradd --system --create-home --home-dir /opt/fanek --shell /bin/bash fanek

# Clone the repository
sudo -u fanek git clone https://github.com/mulaifi/fanek.git /opt/fanek
cd /opt/fanek

# Install production dependencies
sudo -u fanek npm ci

# Generate the Prisma client
sudo -u fanek npx prisma generate

# Run database migrations
sudo -u fanek npx prisma migrate deploy

# Build the Next.js application
sudo -u fanek npm run build
```

**Step 5: Create the `.env` file.**

```bash
sudo -u fanek nano /opt/fanek/.env
```

Add the following (replace the password with the one you set in Step 3):

```bash
# Database connection string
DATABASE_URL="postgresql://fanek:YOUR_PASSWORD_HERE@localhost:5432/fanek"

# NextAuth.js session signing secret (required)
# Generate a secure random value below
NEXTAUTH_SECRET=""

# Application URL (must match how users access it in the browser)
NEXTAUTH_URL="https://fanek.example.com"

# Production mode
NODE_ENV=production
```

Generate and set the `NEXTAUTH_SECRET`:

```bash
# Generate a secure 32-byte hex secret
SECRET=$(openssl rand -hex 32)

# Write it into the .env file
sudo -u fanek sed -i "s/^NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=\"$SECRET\"/" /opt/fanek/.env

# Verify it was set (should show a 64-character hex string)
grep NEXTAUTH_SECRET /opt/fanek/.env
```

**Step 6: Create a systemd service.**

Create the file `/etc/systemd/system/fanek.service`:

```bash
sudo nano /etc/systemd/system/fanek.service
```

Paste the following:

```ini
[Unit]
# Service description and startup ordering
Description=Fanek
After=network.target postgresql.service

[Service]
# Run as the dedicated fanek user
Type=simple
User=fanek
WorkingDirectory=/opt/fanek

# Start the Next.js production server on port 8080
ExecStart=/usr/bin/node node_modules/.bin/next start -p 8080

# Restart automatically on failure, with a 5-second delay
Restart=on-failure
RestartSec=5

# Load environment variables from the .env file
EnvironmentFile=/opt/fanek/.env

[Install]
# Start on boot
WantedBy=multi-user.target
```

**Step 7: Enable and start the service.**

```bash
# Reload systemd to pick up the new service file
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable fanek

# Start the service now
sudo systemctl start fanek

# Check the status
sudo systemctl status fanek
```

**Step 8: Verify Fanek is running.**

```bash
# Check that the app responds on localhost
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080
# Expected output: 200 (or 302 if redirecting to login/setup)
```

If something is wrong, check the logs:

```bash
# View the service logs
journalctl -u fanek --no-pager -n 50
```

### Setup Wizard

The first time you access Fanek in a browser, the setup wizard will guide you through creating an admin account and configuring your organization. Do not run the setup wizard until your reverse proxy and SSL are configured (Section 4), so that your admin credentials are transmitted over an encrypted connection.


## 3. DNS Configuration

Before configuring the reverse proxy, make sure your domain name resolves to your server's IP address.

### Internet-facing deployments

Log in to your domain registrar or DNS provider and create an **A record**:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | fanek | 203.0.113.10 | 300 |

Replace `fanek` with your chosen subdomain and `203.0.113.10` with your server's public IP address. If your domain is `fanek.example.com`, the "Name" field is `fanek` (the registrar appends `.example.com` automatically).

DNS propagation can take anywhere from a few minutes to 48 hours, depending on your provider and TTL settings. Most changes propagate within 5 to 15 minutes.

### Internal/LAN deployments

If your server is on an internal network, you have two options:

**Option 1: Internal DNS server.** Add an A record in your internal DNS server (e.g., Active Directory DNS, Pi-hole, dnsmasq) pointing `fanek.company.local` to the server's internal IP.

**Option 2: `/etc/hosts` file.** On each machine that needs to access Fanek, add a line to `/etc/hosts`:

```bash
# Add this line to /etc/hosts on each client machine
echo "192.168.1.50  fanek.company.local" | sudo tee -a /etc/hosts
```

Replace `192.168.1.50` with your server's internal IP address.

### Verify DNS resolution

```bash
# Any of these commands should return your server's IP address
ping -c 1 fanek.example.com
nslookup fanek.example.com
dig +short fanek.example.com
```


## 4. Reverse Proxy Setup

A reverse proxy sits between the internet (or your LAN) and Fanek. It handles SSL/TLS termination, so traffic between users and the server is encrypted. Fanek itself listens on `http://127.0.0.1:8080`, and the reverse proxy forwards requests to it.

### Choosing a reverse proxy

| Feature | Caddy | Nginx | Traefik |
|---------|-------|-------|---------|
| Automatic HTTPS | Yes (built-in) | No (requires Certbot) | Yes (built-in) |
| Configuration style | Simple text file | Detailed config blocks | Docker labels or YAML |
| Best for | Simplicity, small teams | Full control, familiarity | Docker-native workflows |
| Learning curve | Low | Medium | Medium |

All three are production-grade. If you are unsure, **Caddy** is the simplest option because it handles SSL certificates automatically with zero extra configuration.

### Option A: Caddy

Caddy automatically obtains and renews Let's Encrypt certificates. No extra SSL steps are needed.

**Step 1: Install Caddy.**

```bash
# Install prerequisites
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl

# Add Caddy's GPG key
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg

# Add Caddy's apt repository
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list

# Install Caddy
sudo apt update
sudo apt install -y caddy
```

**Step 2: Configure Caddy.**

Edit `/etc/caddy/Caddyfile`:

```bash
sudo nano /etc/caddy/Caddyfile
```

Replace the contents with:

```
# Fanek reverse proxy configuration
# Caddy automatically obtains and renews Let's Encrypt certificates
fanek.example.com {
    # Forward all requests to the Fanek application
    reverse_proxy localhost:8080
}
```

Replace `fanek.example.com` with your actual domain.

**Step 3: Start Caddy.**

```bash
# Reload Caddy to apply the new configuration
sudo systemctl reload caddy

# Check that Caddy is running
sudo systemctl status caddy
```

**Step 4: Verify.**

```bash
# Test HTTPS (should return 200 or 302)
curl -I https://fanek.example.com
```

### Option B: Nginx

**Step 1: Install Nginx.**

```bash
sudo apt install -y nginx
```

**Step 2: Create the Nginx site configuration.**

```bash
sudo nano /etc/nginx/sites-available/fanek
```

Paste the following:

```nginx
# Fanek reverse proxy configuration for Nginx
server {
    # Listen on port 80 (HTTP) initially; Certbot will add HTTPS later
    listen 80;
    server_name fanek.example.com;

    location / {
        # Forward requests to the Fanek application
        proxy_pass http://127.0.0.1:8080;

        # Use HTTP/1.1 for proxy connections (required for WebSocket support)
        proxy_http_version 1.1;

        # Pass the original host and client information to Fanek
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Enable WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Replace `fanek.example.com` with your actual domain.

**Step 3: Enable the site and remove the default.**

```bash
# Create a symbolic link to enable the site
sudo ln -s /etc/nginx/sites-available/fanek /etc/nginx/sites-enabled/

# Remove the default Nginx site to avoid conflicts
sudo rm -f /etc/nginx/sites-enabled/default

# Test the configuration for syntax errors
sudo nginx -t

# Reload Nginx to apply the configuration
sudo systemctl reload nginx
```

**Step 4: Set up SSL with Certbot.**

```bash
# Install Certbot and the Nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# Obtain and install a Let's Encrypt certificate
# Certbot will modify the Nginx config to add SSL directives automatically
sudo certbot --nginx -d fanek.example.com

# Verify that automatic renewal works
sudo certbot renew --dry-run
```

Certbot adds a systemd timer that renews certificates automatically before they expire.

**Step 5: Verify.**

```bash
# Test HTTPS (should return 200 or 302)
curl -I https://fanek.example.com
```

### Option C: Traefik (Docker only)

Traefik integrates directly with Docker, reading container labels to configure routing and SSL. This approach is best if you are already using Docker for Fanek.

**Step 1: Create `docker-compose.prod.yml`.**

This file extends the base `docker-compose.yml` with Traefik as the reverse proxy:

```bash
nano /opt/fanek/docker-compose.prod.yml
```

Paste the following:

```yaml
# docker-compose.prod.yml
# Adds Traefik as a reverse proxy with automatic Let's Encrypt SSL.
# Use with: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
#
# NOTE: The !reset syntax requires Docker Compose v2.24.6 or later.
services:
  traefik:
    image: traefik:v3
    command:
      # Enable Docker provider so Traefik reads container labels
      - "--providers.docker=true"
      # Do not expose containers by default (only those with traefik.enable=true)
      - "--providers.docker.exposedbydefault=false"
      # Listen on port 80 for HTTP
      - "--entrypoints.web.address=:80"
      # Listen on port 443 for HTTPS
      - "--entrypoints.websecure.address=:443"
      # Configure Let's Encrypt for automatic certificates
      - "--certificatesresolvers.letsencrypt.acme.email=admin@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      # Redirect all HTTP traffic to HTTPS
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
    ports:
      # Expose HTTP and HTTPS on the host
      - "80:80"
      - "443:443"
    volumes:
      # Allow Traefik to read Docker container labels (read-only for security)
      - /var/run/docker.sock:/var/run/docker.sock:ro
      # Persist Let's Encrypt certificates across restarts
      - letsencrypt:/letsencrypt

  app:
    labels:
      # Enable Traefik for this container
      - "traefik.enable=true"
      # Route requests for this domain to the Fanek container
      - "traefik.http.routers.fanek.rule=Host(`fanek.example.com`)"
      # Use the HTTPS entrypoint
      - "traefik.http.routers.fanek.entrypoints=websecure"
      # Use Let's Encrypt for the certificate
      - "traefik.http.routers.fanek.tls.certresolver=letsencrypt"
      # Tell Traefik which port the app listens on inside the container
      - "traefik.http.services.fanek.loadbalancer.server.port=8080"
    # Remove the direct port mapping since Traefik handles external traffic
    ports: !reset []

volumes:
  letsencrypt:
```

Replace `fanek.example.com` with your actual domain and `admin@example.com` with your email address (used for Let's Encrypt registration and expiry notices).

> **Important:** The `!reset` syntax requires Docker Compose v2.24.6 or later. Check your version with `docker compose version`.

**Step 2: If you already created a `docker-compose.override.yml`**, remove or rename it. The override file and the prod file both modify the `app` ports, so using both will cause conflicts:

```bash
# Rename the override file if it exists
mv /opt/fanek/docker-compose.override.yml /opt/fanek/docker-compose.override.yml.bak 2>/dev/null || true
```

**Step 3: Start everything.**

```bash
cd /opt/fanek

# Start Fanek with Traefik using both compose files
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Step 4: Verify.**

```bash
# Test HTTPS (should return 200 or 302)
curl -I https://fanek.example.com
```

### Self-signed certificates (internal/LAN deployments)

If your server is on an internal network without internet access, Let's Encrypt will not work because it cannot reach your server to validate the domain. In this case, use a self-signed certificate.

**Generate a self-signed certificate:**

```bash
# Generate a self-signed certificate valid for 365 days
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/fanek.key \
  -out /etc/ssl/certs/fanek.crt \
  -subj "/CN=fanek.company.local"
```

Replace `fanek.company.local` with your internal hostname.

**Use with Caddy.** Replace the Caddyfile contents:

```
fanek.company.local {
    # Use the self-signed certificate and key
    tls /etc/ssl/certs/fanek.crt /etc/ssl/private/fanek.key
    reverse_proxy localhost:8080
}
```

**Use with Nginx.** Add SSL directives to the server block in `/etc/nginx/sites-available/fanek`:

```nginx
server {
    listen 443 ssl;
    server_name fanek.company.local;

    # Self-signed certificate paths
    ssl_certificate /etc/ssl/certs/fanek.crt;
    ssl_certificate_key /etc/ssl/private/fanek.key;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Use with Traefik.** Self-signed certificates with Traefik require a file provider, which is more complex. For internal deployments with Traefik, consider using Caddy or Nginx as the reverse proxy instead.

> **Note:** Browsers will show a security warning for self-signed certificates. Users must click through the warning or install the certificate as trusted on their machines. For organizations, distributing the certificate via Group Policy (Windows) or configuration management simplifies this.

### Verification checklist

After configuring your reverse proxy, verify the following:

- [ ] Open `https://fanek.example.com` in a browser.
- [ ] Confirm the padlock icon appears (valid certificate). For self-signed certificates, you will need to accept the warning first.
- [ ] Confirm that `http://fanek.example.com` redirects to HTTPS automatically.
- [ ] Log in and verify the application works normally.


## 5. Firewall and Security Hardening

### Internet-facing firewall (UFW)

UFW (Uncomplicated Firewall) is installed by default on Ubuntu. These rules allow SSH, HTTP, and HTTPS while blocking everything else, including direct access to Fanek's port 8080.

```bash
# Set the default policies: deny all incoming, allow all outgoing
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH so you do not lock yourself out
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS for the reverse proxy
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Explicitly block direct access to Fanek's port
# This ensures the app is only reachable through the reverse proxy
sudo ufw deny 8080/tcp

# Enable the firewall (type 'y' when prompted)
sudo ufw enable

# Verify the rules
sudo ufw status
```

### Internal/LAN firewall

For servers on an internal network, you may want to restrict HTTPS access to your office subnet only:

```bash
# Set the default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow OpenSSH

# Allow HTTPS only from the office subnet (adjust the subnet to match your network)
sudo ufw allow from 192.168.1.0/24 to any port 443

# Enable the firewall
sudo ufw enable

# Verify the rules
sudo ufw status
```

Replace `192.168.1.0/24` with your actual network subnet.

> **Defense in depth:** Even if your server sits behind a corporate firewall or in a private network, configuring a host-level firewall is recommended. If the perimeter firewall is misconfigured or bypassed, the host firewall provides an additional layer of protection.

### Additional security hardening

These steps are strongly recommended for any production server.

**SSH key-only authentication.** Disabling password-based SSH login prevents brute-force attacks:

```bash
# Disable password authentication for SSH
# Make sure you have SSH key access configured BEFORE running this
sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config

# Reload the SSH service to apply the change
sudo systemctl reload ssh
```

> **Warning:** Before disabling password authentication, confirm that you can log in with an SSH key. Otherwise, you will be locked out of your server.

**fail2ban.** Automatically bans IP addresses that show malicious behavior (e.g., repeated failed SSH login attempts):

```bash
# Install fail2ban
sudo apt install -y fail2ban

# Enable and start the service
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

fail2ban works out of the box for SSH. It reads `/var/log/auth.log` and bans IPs with too many failed login attempts.

**Automatic security updates.** Keep your server patched without manual intervention:

```bash
# Install the unattended-upgrades package
sudo apt install -y unattended-upgrades

# Enable automatic security updates (select "Yes" when prompted)
sudo dpkg-reconfigure -plow unattended-upgrades
```

For deeper hardening guidance, see the [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks) for Ubuntu/Debian.


## 6. Backups

The most critical piece to back up is the PostgreSQL database. It contains all of Fanek's data: customers, services, users, and configuration.

### Database backup

**Docker deployments:**

```bash
# Dump the database to a compressed file
docker exec fanek-db-1 pg_dump -U fanek -Fc fanek > /opt/backups/fanek-$(date +%Y%m%d).dump
```

**Bare-metal deployments:**

```bash
# Dump the database to a compressed file
pg_dump -U fanek -Fc fanek > /opt/backups/fanek-$(date +%Y%m%d).dump
```

> **Container name note:** The container name `fanek-db-1` assumes the project directory is named `fanek`. If your directory has a different name, Docker Compose uses that name as a prefix. Run `docker compose ps` to find the actual container name.

### Automated daily backups with rotation

Set up a cron job that runs a backup every day at 2:00 AM and deletes backups older than 7 days:

```bash
# Create the backups directory
sudo mkdir -p /opt/backups

# Open the root crontab for editing
sudo crontab -e
```

**For Docker deployments,** add this line:

```
# Daily database backup at 2:00 AM, keep 7 days
0 2 * * * docker exec fanek-db-1 pg_dump -U fanek -Fc fanek > /opt/backups/fanek-$(date +\%Y\%m\%d).dump && find /opt/backups -name "fanek-*.dump" -mtime +7 -delete
```

**For bare-metal deployments,** add this line:

```
# Daily database backup at 2:00 AM, keep 7 days
0 2 * * * pg_dump -U fanek -Fc fanek > /opt/backups/fanek-$(date +\%Y\%m\%d).dump && find /opt/backups -name "fanek-*.dump" -mtime +7 -delete
```

### Database restore

**Docker deployments:**

```bash
# Restore a database dump (replace the filename with your backup)
docker exec -i fanek-db-1 pg_restore -U fanek -d fanek --clean --if-exists < /opt/backups/fanek-YYYYMMDD.dump
```

**Bare-metal deployments:**

```bash
# Restore a database dump (replace the filename with your backup)
pg_restore -U fanek -d fanek --clean --if-exists /opt/backups/fanek-YYYYMMDD.dump
```

> **Warning:** Restoring replaces all existing data in the database. Always test the restore process on a separate instance before relying on it for disaster recovery.

### Application files

The Fanek application itself is stateless. The code comes from the Git repository and can always be re-cloned. What you need to preserve:

- **Database** -- the backup procedures above.
- **Docker `data` volume** -- contains the auto-generated `NEXTAUTH_SECRET`. If this volume is lost, the secret is lost and all user sessions become invalid (users will need to log in again). Back it up with: `docker cp fanek-app-1:/data /opt/backups/fanek-data/`
  > **Container name note:** The container name `fanek-app-1` assumes the project directory is named `fanek`. If your directory has a different name, Docker Compose uses that name as a prefix. Run `docker compose ps` to find the actual container name.
- **`.env` file** (bare-metal) -- contains your `NEXTAUTH_SECRET` and database credentials. Include it in your backup.

### Offsite backups

Local backups protect against accidental deletion and application errors, but not against hardware failure or disasters. Copy your backups to a separate location:

```bash
# Example: rsync backups to a remote server
rsync -az /opt/backups/ backup-user@backup-server:/backups/fanek/

# Example: upload to S3-compatible storage
aws s3 sync /opt/backups/ s3://your-bucket/fanek-backups/
```


## 7. Updates and Upgrades

### Before updating

1. **Back up the database** using the commands in [Section 6](#6-backups). Always have a fresh backup before upgrading.
2. **Check the CHANGELOG** for breaking changes. Read the release notes or CHANGELOG file in the repository before pulling new code.

### Docker update

```bash
cd /opt/fanek

# Pull the latest code
git pull

# Rebuild the container image
docker compose build

# Restart with the new image (the entrypoint runs migrations automatically)
docker compose up -d
```

If you use the Traefik setup from Section 4, include the prod file:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Bare-metal update

```bash
cd /opt/fanek

# Pull the latest code
sudo -u fanek git pull

# Install any new or updated dependencies
sudo -u fanek npm ci

# Apply any new database migrations
sudo -u fanek npx prisma migrate deploy

# Rebuild the Next.js application
sudo -u fanek npm run build

# Restart the service to use the new build
sudo systemctl restart fanek
```

### Verifying after update

```bash
# Check the app responds
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080

# Check the logs for errors (Docker)
docker compose logs --tail 20 app

# Check the logs for errors (bare-metal)
journalctl -u fanek --no-pager -n 20
```


## 8. Troubleshooting

### App not starting

**Symptoms:** The app container exits immediately, or the systemd service fails to start.

**Diagnosis:**

```bash
# Docker: check the container logs
docker compose logs --tail 100 app

# Bare-metal: check the service logs
journalctl -u fanek --no-pager -n 100
```

**Common causes and fixes:**

- **`DATABASE_URL` is incorrect or missing.** Check the `.env` file. For Docker, the `DATABASE_URL` is set in `docker-compose.yml` and should not be overridden in `.env`. For bare-metal, verify the username, password, host, and database name are correct.
- **Port 8080 is already in use.** Another process is listening on the same port. Check with `sudo lsof -i :8080` and stop the conflicting process, or change Fanek's port by setting `PORT` in `.env`.
- **Node.js version is too old.** Fanek requires Node.js 20 or later. Check with `node --version`.

### 502 Bad Gateway

**Symptoms:** The reverse proxy returns a "502 Bad Gateway" error page.

**Diagnosis:** The reverse proxy is running, but it cannot reach Fanek on `127.0.0.1:8080`.

```bash
# Check if the app is actually listening on port 8080
curl -I http://127.0.0.1:8080

# Docker: check if the container is running
docker compose ps

# Bare-metal: check the service status
sudo systemctl status fanek
```

**Common causes and fixes:**

- **The app is not running.** Start it with `docker compose up -d` or `sudo systemctl start fanek`.
- **The app is bound to a different port.** Verify the `PORT` setting in `.env` matches the reverse proxy configuration.
- **The `docker-compose.override.yml` binds to the wrong address.** The proxy must reach `127.0.0.1:8080`. If the override binds to a different address, update it.

### SSL certificate errors

**Symptoms:** Browser shows "Your connection is not private" or Certbot fails to obtain a certificate.

**Diagnosis:**

```bash
# Check if port 80 is open (Let's Encrypt needs it for the HTTP challenge)
sudo ufw status | grep 80

# Check if Certbot can reach your server
curl -I http://fanek.example.com
```

**Common causes and fixes:**

- **DNS has not propagated yet.** Let's Encrypt must resolve your domain to your server's IP. Wait for propagation (check with `dig +short fanek.example.com`) and try again.
- **Port 80 is blocked.** Let's Encrypt's HTTP-01 challenge requires port 80 to be open. Ensure your firewall and any upstream router/cloud security group allows port 80.
- **Another web server is using port 80.** Stop it or configure it to not conflict. Check with `sudo lsof -i :80`.

### Cannot access from other machines

**Symptoms:** Fanek works at `https://localhost` on the server but is not reachable from other machines on the network or the internet.

**Diagnosis:**

```bash
# Check if the firewall allows port 443
sudo ufw status

# Check if the reverse proxy is listening on all interfaces (not just localhost)
sudo ss -tlnp | grep ':443'
```

**Common causes and fixes:**

- **Firewall is blocking port 443.** Add a rule: `sudo ufw allow 443/tcp`.
- **Cloud security group / network firewall.** If your server is hosted on AWS, GCP, Azure, or similar, check the cloud provider's firewall or security group settings. Port 443 must be allowed there as well.
- **Reverse proxy is listening on localhost only.** Ensure the proxy (Caddy, Nginx, or Traefik) is configured to listen on `0.0.0.0:443`, not `127.0.0.1:443`.
- **DNS not pointing to the correct IP.** Verify with `dig +short fanek.example.com`.

### Database connection refused

**Symptoms:** Fanek logs show "connection refused" or "could not connect to server" errors.

**Diagnosis:**

```bash
# Docker: check if the database container is running
docker compose ps db

# Bare-metal: check if PostgreSQL is running
sudo systemctl status postgresql
```

**Common causes and fixes:**

- **PostgreSQL is not running.** Start it with `docker compose up -d db` (Docker) or `sudo systemctl start postgresql` (bare-metal).
- **Wrong credentials.** Verify the username and password in `DATABASE_URL` match what was set when creating the database user.
- **`pg_hba.conf` is rejecting connections (bare-metal only).** PostgreSQL uses `pg_hba.conf` to control which users can connect and how they authenticate. Check the file (usually at `/etc/postgresql/16/main/pg_hba.conf`) and ensure there is a line allowing the `fanek` user to connect to the `fanek` database with password authentication:

  ```
  # TYPE  DATABASE  USER  ADDRESS       METHOD
  local   fanek     fanek                md5
  host    fanek     fanek 127.0.0.1/32   md5
  ```

  After editing, reload PostgreSQL: `sudo systemctl reload postgresql`.

### Slow performance

**Symptoms:** Pages take a long time to load, or the server becomes unresponsive under normal use.

**Diagnosis:**

```bash
# Check CPU and memory usage
htop

# Check disk usage
df -h

# Docker: check container resource usage
docker stats --no-stream
```

**Common causes and fixes:**

- **Insufficient memory.** Fanek with PostgreSQL needs at least 1 GB of RAM. If your server is low on memory, consider upgrading or adding swap space.
- **Node.js memory limit.** If the app is running out of memory, increase the limit by adding this to your `.env` file:

  ```
  NODE_OPTIONS=--max-old-space-size=512
  ```

  Then restart the app.
- **Disk is full.** Check with `df -h`. Old backups, Docker images, or log files may be filling the disk. Clean up with `docker system prune` (for Docker) or remove old log files.
- **Database needs vacuuming.** For long-running instances, PostgreSQL may need maintenance. Run: `docker exec fanek-db-1 psql -U fanek -c "VACUUM ANALYZE;"` (Docker) or `psql -U fanek -c "VACUUM ANALYZE;"` (bare-metal).
