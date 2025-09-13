import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const server = new WebSocketServer({ port: 8080 });
const rooms = {};

console.log("Server started on port 8080");

server.on('connection', ws => {
    const clientId = randomUUID();
    ws.clientId = clientId;
    console.log(`Client ${clientId} connected.`);

    ws.on('message', message => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'joinRoom') {
                const roomId = 'default'; // For now, only one room
                if (!rooms[roomId]) {
                    rooms[roomId] = {
                        worldSeed: Date.now(),
                        clients: new Map(),
                    };
                    console.log(`Created room '${roomId}' with seed ${rooms[roomId].worldSeed}`);
                }

                const room = rooms[roomId];
                room.clients.set(clientId, ws);
                ws.roomId = roomId;

                // Respond with ack and worldSeed
                ws.send(JSON.stringify({
                    type: 'joinRoomAck',
                    replyTo: data.seq,
                    payload: {
                        worldSeed: room.worldSeed
                    }
                }));
            }
        } catch (e) {
            console.error("Failed to handle message:", e);
        }
    });

    ws.on('close', () => {
        const room = rooms[ws.roomId];
        if (room) {
            room.clients.delete(ws.clientId);
            if (room.clients.size === 0) {
                console.log(`Room ${ws.roomId} is empty, closing.`);
                delete rooms[ws.roomId];
            }
        }
        console.log(`Client ${clientId} disconnected.`);
    });
});
