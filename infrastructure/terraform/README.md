# Apex Infrastructure — DigitalOcean (Terraform)

Provisions the Apex streaming network on DigitalOcean: droplets, managed
PostgreSQL + Redis, Spaces object storage, CDN, load balancer, firewalls, DNS.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) ≥ 1.6
- [`doctl`](https://docs.digitalocean.com/reference/doctl/) authenticated (`doctl auth init`)
- A **DigitalOcean API token** with **read + write** scope on:
  **droplets, spaces, databases, load balancers, domains**
- **Spaces access keys** (API → Spaces Keys) for the `spaces_access_id` / `spaces_secret_key` vars
- The domain (`influencetvnetwork.com`) added to DigitalOcean DNS, and your registrar's
  nameservers pointed at DigitalOcean (`ns1/ns2/ns3.digitalocean.com`)

## Setup

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars   # fill in token, spaces keys, ssh key ids, admin IP
```

Find your SSH key IDs: `doctl compute ssh-key list`.

## Commands

```bash
terraform init      # download the DigitalOcean provider
terraform plan      # preview changes
terraform apply     # provision everything
terraform destroy   # tear it all down
```

## After apply

`terraform output` prints the values you need:

| Output                    | Use for                                   |
|---------------------------|-------------------------------------------|
| `api_droplet_ip`          | `DO_API_DROPLET_IP` GitHub secret         |
| `streaming_droplet_ip`    | `DO_STREAMING_DROPLET_IP` GitHub secret   |
| `load_balancer_ip`        | `influencetvnetwork.com` A record (auto-created)         |
| `cdn_endpoint`            | `DO_CDN_ENDPOINT` / `cdn.influencetvnetwork.com`         |
| `postgres_connection_uri` | `DATABASE_URL` (sensitive)                |
| `redis_connection_uri`    | `REDIS_URL` (sensitive)                   |

```bash
terraform output -raw postgres_connection_uri
terraform output -raw redis_connection_uri
```

## Notes

- Spaces bucket names are **globally unique**. If `itvn-videos` / `itvn-uploads`
  / `itvn-assets` are taken, append a suffix in `main.tf` and update the app's
  `DO_SPACES_*_BUCKET` env vars to match.
- Let's Encrypt certificates (CDN + load balancer) require the domain to be
  live in DigitalOcean DNS before `apply` can validate them.
- The uploads Space auto-expires objects after 24h (lifecycle rule).
- Managed PostgreSQL/Redis firewalls restrict access to the API droplet only.
- `terraform.tfvars` and state files are gitignored — never commit them.
