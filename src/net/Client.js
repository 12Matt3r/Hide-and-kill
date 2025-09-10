// net/Client.js
class Client {
  /**
   * @param {{
   *   url?: string,
   *   backoff?: { min?: number, max?: number, factor?: number, jitter?: boolean },
   *   heartbeat?: { interval?: number, timeout?: number },
   * }} [options]
   */
  constructor(options = {}) {
    const {
      url = 'ws://localhost:8080',
      backoff = {},
      heartbeat = {},
    } = options;

    // Config
    this._url = url;
    this._backoffMin = backoff.min ?? 600;
    this._backoffMax = backoff.max ?? 10_000;
    this._backoffFactor = backoff.factor ?? 1.8;
    this._backoffJitter = backoff.jitter ?? true;

    this._hbIntervalMs = heartbeat.interval ?? 15_000;
    this._hbTimeoutMs = heartbeat.timeout ?? 5_000;

    // Conn state
    this.ws = null;
    this.id = null;
    this.sequence = 0;
    this._connecting = false;
    this._shouldReconnect = false;
    this._backoffDelay = this._backoffMin;
    this._reconnectTimer = null;

    // Heartbeat
    this._hbTimer = null;
    this._hbTimeoutTimer = null;

    // Queues & in-flight requests
    this._sendQueue = [];
    this._pending = new Map(); // seq -> {resolve,reject,timeoutId}

    // External listeners
    this.onStateUpdate = null;
    this.onDisconnect = null;
    this.onError = null;
    this.onOpen = null;
    this.onMessage = null; // raw catch-all

    // Bind
    this._handleOpen = this._handleOpen.bind(this);
    this._handleMessage = this._handleMessage.bind(this);
    this._handleError = this._handleError.bind(this);
    this._handleClose = this._handleClose.bind(this);
  }

  /** Public: connect (idempotent). */
  async connect(url = this._url) {
    this._url = url;
    if (this.isOpen() || this._connecting) return;
    this._shouldReconnect = true;
    await this._openSocket();
  }

  /** Public: disable reconnect and close. */
  disconnect(code = 1000, reason = 'Client disconnect') {
    this._shouldReconnect = false;
    this._clearReconnectTimer();
    this._stopHeartbeat();
    this._rejectAllPending(new Error('Disconnected'));
    if (this.ws) {
      try { this.ws.close(code, reason); } catch {}
      this.ws = null;
    }
  }

  /** Public: fire-and-forget send. Queues if not open. */
  send(type, payload = {}) {
    const message = { type, seq: ++this.sequence, payload };
    if (this.isOpen()) {
      this._sendNow(message);
    } else {
      this._sendQueue.push(message);
    }
    return message.seq;
  }

