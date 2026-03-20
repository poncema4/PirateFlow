# Server Infrastructure

This document describes the team's deployment server in full detail. It is written for both humans and AI assistants (Claude, ChatGPT, Copilot, etc.) to have complete context about the server's architecture, capabilities, and constraints. Read this before writing any deployment, networking, infrastructure, or DevOps code.

---

## Hardware

**Device:** Raspberry Pi 5
**RAM:** 16GB
**Storage:** MicroSD card, ~114GB total
**Architecture:** ARM64 (aarch64)
**OS:** Raspberry Pi OS Lite (based on Debian Trixie/13, 64-bit, headless -- no desktop environment)
**Kernel:** Linux 6.12.x (RPi custom)

The Pi runs headless with no monitor, keyboard, or mouse attached. All access is remote via SSH through a Cloudflare Tunnel. The Pi connects to the internet via WiFi.

**Performance characteristics:**
- 4-core ARM Cortex-A76 @ 2.4GHz. Adequate for web servers, API backends, and moderate Docker workloads.
- 16GB RAM is generous for a single-app hackathon server. Multiple large containers or memory-intensive processes (ML models, large builds) should be monitored with `free -h` and `htop`.
- MicroSD storage is the bottleneck. Sequential reads ~100MB/s, writes ~30-50MB/s. Random I/O is slow. Avoid high-frequency disk writes (chatty logging, unoptimized databases). Log rotation is configured.
- The SD card has limited write endurance. Don't run databases with heavy write loads directly on the SD card for extended periods. SQLite is fine for a hackathon. PostgreSQL is fine for light use. If you need heavy database writes, consider using tmpfs or an external USB SSD.

---

## Network Architecture

### Cloudflare Tunnel

The Pi is exposed to the internet through a Cloudflare Tunnel (formerly Argo Tunnel). This is the core of the networking setup and understanding it is important.

**How it works:**
1. The `cloudflared` daemon on the Pi maintains persistent outbound connections to Cloudflare's edge network.
2. When a request comes in for a subdomain of `lodgepi.com`, Cloudflare routes it through the tunnel to the Pi.
3. The Pi receives the request as plain HTTP on localhost. Cloudflare handles TLS termination.
4. Responses travel back through the tunnel to the client.

**Why this matters for your code:**
- Your application serves plain HTTP (not HTTPS). Do not configure TLS certificates on the app.
- The `X-Forwarded-For` header contains the real client IP. Your app sees `127.0.0.1` as the source.
- Cloudflare adds headers like `CF-Connecting-IP`, `CF-RAY`, and `CF-IPCountry` that your app can read.
- WebSocket connections work through the tunnel.
- The tunnel is outbound-only. No ports are opened on the Pi. No firewall rules needed. It works behind any NAT or WiFi network.

**Latency:**
- Round-trip through the tunnel is typically 80-130ms from the US East Coast.
- First request after idle may spike to 500ms+ (tunnel connection warm-up).
- Subsequent requests are fast once the connection is warm.
- The Pi connects to Cloudflare's nearest edge (typically `ewr` Newark or `iad` DC from New Jersey).

### Domain and DNS

**Domain:** `lodgepi.com` (registered on Squarespace, nameservers pointed to Cloudflare)

**DNS is managed in the Cloudflare dashboard**, not on the Pi or on Squarespace. All DNS records for `lodgepi.com` are CNAME records pointing to the tunnel.

| Subdomain | Routes To | Port | Purpose |
|---|---|---|---|
| `ssh.lodgepi.com` | SSH | 22 | Remote shell access via `cloudflared` proxy |
| `deploy.lodgepi.com` | HTTP | 9000 | GitHub webhook listener for auto-deploy |

**There is no A record or direct IP.** All access goes through Cloudflare's proxy. The Pi's actual IP is not publicly known or reachable.

### Tunnel Configuration

The tunnel config lives at `/etc/cloudflared/config.yml`:

```yaml
tunnel: e8673a06-1ebf-4540-89a5-9ccb77c22389
credentials-file: /etc/cloudflared/e8673a06-1ebf-4540-89a5-9ccb77c22389.json

ingress:
  - hostname: deploy.lodgepi.com
    service: http://localhost:9000
  - hostname: ssh.lodgepi.com
    service: ssh://localhost:22
  - service: http_status:404
```

