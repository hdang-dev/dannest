# =============================================================================
#  DanNest infrastructure on Render, defined as code.
#  `terraform apply` only CREATES services that don't exist yet.
#
#  NOTE (free tier): the Render Terraform provider can't UPDATE a free-tier
#  service that already exists (its update call sends a "maintenance mode"
#  field the free tier rejects). This file is still the source of truth for
#  what should be configured — but pushing a change to an existing service
#  means calling the Render REST API directly (e.g. `PATCH
#  /v1/services/{id}`, `PUT /v1/services/{id}/env-vars/{key}`), not
#  `terraform apply`. That direct-API path isn't subject to the same
#  rejection. Keep this file in sync regardless, so `terraform plan` always
#  reflects reality.
# =============================================================================

# The two live URLs reference each other (CORS needs the web URL; the web app
# needs the backend URL). Referencing the resources' .url attributes both ways
# would be a dependency cycle, so we pin the known stable URLs here.
locals {
  web_url          = "https://dannest-punh.onrender.com"
  backend_url      = "https://dannest-service-jauh.onrender.com"
  notification_url = "https://dannest-notification.onrender.com"
  media_url        = "https://dannest-media.onrender.com"
}

# ---- Backend API (Core): Docker service built from services/core/Dockerfile ----
resource "render_web_service" "backend" {
  name   = "dannest-service"
  plan   = "free"
  region = "virginia"

  runtime_source = {
    docker = {
      repo_url        = var.repo_url
      branch          = "main"
      dockerfile_path = "./services/core/Dockerfile"
      context         = "./services/core"
      auto_deploy     = false # GitHub Actions (the robot) will trigger deploys
    }
  }

  health_check_path = "/actuator/health"

  # env_vars is a map: KEY = { value = "..." }
  env_vars = {
    DB_URL      = { value = var.db_url }
    DB_USER     = { value = var.db_user }
    DB_PASSWORD = { value = var.db_password }

    # Auth: verify Google tokens, sign our JWTs, allow the web origin (CORS).
    GOOGLE_CLIENT_ID     = { value = var.google_client_id }
    JWT_SECRET           = { value = var.jwt_secret }
    CORS_ALLOWED_ORIGINS = { value = local.web_url }

    # Refresh-token cookie: web and backend are on different Render subdomains, which
    # browsers treat as cross-site — needs SameSite=None (and thus Secure) to be sent.
    JWT_REFRESH_COOKIE_SECURE    = { value = "true" }
    JWT_REFRESH_COOKIE_SAME_SITE = { value = "None" }

    # Redis (Upstash) — backs refresh tokens only, no caching yet.
    REDIS_HOST        = { value = var.redis_host }
    REDIS_PORT        = { value = var.redis_port }
    REDIS_PASSWORD    = { value = var.redis_password }
    REDIS_SSL_ENABLED = { value = "true" }

    # Object storage (Cloudflare R2) moved to services/media — Core no longer
    # uploads bytes or talks to R2 directly (see docs/tech/architecture-flows.md).

    # Message broker (RabbitMQ / CloudAMQP) — publishes domain events for the
    # notification service to consume. Port 5671 + SSL is CloudAMQP's TLS port.
    RABBITMQ_HOST        = { value = var.rabbitmq_host }
    RABBITMQ_PORT        = { value = "5671" }
    RABBITMQ_USERNAME    = { value = var.rabbitmq_username }
    RABBITMQ_PASSWORD    = { value = var.rabbitmq_password }
    RABBITMQ_VHOST       = { value = var.rabbitmq_vhost }
    RABBITMQ_SSL_ENABLED = { value = "true" }
  }
}

# ---- Notification service: Docker service built from services/notification/Dockerfile ----
resource "render_web_service" "notification" {
  name   = "dannest-notification"
  plan   = "free"
  region = "virginia"

  runtime_source = {
    docker = {
      repo_url        = var.repo_url
      branch          = "main"
      dockerfile_path = "./services/notification/Dockerfile"
      context         = "./services/notification"
      auto_deploy     = false # GitHub Actions (the robot) will trigger deploys
    }
  }

  health_check_path = "/actuator/health"

  env_vars = {
    DB_URL      = { value = var.notification_db_url }
    DB_USER     = { value = var.notification_db_user }
    DB_PASSWORD = { value = var.notification_db_password }

    # Must match Core's JWT_SECRET exactly — this service verifies tokens Core issues.
    JWT_SECRET           = { value = var.jwt_secret }
    CORS_ALLOWED_ORIGINS = { value = local.web_url }

    # Message broker — same CloudAMQP instance Core publishes to.
    RABBITMQ_HOST        = { value = var.rabbitmq_host }
    RABBITMQ_PORT        = { value = "5671" }
    RABBITMQ_USERNAME    = { value = var.rabbitmq_username }
    RABBITMQ_PASSWORD    = { value = var.rabbitmq_password }
    RABBITMQ_VHOST       = { value = var.rabbitmq_vhost }
    RABBITMQ_SSL_ENABLED = { value = "true" }
  }
}

# ---- Media service: Docker service built from services/media/Dockerfile ----
resource "render_web_service" "media" {
  name   = "dannest-media"
  plan   = "free"
  region = "virginia"

  runtime_source = {
    docker = {
      repo_url        = var.repo_url
      branch          = "main"
      dockerfile_path = "./services/media/Dockerfile"
      context         = "./services/media"
      auto_deploy     = false # GitHub Actions (the robot) will trigger deploys
    }
  }

  health_check_path = "/healthz"

  env_vars = {
    MONGO_URI = { value = var.mongo_uri }

    # Must match Core's JWT_SECRET exactly — this service verifies tokens Core issues.
    JWT_SECRET           = { value = var.jwt_secret }
    CORS_ALLOWED_ORIGINS = { value = local.web_url }

    # Object storage (Cloudflare R2) — media uploads. Same bucket Core used pre-split.
    R2_ACCOUNT_ID      = { value = var.r2_account_id }
    R2_ACCESS_KEY      = { value = var.r2_access_key }
    R2_SECRET_KEY      = { value = var.r2_secret_key }
    R2_BUCKET          = { value = var.r2_bucket }
    R2_PUBLIC_BASE_URL = { value = var.r2_public_base_url }
  }
}

# ---- Web frontend: Next.js run as a Node service ----
resource "render_web_service" "web" {
  name   = "dannest"
  plan   = "free"
  region = "virginia"

  root_directory = "web"
  start_command  = "npm start"

  runtime_source = {
    native_runtime = {
      repo_url      = var.repo_url
      branch        = "main"
      runtime       = "node"
      build_command = "npm ci && npm run build"
      auto_deploy   = false
    }
  }

  env_vars = {
    NODE_VERSION = { value = "22" }

    # NEXT_PUBLIC_* are read at BUILD time and baked into the frontend bundle.
    NEXT_PUBLIC_GOOGLE_CLIENT_ID     = { value = var.google_client_id }
    NEXT_PUBLIC_API_URL              = { value = local.backend_url }
    NEXT_PUBLIC_NOTIFICATION_API_URL = { value = local.notification_url }
    NEXT_PUBLIC_MEDIA_API_URL        = { value = local.media_url }
  }
}

# Print the live URLs after apply.
output "backend_url" {
  value = render_web_service.backend.url
}

output "web_url" {
  value = render_web_service.web.url
}

output "notification_url" {
  value = render_web_service.notification.url
}

output "media_url" {
  value = render_web_service.media.url
}
