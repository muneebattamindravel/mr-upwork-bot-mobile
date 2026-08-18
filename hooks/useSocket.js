import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL, SOCKET_PATH } from '../constants/config';
import useAuthStore from '../store/authStore';

const useSocket = ({ onBotHeartbeat, onBotStatusChanging, onBotCommandAck, onJobNew } = {}) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const accessToken = useAuthStore.getState().accessToken;

    const socket = io(API_BASE_URL, {
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
    });

    if (onBotHeartbeat) {
      socket.on('bot:heartbeat', onBotHeartbeat);
    }

    if (onBotStatusChanging) {
      socket.on('bot:status_changing', onBotStatusChanging);
    }

    if (onBotCommandAck) {
      socket.on('bot:command_ack', onBotCommandAck);
    }

    if (onJobNew) {
      socket.on('job:new', onJobNew);
    }

    return () => {
      socket.disconnect();
    };
  }, []);

  return { isConnected, socket: socketRef.current };
};

export default useSocket;
