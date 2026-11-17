'use client';

import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import styles from './PlayerJoinQR.module.css';

interface PlayerJoinQRProps {
  roomId: string;
}

/**
 * Shows the player join link as a QR code so the MC can put it on the
 * projector: scanning it opens /player with the room already filled in.
 */
export default function PlayerJoinQR({ roomId }: PlayerJoinQRProps) {
  const [origin, setOrigin] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(
      process.env.NEXT_PUBLIC_PLAYER_URL || window.location.origin
    );
  }, []);

  const joinUrl = useMemo(() => {
    if (!origin || !roomId) return '';
    return `${origin.replace(/\/$/, '')}/player?room=${encodeURIComponent(
      roomId
    )}`;
  }, [origin, roomId]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  if (!joinUrl) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <div className={styles.card}>
        <div className={styles.qrWrap}>
          <QRCodeSVG value={joinUrl} size={156} level="M" includeMargin />
        </div>

        <div className={styles.info}>
          <h3>📱 Quét QR để vào phòng</h3>
          <p className={styles.code}>{roomId}</p>
          <p className={styles.hint}>
            Mở camera điện thoại và quét mã. Mã phòng được điền sẵn, chỉ cần
            nhập tên.
          </p>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.expandBtn}
              onClick={() => setExpanded(true)}
            >
              🔍 Phóng to
            </button>
            <button
              type="button"
              className={styles.copyBtn}
              onClick={copyLink}
            >
              {copied ? '✓ Đã copy' : '📋 Copy link'}
            </button>
          </div>

          <code className={styles.url}>{joinUrl}</code>
        </div>
      </div>

      {expanded && (
        <div
          className={styles.modal}
          role="dialog"
          aria-label={`QR vào phòng ${roomId}`}
          onClick={() => setExpanded(false)}
        >
          <div
            className={styles.modalInner}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>Quét để vào phòng</h2>
            <p className={styles.modalCode}>{roomId}</p>

            <div className={styles.modalQr}>
              <QRCodeSVG
                value={joinUrl}
                level="M"
                includeMargin
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>

            <p className={styles.modalUrl}>{joinUrl}</p>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setExpanded(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </>
  );
}
