# APEX — Hybrid Broadcast Streaming Network

Live TV channels (24/7 playout) · On-demand VOD · Creator uploads · Community +
gamification · Patron tiers · Live in-stream shopping · Admin broadcast control room.

Monorepo: pnpm workspaces + Turborepo. Node 20 · PostgreSQL 16 · Valkey/Redis · Next.js 14 ·
React Native (Fire TV) · DigitalOcean + Terraform.

## Architecture

```
                              ┌──────────────┐
      viewers / creators ───▶ │   DO CDN     │  cdn.influencetvnetwork.com  (HLS + VOD cache)
                              └──────┬───────┘
                                     │ origin
                              ┌──────▼────────────┐
                              │ Spaces: videos    │◀── HLS segments, VOD, thumbnails
                              │ Spaces: uploads   │◀── temp staging (24h lifecycle)
                              │ Spaces: assets    │◀── avatars, product images
                              └───────────────────┘
        OBS ─RTMP:1935─▶ ┌────────────────────┐       ┌────────────────────┐
                         │ apex-streaming     │       │  DO Load Balancer   │ :443
                         │ Droplet c-4 (pub)  │       │  (redirect 80→443)  │
                         │ nginx-rtmp+FFmpeg  │       └─────────┬──────────┘
                         │ + playout engine   │                 │ :3000  /health
                         └─────────┬──────────┘       ┌─────────▼──────────┐
                                   │ HLS out          │  apex-api Droplet   │
                                   ▼                  │  s-2vcpu-4gb        │
                              (to Spaces/CDN)         │  Express+Socket.io  │
                                                      └───┬───────────┬─────┘
                                    :25060 (priv, TLS)    │           │  :25061 (priv, TLS)
                                    ┌─────────────────────▼─┐   ┌────▼──────────────────┐
                                    │ Managed PostgreSQL 16 │   │ Managed Redis 7        │
                                    │ db-s-1vcpu-1gb        │   │ db-s-1vcpu-1gb         │
                                    └───────────────────────┘   └────────────────────────┘

  SMTP (Resend/SendGrid) · nsfwjs moderation (local) · DO DNS (influencetvnetwork.com) · Let's Encrypt
```

## Repo layout

```
apex/
├── packages/
│   ├── api/          Node.js/Express backend  (@apex/api)
│   ├── web/          Next.js 14 viewer + admin (@apex/web, :3001)
│   ├── firetv/       React Native Fire TV app  (@apex/firetv — Prompt 10)
│   └── shared/       Shared TS types/constants  (@apex/shared)
├── infrastructure/terraform/   DigitalOcean Terraform stack
├── scripts/          Dev + deploy helpers
├── .github/workflows/deploy.yml
├── docker-compose.yml   postgres · valkey · localstack
├── turbo.json · pnpm-workspace.yaml
```

## Local setup

```bash
cp .env.example .env          # fill secrets
pnpm install
docker-compose up -d          # postgres + valkey + localstack
pnpm --filter @apex/api db:reset   # migrations + seed (Prompt 02)
pnpm dev                      # api :3000  +  web :3001
```

Or run `./scripts/dev-bootstrap.sh`.

Health check: `curl http://localhost:3000/health`

## Deploy (DigitalOcean)

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars   # DO token, Spaces keys, ssh key ids, admin IP
terraform init
terraform plan
terraform apply
```

After apply:
1. Point your registrar's nameservers at DigitalOcean (`ns1/ns2/ns3.digitalocean.com`).
2. Read connection strings: `terraform output -raw postgres_connection_uri` / `redis_connection_uri`
   → set `DATABASE_URL` / `REDIS_URL` on the droplet.
3. Fill app secrets (Stripe, Google, JWT, YouTube, SMTP, `DO_SPACES_*`) in the droplet `.env`.
4. Add GitHub secrets `DO_API_DROPLET_IP`, `DO_STREAMING_DROPLET_IP`, `DEPLOY_SSH_KEY`.
5. Push to `main` — GitHub Actions `deploy.yml` ships to both droplets.

See `infrastructure/terraform/README.md` for full details.

## DigitalOcean resources provisioned

| Resource              | Spec                                              |
|-----------------------|---------------------------------------------------|
| apex-api Droplet      | s-2vcpu-4gb, Ubuntu 22.04, nyc3                   |
| apex-streaming Droplet| c-4 (CPU-optimized, 4 vCPU / 8GB), Ubuntu 22.04  |
| Managed PostgreSQL 16 | db-s-1vcpu-1gb, nyc3, firewalled to API droplet  |
| Managed Redis 7       | db-s-1vcpu-1gb, nyc3, firewalled to API droplet  |
| Spaces                | itvn-videos (CDN) / itvn-uploads (24h) / itvn-assets |
| CDN                   | in front of itvn-videos, custom domain cdn.influencetvnetwork.com |
| Load Balancer         | :443 → API :3000, redirect 80→443, /health check |
| Firewalls             | API (LB-only + SSH), streaming (1935/80/443 + SSH) |
| DNS                   | influencetvnetwork.com → LB, cdn.influencetvnetwork.com → CDN, stream.influencetvnetwork.com → droplet |
| Certificates          | Let's Encrypt for LB + CDN custom domain          |

### Estimated monthly cost (nyc3, rough)

| Item                              | Est. / mo |
|-----------------------------------|-----------|
| apex-api Droplet s-2vcpu-4gb      | $24       |
| apex-streaming Droplet c-4        | $84       |
| Managed PostgreSQL db-s-1vcpu-1gb | $15       |
| Managed Redis db-s-1vcpu-1gb      | $15       |
| Spaces storage (250GB)            | $5        |
| CDN bandwidth                     | ~$0.01/GB |
| Load Balancer                     | $12       |
| **Launch total**                  | **~$155/mo** (vs ~$313/mo on AWS — ~50% cheaper) |

## Scripts

Each package exposes `dev` / `build` / `start` / `lint` / `test`. Root delegates
through Turborepo (`pnpm build`, `pnpm dev`, `pnpm lint`, `pnpm test`).

## Build order

This repo is built across 10 sequential prompts. **This is Prompt 01** — scaffold
+ infrastructure. Database schema (Prompt 02), auth (03), streaming (04), web (05),
payments (06), creator/community (07), admin (08), live shop (09), Fire TV (10).
