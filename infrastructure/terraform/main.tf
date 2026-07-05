# ─────────────────────────── Droplets ───────────────────────────
resource "digitalocean_droplet" "api" {
  name     = "apex-api"
  region   = var.region
  size     = "s-2vcpu-4gb"
  image    = "ubuntu-22-04-x64"
  ssh_keys = var.ssh_key_ids

  user_data = <<-EOF
    #!/bin/bash
    set -euxo pipefail
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs git
    npm install -g pnpm pm2
    echo "Apex API droplet provisioned"
  EOF
}

resource "digitalocean_droplet" "streaming" {
  name     = "apex-streaming"
  region   = var.region
  size     = "c-4" # CPU-optimized, 4 vCPU / 8GB for nginx-rtmp + FFmpeg
  image    = "ubuntu-22-04-x64"
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
    echo "Apex streaming droplet provisioned"
  EOF
}

# ─────────────────────── Managed databases ───────────────────────
resource "digitalocean_database_cluster" "postgres" {
  name       = "apex-postgres"
  engine     = "pg"
  version    = "16"
  size       = "db-s-1vcpu-1gb"
  region     = var.region
  node_count = 1
}

resource "digitalocean_database_cluster" "redis" {
  name       = "apex-redis"
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
resource "digitalocean_spaces_bucket" "videos" {
  name   = "apex-videos"
  region = var.region
  acl    = "private"
}

resource "digitalocean_spaces_bucket" "uploads" {
  name   = "apex-uploads"
  region = var.region
  acl    = "private"

  lifecycle_rule {
    id      = "expire-uploads-24h"
    enabled = true
    expiration {
      days = 1
    }
  }
}

resource "digitalocean_spaces_bucket" "assets" {
  name   = "apex-assets"
  region = var.region
  acl    = "private"
}

# ───────────────────────────── CDN ─────────────────────────────
resource "digitalocean_certificate" "cdn" {
  name    = "apex-cdn-cert"
  type    = "lets_encrypt"
  domains = ["cdn.${var.domain}"]
}

resource "digitalocean_cdn" "videos" {
  origin           = digitalocean_spaces_bucket.videos.bucket_domain_name
  custom_domain    = "cdn.${var.domain}"
  certificate_name = digitalocean_certificate.cdn.name
  ttl              = 3600
}

# ─────────────────────── Load balancer ───────────────────────
resource "digitalocean_certificate" "lb" {
  name    = "apex-lb-cert"
  type    = "lets_encrypt"
  domains = [var.domain]
}

resource "digitalocean_loadbalancer" "api" {
  name                   = "apex-api-lb"
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
  name        = "apex-api-fw"
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
  name        = "apex-streaming-fw"
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
