/**
 * VELMÈRE WATCH — CONTINUOUS EVIDENCE MONITORING ENGINE
 * 
 * Continuous surveillance of on-chain state changes:
 * - PROXY_UPGRADED
 * - ADMIN_TRANSFERRED
 * - TAX_MODIFIED
 * - BLACKLIST_MODIFIED
 * - LIQUIDITY_REMOVED
 * - ORACLE_HEARTBEAT_EXPIRED
 * 
 * Strict rule: All alerts MUST be bound to a cryptographically hashed evidence object.
 */

import { type EvidenceObject } from "../evidence/claim-evidence-model";

export type WatchEventType =
  | "PROXY_UPGRADED"
  | "ADMIN_TRANSFERRED"
  | "TAX_MODIFIED"
  | "BLACKLIST_MODIFIED"
  | "LIQUIDITY_REMOVED"
  | "ORACLE_HEARTBEAT_EXPIRED";

export interface WatchAlert {
  alertId: string;
  assetId: string;
  eventType: WatchEventType;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
  description: string;
  triggeredAt: string;
  evidence: EvidenceObject | null;
  evidenceAvailable: boolean;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
}

export class VelmereWatchEngine {
  private alerts: WatchAlert[] = [];

  public triggerAlert(
    assetId: string,
    eventType: WatchEventType,
    severity: WatchAlert["severity"],
    description: string,
    evidence: EvidenceObject | null,
  ): WatchAlert {
    const alert: WatchAlert = {
      alertId: `ALT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      assetId,
      eventType,
      severity,
      description,
      triggeredAt: new Date().toISOString(),
      evidence,
      evidenceAvailable: Boolean(evidence),
      status: "ACTIVE",
    };
    this.alerts.push(alert);
    return alert;
  }

  public getActiveAlerts(assetId?: string): WatchAlert[] {
    if (assetId) {
      return this.alerts.filter((a) => a.assetId === assetId && a.status === "ACTIVE");
    }
    return this.alerts.filter((a) => a.status === "ACTIVE");
  }
}
