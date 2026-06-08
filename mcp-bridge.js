// Muninn MCP Bridge
// Bridges stdio (used by IDE/LLM client) to a browser tab WebSocket connection.

const { WebSocketServer } = require('ws');
const readline = require('readline');

const PORT = 8765;
const wss = new WebSocketServer({ port: PORT });
let browserSocket = null;

// Track pending JSON-RPC requests from the LLM client
const pendingRequests = new Map();

console.error(`[Bridge] Starting WebSocket server on ws://localhost:${PORT}...`);

wss.on('connection', (ws) => {
  console.error('[Bridge] Browser tab connected!');
  browserSocket = ws;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      // Check if this is a response to a forwarded request
      if (data.id !== undefined && pendingRequests.has(data.id)) {
        const originalId = data.id;
        const response = pendingRequests.get(originalId);
        pendingRequests.delete(originalId);

        // Send response back to LLM client stdout
        sendToStdout({
          jsonrpc: '2.0',
          id: originalId,
          result: data.result,
          error: data.error
        });
      } else {
        // Forward notifications or other messages if applicable
        console.error('[Bridge] Received message from browser:', data);
      }
    } catch (err) {
      console.error('[Bridge] Error parsing browser message:', err.message);
    }
  });

  ws.on('close', () => {
    console.error('[Bridge] Browser tab disconnected.');
    if (browserSocket === ws) {
      browserSocket = null;
    }
  });
});

// Setup Readline to parse standard input from LLM client
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const request = JSON.parse(line);
    handleClientRequest(request);
  } catch (err) {
    console.error('[Bridge] Error parsing stdin JSON:', err.message);
    sendToStdout({
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error' }
    });
  }
});

function handleClientRequest(req) {
  const { method, id, params } = req;

  // 1. Handle standard initialization handshake directly
  if (method === 'initialize') {
    sendToStdout({
      jsonrpc: '2.0',
      id: id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'muninn-mcp-bridge',
          version: '1.0.0'
        }
      }
    });
    return;
  }

  if (method === 'notifications/initialized') {
    // Handshake finished, no response needed
    return;
  }

  // 2. Forward other requests to the browser if connected
  if (!browserSocket) {
    sendToStdout({
      jsonrpc: '2.0',
      id: id,
      error: { 
        code: -32603, 
        message: 'No browser tab connected to the bridge. Please open Muninn portal in your browser.' 
      }
    });
    return;
  }

  // Save request context to resolve later
  pendingRequests.set(id, req);

  // Send request to browser
  browserSocket.send(JSON.stringify({
    jsonrpc: '2.0',
    method: method,
    id: id,
    params: params
  }));
}

function sendToStdout(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}
