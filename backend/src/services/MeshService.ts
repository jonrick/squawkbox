import { SocketService } from './SocketService';
import { LogService } from './LogService';
import { PrismaClient } from '@prisma/client';
import { MeshDevice, Protobuf } from '@meshtastic/core';
import { TransportNode } from '@meshtastic/transport-node';

export class MeshService {
  private socketService: SocketService;
  private logService: LogService;
  private prisma: PrismaClient;
  private gatewayNodeId: string;
  private isOnline = false;
  private device: MeshDevice | null = null;
  private meshIp: string;
  private meshPort: number;
  private targetChannel: number;

  // Cache of node numbers to Long Names
  private nodeMap: Map<number, string> = new Map();
  // Buffer of outbound squawks to be sent when the node comes back online
  private outboundQueue: { message: string, replyId?: number, toNodeId?: number }[] = [];

  constructor(socketService: SocketService, logService: LogService, prisma: PrismaClient, gatewayNodeId: string) {
    this.socketService = socketService;
    this.logService = logService;
    this.prisma = prisma;
    this.gatewayNodeId = gatewayNodeId;

    this.meshIp = process.env.MESHTASTIC_IP || '192.168.12.90';
    this.meshPort = parseInt(process.env.MESHTASTIC_PORT || '4404');
    this.targetChannel = parseInt(process.env.MESHTASTIC_CHANNEL || '0');
  }

  async init() {
    console.log(`[MeshService] Initializing real Meshtastic integration to ${this.meshIp}:${this.meshPort}...`);
    this.logService.log('SYS', 'INIT', `Initializing Meshtastic connection to ${this.meshIp}:${this.meshPort}`);
    
    // Load existing identities from database
    try {
      const nodes = await this.prisma.node.findMany();
      for (const node of nodes) {
        if (node.long_name) {
          this.nodeMap.set(parseInt(node.id, 16), node.long_name);
        }
      }
      console.log(`[MeshService] Loaded ${nodes.length} identities from database.Cached.`);
    } catch (e) {
      console.error("[MeshService] Failed to load identities from DB", e);
    }

    this.connect();
  }