  /**
   * Public: request/response helper.
   * Resolves when a message with {replyTo: seq} arrives (or same seq echoed).
   */
  request(type, payload = {}, { timeout = 8000 } = {}) {
    if (!Number.isFinite(timeout) || timeout <= 0) timeout = 8000;
    const seq = this.send(type, payload);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this._pending.delete(seq);
        reject(new Error(`Request timeout for seq ${seq}`));
      }, timeout);
      this._pending.set(seq, { resolve, reject, timeoutId });
    });
  }

  /** ---------- Internals ---------- */

  isOpen() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  async _openSocket() {
    if (this._connecting || this.isOpen()) return;
    this._connecting = true;

    // Close previous socket if any
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }

    try {
      this.ws = new WebSocket(this._url);
      this.ws.addEventListener('open', this._handleOpen);
      this.ws.addEventListener('message', this._handleMessage);
      this.ws.addEventListener('error', this._handleError);
      this.ws.addEventListener('close', this._handleClose);
    } catch (err) {
      this._connecting = false;
      this._scheduleReconnect();
      throw err;
    }
  }

  _handleOpen() {
    this._connecting = false;
    this._resetBackoff();
    // Flush queue
    if (this._sendQueue.length) {
      for (const msg of this._sendQueue) this._sendNow(msg);
      this._sendQueue.length = 0;
    }
    this._startHeartbeat();
    if (this.onOpen) this.onOpen();
  }

  _handleMessage(event) {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (err) {
      console.error('[Client] Bad JSON:', event.data, err);
      return;
    }

    // Heartbeat responses
    if (msg.type === 'pong') {
      this._bumpHeartbeatWatchdog();
      return;
    }

    // Resolve pending requests by replyTo (preferred) or echo seq
    if (msg.replyTo != null && this._pending.has(msg.replyTo)) {
      const p = this._pending.get(msg.replyTo);
      clearTimeout(p.timeoutId);
      this._pending.delete(msg.replyTo);
      p.resolve(msg.payload);
      return;
    }
    if (msg.seq != null && this._pending.has(msg.seq)) {
      const p = this._pending.get(msg.seq);
      clearTimeout(p.timeoutId);
      this._pending.delete(msg.seq);
      p.resolve(msg.payload);
      return;
    }

    // Route known types
    switch (msg.type) {
      case 'welcome':
        this.id = msg.payload?.id ?? null;
        break;
      case 'gameState':
        if (this.onStateUpdate) this.onStateUpdate(msg.payload);
        break;
      default:
        // app-specific messages surface here
        if (this.onMessage) this.onMessage(msg);
        break;
    }
  }

  _handleError(err) {
    if (this.onError) this.onError(err);
  }

  _handleClose() {
    this._stopHeartbeat();
    this.ws = null;
    if (this.onDisconnect) this.onDisconnect();
    if (this._shouldReconnect) this._scheduleReconnect();
  }

  _sendNow(message) {
    try {
      this.ws.send(JSON.stringify(message));
    } catch (err) {
      // If send fails mid-flight, re-queue and trigger reconnect
      this._sendQueue.unshift(message);
      if (this.onError) this.onError(err);
      if (this._shouldReconnect) {
        try { this.ws.close(); } catch {}
      }
    }
  }

  _scheduleReconnect() {
    this._clearReconnectTimer();
    const jitter = this._backoffJitter ? (Math.random() * 0.4 + 0.8) : 1; // 80–120%
    const delay = Math.min(this._backoffDelay * jitter, this._backoffMax);
    this._reconnectTimer = setTimeout(() => this._openSocket(), delay);
    this._backoffDelay = Math.min(this._backoffDelay * this._backoffFactor, this._backoffMax);
  }

  _resetBackoff() {
    this._backoffDelay = this._backoffMin;
    this._clearReconnectTimer();
  }

  _clearReconnectTimer() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    // Kick first watchdog immediately so lack of traffic still monitored
    this._bumpHeartbeatWatchdog();
    this._hbTimer = setInterval(() => {
      if (!this.isOpen()) return;
      // Send ping; server should reply with {type:'pong'}
      const ts = Date.now();
      this._safePing({ ts });
      // Watchdog will close if we don't see traffic within timeout
      this._bumpHeartbeatWatchdog();
    }, this._hbIntervalMs);
  }

  _stopHeartbeat() {
    if (this._hbTimer) clearInterval(this._hbTimer);
    this._hbTimer = null;
    if (this._hbTimeoutTimer) clearTimeout(this._hbTimeoutTimer);
    this._hbTimeoutTimer = null;
  }

  _bumpHeartbeatWatchdog() {
    if (this._hbTimeoutTimer) clearTimeout(this._hbTimeoutTimer);
    // If no message (including pong) arrives within timeout, force reconnect
    this._hbTimeoutTimer = setTimeout(() => {
      if (this.isOpen()) {
        try { this.ws.close(4000, 'Heartbeat timeout'); } catch {}
      }
    }, this._hbTimeoutMs);
  }

  _safePing(payload) {
    try {
      if (this.isOpen()) {
        this.ws.send(JSON.stringify({ type: 'ping', payload }));
      }
    } catch {}
  }

  _rejectAllPending(err) {
    for (const [seq, p] of this._pending) {
      clearTimeout(p.timeoutId);
      p.reject(err);
    }
    this._pending.clear();
  }
}

export default Client;
