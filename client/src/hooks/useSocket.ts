import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { BalanceUpdatePayload } from '../types/index.js';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8080';

type BalanceUpdatedHandler = (payload: BalanceUpdatePayload) => void;

export const useSocket = (
  accountId: string | null,
  onBalanceUpdated: BalanceUpdatedHandler,
) => {
  const socketRef = useRef<Socket | null>(null);

  // Stable reference to callback to avoid re-connecting on every render
  const handlerRef = useRef(onBalanceUpdated);
  useEffect(() => { handlerRef.current = onBalanceUpdated; }, [onBalanceUpdated]);

  useEffect(() => {
    const token = localStorage.getItem('BalanceEngine_token');
    if (!token || !accountId) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[socket] Connected:', socket.id);
      socket.emit('subscribe_account', { accountId });
    });

    socket.on('balance_snapshot', (data: { accountId: string; balance: string }) => {
      console.log('[socket] balance_snapshot:', data);
      handlerRef.current({
        accountId: data.accountId,
        balance: data.balance,
        transactionId: '',
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('balance_updated', (payload: BalanceUpdatePayload) => {
      console.log('[socket] balance_updated:', payload);
      handlerRef.current(payload);
    });

    socket.on('error', (err: { message: string }) => {
      console.error('[socket] Server error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[socket] Disconnected:', reason);
    });

    return () => {
      socket.emit('unsubscribe_account', { accountId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accountId]);

  const emit = useCallback((event: string, data: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
};
