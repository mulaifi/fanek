#!/bin/sh
set -e

PLACEHOLDER="change-me-generate-with-openssl-rand-hex-32"
SECRETS_DIR="/data/secrets"
SECRET_FILE="$SECRETS_DIR/nextauth_secret"

echo "==> Fanek entrypoint starting..."

# --- 1. Secret management ---

if [ -n "$NEXTAUTH_SECRET" ] && [ "$NEXTAUTH_SECRET" != "$PLACEHOLDER" ]; then
  echo "==> Using provided NEXTAUTH_SECRET"
elif [ -f "$SECRET_FILE" ]; then
  echo "==> Reading NEXTAUTH_SECRET from $SECRET_FILE"
  NEXTAUTH_SECRET=$(cat "$SECRET_FILE")
  export NEXTAUTH_SECRET
else
  echo "==> Generating new NEXTAUTH_SECRET..."
  mkdir -p "$SECRETS_DIR"
  chmod 700 "$SECRETS_DIR"
  NEXTAUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  printf '%s' "$NEXTAUTH_SECRET" > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  export NEXTAUTH_SECRET
  echo "==> NEXTAUTH_SECRET generated and saved to $SECRET_FILE"
  echo "==> WARNING: If the database already has users, their sessions are now invalid."
  echo "==> They will need to log in again."
fi

# Safety net
if [ -z "$NEXTAUTH_SECRET" ] || [ "$NEXTAUTH_SECRET" = "$PLACEHOLDER" ]; then
  echo "ERROR: NEXTAUTH_SECRET is not set. Cannot start."
  exit 1
fi

# --- 2. NEXTAUTH_URL default ---

if [ -z "$NEXTAUTH_URL" ]; then
  NEXTAUTH_URL="http://localhost:${PORT:-3000}"
  export NEXTAUTH_URL
  echo "==> WARNING: NEXTAUTH_URL not set, defaulting to $NEXTAUTH_URL"
  echo "==> Set NEXTAUTH_URL for production deployments."
fi

# --- 3. Database readiness ---

echo "==> Waiting for database..."

MAX_RETRIES=15
RETRY_COUNT=0

until node -e "
  const net = require('net');
  const url = new URL(process.env.DATABASE_URL);
  const socket = net.createConnection(
    { host: url.hostname, port: url.port || 5432, timeout: 2000 },
    () => { socket.destroy(); process.exit(0); }
  );
  socket.on('error', () => process.exit(1));
  socket.on('timeout', () => { socket.destroy(); process.exit(1); });
" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "ERROR: Database not reachable after 30 seconds. Check DATABASE_URL."
    exit 1
  fi
  echo "==> Database not ready, retrying ($RETRY_COUNT/$MAX_RETRIES)..."
  sleep 2
done

echo "==> Database is ready"

# --- 4. Run migrations ---

echo "==> Running database migrations..."
npx prisma migrate deploy
echo "==> Migrations complete"

# --- 5. Start the app ---

echo "==> Starting Fanek on port ${PORT:-3000}..."
exec npm start
