export function TimerOverlay({ seconds, total, paused }: {
    seconds: number;
    total: number;
    paused: boolean;
}) { return <div className="punishment-timer" role="timer" aria-label={paused ? "已暂停" : "倒计时"} style={{ background: `conic-gradient(var(--color-hot-pink) ${seconds / total * 360}deg, transparent 0)` }}><div><strong>{seconds}</strong><span>/ {total} 秒</span>{paused && <small>已暂停</small>}</div></div>; }
