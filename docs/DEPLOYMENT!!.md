# Complete Production Deployment Guide

This guide is written specifically for this project: React + FastAPI + PostgreSQL, Docker
Compose, with the CD pipeline already wired in `deploy.yml`.

---

## Part 1 — Choose a VPS

Your stack (3 Docker containers: nginx, FastAPI, Postgres) needs at least **2 GB RAM** and
**20 GB disk**. Here are the best options by value:

| Provider | Plan | RAM | CPU | Disk | Price | Best for |
|---|---|---|---|---|---|---|
| **Hetzner** CX22 | Cloud | 4 GB | 2 vCPU | 40 GB | ~€4.15/mo | Best value in Europe |
| **DigitalOcean** Basic | Droplet | 2 GB | 1 vCPU | 50 GB | $6/mo | Best docs/UX |
| **Linode/Akamai** | Shared | 2 GB | 1 vCPU | 50 GB | $5/mo | Good US coverage |
| **Vultr** VC2 | Cloud | 2 GB | 1 vCPU | 55 GB | $6/mo | Many regions |

**Recommended: Hetzner CX22** — 4 GB RAM gives headroom for Docker build during rolling
deploys. Pick the region closest to your users.

**OS to choose:** Ubuntu 24.04 LTS (all commands below assume this).

---

## Part 2 — First-time VPS Setup

SSH into your new server as root, then run each block in order.

### 2.1 — Create a non-root deploy user

```bash
adduser deploy                          # set a strong password
usermod -aG sudo deploy

# Copy your SSH public key to the deploy user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 2.2 — Harden SSH

```bash
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh
```

### 2.3 — Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 2.4 — Install Docker

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy      # lets deploy user run docker without sudo
newgrp docker
```

### 2.5 — Clone the repo

```bash
su - deploy
git clone https://github.com/Melclycj/Todo-list.git /opt/todo-app
cd /opt/todo-app
git checkout main
```

### 2.6 — Create the `.env` file

```bash
cp .env.example .env
nano .env
```

Fill in real values:

```bash
# Generate SECRET_KEY:  python3 -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=<generated-value>

POSTGRES_USER=todoapp
# Generate POSTGRES_PASSWORD:  python3 -c "import secrets; print(secrets.token_hex(32))"
POSTGRES_PASSWORD=<generated-value>
POSTGRES_DB=todoapp

ALLOWED_ORIGINS=https://yourdomain.com
```

> **Never commit `.env` to git.** It is already in `.gitignore`.

### 2.7 — First manual test (HTTP only, before HTTPS is set up)

```bash
cd /opt/todo-app
docker compose up -d --build
docker compose ps          # all 3 containers should show "Up"
curl http://localhost/api/health
```

If health returns `{"status":"ok"}` your stack is running. Proceed to Part 3 for HTTPS.

---

## Part 3 — Domain & HTTPS

### 3.1 — Understanding your ngrok domain

ngrok has two different "custom domain" features. Identify which one you have:

**Case A — You have `something.ngrok-free.app` or `something.ngrok.app`**

This is an ngrok-owned subdomain. You cannot get a TLS certificate for it on your own
server because ngrok controls the domain. You have two options:

- **Option A1 (recommended):** Register a proper domain (~$10/year at Namecheap or
  Cloudflare Registrar) and follow the Let's Encrypt path in section 3.3.
- **Option A2:** Run ngrok as a persistent tunnel on your VPS — see section 3.4.

**Case B — You brought your own domain to ngrok (e.g. `todo.yourdomain.com` pointed via
CNAME to ngrok)**

This is your own domain. You just need to update the DNS record to point to your VPS IP
instead of ngrok, then use Let's Encrypt. Follow section 3.2 below.

---

### 3.2 — Point your domain DNS to the VPS

Get your VPS IP address:

```bash
curl ifconfig.me
```

In your domain registrar's DNS panel (Cloudflare, Namecheap, GoDaddy, etc.):

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `<your VPS IP>` | 300 |
| A | `www` | `<your VPS IP>` | 300 |

If your domain was previously CNAME'd to ngrok, **delete that CNAME record** and replace
it with the A record above.

Wait 5–30 minutes for DNS to propagate, then verify from your local machine:

```bash
nslookup yourdomain.com
# Should return your VPS IP
```

---

### 3.3 — Get a free HTTPS certificate with Caddy (recommended)

