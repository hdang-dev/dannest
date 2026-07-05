# Inputs this config needs. Values are supplied in terraform.tfvars (gitignored).

variable "render_api_key" {
  description = "Render API key (Account Settings -> API Keys)"
  type        = string
  sensitive   = true
}

variable "render_owner_id" {
  description = "Render owner/workspace id (tea-... or usr-...)"
  type        = string
}

variable "repo_url" {
  description = "GitHub repo URL Render builds from"
  type        = string
  default     = "https://github.com/hdang-dev/dannest"
}

variable "db_url" {
  description = "JDBC URL for the Neon database"
  type        = string
}

variable "db_user" {
  description = "Neon database user"
  type        = string
}

variable "db_password" {
  description = "Neon database password"
  type        = string
  sensitive   = true
}
