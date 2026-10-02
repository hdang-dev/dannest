# One Render workspace per service: Render's 750 free instance hours are per
# workspace, so a single always-on service fits each one (~744h/month).
# The default provider is the original workspace ("DanNest Web").
provider "render" {
  api_key  = var.render_api_key
  owner_id = var.render_owner_id
}

provider "render" {
  alias    = "core"
  api_key  = var.render_api_key
  owner_id = "tea-davrsvk9v7es738v9ugg" # DanNest Core
}

provider "render" {
  alias    = "notify"
  api_key  = var.render_api_key
  owner_id = "tea-davrm6m7bikc73f714mg" # DanNest Notify
}

provider "render" {
  alias    = "market"
  api_key  = var.render_api_key
  owner_id = "tea-davrt4942hec73duk5i0" # DanNest Market
}
