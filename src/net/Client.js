// Mock client for local play. In a real game, this would use WebSockets.
class MockClient {
    constructor(server) {
        this.id = 'local_player';
        this.server = server;
    }
    // In a real implementation, this would send player inputs to the server,
    // e.g., this.socket.send(JSON.stringify({ type: 'move', ... }))
    sendInput(inputData) {
        this.server.handleInput(this.id, inputData);
    }
}

export default MockClient;
