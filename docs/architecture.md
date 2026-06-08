# Architecture & Technical Design

Muninn is designed as a **serverless, static website** powered by **Jekyll** and hosted on **GitHub Pages**. All data processing, authentication validation, and API polling occur client-side in the browser.

---

## Technical Stack

*   **Static Engine**: Jekyll 4.4.1
*   **Design System**: Custom CSS Custom Properties (Variables) implementing Gruvbox Dark (default) and Light color tokens.
*   **Fonts**: *Outfit* (for body text and headings), *JetBrains Mono* (for status badges, code, and logs).
*   **API Layer**: Direct client-side calls to the GitHub REST API (`https://api.github.com`).
*   **Local Storage**: Browser `localStorage` is utilized for local, private persistence of:
    *   `gh_pat`: Your Personal Access Token (PAT).
    *   `theme`: Color mode preferences (`dark` or `light`).
    *   `refresh_interval`: Period in seconds for background auto-refresh.

---

## File Structure

```text
Muninn/
├── _config.yml         # Jekyll settings (custom domain, excludes)
├── Gemfile             # Ruby dependencies (jekyll, webrick)
├── devenv.nix          # Nix shell environment configuration
├── catalog-info.yaml   # Backstage component annotation metadata
├── mkdocs.yml          # Backstage TechDocs configuration
├── mcp-bridge.js       # JSON-RPC WebSocket server (fallback bridge)
├── index.html          # Main HTML entrypoint (SPA dashboard panels)
├── _layouts/
│   └── default.html    # Base HTML template containing viewport & fonts
├── assets/
│   ├── css/
│   │   └── style.css   # Gruvbox styling tokens & responsive layout
│   ├── js/
│   │   └── app.js      # App controller (API client, view-routing, WebMCP)
│   └── images/
│       └── logo.png    # Brand logo asset (Norse raven tech illustration)
└── docs/               # Technical documentation (Backstage TechDocs source)
```

---

## Security Model

Muninn has a **zero-backend security architecture**:
1.  **Direct Communication**: Your browser tab communicates directly with GitHub's servers. No intermediary server is ever used.
2.  **Private Tokens**: Your Personal Access Token is stored inside your browser's sandboxed `localStorage` database. It never leaves your machine.
3.  **No Server Logs**: Since there is no backend hosting server (only static hosting via GitHub Pages), your token and repository details can never be leaked through server logs or database breaches.
