const WINDOW_MS = 15_000;
const MAX_REQUESTS = 3;

type GateState = {
  timestamps: number[];
};

const globalGate = globalThis as typeof globalThis & {
  __pollinationsGateState__?: GateState;
};

function getState(): GateState {
  if (!globalGate.__pollinationsGateState__) {
    globalGate.__pollinationsGateState__ = { timestamps: [] };
  }
  return globalGate.__pollinationsGateState__;
}

export function checkPollinationsRateLimit(now = Date.now()): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const state = getState();
  state.timestamps = state.timestamps.filter((ts) => now - ts < WINDOW_MS);
  if (state.timestamps.length >= MAX_REQUESTS) {
    const oldest = state.timestamps[0];
    const retryAfterMs = Math.max(0, WINDOW_MS - (now - oldest));
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  state.timestamps.push(now);
  return { allowed: true, retryAfterSeconds: 0 };
}

