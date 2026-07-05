variable "do_token" {
  description = "DigitalOcean API token (read+write: droplets, spaces, databases, load balancers, domains)"
  type        = string
  sensitive   = true
}

variable "spaces_access_id" {
  description = "DigitalOcean Spaces access key ID"
  type        = string
  sensitive   = true
}

variable "spaces_secret_key" {
  description = "DigitalOcean Spaces secret key"
  type        = string
  sensitive   = true
}

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
