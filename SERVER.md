# Server Infrastructure

This document describes the deployment server for PirateFlow in full detail. It is written for both humans and AI assistants (Claude, ChatGPT, Copilot, etc.) to have complete context about the server's architecture, capabilities, and constraints. Read this before writing any deployment, networking, infrastructure, or DevOps code.

---

## Hardware

**Device:** Lenovo ThinkCentre M710q (mini desktop)
**CPU:** Intel Core i5-7500T @ 2.70GHz, 4 cores, 4 threads (no hyperthreading)
**RAM:** 16GB DDR4
**Storage:** 233GB NVMe SSD (`/dev/nvme0n1p2`)
**Architecture:** x86_64
**OS:** Ubuntu 24.04.4 LTS (Noble Numbat)
**Kernel:** Linux 6.17.0-14-generic

The server runs headless with no monitor, keyboard, or mouse attached. All access is remote via SSH through a Cloudflare Tunnel. The machine connects to the local network via WiFi.

**Performance characteristics:**
- 4-core Kaby Lake i5 at 2.7GHz. More than adequate for web servers, API backends, Docker workloads, and moderate build tasks. Significantly faster than a Raspberry Pi for compilation and I/O.
- 16GB RAM provides comfortable headroom for running multiple Docker containers, Node.js processes, and Python backends concurrently. Monitor with `free -h` and `htop` if adding memory-intensive services.
- NVMe SSD eliminates the I/O bottleneck of SD card storage. Sequential reads exceed 1GB/s, random I/O is fast. No write endurance concerns for typical server workloads including databases, logging, and frequent deploys.
- The machine draws roughly 35W at idle, making it suitable for always-on operation.

---

## Network Architecture

### Cloudflare Tunnel

The server is exposed to the internet through a Cloudflare Tunnel (formerly Argo Tunnel). This is the core of the networking setup and understanding it is important.

**How it works:**
1. The `cloudflared` daemon on the server maintains persistent outbound connections to Cloudflare's edge network.
2. When a request comes in for a configured hostname, Cloudflare routes it through the tunnel to the server.
3. The server receives the request as plain HTTP on localhost. Cloudflare handles TLS termination.
4. Responses travel back through the tunnel to the client.

**Why this matters for your code:**
- Your application serves plain HTTP (not HTTPS). Do not configure TLS certificates on the app.
- The `X-Forwarded-For` header contains the real client IP. Your app sees `127.0.0.1` as the source.
- Cloudflare adds headers like `CF-Connecting-IP`, `CF-RAY`, and `CF-IPCountry` that your app can read.
- WebSocket connections work through the tunnel.
- The tunnel is outbound-only. No ports are opened on the server's firewall. No port forwarding is needed on the router. It works behind any NAT or WiFi network.

**Latency:**
- Round-trip through the tunnel is typically 20-80ms from the US East Coast.
- First request after idle may spike to 500ms+ (tunnel connection warm-up).
- Subsequent requests are fast once the connection is warm.
- The server connects to Cloudflare's nearest edge (typically `ewr` Newark or `iad` DC from New Jersey).

### Domains and DNS

Two domains are used for PirateFlow:

**Domain:** `pirateflow.net` (nameservers pointed to Cloudflare)
**Domain:** `benkosiek.com` (nameservers pointed to Cloudflare)

DNS is managed in the Cloudflare dashboard, not on the server. All DNS records are CNAME records pointing to the tunnel.

| Hostname | Routes To | Port | Purpose |
|---|---|---|---|
| `pirateflow.net` | HTTP | 5173 | Frontend (Vite preview) |
| `www.pirateflow.net` | HTTP | 5173 | Frontend (Vite preview) |
| `api.pirateflow.net` | HTTP | 5000 | Backend (FastAPI/uvicorn) |
| `deploy-pirateflow.benkosiek.com` | HTTP | 9002 | GitHub webhook listener for auto-deploy |
| `ssh.benkosiek.com` | SSH | 22 | Remote shell access via `cloudflared` proxy |
| `logs.benkosiek.com` | HTTP | 9999 | Dozzle (real-time container logs) |
| `npm.benkosiek.com` | HTTP | 81 | Nginx Proxy Manager admin |
| `admin.benkosiek.com` | HTTP | 9090 | Admin panel |
| `benkosiek.com` | HTTP | 80 | Portfolio / main site |

