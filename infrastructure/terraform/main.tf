# ─────────────────────────── Droplets ───────────────────────────
resource "digitalocean_droplet" "api" {
  name     = "itvn-api"
  region   = var.region
  size     = "s-2vcpu-4gb"
  image    = "ubuntu-24-04-x64"
  ssh_keys = var.ssh_key_ids

  user_data = <<-EOF
    #!/bin/bash
    set -euxo pipefail
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs git
    npm install -g pnpm pm2
    echo "Influence TV API droplet provisioned"
  EOF
}

resource "digitalocean_droplet" "streaming" {
  name     = "itvn-streaming"
  region   = var.region
  size     = "c-4" # CPU-optimized, 4 vCPU / 8GB for nginx-rtmp + FFmpeg
  image    = "ubuntu-24-04-x64"
  ssh_keys = var.ssh_key_ids

  user_data = <<-EOF
    #!/bin/bash
    set -euxo pipefail
    apt-get update -y
    apt-get install -y libnginx-mod-rtmp nginx ffmpeg git curl build-essential
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    npm install -g pm2
    mkdir -p /var/www/hls
    echo "Influence TV streaming droplet provisioned"
  EOF
}

# ─────────────────────── Managed databases ───────────────────────
resource "digitalocean_database_cluster" "postgres" {
  name       = "itvn-postgres"
  engine     = "pg"
  version    = "16"
  size       = "db-s-1vcpu-1gb"
  region     = var.region
  node_count = 1
}

resource "digitalocean_database_cluster" "redis" {
  name       = "itvn-redis"
  engine     = "redis"
  version    = "7"
  size       = "db-s-1vcpu-1gb"
  region     = var.region
  node_count = 1
}

# Restrict DB access to the API droplet only.
resource "digitalocean_database_firewall" "postgres" {
  cluster_id = digitalocean_database_cluster.postgres.id
  rule {
    type  = "droplet"
    value = digitalocean_droplet.api.id
  }
}

resource "digitalocean_database_firewall" "redis" {
  cluster_id = digitalocean_database_cluster.redis.id
  rule {
    type  = "droplet"
    value = digitalocean_droplet.api.id
  }
}

# ─────────────────────────── Spaces ───────────────────────────
# Buckets (itvn-videos / itvn-uploads / itvn-assets) are managed OUTSIDE
# Terraform on purpose — they hold live video data, so Terraform must not be
# able to destroy them. Create them once (doctl/console) with the itvn-app-key.
# Set the 24h expiration lifecycle on itvn-uploads manually:
#   s3cmd (or aws s3api) put-bucket-lifecycle-configuration on itvn-uploads.
locals {
  videos_origin = "itvn-videos.${var.region}.digitaloceanspaces.com"
}

# ───────────────────────────── CDN ─────────────────────────────
resource "digitalocean_certificate" "cdn" {
  name    = "itvn-cdn-cert"
  type    = "lets_encrypt"
  domains = ["cdn.${var.domain}"]
}

resource "digitalocean_cdn" "videos" {
  origin           = local.videos_origin
  custom_domain    = "cdn.${var.domain}"
  certificate_name = digitalocean_certificate.cdn.name
  ttl              = 3600
}

# ─────────────────────── Load balancer ───────────────────────
resource "digitalocean_certificate" "lb" {
  name    = "itvn-lb-cert"
  type    = "lets_encrypt"
  domains = [var.domain]
}

resource "digitalocean_loadbalancer" "api" {
  name                   = "itvn-lb"
  region                 = var.region
  droplet_ids            = [digitalocean_droplet.api.id]
  redirect_http_to_https = true

  forwarding_rule {
    entry_protocol   = "https"
    entry_port       = 443
    target_protocol  = "http"
    target_port      = 3000
    certificate_name = digitalocean_certificate.lb.name
  }

  healthcheck {
    protocol = "http"
    port     = 3000
    path     = "/health"
  }
}

# ─────────────────────────── Firewalls ───────────────────────────
resource "digitalocean_firewall" "api" {
  name        = "itvn-api-fw"
  droplet_ids = [digitalocean_droplet.api.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = [var.admin_ip]
  }
  inbound_rule {
    protocol                  = "tcp"
    port_range                = "3000"
    source_load_balancer_uids = [digitalocean_loadbalancer.api.id]
  }
  inbound_rule {
    protocol                  = "tcp"
    port_range                = "80"
    source_load_balancer_uids = [digitalocean_loadbalancer.api.id]
  }
  inbound_rule {
    protocol                  = "tcp"
    port_range                = "443"
    source_load_balancer_uids = [digitalocean_loadbalancer.api.id]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "digitalocean_firewall" "streaming" {
  name        = "itvn-streaming-fw"
  droplet_ids = [digitalocean_droplet.streaming.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "1935" # RTMP ingest — public
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80" # HLS output
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = [var.admin_ip]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# ─────────────────────────── DNS ───────────────────────────
resource "digitalocean_domain" "apex" {
  name = var.domain
}

resource "digitalocean_record" "root" {
  domain = digitalocean_domain.apex.id
  type   = "A"
  name   = "@"
  value  = digitalocean_loadbalancer.api.ip
  ttl    = 300
}

resource "digitalocean_record" "cdn" {
  domain = digitalocean_domain.apex.id
  type   = "CNAME"
  name   = "cdn"
  value  = "${digitalocean_cdn.videos.endpoint}."
  ttl    = 300
}

resource "digitalocean_record" "stream" {
  domain = digitalocean_domain.apex.id
  type   = "A"
  name   = "stream"
  value  = digitalocean_droplet.streaming.ipv4_address
  ttl    = 300
}
