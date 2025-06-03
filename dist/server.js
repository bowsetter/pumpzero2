"use strict";
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');
// For diagnostics
console.log('Current working directory:', process.cwd());
console.log('NODE_ENV:', process.env.NODE_ENV);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });
    console.log('About to initialize WebSocket server...');
    try {
        let websocketServer;
        let tokenManager;
        let externalWebSocket;
        // First, we'll try to import the compiled JavaScript module from dist
        try {
            // Register ts-node to handle TypeScript imports
            require('ts-node').register({
                project: path.join(__dirname, 'tsconfig.server.json')
            });
            // Import the TypeScript modules
            websocketServer = require('./src/server/websocketServer');
            tokenManager = require('./src/server/tokenManager');
            externalWebSocket = require('./src/server/externalWebSocket');
            console.log('Successfully imported modules using ts-node');
        }
        catch (e) {
            console.log('Failed to import from dist:', e.message);
            // If development mode, try to use ts-node for direct TypeScript import
            if (dev) {
                console.log('Development mode detected, trying to use ts-node...');
                try {
                    // Register ts-node to handle TypeScript imports
                    require('ts-node').register({
                        project: path.join(__dirname, 'tsconfig.server.json')
                    });
                    // Import the TypeScript modules
                    websocketServer = require('./src/server/websocketServer');
                    tokenManager = require('./src/server/tokenManager');
                    externalWebSocket = require('./src/server/externalWebSocket');
                    console.log('Successfully imported modules using ts-node');
                }
                catch (tsNodeErr) {
                    console.error('Error using ts-node:', tsNodeErr);
                    throw new Error('Could not import required modules with ts-node');
                }
            }
            else {
                throw new Error('Could not import required modules in production');
            }
        }
        console.log('Modules imported successfully');
        console.log('Available websocketServer exports:', Object.keys(websocketServer));
        console.log('Available tokenManager exports:', Object.keys(tokenManager));
        console.log('Available externalWebSocket exports:', Object.keys(externalWebSocket));
        if (typeof websocketServer.initWebSocketServer === 'function') {
            console.log('Calling initWebSocketServer...');
            const wss = websocketServer.initWebSocketServer(server);
            // Initialize external WebSocket connection and intervals
            console.log('Calling setupExternalWS...');
            externalWebSocket.setupExternalWS(wss, server);
            // Test the token store after a short delay
            setTimeout(() => {
                try {
                    const tokenStore = tokenManager.getTokenStore();
                    console.log('Token store after 10 seconds:', {
                        tokens: tokenStore.tokens ? tokenStore.tokens.length : 'N/A',
                        solanaPrice: tokenStore.solanaPrice,
                        lastUpdate: tokenStore.lastPriceUpdate
                    });
                }
                catch (err) {
                    console.error('Error checking token store:', err);
                }
            }, 10000);
        }
        else {
            console.error('initWebSocketServer is not a function');
        }
    }
    catch (error) {
        console.error('Error initializing WebSocket server:', error);
    }
    server.listen(4000, (err) => {
        if (err)
            throw err;
        console.log('> Ready on http://localhost:3000');
    });
});
