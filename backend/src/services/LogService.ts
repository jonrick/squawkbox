import * as fs from 'fs';
import * as path from 'path';

export interface NodeLogEntry {
  timestamp: string;
  direction: 'TX' | 'RX' | 'SYS';
  type: string;
  summary: string;
  raw?: string;
}

export class LogService {
  private ringBuffer: NodeLogEntry[] = [];
  private maxEntries = 500;
  private logFilePath: string;
  private logStream: fs.WriteStream;

  constructor() {
    const logDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logFilePath = path.join(logDir, 'node.log');
    this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
    console.log(`[LogService] Logging node traffic to ${this.logFilePath}`);
  }

  log(direction: 'TX' | 'RX' | 'SYS', type: string, summary: string, raw?: any) {
    const entry: NodeLogEntry = {
      timestamp: new Date().toISOString(),
      direction,
      type,
      summary,
      raw: raw ? JSON.stringify(raw) : undefined,
    };

    // In-memory ring buffer
    this.ringBuffer.push(entry);
    if (this.ringBuffer.length > this.maxEntries) {
      this.ringBuffer.shift();
    }

    // Append to file
    const line = `[${entry.timestamp}] [${entry.direction}] [${entry.type}] ${entry.summary}${entry.raw ? ' | ' + entry.raw : ''}`;
    this.logStream.write(line + '\n');
  }

  getLogs(count: number = 200): NodeLogEntry[] {
    return this.ringBuffer.slice(-count);
  }
}
