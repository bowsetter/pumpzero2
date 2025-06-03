// src/types/module.d.ts
declare module '@/server/websocketServer' {
  import { Server } from 'http';
  import { WebSocketServer } from 'ws';
  import { EventEmitter } from 'events';
  import { TokenData } from './tokens';

  export function getTokenStore(): {
    tokens: TokenData[];
    solanaPrice: number;
    lastPriceUpdate: string | null;
  };

  export function initWebSocketServer(server: Server): WebSocketServer;
  
  export function getTokenEventEmitter(): EventEmitter;
}