The `ingress` rules are evaluated top-to-bottom. The final `http_status:404` is a catch-all required by cloudflared.

**Tunnel ID:** `e8673a06-1ebf-4540-89a5-9ccb77c22389`

When adding new public subdomains, a CNAME record must point to `e8673a06-1ebf-4540-89a5-9ccb77c22389.cfargotunnel.com` in the Cloudflare DNS dashboard.

---

## Access and Authentication

### SSH Access

Only one person (Gonzei) has SSH access. Teammates do not connect to the server directly. All code reaches the server through the CI/CD pipeline (push to GitHub -> auto-deploy).

SSH is accessed through the Cloudflare Tunnel using `cloudflared` as a proxy. The SSH config on the client machine looks like:

```
Host pilab
    HostName ssh.lodgepi.com
    User gonzei
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
    ProxyCommand "C:\Program Files (x86)\cloudflared\cloudflared.exe" access ssh --hostname %h
```

**Authentication:** SSH key only (Ed25519). Password auth works but key auth is primary.

**VS Code Remote SSH:** Works through the tunnel with one required setting in VS Code:
```json
"remote.SSH.enableDynamicForwarding": false
```
Without this, VS Code's dynamic port forwarding conflicts with Cloudflare's SSH proxy and the connection fails with a websocket handshake error.

### User Account

**Username:** `gonzei`
**Hostname:** `pilab`
**Shell:** bash
**Home directory:** `/home/gonzei/`
**Sudo:** yes (with password)
**Docker group:** yes (can run Docker without sudo)

There is only one user account on the system. No other users exist. The `gonzei` user owns all application files, deploy scripts, and logs.

---

## CI/CD Pipeline

### Overview

The deployment pipeline is fully automatic. No one needs to SSH into the server to deploy code. The flow is:

```
Developer pushes to main on GitHub
        |
        v
GitHub sends POST to https://deploy.lodgepi.com
        |
        v
webhook.py verifies HMAC-SHA256 signature
        |
        v
webhook.py runs deploy.sh in a background thread
        |
        v
deploy.sh: git pull -> detect stack -> install deps -> restart service
```

### Webhook Listener (`~/deploy/webhook.py`)

A standalone Python HTTP server (standard library only, no pip dependencies) running on port 9000. It runs as a systemd service called `webhook`.

**What it does:**
- Listens for POST requests from GitHub
- Verifies the request signature using HMAC-SHA256 with a shared secret
- Only processes `push` events targeting `refs/heads/main`
- Ignores pushes to other branches
- Responds to `ping` events (sent when the webhook is first configured)
- Runs the deploy in a background thread so GitHub gets an immediate 200 response

**Concurrent push safety:**
The webhook uses a `DeployQueue` class with threading locks. If a deploy is already running and another push comes in, it does NOT start a second deploy. Instead it flags a "pending" redeploy. When the current deploy finishes, it checks the flag and runs one more deploy. Multiple pushes during a single deploy collapse into one redeploy because `git pull` always fetches the latest state. This prevents race conditions like `git reset --hard` happening while `npm install` is running.

**Health check / status:**
A GET request to `https://deploy.lodgepi.com/` returns JSON:
```json
{
  "status": "running",
  "deploy": {
    "is_deploying": false,
    "pending_redeploy": false,
    "total_deploys": 5
  }
}
```

**Secret:**
The HMAC secret is stored in `~/deploy/.webhook_secret` (file permissions 600, readable only by `gonzei`). The same secret is configured in the GitHub webhook settings. If you ever need to recreate the webhook on GitHub, the secret must match this file.

### Deploy Script (`~/deploy/deploy.sh`)

A bash script that handles the actual deployment logic. It is stack-agnostic and auto-detects what kind of project it's deploying.

**Step 1: Pull latest code**
```bash
git fetch origin main
git reset --hard origin/main
```
This is a hard reset, not a merge. Whatever is on `origin/main` becomes the deployed code. Local changes on the server (if any) are discarded.

**Step 2: Detect stack and install dependencies**

Detection priority (first match wins):

| File Found | Stack | Action |
|---|---|---|
| `docker-compose.yml` or `docker-compose.yaml` | Docker Compose | `docker compose -p pilab up -d --build` |
| `Dockerfile` | Docker | Build image, stop/remove old container, start new one on port 8080 |
| `requirements.txt` | Python | Create venv if missing, `pip install -r requirements.txt` |
| `package.json` | Node.js | `npm ci` (if lockfile exists) or `npm install`, then `npm run build` if build script exists |
| None of the above | Unknown | Just pull code, no dependency install |

