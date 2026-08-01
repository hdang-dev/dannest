# =============================================================================
#  DanNest infrastructure on Render, defined as code.
#  `terraform apply` CREATES these two services (they don't exist yet).
#
#  NOTE (free tier): the Render provider can't UPDATE free-tier services
#  (it sends a "maintenance mode" field the free tier rejects). So env-var
#  changes below are the source of truth, but are applied to live services via
#  the Render API until these move to a paid tier. Keep this file in sync.
# =============================================================================

# The two live URLs reference each other (CORS needs the web URL; the web app
# needs the backend URL). Referencing the resources' .url attributes both ways
# would be a dependency cycle, so we pin the known stable URLs here.
locals {
  web_url     = "https://dannest-punh.onrender.com"
  backend_url = "https://dannest-service-jauh.onrender.com"
}

# ---- Backend API (Core): Docker service built from services/core/Dockerfile ----
# NOTE: this path was "./service" before the services/ restructure. Per the free-tier
# limitation above, `terraform apply` CANNOT push this change to the already-existing
# live service — the Dockerfile path / context must also be updated by hand in the
# Render dashboard (Settings → Build), or the next deploy will fail looking for a
# service/Dockerfile that no longer exists.
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

    # Object storage (Cloudflare R2) — media uploads.
    R2_ACCOUNT_ID      = { value = var.r2_account_id }
    R2_ACCESS_KEY      = { value = var.r2_access_key }
    R2_SECRET_KEY      = { value = var.r2_secret_key }
    R2_BUCKET          = { value = var.r2_bucket }
    R2_PUBLIC_BASE_URL = { value = var.r2_public_base_url }

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
# Brand new resource — this is a CREATE, so (unlike the backend edits above) the free-tier
# limitation doesn't block `terraform apply` from provisioning it the first time.
#
# NOTE: its URL is only known after Render creates it (see the `notification_url` output
# below). The web frontend's NEXT_PUBLIC_NOTIFICATION_API_URL can't be wired in until then —
# and because that means editing the *already-existing* web service, that step will hit the
# same free-tier "can't update" limitation and has to be done by hand in the dashboard.
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
    NEXT_PUBLIC_GOOGLE_CLIENT_ID = { value = var.google_client_id }
    NEXT_PUBLIC_API_URL          = { value = local.backend_url }
  }
}

# Print the live URLs after apply.
output "backend_url" {
  value = render_web_service.backend.url
}

output "web_url" {
  value = render_web_service.web.url
}

# Once you have this, paste it into the web service's NEXT_PUBLIC_NOTIFICATION_API_URL
# by hand in the Render dashboard (see the note on the notification resource above).
output "notification_url" {
  value = render_web_service.notification.url
}
