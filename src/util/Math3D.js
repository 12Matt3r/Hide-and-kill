export function lerp(start, end, amt) { return (1 - amt) * start + amt * end; }
export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