**Step 3: Restart the application**

For non-Docker stacks, the script runs `sudo systemctl restart app`. The `app` service is a systemd unit that will be created once the team decides on a stack and entrypoint. For Docker stacks, Docker itself manages the container lifecycle.

**Logging:**
Every step is logged with timestamps to both stdout (captured by systemd journal) and `/var/log/pilab/deploy.log`. Git output, pip/npm output, and Docker output are all captured. If a deploy fails, the logs show exactly where it broke.

**Timeout:**
The deploy script has a 300-second (5 minute) timeout enforced by the webhook listener. If a deploy takes longer than that, it is killed.

### GitHub Webhook Configuration

The webhook is configured in the GitHub repo settings (Settings -> Webhooks):

- **Payload URL:** `https://deploy.lodgepi.com`
- **Content type:** `application/json`
- **Secret:** (matches `~/deploy/.webhook_secret` on the Pi)
- **Events:** Just the push event
- **Active:** yes

The repo owner (poncema4) manages the webhook settings since admin access is required.

---

## Installed Software

Everything below is pre-installed and ready to use. No setup required on hackathon day.

### Runtimes and Languages

| Tool | Version | Install Source | Binary Location |
|---|---|---|---|
| Python | 3.13.5 | System (Debian) | `/usr/bin/python3` |
| Node.js | 24.14.0 | NodeSource | `/usr/local/bin/node` |
| npm | 11.9.0 | Bundled with Node.js | `/usr/local/bin/npm` |
| Docker | 29.3.0 | Docker official repo | `/usr/bin/docker` |
| Docker Compose | 5.1.1 | Docker CLI plugin | `docker compose` (not `docker-compose`) |

**Python notes:**
- `pip` is available as `pip3` or `python3 -m pip`
- `venv` is available: `python3 -m venv myenv`
- Dev headers and `libffi-dev` are installed for compiling native extensions (e.g., `cryptography`, `psycopg2`)
- The deploy script auto-creates a venv in the app directory if `requirements.txt` exists

**Node.js notes:**
- Installed from NodeSource, NOT the Debian package. This gives us a current LTS version instead of the older Debian-packaged one.
- Global npm packages install to `/usr/local/lib/node_modules/`
- The deploy script runs `npm ci` if `package-lock.json` exists (faster, deterministic), otherwise `npm install`
- If `package.json` contains a `"build"` script, `npm run build` is run automatically after install

**Docker notes:**
- The `gonzei` user is in the `docker` group and can run Docker commands without sudo
- Docker Compose v2 syntax: use `docker compose` (space), not `docker-compose` (hyphen)
- Images must support `linux/arm64`. Most official images (node, python, postgres, redis, nginx) support ARM64. If using a niche image, check its platform support on Docker Hub.
- Docker data lives at `/var/lib/docker/`. Large images and volumes consume SD card space.

### Databases and Services

| Service | Version | Default State | Enable Command | Port |
|---|---|---|---|---|
| PostgreSQL | 17.9 | disabled, stopped | `sudo systemctl enable --now postgresql` | 5432 |
| Redis | 8.0.2 | disabled, stopped | `sudo systemctl enable --now redis-server` | 6379 |
| Nginx | 1.26.3 | disabled, stopped | `sudo systemctl enable --now nginx` | 80 |
| SQLite | 3.46.1 | always available | N/A (no service, file-based) | N/A |

These services are deliberately disabled to save RAM and CPU. Only enable what the project needs.

**PostgreSQL notes:**
- Default cluster: `17/main`
- Connect as postgres superuser: `sudo -u postgres psql`
- Create a database: `sudo -u postgres createdb myapp`
- Create a user: `sudo -u postgres createuser --pwprompt myuser`
- Config: `/etc/postgresql/17/main/postgresql.conf`
- Data: `/var/lib/postgresql/17/main/`

**Redis notes:**
- Config: `/etc/redis/redis.conf`
- Test: `redis-cli ping` (should return `PONG`)
- Default: no password, localhost only

