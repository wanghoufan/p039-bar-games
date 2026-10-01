export type Timer = {
    status: "idle" | "running" | "paused";
    remainingMs: number;
    endAt: number;
};
export const idleTimer: Timer = { status: "idle", remainingMs: 0, endAt: 0 };
export const startTimer = (seconds: number, now: number): Timer => ({ status: "running", remainingMs: seconds * 1000, endAt: now + seconds * 1000 });
export const remaining = (timer: Timer, now: number) => timer.status === "running" ? Math.max(0, timer.endAt - now) : timer.remainingMs;
export const pauseTimer = (timer: Timer, now: number): Timer => ({ ...timer, status: "paused", remainingMs: remaining(timer, now) });
export const resumeTimer = (timer: Timer, now: number): Timer => ({ ...timer, status: "running", endAt: now + timer.remainingMs });
