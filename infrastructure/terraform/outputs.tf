output "api_droplet_ip" {
  description = "Public IP of the API droplet (→ DO_API_DROPLET_IP secret)"
  value       = digitalocean_droplet.api.ipv4_address
}

output "streaming_droplet_ip" {
  description = "Public IP of the streaming droplet (→ DO_STREAMING_DROPLET_IP secret)"
  value       = digitalocean_droplet.streaming.ipv4_address
}

output "load_balancer_ip" {
  description = "Load balancer public IP (influencetvnetwork.com A record target)"
  value       = digitalocean_loadbalancer.api.ip
}

output "cdn_endpoint" {
  description = "CDN endpoint for the videos Space"
  value       = digitalocean_cdn.videos.endpoint
}

output "postgres_connection_uri" {
  description = "Managed PostgreSQL connection string (→ DATABASE_URL)"
  value       = digitalocean_database_cluster.postgres.uri
  sensitive   = true
}

output "redis_connection_uri" {
  description = "Managed Redis connection string (→ REDIS_URL)"
  value       = digitalocean_database_cluster.redis.uri
  sensitive   = true
}

output "spaces_buckets" {
  description = "Spaces bucket names (managed outside Terraform)"
  value = {
    videos  = "itvn-videos"
    uploads = "itvn-uploads"
    assets  = "itvn-assets"
  }
}
