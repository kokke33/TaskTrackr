// client/src/contexts/useWebSocket.ts

import { useContext } from 'react';
import { WebSocketContext, WebSocketContextState } from './WebSocketContext';

export const useWebSocket = (): WebSocketContextState => {
  console.log('[useWebSocket] Hook called');
  const context = useContext(WebSocketContext);
  if (context === null) {
    console.error('[useWebSocket] Context is null - WebSocketProvider not found');
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  console.log('[useWebSocket] Context found, status:', context.status);
  return context;
};