import { WebSocketServer, WebSocket } from "ws";
import { Server, IncomingMessage } from "http";
import { getTokenStore } from "./tokenManager";
import { safeJsonParse } from "./utils";

// Track if a WebSocket server has already been initialized
let isWebSocketServerInitialized = false;

// Initialize WebSocket server
export function initWebSocketServer(server: Server): WebSocketServer {
  // Check if WebSocket server is already initialized
  if (isWebSocketServerInitialized) {
    console.log("WebSocket server already initialized, returning");
    return new WebSocketServer({ noServer: true });
  }

  console.log("Initializing WebSocket server");
  isWebSocketServerInitialized = true;

  const wss = new WebSocketServer({ noServer: true });

  // Handle WebSocket connection upgrades
  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    try {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } catch (error) {
      console.error("Error handling WebSocket upgrade:", error);
      // Ensure we don't leave hanging connections
      socket.destroy();
    }
  });

  // Handle WebSocket connections
  wss.on("connection", (ws: WebSocket) => {
    console.log("WebSocket client connected");

    try {
      // Send initial data to the new client
      const { tokens, solanaPrice, lastPriceUpdate } = getTokenStore();
      console.log(
        "Client connected, current tokenStore length:",
        tokens.length
      );

      if (tokens.length > 0) {
        console.log(
          "Sending initial data to client, first token:",
          tokens[0].mint
        );
        try {
          ws.send(
            JSON.stringify({
              type: "initialData",
              tokens: tokens.slice(0, 100), // Send initial 100 tokens
              solanaPrice,
              lastPriceUpdate,
            })
          );
          console.log("Successfully sent initial data to client");
        } catch (err) {
          console.error("Error sending initial data to client:", err);
        }
      } else {
        console.log("No tokens to send to client initially");
        // Send empty array to avoid client errors
        try {
          ws.send(
            JSON.stringify({
              type: "initialData",
              tokens: [],
              solanaPrice,
              lastPriceUpdate,
            })
          );
        } catch (err) {
          console.error("Error sending empty initial data to client:", err);
        }
      }

      // Handle client messages
      ws.on("message", (message) => {
        try {
          const messageStr = message.toString();
          const data = safeJsonParse(messageStr);
          if (!data) return;

          console.log("Client message received:", data);

          // Handle client-side requests
          if (data.action === "fetchTokens") {
            // Client is requesting token data refresh
            const { tokens, solanaPrice, lastPriceUpdate } = getTokenStore();
            ws.send(
              JSON.stringify({
                type: "tokenUpdate",
                tokens: tokens.slice(0, 100),
                solanaPrice,
                lastPriceUpdate,
              })
            );
          }
        } catch (error) {
          console.error("Error handling client message:", error);
        }
      });
    } catch (error) {
      console.error("Error setting up client connection:", error);
    }

    // Handle client disconnection
    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });

    // Handle client errors
    ws.on("error", (error) => {
      console.error("WebSocket client error:", error);
    });
  });

  return wss;
}