  private async connect() {
    try {
      console.log(`[MeshService] Attempting TCP connection to ${this.meshIp}:${this.meshPort}...`);
      this.logService.log('SYS', 'CONNECT', `Attempting TCP connection to ${this.meshIp}:${this.meshPort}`);
      const transport = await TransportNode.create(this.meshIp, this.meshPort);
      this.device = new MeshDevice(transport);

      // Handle User Packets (for Long Names)
      this.device.events.onUserPacket.subscribe(async (packet: any) => {
        const longName = packet.data?.longName;
        const shortName = packet.data?.shortName;
        const hexId = packet.from?.toString(16);

        if (longName && hexId) {
          this.nodeMap.set(packet.from, longName);
          console.log(`[MeshService] Identified Node !${hexId} as "${longName}"`);
          this.logService.log('RX', 'USER_PKT', `Identified Node !${hexId} as "${longName}"`, {
            from: packet.from,
            longName,
            shortName,
          });

          // Persist to DB
          try {
            await this.prisma.node.upsert({
              where: { id: hexId },
              update: { long_name: longName, short_name: shortName, last_heard: new Date() },
              create: { id: hexId, long_name: longName, short_name: shortName }
            });

            // RETROACTIVE FIX: Update all previous squawks from this node that might be using "node-hexID"
            await this.prisma.squawk.updateMany({
              where: { 
                node_id: hexId,
                OR: [
                  { author: `node-${hexId}` },
                  { author: "" } 
                ]
              },
              data: { author: longName }
            });
            
          } catch (e) { console.error("[MeshService] Failed to upsert node or update squawks", e); }
        }
      });

      // Handle incoming signals (Text Messages)
      // We use onMeshPacket because it contains the raw envelope with SNR/RSSI/Hops data.

      // 2. Primary Engine: This event fires SECOND, giving us access to the raw protobuf 
      // where the 'replyId' is located, which we combine with the buffered metadata above.
      this.device.events.onMeshPacket.subscribe(async (packet: any) => {
        if (packet.payloadVariant?.case === 'decoded' && 
            packet.payloadVariant.value?.portnum === 1) { // TEXT_MESSAGE_APP
          
          const decoded = packet.payloadVariant.value;
          const text = new TextDecoder().decode(decoded.payload);
          const senderId = packet.from.toString(16);
          const packetId = packet.id;

          // DEEP HARVEST: Extract signal stats directly from the raw envelope
          const snr = packet.rxSnr ?? (packet as any).rx_snr ?? (packet as any).p?.rxSnr ?? (packet as any).metadata?.rxSnr ?? (packet as any).data?.rxSnr;
          const rssi = packet.rxRssi ?? (packet as any).rx_rssi ?? (packet as any).p?.rxRssi ?? (packet as any).metadata?.rxRssi ?? (packet as any).data?.rxRssi;
          const hops = packet.hopLimit ?? (packet as any).hop_limit ?? (packet as any).p?.hopLimit ?? (packet as any).metadata?.hopLimit ?? (packet as any).data?.hopLimit;
          
          const stats = {
            snr: typeof snr === 'number' ? snr : undefined,
            rssi: typeof rssi === 'number' ? rssi : undefined,
            hops: typeof hops === 'number' ? hops : undefined,
          };

          this.logService.log('RX', 'TEXT_MSG', `From !${senderId}: ${text}`, {
            from: packet.from,
            id: packetId,
            rxSnr: stats.snr,
            rxRssi: stats.rssi,
            hopLimit: stats.hops,
            replyId: decoded.replyId,
            channel: packet.channel,
          });

          // AVOID ECHO: If the message matches our outbound pattern, ignore it
          const shortId = this.gatewayNodeId.length > 4 ? this.gatewayNodeId.slice(-4) : this.gatewayNodeId;
          if (text.includes(`📡${shortId}:`)) {
            this.logService.log('SYS', 'ECHO_SKIP', `Suppressed loopback echo: ${text}`);
            return;
          }

          console.log(`[MeshService] Incoming Mesh Message from !${senderId}: ${text}`);

          // Resolve author name
          let author = this.nodeMap.get(packet.from);
          if (!author) {
            const dbNode = await this.prisma.node.findUnique({ where: { id: senderId } });
            if (dbNode && dbNode.long_name) {
              const name = dbNode.long_name as string;
              author = name;
              this.nodeMap.set(packet.from, name);
            }
          }
          if (!author) author = `node-${senderId}`;

          // Resolve Threading
          let replyToId: number | null = null;
          // In Protobuf, 0 is often the default, so we check > 0
          if (decoded.replyId && decoded.replyId > 0) {
            const parent = await this.prisma.squawk.findFirst({
              where: { mesh_packet_id: String(decoded.replyId) }
            });
            if (parent) {
              replyToId = parent.id;
              console.log(`[MeshService] Thread Matched (via Protobuf)! Reply to Squawk ID: ${replyToId}`);
            }
          }

          // Persist to DB
          try {
            const saved = await this.prisma.squawk.create({
              data: {
                author,
                node_id: senderId,
                message: text,
                snr: stats.snr ?? null,
                rssi: stats.rssi ?? null,
                hops: stats.hops ?? null,
                mesh_packet_id: String(packetId),
                reply_to_id: replyToId,
                is_global: true // Flag as from mesh
              },
              include: { parent_squawk: true }
            }) as any;

            this.socketService.broadcastSquawk(saved);
          } catch (dbErr: any) {
            console.error(`[MeshService] Database error on incoming message: ${dbErr.message}`);
          }
        }
      });

      // Handle device status changes
      this.device.events.onDeviceStatus.subscribe((status: any) => {
        this.handleDeviceStatus(status);
      });

    } catch (err: any) {
      console.error(`[MeshService] Connection failed: ${err.message}. Retrying in 10s...`);
      this.logService.log('SYS', 'ERROR', `Connection failed: ${err.message}. Retrying in 10s...`);
      setTimeout(() => this.connect(), 10000);
    }
  }