There is no A record or direct IP. All access goes through Cloudflare's proxy. The server's actual IP is not publicly known or reachable.

### Tunnel Configuration

There are two tunnel config files on this server. The `cloudflared` systemd service uses the one in `/etc/cloudflared/`:

**Active config (used by systemd):** `/etc/cloudflared/config.yml`
**User config (not used by systemd):** `/home/benkosiek/.cloudflared/config.yml`

When editing tunnel routes, make sure you edit `/etc/cloudflared/config.yml` since that is what the running `cloudflared` service reads. The user-level config at `~/.cloudflared/config.yml` is only used when running `cloudflared` manually from the command line.

**Tunnel ID:** `b5031382-bc55-4d99-bf6f-8235be571a4d`

The `ingress` rules are evaluated top-to-bottom. The final `http_status:404` is a catch-all required by cloudflared.

When adding new public hostnames, a CNAME record must be added in the Cloudflare DNS dashboard pointing to `b5031382-bc55-4d99-bf6f-8235be571a4d.cfargotunnel.com`.

After editing the config, restart the tunnel: `sudo systemctl restart cloudflared`

---

## Access and Authentication

### SSH Access

SSH is accessed through the Cloudflare Tunnel using `cloudflared` as a proxy. The SSH config on the client machine looks like:

```
Host server
    HostName ssh.benkosiek.com
    User benkosiek
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
    ProxyCommand cloudflared access ssh --hostname %h
```

On Windows, the ProxyCommand path may need to be the full path to `cloudflared.exe`.

**VS Code Remote SSH** works through the tunnel with one required setting:
```json
"remote.SSH.enableDynamicForwarding": false
```
Without this, VS Code's dynamic port forwarding conflicts with Cloudflare's SSH proxy and the connection fails with a websocket handshake error.

### User Account

**Username:** `benkosiek`
**Hostname:** `benkosiek-ThinkCentre-M710q`
**Shell:** bash
**Home directory:** `/home/benkosiek/`
**Sudo:** yes (with password)
**Docker group:** yes (can run Docker without sudo)

---

## PirateFlow Application

PirateFlow consists of two services: a Python/FastAPI backend and a Vite/React frontend.

### Backend

- **Location:** `/home/benkosiek/server/pirateflow/PirateFlow/backend/`
- **Runtime:** Python 3.12, FastAPI, uvicorn
- **Port:** 5000
- **Virtual environment:** `./venv/`
- **Entry point:** `main:app` (uvicorn ASGI)
- **Public URL:** `https://api.pirateflow.net`

### Frontend

- **Location:** `/home/benkosiek/server/pirateflow/PirateFlow/frontend/`
- **Runtime:** Node.js 22, Vite, React
- **Port:** 5173
- **Mode:** `vite preview` (serves pre-built production bundle from `dist/`)
- **Public URL:** `https://pirateflow.net`

The frontend is built with `npm run build` during deploy, which outputs to `dist/`. The `vite preview` command serves this built output as a static production server.

---

## CI/CD Pipeline

### Overview

The deployment pipeline is fully automatic. No one needs to SSH into the server to deploy code. The flow is:

```
Developer pushes to main on GitHub
        |
        v
GitHub sends POST to https://deploy-pirateflow.benkosiek.com
        |
        v
webhook.py verifies HMAC-SHA256 signature
        |
        v
webhook.py runs deploy.sh in a background thread
        |
        v
deploy.sh: git pull -> pip install -> npm ci -> npm build -> restart services
```

### Webhook Listener (`~/deploy-pirateflow/webhook.py`)

A standalone Python HTTP server (standard library only, no pip dependencies) running on port 9002. It runs as a systemd service called `pirateflow-webhook`.

**What it does:**
- Listens for POST requests from GitHub
- Verifies the request signature using HMAC-SHA256 with a shared secret
- Only processes `push` events targeting `refs/heads/main`
- Ignores pushes to other branches
- Responds to `ping` events (sent when the webhook is first configured on GitHub)
- Runs the deploy in a background thread so GitHub gets an immediate 200 response

