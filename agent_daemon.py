import os
import sys
import logging
import asyncio
from dotenv import load_dotenv
from google.antigravity import Agent, LocalAgentConfig, types
from google.antigravity.hooks import policy
from google.antigravity.triggers import every, on_file_change, TriggerContext

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Load environment variables
load_dotenv()

# =============================================================================
# 1. Periodic Trigger: Check Repository Issues
# =============================================================================
async def check_repo_issues(ctx: TriggerContext):
    logging.info("TRIGGER: Checking GitHub Repository issues periodically...")
    # Send a prompt to the agent, which triggers it to use the GitHub MCP server to list issues
    await ctx.send("Please search for any open issues in the 'olafkfreund/Muninn' repository that need attention or labels.")

timer_trigger = every(300, check_repo_issues) # runs every 5 minutes

# =============================================================================
# 2. File Change Trigger: Verify Code on Modification
# =============================================================================
async def handle_code_changes(ctx: TriggerContext, changes):
    # Filter for relevant code/configuration file modifications
    relevant_changes = []
    for change in changes:
        path = change.path
        if any(path.endswith(ext) for ext in [".js", ".html", ".css", ".yml", ".py"]):
            # Ignore built sites, git directories, and package folders
            if not any(pat in path for pat in ["node_modules", ".git", "_site", ".jekyll-cache"]):
                relevant_changes.append(change)
                
    if not relevant_changes:
        return

    logging.info(f"TRIGGER: Code changes detected: {[c.path for c in relevant_changes]}")
    files_str = ", ".join([os.path.basename(c.path) for c in relevant_changes])
    prompt = f"The following files were modified: {files_str}. Please inspect them, run syntax checks if applicable, and report any errors."
    await ctx.send(prompt)

watch_dir = os.environ.get("AGENT_WATCH_DIR", os.path.dirname(os.path.abspath(__file__)))
file_trigger = on_file_change(watch_dir, handle_code_changes)

# =============================================================================
# Main Execution Loop
# =============================================================================
async def main():
    # Retrieve tokens from the environment
    github_token = os.getenv("GITHUB_TOKEN") or os.getenv("GITHUB_API_TOKEN") or os.getenv("SYNECHRON_GITHUB_API_TOKEN")
    if not github_token:
        logging.warning("No GITHUB_TOKEN or GITHUB_API_TOKEN found in environment. GitHub MCP server will run unauthenticated.")
    
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        logging.error("GEMINI_API_KEY is not set. The agent cannot start.")
        sys.exit(1)

    # Configure GitHub MCP Server (Stdio transport)
    mcp_servers = []
    if github_token:
        mcp_servers.append(
            types.McpStdioServer(
                name="github",
                command="npx",
                args=["-y", "@modelcontextprotocol/server-github"],
                env={
                    "GITHUB_PERSONAL_ACCESS_TOKEN": github_token
                }
            )
        )
        logging.info("Configured GitHub MCP server stdio transport.")

    # Setup Session Trajectory Persistence
    save_dir = os.environ.get("AGENT_CACHE_DIR", os.path.expanduser("~/.gemini/muninn-agent-cache"))
    os.makedirs(save_dir, exist_ok=True)
    session_file = os.path.join(save_dir, "last_session.txt")
    conversation_id = None
    
    if os.path.exists(session_file):
        try:
            with open(session_file, "r") as f:
                conversation_id = f.read().strip()
                if not conversation_id:
                    conversation_id = None
                else:
                    logging.info(f"Resuming conversation session: {conversation_id}")
        except Exception as e:
            logging.warning(f"Could not load previous session: {e}")

    # Build Agent Configuration
    config = LocalAgentConfig(
        system_instructions=(
            "You are the Muninn Autonomous Developer Agent. You monitor changes in the "
            "olafkfreund/Muninn repository and help with issues, code validation, and automated pull requests. "
            "You are equipped with the GitHub MCP server to interact with GitHub, and standard shell execution tools to validate code."
        ),
        capabilities=types.CapabilitiesConfig(
            enable_subagents=True,
        ),
        mcp_servers=mcp_servers,
        policies=[policy.allow_all()], # Allow running commands and tools autonomously in local development
        save_dir=save_dir,
        conversation_id=conversation_id,
        triggers=[timer_trigger, file_trigger],
    )

    logging.info("Starting Muninn Autonomous Developer Agent...")
    async with Agent(config) as agent:
        # Save session ID for resumption on next launch if available
        try:
            if agent.conversation_id:
                with open(session_file, "w") as f:
                    f.write(agent.conversation_id)
                logging.info(f"Saved active session ID: {agent.conversation_id}")
        except Exception as e:
            logging.warning(f"Could not save session ID: {e}")
            
        print("\n=========================================================")
        print(" Muninn Autonomous Developer Agent is active!")
        print(f" Session ID: {agent.conversation_id}")
        print(" Triggers: Periodic Issue Check (5m), Code File Watcher")
        print(" Type a message below to chat (or Ctrl+C / 'exit' to quit):")
        print("=========================================================\n")
        
        while True:
            try:
                # Execute user inputs inside asyncio executor to prevent blocking the event loop
                prompt = await asyncio.get_event_loop().run_in_executor(None, input, "agent> ")
                if not prompt.strip():
                    continue
                if prompt.strip().lower() in ["exit", "quit"]:
                    break
                
                logging.info(f"Prompt sent: {prompt}")
                response = await agent.chat(prompt)
                
                # Save session ID if it was generated/changed
                if agent.conversation_id and not os.path.exists(session_file):
                    try:
                        with open(session_file, "w") as f:
                            f.write(agent.conversation_id)
                    except Exception:
                        pass
                
                print(f"\nResponse:\n{await response.text()}\n")
            except (KeyboardInterrupt, EOFError):
                break
            except Exception as e:
                logging.error(f"Error handling interaction: {e}")

    logging.info("Muninn Autonomous Developer Agent stopped.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Daemon terminated by user.")