  private handleDeviceStatus(status: number) {
    console.log(`[MeshService] Device Status Changed: ${status}`);
    this.logService.log('SYS', 'STATUS', `Device status changed: ${status}`);

    // Allow online on Status 5 (Connected) or Status 7 (Configured)
    if (status === 5 || status === 7) {
      if (!this.isOnline) {
        this.isOnline = true;
        this.socketService.broadcastNodeStatus(this.isOnline);
        console.log(`[MeshService] Device CONNECTED/CONFIGURED and ready.`);
        this.logService.log('SYS', 'READY', `Mesh device ready with status: ${status}`);
        
        // Auto-flush queue on reconnect
        this.processOutboundQueue();
      }
    } else if (status === 2) {
      // Disconnected
      this.handleDisconnect();
    }
  }

  private handleDisconnect() {
    this.isOnline = false;
    this.socketService.broadcastNodeStatus(this.isOnline);
    this.device = null;
    console.log("[MeshService] Disconnected. Attempting reconnect in 10s...");
    this.logService.log('SYS', 'DISCONNECT', 'Disconnected from node. Attempting reconnect in 10s...');
    setTimeout(() => this.connect(), 10000);
  }

  private async processOutboundQueue() {
    if (this.outboundQueue.length === 0) return;
    
    console.log(`[MeshService] Connection restored. Flushing ${this.outboundQueue.length} pending messages...`);
    this.logService.log('SYS', 'QUEUE_FLUSH', `Restored. Flushing ${this.outboundQueue.length} pending messages...`);
    
    // Drain the queue
    const messages = [...this.outboundQueue];
    this.outboundQueue = [];
    
    for (const item of messages) {
      await this.queueMessage(item.message, item.replyId, item.toNodeId);
      // Wait a tiny bit between messages to avoid congestion
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async queueMessage(formattedMessage: string, replyId?: number, toNodeId?: number): Promise<number | undefined> {
    if (!this.isOnline || !this.device) {
      console.warn(`[MeshService] Node offline. Queuing message for reconnect: ${formattedMessage}`);
      this.logService.log('SYS', 'QUEUE_PUSH', `Queued (Offline): ${formattedMessage}`);
      this.outboundQueue.push({ message: formattedMessage, replyId, toNodeId });
      
      // Limit queue size to avoid bloat
      if (this.outboundQueue.length > 20) this.outboundQueue.shift();
      return undefined;
    }

    try {
      // FORCE BROADCAST for all Squawk traffic. 
      // Individual 'Directed' messaging triggered 'NOT_LOCAL' (error 5) on some radios.
      // 0xFFFFFFFF is the standard broadcast address for channel traffic.
      const destination: number = 0xFFFFFFFF;
      
      console.log(`[MeshService] SENDING -> ${formattedMessage} (To: ${destination}, Native Reply ID: ${replyId || 'none'})`);
      this.logService.log('TX', 'TEXT_MSG', `Sending: ${formattedMessage}`, {
        to: destination,
        replyId: replyId || null,
        channel: this.targetChannel,
      });

      // Send to targeted channel (0 by default)
      const result = await this.device.sendText(formattedMessage, destination, true, this.targetChannel, replyId);
      
      // Capture the mesh packet ID from the result
      const meshPacketId = (result as any)?.id || (result as any);
      if (meshPacketId) {
        this.logService.log('SYS', 'TX_ID', `Outbound packet ID: ${meshPacketId}`);
      }
      return meshPacketId ? Number(meshPacketId) : undefined;
    } catch (err: any) {
      const errMsg = err?.message || JSON.stringify(err) || 'Unknown error';
      console.error(`[MeshService] Failed to send message: ${errMsg}`, err);
      this.logService.log('SYS', 'TX_ERROR', `Failed to send: ${errMsg}`);
      return undefined;
    }
  }

  getLogs(count?: number) {
    return this.logService.getLogs(count);
  }
}