**Nginx notes:**
- Config: `/etc/nginx/nginx.conf` and `/etc/nginx/sites-enabled/`
- Useful as a reverse proxy if the app needs to serve static files alongside an API
- Not needed if using Cloudflare Tunnel directly to the app port

**SQLite notes:**
- No service to manage. Just point your app at a `.db` file.
- Good for hackathon projects that don't need concurrent writes from multiple processes.
- CLI: `sqlite3 myapp.db`

### Build Tools and Utilities

| Tool | Purpose |
|---|---|
| `build-essential` | gcc, g++, make -- needed for native npm/pip packages |
| `libffi-dev` | Foreign function interface -- needed by Python's `cryptography` and `cffi` packages |
| `libssl-dev` | OpenSSL headers -- needed for packages that do TLS |
| `python3-dev` | Python C API headers -- needed for compiled Python extensions |
| `git` | Version control, used by deploy script |
| `curl`, `wget` | HTTP clients for scripts |

---

## File Structure

```
/home/gonzei/
├── app/                          # The repo clone. deploy.sh pulls into here.
│   ├── SERVER.md                 # This file
│   └── (repo contents)
│
├── deploy/
│   ├── webhook.py                # GitHub webhook listener (systemd: webhook)
│   ├── deploy.sh                 # Deploy script (called by webhook.py)
│   └── .webhook_secret           # HMAC secret (chmod 600)
│
└── .ssh/
    ├── config                    # SSH client config (GitHub deploy key routing)
    ├── deploy_key                # Ed25519 private key for GitHub repo access
    ├── deploy_key.pub            # Public key (added to repo as deploy key)
    └── authorized_keys           # Gonzei's public key for SSH login

/etc/cloudflared/
├── config.yml                    # Tunnel ingress routing rules
└── e8673a06-....json             # Tunnel credentials (do not share)

/etc/systemd/system/
├── webhook.service               # Webhook listener service definition
└── (app.service)                 # Created when stack is decided

/var/log/pilab/
├── webhook.log                   # Webhook listener activity log
└── deploy.log                    # Deploy script output log
```

---

## Systemd Services

| Service | Unit File | Purpose | Auto-Start on Boot | Restart Policy |
|---|---|---|---|---|
| `cloudflared` | `/etc/systemd/system/cloudflared.service` | Cloudflare Tunnel | yes | always |
| `webhook` | `/etc/systemd/system/webhook.service` | GitHub webhook listener | yes | always (3s delay) |
| `app` | `/etc/systemd/system/app.service` | Project application | TBD | TBD |
| `postgresql` | system-provided | PostgreSQL database | no (disabled) | on-failure |
| `redis-server` | system-provided | Redis in-memory store | no (disabled) | on-failure |
| `nginx` | system-provided | Reverse proxy / static server | no (disabled) | on-failure |

**Useful commands:**
```bash
sudo systemctl status <service>          # Check if running
sudo systemctl start <service>           # Start now
sudo systemctl stop <service>            # Stop now
sudo systemctl restart <service>         # Restart
sudo systemctl enable <service>          # Start on boot
sudo systemctl disable <service>         # Don't start on boot
sudo systemctl enable --now <service>    # Enable AND start immediately
journalctl -u <service> -f              # Follow live logs
journalctl -u <service> --since "1h ago" # Logs from last hour
```

---

## Logs

| Log | Location | What It Captures |
|---|---|---|
| Webhook activity | `/var/log/pilab/webhook.log` | Incoming requests, signature verification, deploy triggers |
| Deploy output | `/var/log/pilab/deploy.log` | Git pull output, dependency install output, service restart results |
| App logs | `journalctl -u app` | Application stdout/stderr (once app service exists) |
| Tunnel logs | `journalctl -u cloudflared` | Tunnel connection status, reconnections, errors |
| System logs | `journalctl` | Everything else |

Logs are rotated weekly (4 weeks retained, compressed) via `/etc/logrotate.d/pilab`.

---

## Constraints and Gotchas

### Architecture
- **ARM64 only.** All Docker images must support `linux/arm64`. Check Docker Hub for platform support before using any image. Most official images (node, python, postgres, redis, nginx, alpine) support ARM64. Some community images do not.
- If a Docker build fails with `exec format error`, the image or a base image does not support ARM64.

