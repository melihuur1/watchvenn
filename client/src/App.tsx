import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Phase 0 placeholder: proves the client builds, Tailwind works and the socket connects.
export function App() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-amber-400 to-rose-500 bg-clip-text text-5xl font-black tracking-tight text-transparent">
          WatchVenn
        </h1>
        <p className="mt-3 text-stone-400">
          Sunucu bağlantısı: {connected ? 'bağlı ✓' : 'bağlanıyor…'}
        </p>
      </div>
    </main>
  );
}
