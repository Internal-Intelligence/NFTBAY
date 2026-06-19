import React, { useEffect, useState } from 'react';

interface CountdownProps {
  endTime: number; // unix timestamp seconds
  onEnd?: () => void;
  className?: string;
}

export default function Countdown({ endTime, onEnd, className = '' }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const diff = Math.max(0, endTime - now);

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;

      setTimeLeft({ days, hours, mins, secs });

      if (diff <= 0 && onEnd) {
        onEnd();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime, onEnd]);

  const { days, hours, mins, secs } = timeLeft;

  return (
    <div className={`font-mono text-lg tracking-[2px] text-[#22ffaa] ${className}`}>
      {days > 0 && `${days}d `}
      {hours.toString().padStart(2, '0')}h {mins.toString().padStart(2, '0')}m {secs.toString().padStart(2, '0')}s
    </div>
  );
}
