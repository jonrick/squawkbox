import { SocketService } from './SocketService';
import { PrismaClient } from '@prisma/client';
import { MeshDevice, Protobuf } from '@meshtastic/core';
import { TransportNode } from '@meshtastic/transport-node';

export class MeshService {
  private socketService: SocketService;
  private prisma: PrismaClient;
  private gatewayNodeId: string;
  private isOnline = false;
  private device: MeshDevice | null = null;
  private meshIp: string;
  private meshPort: number;
  private targetChannel: number;

  // Cache of node numbers to Long Names
  private nodeMap: Map<number, string> = new Map();

  constructor(socketService: SocketService, prisma: PrismaClient, gatewayNodeId: string) {
    this.socketService = socketService;
    this.prisma = prisma;
    this.gatewayNodeId = gatewayNodeId;

    this.meshIp = process.env.MESHTASTIC_IP || '192.168.12.90';
    this.meshPort = parseInt(process.env.MESHTASTIC_PORT || '4404');
    this.targetChannel = parseInt(process.env.MESHTASTIC_CHANNEL || '0');
  }

  async init() {
    console.log(`[MeshService] Initializing real Meshtastic integration to ${this.meshIp}:${this.meshPort}...`);
    this.connect();
  }

  private async connect() {
    try {
      console.log(`[MeshService] Attempting TCP connection to ${this.meshIp}:${this.meshPort}...`);
      const transport = await TransportNode.create(this.meshIp, this.meshPort);
      this.device = new MeshDevice(transport);

      this.isOnline = true;
      this.socketService.broadcastNodeStatus(this.isOnline);
      console.log(`[MeshService] Successfully connected to Meshtastic Node!`);

      // Handle User Packets (for Long Names)
      this.device.events.onUserPacket.subscribe((packet: any) => {
        const longName = packet.data.longName;
        if (longName) {
          this.nodeMap.set(packet.from, longName);
          console.log(`[MeshService] Identified Node !${packet.from.toString(16)} as "${longName}"`);
        }
      });

      // Handle incoming signals (Text Messages)
      this.device.events.onMessagePacket.subscribe(async (packet: any) => {
        const message = packet.data;
        const senderId = packet.from.toString(16);

        // AVOID ECHO: If the message matches our outbound pattern, ignore it
        const shortId = this.gatewayNodeId.length > 4 ? this.gatewayNodeId.slice(-4) : this.gatewayNodeId;
        if (message.includes(`📡${shortId}:`)) {
          console.log(`[MeshService] Suppressing loopback echo from Mesh: ${message}`);
          return;
        }

        console.log(`[MeshService] Incoming Mesh Message from !${senderId}: ${message}`);

        // Resolve author name (Long Name > node-hex)
        const author = this.nodeMap.get(packet.from) || `node-${senderId}`;

        const newSquawk = await (this.prisma.squawk.create({
          data: {
            author: author,
            node_id: senderId,
            message: message,
            is_global: true,
            snr: packet.snr,
            rssi: packet.rssi,
            hops: (packet as any).hopLimit
          }
        }) as any);

        this.socketService.broadcastSquawk(newSquawk as any);
      });

      // Handle device status changes
      this.device.events.onDeviceStatus.subscribe((status: any) => {
        console.log(`[MeshService] Device Status Changed: ${status}`);
        if (status === 2) {
          this.handleDisconnect();
        }
      });

    } catch (err: any) {
      console.error(`[MeshService] Connection failed: ${err.message}. Retrying in 10s...`);
      setTimeout(() => this.connect(), 10000);
    }
  }

  private handleDisconnect() {
    this.isOnline = false;
    this.socketService.broadcastNodeStatus(this.isOnline);
    this.device = null;
    console.log("[MeshService] Disconnected. Attempting reconnect in 10s...");
    setTimeout(() => this.connect(), 10000);
  }

  async queueMessage(formattedMessage: string, replyId?: number) {
    if (!this.isOnline || !this.device) {
      console.warn(`[MeshService] Node offline. Dropping outbound packet.`);
      return;
    }

    try {
      console.log(`[MeshService] SENDING -> ${formattedMessage} (Native Reply ID: ${replyId || 'none'})`);
      // Send to targeted channel (0 by default) as a broadcast
      await this.device.sendText(formattedMessage, "broadcast", true, this.targetChannel, replyId);
    } catch (err: any) {
      console.error(`[MeshService] Failed to send message: ${err.message}`);
    }
  }
}