**Concurrent push safety:**
The webhook uses a `DeployQueue` class with threading locks. If a deploy is already running and another push comes in, it does not start a second deploy. Instead it flags a "pending" redeploy. When the current deploy finishes, it checks the flag and runs one more deploy. Multiple pushes during a single deploy collapse into one redeploy because `git pull` always fetches the latest state. This prevents race conditions like `git reset --hard` happening while `npm install` is running.

**Health check / status:**
A GET request to `https://deploy-pirateflow.benkosiek.com/` returns JSON:
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
The HMAC secret is stored in `~/deploy-pirateflow/.webhook_secret` (file permissions 600, readable only by `benkosiek`). The same secret is configured in the GitHub webhook settings. If you ever need to recreate the webhook on GitHub, the secret must match this file.

### Deploy Script (`~/deploy-pirateflow/deploy.sh`)

A bash script that handles the actual deployment logic.

**Step 1: Pull latest code**
```bash
cd /home/benkosiek/server/pirateflow
git fetch origin main
git reset --hard origin/main
```
This is a hard reset, not a merge. Whatever is on `origin/main` becomes the deployed code. Local changes on the server (if any) are discarded.

**Step 2: Install backend dependencies**
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```
Creates a virtual environment if one does not exist.

**Step 3: Install frontend dependencies and build**
```bash
cd frontend
npm ci
npm run build
```
`npm ci` does a clean install from the lockfile (faster and deterministic). `npm run build` produces the production bundle in `dist/`.

**Step 4: Restart services**
```bash
sudo systemctl restart pirateflow-backend
sudo systemctl restart pirateflow-frontend
```

**Logging:**
Every step is logged with timestamps to both stdout (captured by systemd journal) and `/var/log/pirateflow/deploy.log`.

**Timeout:**
The deploy script has a 300-second (5 minute) timeout enforced by the webhook listener. If a deploy takes longer than that, it is killed.

### GitHub Webhook Configuration

The webhook is configured in the GitHub repo settings (Settings -> Webhooks):

- **Payload URL:** `https://deploy-pirateflow.benkosiek.com`
- **Content type:** `application/json`
- **Secret:** (matches `~/deploy-pirateflow/.webhook_secret` on the server)
- **Events:** Just the push event
- **SSL verification:** enabled (Cloudflare handles the certificate)
- **Active:** yes

The repo owner (poncema4) manages the webhook settings since admin access is required.

---

## Installed Software

### Runtimes and Languages

| Tool | Version | Install Source | Binary Location |
|---|---|---|---|
| Python | 3.12.3 | System (Ubuntu) | `/usr/bin/python3` |
| Node.js | 22.22.0 | nvm | `/home/benkosiek/.nvm/versions/node/v22.22.1/bin/node` |
| npm | 10.9.4 | Bundled with Node.js | `/home/benkosiek/.nvm/versions/node/v22.22.1/bin/npm` |
| Docker | 29.2.1 | Docker official repo | `/usr/bin/docker` |
| Docker Compose | 5.0.2 | Docker CLI plugin | `docker compose` (not `docker-compose`) |
| cloudflared | 2026.2.0 | Cloudflare | `/usr/local/bin/cloudflared` |
| git | 2.43.0 | System (Ubuntu) | `/usr/bin/git` |

**Python notes:**
- `pip` is available as `pip3` or `python3 -m pip`
- `venv` is available: `python3 -m venv myenv`
- The deploy script auto-creates a venv in the backend directory if `requirements.txt` exists

**Node.js notes:**
- Installed via nvm, not the system package. The nvm path must be included in systemd service `Environment` directives or the node/npm binaries will not be found.
- The deploy script runs `npm ci` if `package-lock.json` exists (faster, deterministic), otherwise `npm install`
- If `package.json` contains a `"build"` script, `npm run build` is run automatically after install

**Docker notes:**
- The `benkosiek` user is in the `docker` group and can run Docker commands without sudo
- Docker Compose v2 syntax: use `docker compose` (space), not `docker-compose` (hyphen)
- Docker data lives at `/var/lib/docker/`

---

## Docker Services

The following containers run via Docker Compose from `/home/benkosiek/server/docker-compose.yml`:

| Container | Image | Ports | Purpose |
|---|---|---|---|
| `nginx-proxy-manager` | jc21/nginx-proxy-manager | 80, 81, 443 | Reverse proxy for portfolio and project subdomains |
| `portfolio` | Custom build (`./portfolio`) | 80 (internal) | Main portfolio website |
| `dozzle` | amir20/dozzle | 9999->8080 | Real-time Docker container log viewer |
| `server-bot` | Custom build (`./discord-bot`) | none | Discord bot for remote server management |
| `tenantdesk-postgres` | PostgreSQL | 5432 | TenantDesk database |
| `tenantdesk-redis` | Redis | 6379 | TenantDesk cache |
| `tenantdesk-minio` | MinIO | 9000-9001 | TenantDesk object storage |

Note: MinIO occupies ports 9000 (API) and 9001 (console). The PirateFlow webhook was moved to port 9002 to avoid this conflict.

---

## Systemd Services

| Service | Unit File | Purpose | Auto-Start | Restart Policy |
|---|---|---|---|---|
| `cloudflared` | `/etc/systemd/system/cloudflared.service` | Cloudflare Tunnel | yes | on-failure (5s delay) |
| `pirateflow-backend` | `/etc/systemd/system/pirateflow-backend.service` | FastAPI backend on port 5000 | yes | always (3s delay) |
| `pirateflow-frontend` | `/etc/systemd/system/pirateflow-frontend.service` | Vite preview on port 5173 | yes | always (3s delay) |
| `pirateflow-webhook` | `/etc/systemd/system/pirateflow-webhook.service` | GitHub webhook listener on port 9002 | yes | always (3s delay) |
| `docker` | system-provided | Docker daemon | yes | on-failure |

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

## File Structure

```
/home/benkosiek/
├── server/
│   ├── docker-compose.yml               # Docker Compose for portfolio, NPM, dozzle, bot
│   ├── pirateflow/
│   │   ├── PirateFlow/                  # Git repo clone
│   │   │   ├── backend/
│   │   │   │   ├── main.py              # FastAPI application
│   │   │   │   ├── requirements.txt
│   │   │   │   └── venv/               # Python virtual environment
│   │   │   └── frontend/
│   │   │       ├── src/                 # React source code
│   │   │       ├── dist/                # Built production bundle
│   │   │       ├── package.json
│   │   │       └── vite.config.js
│   │   ├── SERVER.md                    # This file
│   │   └── README.md
│   ├── portfolio/                       # Portfolio site (Docker build)
│   ├── discord-bot/                     # Discord bot (Docker build)
│   ├── nginx-proxy-manager/             # NPM config and data
│   └── tenantdesk/                      # TenantDesk project
│
├── deploy-pirateflow/
│   ├── webhook.py                       # GitHub webhook listener (systemd: pirateflow-webhook)
│   ├── deploy.sh                        # Deploy script (called by webhook.py)
│   └── .webhook_secret                  # HMAC secret (chmod 600)
│
└── .cloudflared/
    ├── config.yml                       # User-level tunnel config (NOT used by systemd)
    └── b5031382-....json                # Tunnel credentials

/etc/cloudflared/
├── config.yml                           # Active tunnel config (USED by systemd service)
└── b5031382-....json                    # Tunnel credentials

/etc/systemd/system/
├── cloudflared.service
├── pirateflow-backend.service
├── pirateflow-frontend.service
└── pirateflow-webhook.service

/var/log/pirateflow/
├── webhook.log                          # Webhook listener activity log
└── deploy.log                           # Deploy script output log
```

---

## Logs

| Log | Location | What It Captures |
|---|---|---|
| Webhook activity | `/var/log/pirateflow/webhook.log` | Incoming requests, signature verification, deploy triggers |
| Deploy output | `/var/log/pirateflow/deploy.log` | Git pull output, dependency install output, service restart results |
| Backend logs | `journalctl -u pirateflow-backend` | Uvicorn/FastAPI stdout/stderr |
| Frontend logs | `journalctl -u pirateflow-frontend` | Vite preview stdout/stderr |
| Tunnel logs | `journalctl -u cloudflared` | Tunnel connection status, reconnections, errors |
| Docker logs | `docker logs <container>` or Dozzle at `logs.benkosiek.com` | Container stdout/stderr |
| System logs | `journalctl` | Everything else |

---

## Port Map