### Storage
- **SD card is the only storage.** ~114GB total, some used by the OS and installed packages.
- SD cards have limited write endurance. Avoid patterns that write to disk continuously (e.g., logging every request to a file without rotation, database WAL files on busy apps).
- Check available space: `df -h /`
- Docker images and volumes live at `/var/lib/docker/` and can grow quickly. Clean up unused images: `docker system prune -a`

### Memory
- **16GB RAM.** Check usage: `free -h` or `htop`
- Docker containers, Node.js, and PostgreSQL can each use significant memory. Monitor if running multiple services.
- If the Pi runs out of memory, the OOM killer will terminate processes unpredictably. Set memory limits on Docker containers if running multiple.

### Networking
- **All HTTP traffic is proxied through Cloudflare.** Your app sees requests from `127.0.0.1`. Use `X-Forwarded-For` or `CF-Connecting-IP` for the real client IP.
- **Cloudflare terminates TLS.** Your app serves plain HTTP on localhost. Do not set up TLS certificates on the app.
- **WebSockets work** through the tunnel. No special configuration needed.
- **Maximum upload size:** Cloudflare free plan limits request bodies to 100MB. If your app needs to receive larger files, this is a hard limit.
- **Request timeout:** Cloudflare has a 100-second timeout for HTTP responses. Long-running requests (large file processing, slow API calls) may be cut off. Use background processing for heavy tasks.
- **Cold start latency:** If the tunnel is idle, the first request may take 500ms+. Subsequent requests settle around 80-130ms.

### Deployment
- **`main` branch only.** Pushes to other branches do not trigger deploys.
- **Hard reset on deploy.** The deploy script does `git reset --hard origin/main`. Any files manually created in `~/app/` that aren't in the repo will survive (git doesn't delete untracked files), but any local modifications to tracked files are destroyed.
- **No rollback mechanism.** If a deploy breaks the app, push a fix to main. The previous version is not saved. If you need rollback capability, use Docker with tagged images.
- **Deploy timeout is 5 minutes.** If dependency installation or Docker builds take longer, the deploy is killed. Optimize your Dockerfile with multi-stage builds and layer caching.

### Security
- **The webhook secret is sensitive.** Don't commit it to the repo or share it in chat. If compromised, anyone can trigger deploys on the Pi.
- **The deploy key has read-only access** to the repo. The Pi can pull but not push.
- **SSH access is key-only** through the Cloudflare Tunnel. The Pi's SSH port is not directly exposed to the internet.

---

## How To: Common Tasks

### Add a public subdomain for the app

Gonzei does this. Steps:

1. Edit `/etc/cloudflared/config.yml` and add an ingress rule ABOVE the catch-all:
   ```yaml
   - hostname: app.lodgepi.com
     service: http://localhost:8080
   ```
2. Go to Cloudflare dashboard -> `lodgepi.com` -> DNS -> Add record:
   - Type: CNAME
   - Name: `app`
   - Target: `e8673a06-1ebf-4540-89a5-9ccb77c22389.cfargotunnel.com`
   - Proxy: enabled (orange cloud)
3. Restart the tunnel: `sudo systemctl restart cloudflared`

### Create the app systemd service

Once the team decides on a stack, Gonzei creates `/etc/systemd/system/app.service`. Example for a Python FastAPI app:

```ini
[Unit]
Description=App Server
After=network.target

[Service]
Type=simple
User=gonzei
WorkingDirectory=/home/gonzei/app
ExecStart=/home/gonzei/app/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8080
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Example for a Node.js app:

```ini
[Unit]
Description=App Server
After=network.target

[Service]
Type=simple
User=gonzei
WorkingDirectory=/home/gonzei/app
ExecStart=/usr/local/bin/node server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now app
```

For Docker-based projects, no `app` service is needed -- Docker manages the containers directly.

### Enable PostgreSQL and create a database

```bash
sudo systemctl enable --now postgresql
sudo -u postgres createuser --pwprompt myapp
sudo -u postgres createdb --owner=myapp myappdb
```

Connection string: `postgresql://myapp:password@localhost:5432/myappdb`

### Enable Redis

```bash
sudo systemctl enable --now redis-server
redis-cli ping  # Should return PONG
```

Connection: `redis://localhost:6379`

### Check what's using resources

```bash
htop                    # Interactive process viewer
free -h                 # Memory usage
df -h /                 # Disk usage
docker stats            # Docker container resource usage
sudo systemctl list-units --type=service --state=running  # Running services
```
