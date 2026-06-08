# Backstage Portal Integration

Muninn includes metadata to support integration into a **Backstage** developer portal. This allows organizations to register Muninn as a tool in their software catalog and compile its Technical Documentation natively.

---

## Catalog Metadata: `catalog-info.yaml`

To register Muninn, a `catalog-info.yaml` file is declared in the root directory. It uses standard metadata annotations to connect Muninn to external plugins (GitHub cards, actions runs, and TechDocs).

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: muninn
  description: A modern, Gruvbox-themed GitHub management portal with native WebMCP capabilities.
  title: Muninn Portal
  annotations:
    # TechDocs documentation reference (points to local docs/ directory)
    backstage.io/techdocs-ref: dir:.
    
    # GitHub Integration
    github.com/project-slug: olafkfreund/Muninn
    
    # GitHub Actions Integration (shows actions runs directly in Backstage)
    github.com/actions-workflow: pages-deploy.yml
spec:
  type: website
  lifecycle: production
  owner: guests
  system: developer-tools
```

---

## Required Backstage Annotations

*   **`backstage.io/techdocs-ref`**: Set to `dir:.`. This tells Backstage that TechDocs documentation files live inside this repository, with configuration mapped in `mkdocs.yml` and markdown files stored under the `docs/` directory.
*   **`github.com/project-slug`**: Set to `olafkfreund/Muninn`. This links the Backstage component to the GitHub repository, enabling widgets to display open issues, pull requests, and readme contents.
*   **`github.com/actions-workflow`**: Set to `pages-deploy.yml`. This links the component to the GitHub Actions workflow file that builds and deploys the site.

---

## TechDocs Compilation: `mkdocs.yml`

Backstage TechDocs utilizes **MkDocs** to compile documentation pages. The `mkdocs.yml` in the root of the repository declares navigation structure and styling overrides:

```yaml
site_name: Muninn Portal Docs
site_description: Technical documentation for Muninn GitHub Management Portal
site_author: Olaf Krasicki-Freund

nav:
  - Overview: index.md
  - Architecture: architecture.md
  - Local Development: development.md
  - Fallback MCP Bridge: bridge.md
  - Backstage Integration: backstage.md

theme:
  name: material
  palette:
    - scheme: slate
      primary: deep orange
      accent: amber
    - scheme: default
      primary: orange
      accent: amber
  features:
    - navigation.tabs
    - navigation.sections
    - content.code.copy

plugins:
  - techdocs-core
```

Using the Slate theme palette with deep orange accents ensures that your compiled Backstage TechDocs maintain the dark, warm **Gruvbox aesthetic**!