| Port | Process | Purpose |
|---|---|---|
| 22 | sshd | SSH access |
| 80 | Nginx Proxy Manager | HTTP traffic for portfolio/projects |
| 81 | Nginx Proxy Manager | NPM admin interface |
| 443 | Nginx Proxy Manager | HTTPS traffic |
| 5000 | uvicorn | PirateFlow backend (FastAPI) |
| 5173 | node (vite) | PirateFlow frontend (Vite preview) |
| 5432 | Docker (postgres) | TenantDesk PostgreSQL |
| 6379 | Docker (redis) | TenantDesk Redis |
| 9000 | Docker (minio) | TenantDesk MinIO API |
| 9001 | Docker (minio) | TenantDesk MinIO console |
| 9002 | python3 (webhook.py) | PirateFlow deploy webhook |
| 9090 | cockpit/admin | Admin panel |
| 9999 | Docker (dozzle) | Container log viewer |

---

## Constraints and Gotchas

### Two Tunnel Config Files

This is the most common source of confusion on this server. The `cloudflared` systemd service reads from `/etc/cloudflared/config.yml`. The file at `~/.cloudflared/config.yml` is only used when running `cloudflared` manually from the terminal. If you edit the wrong file, your changes will not take effect. Always edit `/etc/cloudflared/config.yml` and then run `sudo systemctl restart cloudflared`.

### Networking

- All HTTP traffic is proxied through Cloudflare. Your app sees requests from `127.0.0.1`. Use `X-Forwarded-For` or `CF-Connecting-IP` for the real client IP.
- Cloudflare terminates TLS. Your app serves plain HTTP on localhost. Do not set up TLS certificates on the app.
- WebSockets work through the tunnel. No special configuration needed.
- Maximum upload size: Cloudflare free plan limits request bodies to 100MB.
- Request timeout: Cloudflare has a 100-second timeout for HTTP responses. Long-running requests may be cut off. Use background processing for heavy tasks.
- Cold start latency: If the tunnel is idle, the first request may take 500ms+. Subsequent requests settle around 20-80ms.

### Deployment

- `main` branch only. Pushes to other branches do not trigger deploys.
- Hard reset on deploy. The deploy script does `git reset --hard origin/main`. Any files manually created in the repo directory that are not in the repo will survive (git does not delete untracked files), but any local modifications to tracked files are destroyed.
- No rollback mechanism. If a deploy breaks the app, push a fix to main. The previous version is not saved.
- Deploy timeout is 5 minutes. If dependency installation or builds take longer, the deploy is killed.

### Node.js via nvm

Node.js is installed through nvm, not the system package manager. This means the `node` and `npm` binaries are located under `~/.nvm/versions/node/` rather than `/usr/local/bin/`. Systemd services that need Node.js must explicitly set the `PATH` environment variable to include the nvm binary directory, otherwise the binaries will not be found. See the `pirateflow-frontend.service` unit file for an example.

### Security

- The webhook secret is sensitive. Do not commit it to the repo or share it in chat. If compromised, anyone can trigger deploys on the server.
- SSH access is key-only through the Cloudflare Tunnel. The server's SSH port is not directly exposed to the internet.

---

## How To: Common Tasks

### Add a new hostname to the tunnel

1. Edit `/etc/cloudflared/config.yml` and add an ingress rule ABOVE the catch-all `http_status:404`:
   ```yaml
   - hostname: newapp.benkosiek.com
     service: http://localhost:8080
   ```
2. Go to Cloudflare dashboard -> DNS -> Add record:
   - Type: CNAME
   - Name: `newapp`
   - Target: `b5031382-bc55-4d99-bf6f-8235be571a4d.cfargotunnel.com`
   - Proxy: enabled (orange cloud)
3. Restart the tunnel: `sudo systemctl restart cloudflared`

### Check what is using resources

```bash
htop                    # Interactive process viewer
free -h                 # Memory usage
df -h /                 # Disk usage
docker stats            # Docker container resource usage
ss -tlnp                # All listening ports and their processes
sudo systemctl list-units --type=service --state=running  # Running services
```

### Manually trigger a deploy

```bash
cd /home/benkosiek/deploy-pirateflow
bash deploy.sh
```

### View recent deploy output

```bash
tail -50 /var/log/pirateflow/deploy.log
```

### Restart PirateFlow services

```bash
sudo systemctl restart pirateflow-backend
sudo systemctl restart pirateflow-frontend
```
