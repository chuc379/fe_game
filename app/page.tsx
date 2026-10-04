'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect based on port
    if (typeof window !== 'undefined') {
      const port = window.location.port;
      if (port === '2000') {
        router.push('/mc');
      } else if (port === '2500') {
        router.push('/player');
      }
    }
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '20px',
    }}>
      <h1 style={{ color: 'white', fontSize: '48px', margin: 0 }}>🎮 Game Theory</h1>
      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '18px', margin: 0 }}>
        Guess 2/3 of Average
      </p>
      <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
        <button
          onClick={() => router.push('/rooms')}
          style={{
            padding: '12px 30px',
            fontSize: '16px',
            background: 'white',
            color: '#667eea',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          Browse Rooms
        </button>
        <button
          onClick={() => router.push('/player')}
          style={{
            padding: '12px 30px',
            fontSize: '16px',
            background: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: '2px solid white',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
          }}
        >
          Play
        </button>
      </div>
    </div>
  );
}
