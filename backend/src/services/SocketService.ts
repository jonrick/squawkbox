import { Server } from 'socket.io';

export class SocketService {
  private io: Server;

  constructor(server: any) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`New client connected: ${socket.id}`);
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  broadcastSquawk(squawk: any) {
    this.io.emit('new_squawk', squawk);
  }

  broadcastNodeStatus(isOnline: boolean) {
    this.io.emit('node_status', { isOnline });
  }
}
