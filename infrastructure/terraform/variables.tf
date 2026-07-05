# Credentials are supplied via environment variables (see versions.tf):
#   DIGITALOCEAN_ACCESS_TOKEN, SPACES_ACCESS_KEY_ID, SPACES_SECRET_ACCESS_KEY

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "nyc3"
}

variable "domain" {
  description = "Root domain managed in DigitalOcean DNS"
  type        = string
  default     = "influencetvnetwork.com"
}

variable "ssh_key_ids" {
  description = "IDs of DO SSH keys to install on droplets (from `doctl compute ssh-key list`)"
  type        = list(string)
  default     = []
}

variable "admin_ip" {
  description = "Your IP (CIDR) allowed to SSH into droplets on port 22"
  type        = string
  default     = "0.0.0.0/0"
}
