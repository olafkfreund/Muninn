# Muninn Portal Overview

Muninn is a modern, client-side GitHub management portal designed to centralize and automate your daily software engineering workflows. It is themed using a high-contrast **Gruvbox** color scheme and includes experimental integrations with the browser-native **WebMCP (Web Model Context Protocol)** standard.

Named after one of Odin's ravens, Muninn travels the GitHub API to bring back memory, status, and insight about your codebases.

---

## Why Muninn?

Modern developers deal with information overload across multiple codebases. To get a status check, a developer must visit separate GitHub tabs for:
1.  Running Actions/Workflows
2.  Open Pull Requests requiring review
3.  Open Issues assigned to them
4.  Security scanning alerts and Dependabot warnings
5.  Repository metrics (stars, forks, languages)

Muninn consolidates all of these panels into a **single, responsive dashboard**. By using a client-side Personal Access Token (PAT) stored only in your browser, it queries the GitHub API directly, keeping your secrets safe while allowing you to perform rapid, bulk triage operations.

---

## Key Capabilities

*   **Actions Monitor**: View workflow runs in real-time, cancel stuck pipelines, and trigger new builds.
*   **PR Manager**: Triage reviewer assignments, check status validations, and execute direct merges.
*   **Issue Triage**: Review issues grouped by repository, create new issues via templates, and bulk-close stale issues.
*   **Security Scans**: Unified display of Dependabot and Code scanning warnings.
*   **Automations & Local Ollama Agent**: Local browser terminal allowing direct connection to a local Ollama instance (running `/api/generate`) to assist with draft generation and code analysis.
*   **WebMCP & Bridge**: Fallback StdIO-to-WebSocket server allowing terminal AI agents to interact with your browser tab.
*   **Autonomous Developer Agent Daemon**: A background Python service utilizing the Google Antigravity SDK and the GitHub MCP server to monitor code edits in real-time, trigger compiler checks, and periodically check issues. See the [Autonomous Agent Guide](agent.md) for details.
