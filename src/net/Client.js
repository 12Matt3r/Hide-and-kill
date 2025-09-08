class Client {
    constructor() {
        this.ws = null;
        this.gameState = null;
        this.onStateUpdate = null; // Callback for when state is updated
    }

    connect(url = 'ws://localhost:8080') {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                console.log("Connected to WebSocket server.");
                this.send('joinRoom', { roomId: 'default' });
                resolve();
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                if (message.type === 'gameState') {
                    this.gameState = message.payload;
                    if (this.onStateUpdate) {
                        this.onStateUpdate(this.gameState);
                    }
                }
            };

            this.ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                reject(error);
            };

            this.ws.onclose = () => {
                console.log("Disconnected from WebSocket server.");
                this.ws = null;
            };
        });
    }

    send(type, payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({ type, payload });
            this.ws.send(message);
        }
    }

    getLatestState() {
        return this.gameState;
    }
}

export default Client;
