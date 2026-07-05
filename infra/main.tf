# =============================================================================
#  DanNest infrastructure on Render, defined as code.
#  `terraform apply` CREATES these two services (they don't exist yet).
# =============================================================================

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
  }
}

# Print the live URLs after apply.
output "backend_url" {
  value = render_web_service.backend.url
}

output "web_url" {
  value = render_web_service.web.url
}
