# Fallback MCP Bridge

If your browser does not support the experimental WebMCP browser flag (`#enable-webmcp-testing`), Muninn provides a local Node.js bridge script to let command-line AI agents inspect and control your open browser dashboard.

---

## Technical Design

```text
┌─────────────────┐             ┌────────────────┐             ┌─────────────┐
│  Local LLM/IDE  │ ──(stdio)──>│  mcp-bridge.js │ ──(WebSock)─>│ Browser Tab │
│  (e.g., Claude) │ <──(stdio)──│  (local node)  │ <──(WebSock)─│  (Muninn)   │
└─────────────────┘             └────────────────┘             └─────────────┘
```

The bridge server (`mcp-bridge.js`) acts as a standard JSON-RPC 2.0 stdio server, which connects to the browser tab over WebSockets.
*   **Stdio Transport**: Translates standard stdio messages received from your IDE or LLM client.
*   **WebSocket Transport**: Relays structured tool listing and execution payloads to the browser client.
*   **Auto-reconnect**: The browser tab monitors the port and attempts to reconnect to `ws://localhost:8765` automatically every 5 seconds.

---

## How to Run the Bridge

1.  Open a terminal inside your repository:
    ```bash
    cd Muninn
    ```
2.  Start the bridge daemon:
    ```bash
    node mcp-bridge.js
    ```
3.  Open `https://muninn.freundcloud.com` in your browser. The status dot in the bottom-left corner of the sidebar will immediately transition to **Active (via Local Bridge)**.

---

## Adding the Bridge to IDE/AI Clients

To register Muninn's tools in your local AI assistant configuration:

### Claude Desktop
Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "muninn-bridge": {
      "command": "node",
      "args": ["/absolute/path/to/Muninn/mcp-bridge.js"]
    }
  }
}
```

### Registered Tools
Once configured, your local agent has access to these tools:
*   `list_loaded_repos`: Returns all repositories currently monitored by the dashboard.
*   `list_pull_requests`: Returns open PRs, including reviewers and status check logs.
*   `list_issues`: Returns open issues grouped by repositories.
*   `trigger_action_workflow`: Triggers a manual workflow dispatch run.
