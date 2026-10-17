import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'access_denied'
  | 'item_deleted'
  | 'backup_created';

export interface SecurityEvent {
  type: SecurityEventType;
  username?: string;
  detail?: string;
  timestamp: string;
}

export interface SuspiciousActivity {
  rule: string;
  username?: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

const WINDOW_MS = 15 * 60 * 1000;
const FAILED_LOGIN_THRESHOLD = 5;
const ACCESS_DENIED_THRESHOLD = 10;
const MAX_EVENTS_READ = 5000;

/**
 * Operational logging plus a persistent security-event trail.
 * Events are appended as JSON lines to `<STORAGE_PATH>/.audit/events.jsonl`
 * (dot-prefixed so the file browser hides it).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly eventsFile: string;

  constructor(configService: ConfigService) {
    const storagePath =
      configService.get<string>('storagePath') ?? './public_storage';
    const auditDir = path.join(storagePath, '.audit');
    fs.mkdirSync(auditDir, { recursive: true });
    this.eventsFile = path.join(auditDir, 'events.jsonl');
  }

  log(message: string, context?: string): void {
    this.logger.log(message, context);
  }

  async recordEvent(
    type: SecurityEventType,
    data: { username?: string; detail?: string } = {},
  ): Promise<void> {
    const event: SecurityEvent = {
      type,
      ...data,
      timestamp: new Date().toISOString(),
    };
    try {
      await fs.promises.appendFile(
        this.eventsFile,
        JSON.stringify(event) + '\n',
        'utf8',
      );
    } catch (error) {
      this.logger.error(
        `Could not write security event: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Bursts of failed logins or denied accesses per user within a sliding window.
   */
  async getSuspiciousActivity(): Promise<SuspiciousActivity[]> {
    const events = await this.readRecentEvents();
    return [
      ...this.detectBursts(
        events,
        'login_failure',
        FAILED_LOGIN_THRESHOLD,
        'repeated_failed_logins',
      ),
      ...this.detectBursts(
        events,
        'access_denied',
        ACCESS_DENIED_THRESHOLD,
        'repeated_access_denied',
      ),
    ];
  }

  private async readRecentEvents(): Promise<SecurityEvent[]> {
    let raw: string;
    try {
      raw = await fs.promises.readFile(this.eventsFile, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const events: SecurityEvent[] = [];
    for (const line of raw.split('\n').slice(-MAX_EVENTS_READ)) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line) as SecurityEvent);
      } catch {
        // Skip a corrupted line instead of failing the whole report.
      }
    }
    return events;
  }

  private detectBursts(
    events: SecurityEvent[],
    type: SecurityEventType,
    threshold: number,
    rule: string,
  ): SuspiciousActivity[] {
    const byUser = new Map<string, number[]>();
    for (const event of events) {
      if (event.type !== type) continue;
      const key = event.username ?? '(unknown)';
      const times = byUser.get(key) ?? [];
      times.push(Date.parse(event.timestamp));
      byUser.set(key, times);
    }

    const findings: SuspiciousActivity[] = [];
    for (const [username, times] of byUser) {
      times.sort((a, b) => a - b);
      let start = 0;
      let best: { from: number; to: number } | null = null;
      for (let end = 0; end < times.length; end++) {
        while (times[end] - times[start] > WINDOW_MS) start++;
        const size = end - start + 1;
        if (size >= threshold && (!best || size > best.to - best.from + 1)) {
          best = { from: start, to: end };
        }
      }
      if (best) {
        findings.push({
          rule,
          username,
          count: best.to - best.from + 1,
          firstSeen: new Date(times[best.from]).toISOString(),
          lastSeen: new Date(times[best.to]).toISOString(),
        });
      }
    }
    return findings;
  }
}
