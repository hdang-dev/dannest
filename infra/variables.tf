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

# ---- Auth (Google sign-in) ----

variable "google_client_id" {
  description = "Google OAuth Client ID (public — safe to keep in code)"
  type        = string
  default     = "350344514147-tpdsko12kk5rh10i279o5pjp8j7s7dkk.apps.googleusercontent.com"
}

variable "jwt_secret" {
  description = "Secret key that signs our app JWTs (set in terraform.tfvars)"
  type        = string
  sensitive   = true
}

# ---- Object storage (Cloudflare R2) ----

variable "r2_account_id" {
  description = "Cloudflare R2 account id (forms the S3 endpoint host)"
  type        = string
}

variable "r2_access_key" {
  description = "R2 API token Access Key ID"
  type        = string
  sensitive   = true
}

variable "r2_secret_key" {
  description = "R2 API token Secret Access Key"
  type        = string
  sensitive   = true
}

variable "r2_bucket" {
  description = "R2 bucket name for media uploads"
  type        = string
  default     = "dannest-media"
}

variable "r2_public_base_url" {
  description = "R2 bucket public base URL (pub-*.r2.dev or custom domain), no trailing slash"
  type        = string
}
