# Autonomous Developer Agent Daemon

Muninn features an autonomous background developer agent built using the **Google Antigravity SDK** and the **Model Context Protocol (MCP)**. 

The agent runs as a local daemon process on your machine (or inside a container), monitors your workspace files in real time, periodically triages your GitHub repository, and performs actions on your behalf with full trajectory memory.

---

## Capabilities

1.  **Real-Time Code Auditing (File Watcher):** The agent watches your workspace directory. When you edit and save any `.js`, `.html`, `.css`, `.yml`, or `.py` files, it triggers the agent to audit the changes, run syntax checkers (e.g. `node -c`), and print warnings or proposed fixes directly to the console.
2.  **Periodic Issue Triage:** Every 5 minutes, a background timer trigger contacts the GitHub API via the local GitHub MCP server to fetch open issues, check for stale discussions, and suggest labels.
3.  **Local + GitHub Tooling (GitHub MCP):** By connecting the GitHub Stdio MCP server, the agent has native capabilities to search repository code, check PR statuses, make commits, and open pull requests directly from your terminal.
4.  **Persistent Memory:** Conversations and trajectories are saved to disk, allowing the agent to remember instructions, past bugs, and context across daemon restarts.

---

## Configuration & Credentials

The agent inherits credentials from your environment or a `.env` file:
*   `GEMINI_API_KEY`: Required to access the Gemini LLM engine.
*   `GITHUB_TOKEN` (or `GITHUB_API_TOKEN` / `SYNECHRON_GITHUB_API_TOKEN`): Required to authenticate the GitHub MCP server subprocess.

Environment variables can also be used to override the default directories:
*   `AGENT_WATCH_DIR`: The directory to monitor for changes (defaults to the script's directory).
*   `AGENT_CACHE_DIR`: Directory where session memory and trajectories are stored (defaults to `~/.gemini/muninn-agent-cache`).

---

## How to Run the Agent

You can run the agent in three different environments depending on your preference:

### 1. Using the `devenv` Shell (Recommended for Local Dev)
We have registered a shell runner alias. Enter the dev shell and launch the agent:
```bash
devenv shell agent
```

### 2. Standard Virtual Environment
To run it outside of the Nix devenv environment using python:
```bash
# Initialize venv and install dependencies
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Run the agent daemon
.venv/bin/python3 agent_daemon.py
```

### 3. Containerized (Docker Compose)
To isolate all dependencies (Python, Node.js, Ruby, Jekyll, Git) inside a container, you can run the agent using Docker:
```bash
# Build the container image
docker compose build

# Run the agent in interactive mode
docker compose run --rm agent
```
*The docker compose setup mounts your workspace directory to `/workspace` so code edits are immediately synced to your host machine, and maps a named volume `muninn-agent-cache` so memory is preserved.*

---

## Project Structure

*   `agent_daemon.py`: The main Python daemon script registering the triggers, loading the local GitHub MCP server, and managing the interaction loop.
*   `requirements.txt`: Python package requirements (including `google-antigravity`, `watchfiles`, `python-dotenv`).
*   `Dockerfile` & `docker-compose.yml`: Container definitions mapping directories and passing environment credentials.
