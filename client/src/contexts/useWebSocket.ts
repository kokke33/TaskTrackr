// client/src/contexts/useWebSocket.ts

import { useContext } from 'react';
import { WebSocketContext, WebSocketContextState } from './WebSocketContext';

export const useWebSocket = (): WebSocketContextState => {
  const context = useContext(WebSocketContext);
  if (context === null) {
    console.error('[useWebSocket] Context is null - WebSocketProvider not found');
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};