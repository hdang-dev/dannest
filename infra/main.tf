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

# ---- Backend API: Docker service built from service/Dockerfile ----
resource "render_web_service" "backend" {
  name   = "dannest-service"
  plan   = "free"
  region = "virginia"

  runtime_source = {
    docker = {
      repo_url        = var.repo_url
      branch          = "main"
      dockerfile_path = "./service/Dockerfile"
      context         = "./service"
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
    GOOGLE_CLIENT_ID      = { value = var.google_client_id }
    JWT_SECRET            = { value = var.jwt_secret }
    CORS_ALLOWED_ORIGINS  = { value = local.web_url }
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
