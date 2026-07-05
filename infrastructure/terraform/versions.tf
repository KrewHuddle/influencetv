terraform {
  required_version = ">= 1.6.0"
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.40"
    }
  }
}

# Credentials come from the environment (no secrets in code):
#   DIGITALOCEAN_ACCESS_TOKEN   — API token
#   SPACES_ACCESS_KEY_ID        — Spaces access key
#   SPACES_SECRET_ACCESS_KEY    — Spaces secret
provider "digitalocean" {}