Caddy is a reverse proxy that fetches and renews Let's Encrypt certificates automatically
with zero manual steps. It runs on the VPS host and forwards HTTPS traffic to the Docker
nginx container on port 80.

**Install Caddy:**

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy
```

**Create `/etc/caddy/Caddyfile`:**

```
yourdomain.com {
    reverse_proxy localhost:80
}

www.yourdomain.com {
    redir https://yourdomain.com{uri} permanent
}
```

**Start it:**

```bash
systemctl enable caddy
systemctl start caddy
```

Caddy automatically:
- Obtains a Let's Encrypt certificate for `yourdomain.com`
- Renews it before expiry (no cron job needed)
- Handles HTTP → HTTPS redirect
- Forwards HTTPS traffic to your Docker nginx on port 80

**Verify:**

```bash
curl https://yourdomain.com/api/health
# Should return {"status":"ok"}
```

---

### 3.4 — Alternative: Use ngrok on the VPS as the HTTPS tunnel

If you want to keep using an ngrok domain rather than setting up your own DNS, you can
run ngrok as a persistent process on the VPS. Traffic path:
`user → ngrok servers → VPS → Docker`.

**Install ngrok on the VPS:**

```bash
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
  | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
  | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# Authenticate with your ngrok account token
ngrok config add-authtoken <YOUR_NGROK_AUTH_TOKEN>
```

**Create a systemd service to keep ngrok running:**

Create `/etc/systemd/system/ngrok.service`:

```ini
[Unit]
Description=ngrok tunnel
After=network.target

[Service]
User=deploy
ExecStart=/usr/bin/ngrok http --domain=your-reserved-domain.ngrok-free.app 80
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable ngrok
systemctl start ngrok
systemctl status ngrok    # confirm it is running
```

> **Limitation:** Free ngrok plans have request rate limits and do not support custom
> domains. Paid plans ($8–$20/mo) unlock reserved domains and higher throughput. For a
> real production app the Caddy + Let's Encrypt path (section 3.3) is cheaper and faster.

---

### 3.5 — Update ALLOWED_ORIGINS

Your FastAPI backend enforces CORS. Update `.env` on the VPS to match your live domain:

```bash
nano /opt/todo-app/.env
# Set: ALLOWED_ORIGINS=https://yourdomain.com
```

Restart the API container to pick up the change:

```bash
cd /opt/todo-app
docker compose up -d api
```

---

## Part 4 — Configure GitHub CD Secrets

The `deploy.yml` workflow already exists and is correct. It needs 3 secrets added to
GitHub before it can SSH into your VPS.

### 4.1 — Generate a dedicated SSH key pair (on your local machine)

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f $env:USERPROFILE/.ssh/github_deploy
# Creates:
#   ~/.ssh/github_deploy      ← private key (goes into GitHub Secrets)
#   ~/.ssh/github_deploy.pub  ← public key (goes onto the VPS)
```

### 4.2 — Add the public key to the VPS

```bash
# On the VPS, as the deploy user:
echo "<paste full contents of github_deploy.pub>" >> /home/deploy/.ssh/authorized_keys
```

Test the connection from your local machine before adding to GitHub:

```bash
ssh -i ~/.ssh/github_deploy deploy@<your-vps-ip> "echo connected"
```

### 4.3 — Add the 3 secrets to GitHub

Go to:
**GitHub → Your repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value |
|---|---|
| `VPS_HOST` | Your VPS IP address, e.g. `157.90.123.45` |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Full contents of `~/.ssh/github_deploy` (private key, including the `-----BEGIN...` and `-----END...` lines) |

---

## Part 5 — Merge DEV → main and Trigger the Deploy

### 5.1 — Open a Pull Request

On GitHub, open a PR from `DEV` into `main`:

```
https://github.com/Melclycj/Todo-list/compare/main...DEV
```

Or via the CLI (if `gh` is installed):

```bash
gh pr create --base main --head DEV \
  --title "feat: topics column, edit mode, bulk delete" \
  --body "Production release — all CI checks passing on DEV."
```

### 5.2 — Verify CI passes on the PR

All 4 jobs must be green before merging:

- Backend Tests
- Frontend Tests
- Docker Build Check
- E2E Tests

### 5.3 — Merge and watch the deploy

Merge the PR on GitHub. This pushes to `main`, which triggers `deploy.yml`:

1. SSHes into the VPS as `deploy`
2. Runs `git pull origin main`
3. Runs `docker compose up -d --build` (rebuilds images with new code)
4. Runs `alembic upgrade head` (applies any pending DB migrations)
5. Hits `https://yourdomain.com/api/health` to confirm the app came up healthy

Watch it live:
**GitHub → Actions → Deploy to VPS**

If the health check step fails, the workflow is marked red and you are alerted before any
users notice. Roll back by reverting the merge commit on GitHub and the next push to
`main` will re-deploy the previous version.

---

## Part 6 — Post-deployment Checklist

### 6.1 — Automated database backups

```bash
# Create the backup script on the VPS
cat > /opt/todo-app/backup.sh << 'EOF'
#!/bin/bash
set -euo pipefail
BACKUP_DIR="/opt/backups"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d_%H%M%S)
source /opt/todo-app/.env
docker compose -f /opt/todo-app/docker-compose.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "$BACKUP_DIR/todoapp_${DATE}.sql.gz"
# Keep only the last 7 days of backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/todo-app/backup.sh

# Schedule at 3am every day
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/todo-app/backup.sh") | crontab -
```

Restore a backup:

```bash
gunzip -c /opt/backups/todoapp_YYYYMMDD_HHMMSS.sql.gz \
  | docker compose exec -T db psql -U todoapp todoapp
```

### 6.2 — View logs

```bash
# All services, live
docker compose -f /opt/todo-app/docker-compose.yml logs -f

# API only
docker compose -f /opt/todo-app/docker-compose.yml logs -f api

# Last 100 lines from all services
docker compose -f /opt/todo-app/docker-compose.yml logs --tail=100
```

### 6.3 — Docker disk cleanup (weekly)

Docker accumulates old image layers during rebuilds. Prune them weekly:

```bash
(crontab -l 2>/dev/null; echo "0 4 * * 0 docker image prune -af") | crontab -
```

### 6.4 — Unattended OS security updates

```bash
apt install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades    # choose Yes
```

---

## Summary: Order of Operations

Work through this checklist top to bottom:

```
Part 2 — VPS Setup
[ ] 1.  Provision VPS — Hetzner CX22, Ubuntu 24.04 LTS
[ ] 2.  Create deploy user, disable root SSH, enable firewall
[ ] 3.  Install Docker, add deploy to docker group
[ ] 4.  Clone repo to /opt/todo-app, check out main
[ ] 5.  Copy .env.example → .env, fill in SECRET_KEY and POSTGRES_PASSWORD
[ ] 6.  Run: docker compose up -d --build
[ ] 7.  Confirm: curl http://localhost/api/health returns {"status":"ok"}

Part 3 — HTTPS
[ ] 8.  Delete any CNAME → ngrok DNS record for your domain
[ ] 9.  Add A record pointing yourdomain.com → VPS IP
[ ] 10. Wait for DNS propagation (nslookup yourdomain.com shows VPS IP)
[ ] 11. Install Caddy, write Caddyfile, start Caddy
[ ] 12. Confirm: curl https://yourdomain.com/api/health returns {"status":"ok"}
[ ] 13. Update ALLOWED_ORIGINS in .env → https://yourdomain.com
[ ] 14. Restart API: docker compose up -d api

Part 4 — GitHub CD
[ ] 15. Generate SSH key pair: ssh-keygen -t ed25519 -f ~/.ssh/github_deploy
[ ] 16. Add public key to /home/deploy/.ssh/authorized_keys on VPS
[ ] 17. Test: ssh -i ~/.ssh/github_deploy deploy@<VPS-IP> "echo connected"
[ ] 18. Add VPS_HOST secret to GitHub
[ ] 19. Add VPS_USER secret to GitHub (value: deploy)
[ ] 20. Add VPS_SSH_KEY secret to GitHub (private key contents)

Part 5 — First Production Deploy
[ ] 21. Open PR: DEV → main on GitHub
[ ] 22. Confirm all 4 CI jobs are green
[ ] 23. Merge the PR
[ ] 24. Watch deploy.yml complete successfully in GitHub Actions
[ ] 25. Open https://yourdomain.com in the browser — app is live

Part 6 — Maintenance
[ ] 26. Set up daily DB backup cron job
[ ] 27. Set up weekly Docker prune cron job
[ ] 28. Enable unattended OS security updates
```
