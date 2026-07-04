# APEX — Hybrid Broadcast Streaming Network

Live TV channels (24/7 playout) · On-demand VOD · Creator uploads · Community +
gamification · Patron tiers · Live in-stream shopping · Admin broadcast control room.

Monorepo: pnpm workspaces + Turborepo. Node 20 · PostgreSQL 16 · Valkey · Next.js 14 ·
React Native (Fire TV) · AWS CDK.

## Architecture

```
                              ┌──────────────┐
      viewers / creators ───▶ │  CloudFront  │  cdn.apex.tv  (HLS + VOD cache)
                              └──────┬───────┘
                                     │ origin
                              ┌──────▼───────┐
                              │  S3: videos  │◀── HLS segments, VOD, thumbnails
                              │  S3: uploads │◀── temp staging (24h TTL)
                              │  S3: assets  │◀── avatars, product images
                              └──────────────┘
        OBS ─RTMP:1935─▶ ┌───────────────────┐        ┌────────────────────┐
                         │ Streaming EC2     │        │  Application LB     │ :443
                         │ c5.xlarge (public)│        │  (public)          │
                         │ nginx-rtmp+FFmpeg │        └─────────┬──────────┘
                         │ + playout engine  │                  │ :3000  /health
                         └─────────┬─────────┘        ┌─────────▼──────────┐
                                   │ HLS out          │  API EC2           │
                                   ▼                  │  t3.medium (priv)  │
                              (to S3/CloudFront)      │  Express+Socket.io │
                                                      └───┬───────────┬────┘
                                            :5432 (priv)  │           │  :6379 (priv)
                                            ┌─────────────▼──┐   ┌────▼─────────────┐
                                            │ RDS Postgres16 │   │ ElastiCache      │
                                            │ t3.medium      │   │ Valkey t3.micro  │
                                            └────────────────┘   └──────────────────┘

  Secrets Manager · SES (apex.tv) · Rekognition · Route53 (apex.tv) · ACM
```

## Repo layout

```
apex/
├── packages/
│   ├── api/          Node.js/Express backend  (@apex/api)
│   ├── web/          Next.js 14 viewer + admin (@apex/web, :3001)
│   ├── firetv/       React Native Fire TV app  (@apex/firetv — Prompt 10)
│   └── shared/       Shared TS types/constants  (@apex/shared)
├── infrastructure/   AWS CDK stack (@apex/infrastructure)
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

## Deploy (AWS)

```bash
cd infrastructure
pnpm install
npx cdk bootstrap                       # one-time per account/region
pnpm synth                              # review CloudFormation
pnpm deploy                             # provision stack
```

After deploy:
1. Point the domain registrar at the Route53 `NameServers` output.
2. Fill the empty Secrets Manager entries (Stripe, Google, JWT, YouTube, SES SMTP).
3. Wait for ACM DNS validation (auto once NS records propagate).
4. App code is shipped to EC2 via the GitHub Actions `deploy.yml` on push to `main`.

> CDK uses **aws-cdk-lib v2** (single package) rather than the deprecated
> per-service `@aws-cdk/*` v1 modules.

## AWS resources provisioned

| Resource                | Spec                                         |
|-------------------------|----------------------------------------------|
| VPC                     | 2 AZ, public + private subnets, 1 NAT GW     |
| API EC2                 | t3.medium, Amazon Linux 2023, private        |
| Streaming EC2           | c5.xlarge, Ubuntu 22.04, public              |
| RDS PostgreSQL 16.3     | db.t3.medium, Single-AZ, 100→500GB gp3, 7d backup |
| ElastiCache Valkey      | cache.t3.micro, single node                  |
| S3                      | apex-videos / apex-uploads / apex-assets     |
| CloudFront              | PriceClass_100, custom domain cdn.apex.tv    |
| ALB                     | public :443 → API :3000, :80→:443 redirect   |
| Route53                 | public hosted zone apex.tv                    |
| ACM                     | certs for cdn.apex.tv + api.apex.tv (DNS val)|
| Secrets Manager         | rds creds + 9 manual secrets                  |
| SES                     | domain identity apex.tv                       |
| IAM                     | roles for API (S3/SES/Secrets/Rekognition), Stream (S3) |

### Estimated monthly cost (us-east-1, on-demand, rough)

| Item                          | Est. / mo |
|-------------------------------|-----------|
| API EC2 t3.medium             | ~$30      |
| Streaming EC2 c5.xlarge       | ~$125     |
| RDS db.t3.medium + 100GB gp3  | ~$75      |
| ElastiCache t3.micro          | ~$12      |
| NAT Gateway (+ data)          | ~$35+     |
| ALB                           | ~$20      |
| S3 + CloudFront (low traffic) | ~$25      |
| Route53 / SES / Secrets       | ~$5       |
| **Baseline total**            | **~$325/mo** (excludes egress/transcode/scale) |

## Scripts

Each package exposes `dev` / `build` / `start` / `lint` / `test`. Root delegates
through Turborepo (`pnpm build`, `pnpm dev`, `pnpm lint`, `pnpm test`).

## Build order

This repo is built across 10 sequential prompts. **This is Prompt 01** — scaffold
+ infrastructure. Database schema (Prompt 02), auth (03), streaming (04), web (05),
payments (06), creator/community (07), admin (08), live shop (09), Fire TV (10).
