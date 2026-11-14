'use client';

import { useEffect } from 'react';
import styles from './ExecutionOverlay.module.css';

interface ExecutionOverlayProps {
  /** Names of the players executed this round */
  names: string[];
  /** "player" shows a personal game-over message */
  variant?: 'mc' | 'player';
  /** Called when the overlay should disappear (click / timeout) */
  onDismiss?: () => void;
  /** Auto dismiss delay in ms (0 disables auto dismiss) */
  autoHideMs?: number;
}

export default function ExecutionOverlay({
  names,
  variant = 'mc',
  onDismiss,
  autoHideMs = 5500,
}: ExecutionOverlayProps) {
  useEffect(() => {
    if (!onDismiss || autoHideMs <= 0) return;
    const timer = setTimeout(onDismiss, autoHideMs);
    return () => clearTimeout(timer);
    // names is included so a new execution restarts the timer
  }, [onDismiss, autoHideMs, names.join('|')]);

  const title = variant === 'player' ? 'Bạn đã bị xử tử' : 'Tử hình';
  const subtitle =
    variant === 'player'
      ? 'Bạn đã hết điểm sinh mệnh — giờ chỉ còn là khán giả'
      : 'Hết điểm sinh mệnh';

  return (
    <div
      className={styles.backdrop}
      role="alertdialog"
      aria-label={title}
      onClick={onDismiss}
    >
      <div className={styles.vignette} />
      <div className={styles.guillotine} aria-hidden="true">
        <span className={styles.rope} />
        <span className={styles.steel} />
      </div>

      <div className={styles.skull} aria-hidden="true">
        ☠️
      </div>
      <div className={styles.stamp}>{title}</div>
      <p className={styles.names}>{names.filter(Boolean).join(', ')}</p>
      <p className={styles.sub}>{subtitle}</p>

      {onDismiss && (
        <button
          type="button"
          className={styles.dismiss}
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
        >
          Tiếp tục
        </button>
      )}
    </div>
  );
}
