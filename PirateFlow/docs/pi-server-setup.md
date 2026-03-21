# PirateFlow - Pi Server Setup Guide

Run these commands via SSH on the Pi (`ssh pilab`).

---

## 1. Create the systemd service

```bash
sudo tee /etc/systemd/system/app.service > /dev/null << 'EOF'
[Unit]
Description=PirateFlow API Server
After=network.target

[Service]
Type=simple
User=gonzei
WorkingDirectory=/home/gonzei/app/PirateFlow/backend
ExecStart=/home/gonzei/app/PirateFlow/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8080
Restart=always
RestartSec=3
EnvironmentFile=/home/gonzei/app/PirateFlow/backend/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable app
```

## 2. Create the .env file

```bash
cat > /home/gonzei/app/PirateFlow/backend/.env << EOF
ANTHROPIC_API_KEY=<your-key-here>
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
DATABASE_URL=sqlite:///home/gonzei/app/PirateFlow/backend/pirateflow.db
CORS_ORIGINS=https://pirateflow.net,https://app.lodgepi.com,http://localhost:5173
ENVIRONMENT=production
EOF

chmod 600 /home/gonzei/app/PirateFlow/backend/.env
```

## 3. Update the deploy script

The Pi's `~/deploy/deploy.sh` auto-detects stacks by looking for files at the repo root. Since PirateFlow lives in a subdirectory, update the deploy script to call our custom script instead.

Add this near the top of `~/deploy/deploy.sh`, right after the `git reset --hard origin/main` line:

```bash
# PirateFlow custom deploy
if [ -f "PirateFlow/deploy-pirateflow.sh" ]; then
    echo "Found PirateFlow deploy script, running it..."
    bash PirateFlow/deploy-pirateflow.sh
    exit 0
fi
```

This makes the Pi's deploy script delegate to our project-specific script.

## 4. Configure Cloudflare Tunnel for pirateflow.net

### 4a. Add pirateflow.net to Cloudflare

1. Go to Cloudflare dashboard → **Add a site** → enter `pirateflow.net`
2. Select the Free plan
3. Cloudflare will give you two nameservers (e.g., `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`)
4. Go to your domain registrar and change the nameservers to the ones Cloudflare provided
5. Wait for Cloudflare to verify (can take a few minutes to hours)

### 4b. Add DNS record

In Cloudflare dashboard → `pirateflow.net` → DNS → Records → Add record:

| Field | Value |
|-------|-------|
| Type | CNAME |
| Name | `@` |
| Target | `e8673a06-1ebf-4540-89a5-9ccb77c22389.cfargotunnel.com` |
| Proxy | Enabled (orange cloud) |

### 4c. Add backup subdomain on lodgepi.com

In Cloudflare dashboard → `lodgepi.com` → DNS → Records → Add record:

| Field | Value |
|-------|-------|
| Type | CNAME |
| Name | `app` |
| Target | `e8673a06-1ebf-4540-89a5-9ccb77c22389.cfargotunnel.com` |
| Proxy | Enabled (orange cloud) |

### 4d. Update tunnel config on Pi

```bash
sudo nano /etc/cloudflared/config.yml
```

Add these two rules **ABOVE** the catch-all `http_status:404`:

```yaml
  - hostname: pirateflow.net
    service: http://localhost:8080
  - hostname: app.lodgepi.com
    service: http://localhost:8080
```

The full config should look like:

```yaml
tunnel: e8673a06-1ebf-4540-89a5-9ccb77c22389
credentials-file: /etc/cloudflared/e8673a06-1ebf-4540-89a5-9ccb77c22389.json

ingress:
  - hostname: deploy.lodgepi.com
    service: http://localhost:9000
  - hostname: ssh.lodgepi.com
    service: ssh://localhost:22
  - hostname: pirateflow.net
    service: http://localhost:8080
  - hostname: app.lodgepi.com
    service: http://localhost:8080
  - service: http_status:404
```

Restart the tunnel:

```bash
sudo systemctl restart cloudflared
```

## 5. First deploy test

Push to main from your local machine. Then verify on the Pi:

```bash
# Watch the deploy
journalctl -u webhook -f

# Check app logs
journalctl -u app -f

# Quick test
curl http://localhost:8080/api/health
```

Then visit `https://pirateflow.net/api/health` in a browser.

If DNS hasn't propagated yet, use the backup: `https://app.lodgepi.com/api/health`
