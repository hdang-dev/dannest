terraform {
  required_version = ">= 1.13"

  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.8"
    }
  }
}
