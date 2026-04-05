# Deployment & Server Setup Guide

> Stack: React + FastAPI + PostgreSQL, Docker Compose
> Assumes: Ubuntu 24.04 LTS VPS, your own domain

---

## 1. VPS Requirements

Minimum: **2 GB RAM**, **20 GB disk** (3 Docker containers: nginx, FastAPI, Postgres).

4 GB RAM recommended for headroom during Docker builds.

---

## 2. First-Time VPS Setup

SSH into the server as root and run each section in order.

### 2.1 Create a deploy user

```bash
adduser deploy
usermod -aG sudo deploy

mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 2.2 Harden SSH

```bash
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh
```

### 2.3 Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 2.4 Install Docker

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
newgrp docker
```

### 2.5 Clone the repo

```bash
su - deploy
git clone <your-repo-url> /opt/todo-app
cd /opt/todo-app
git checkout main
```

### 2.6 Create the `.env` file

```bash
cp .env.example .env
nano .env
```

Fill in:

```bash
# Generate with: python3 -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=<generated-value>

POSTGRES_USER=todoapp
# Generate with: python3 -c "import secrets; print(secrets.token_hex(32))"
POSTGRES_PASSWORD=<generated-value>
POSTGRES_DB=todoapp

ALLOWED_ORIGINS=https://yourdomain.com
```

> **Never commit `.env` to git.** It is already in `.gitignore`.

### 2.7 First manual test (HTTP only)

```bash
cd /opt/todo-app
docker compose up -d --build
docker compose ps          # all 3 containers should show "Up"
curl http://localhost/api/health
```

If health returns `{"status":"ok"}`, proceed to HTTPS setup.

---

## 3. Domain & HTTPS

### 3.1 Point DNS to the VPS

Get your VPS IP:

```bash
curl ifconfig.me
```

In your domain registrar's DNS panel:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<your VPS IP>` | 300 |
| A | `www` | `<your VPS IP>` | 300 |

Verify propagation:

```bash
nslookup yourdomain.com
```

### 3.2 Install Caddy for automatic HTTPS

Caddy fetches and renews Let's Encrypt certificates automatically.

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy
```

Create `/etc/caddy/Caddyfile`:

```
yourdomain.com {
    reverse_proxy localhost:80
}

www.yourdomain.com {
    redir https://yourdomain.com{uri} permanent
}
```

Start Caddy:

```bash
systemctl enable caddy
systemctl start caddy
```

Verify:

```bash
curl https://yourdomain.com/api/health
```

### 3.3 Update ALLOWED_ORIGINS

```bash
nano /opt/todo-app/.env
# Set: ALLOWED_ORIGINS=https://yourdomain.com
```

Restart the API:

```bash
cd /opt/todo-app && docker compose up -d api
```

---

## 4. GitHub CD Secrets

The `deploy.yml` workflow needs 3 secrets to SSH into the VPS.

### 4.1 Generate a deploy SSH key pair (on your local machine)

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy
```

### 4.2 Add the public key to the VPS

```bash
# On the VPS as deploy user:
echo "<contents of github_deploy.pub>" >> /home/deploy/.ssh/authorized_keys
```

Test:

```bash
ssh -i ~/.ssh/github_deploy deploy@<your-vps-ip> "echo connected"
```

### 4.3 Add secrets to GitHub

Go to: **GitHub → Repo → Settings → Secrets and variables → Actions**

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Your VPS IP address |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Full contents of `~/.ssh/github_deploy` (private key) |

---

## 5. Deploy via PR

1. Open a PR from `DEV` into `main`
2. Confirm CI passes (backend tests, frontend tests, Docker build)
3. Merge the PR — triggers `deploy.yml`:
   - SSH into VPS
   - `git pull origin main`
   - `docker compose up -d --build`
   - `alembic upgrade head`
   - Health check: `curl /api/health`

Watch progress at: **GitHub → Actions → Deploy to VPS**

---

## 6. Post-Deployment

### 6.1 Automated database backups

```bash
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
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/todo-app/backup.sh
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/todo-app/backup.sh") | crontab -
```

Restore:

```bash
gunzip -c /opt/backups/todoapp_YYYYMMDD_HHMMSS.sql.gz \
  | docker compose exec -T db psql -U todoapp todoapp
```

### 6.2 View logs

```bash
docker compose -f /opt/todo-app/docker-compose.yml logs -f        # all services
docker compose -f /opt/todo-app/docker-compose.yml logs -f api    # API only
```

### 6.3 Docker disk cleanup (weekly)

```bash
(crontab -l 2>/dev/null; echo "0 4 * * 0 docker image prune -af") | crontab -
```

### 6.4 Unattended OS security updates

```bash
apt install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

---

## Setup Checklist

```
VPS Setup
[ ] Provision VPS (Ubuntu 24.04 LTS, 2+ GB RAM)
[ ] Create deploy user, disable root SSH, enable firewall
[ ] Install Docker, add deploy to docker group
[ ] Clone repo to /opt/todo-app, checkout main
[ ] Create .env from .env.example with real secrets
[ ] docker compose up -d --build
[ ] curl http://localhost/api/health → {"status":"ok"}

HTTPS
[ ] Add A records pointing domain → VPS IP
[ ] Verify DNS propagation
[ ] Install Caddy, create Caddyfile, start Caddy
[ ] curl https://yourdomain.com/api/health → {"status":"ok"}
[ ] Update ALLOWED_ORIGINS in .env, restart API

GitHub CD
[ ] Generate SSH key pair for GitHub Actions
[ ] Add public key to VPS authorized_keys
[ ] Add VPS_HOST, VPS_USER, VPS_SSH_KEY to GitHub Secrets

First Deploy
[ ] Open PR: DEV → main
[ ] Confirm CI passes
[ ] Merge PR, watch deploy.yml complete
[ ] Verify app is live at https://yourdomain.com

Maintenance
[ ] Set up daily DB backup cron
[ ] Set up weekly Docker prune cron
[ ] Enable unattended OS security updates
```
