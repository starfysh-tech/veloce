// lib/queries/dashboard.ts — role-scoped dashboard read composition.
// This module intentionally fetches one role's data per caller. Existing
// helpers are tenant-scoped by firmId, but they do not encode role access.
import type { Caller } from '@/lib/auth/caller';
import { listRfqs, type RfqListRow } from '@/lib/queries/rfqs';
import { getApprovalQueue, type ApprovalQueueRow } from '@/lib/queries/approvals';
import { getOpsTrades, getOpsHandoffs, type OpsHandoffRow, type OpsTradeRow } from '@/lib/queries/ops';
import { getComplianceOverview, type ComplianceOverview } from '@/lib/queries/compliance';
import { getDealerConcentration } from '@/lib/queries/concentration';
import { getAdminOverview, type AdminOverview } from '@/lib/queries/admin';

export type UserRole = Extract<Caller, { kind: 'user' }>['role'];

export type TraderDashboard = {
  role: 'trader';
  kpis: {
    liveAuctions: number;
    awaitingApproval: number;
    draftRfqs: number;
    responseRatePct: number | null;
  };
  recentRfqs: RfqListRow[];
  tasks: RfqListRow[];
};

export type ApproverDashboard = {
  role: 'approver';
  kpis: {
    pendingApprovals: number;
    openExceptions: number;
    policyFlags: number;
    highestConcentrationBps: number | null;
  };
  queue: ApprovalQueueRow[];
};

export type OpsDashboard = {
  role: 'ops';
  kpis: {
    capturedTrades: number;
    activeHandoffs: number;
    affirmedTrades: number;
    openHandoffExceptions: number;
  };
  trades: OpsTradeRow[];
  handoffs: OpsHandoffRow[];
};

export type ComplianceDashboard = {
  role: 'compliance';
  kpis: {
    reviewableRfqs: number;
    openExceptions: number;
    concentrationBreaches: number;
    recentEvents: number;
  };
  overview: ComplianceOverview;
};

export type AdminDashboard = {
  role: 'admin';
  kpis: {
    activeUsers: number;
    bankPanels: number;
    dealerFirms: number;
    recentEvents: number;
  };
  overview: AdminOverview;
};

export type DashboardData =
  | TraderDashboard
  | ApproverDashboard
  | OpsDashboard
  | ComplianceDashboard
  | AdminDashboard;

export function responseRatePct(rfqs: Pick<RfqListRow, 'status' | 'quoteCount' | 'invitedCount'>[]): number | null {
  const live = rfqs.filter((r) => r.status === 'live');
  const invited = live.reduce((sum, r) => sum + r.invitedCount, 0);
  if (invited === 0) return null;
  const quotes = live.reduce((sum, r) => sum + r.quoteCount, 0);
  return Math.round((quotes / invited) * 100);
}

export function highestConcentrationBps(concentration: Record<string, { shareBps: number }>): number | null {
  const shares = Object.values(concentration).map((c) => c.shareBps);
  return shares.length ? Math.max(...shares) : null;
}

export function concentrationBreachCount(rows: Array<{ shareBps: number }>, thresholdBps = 3500): number {
  return rows.filter((c) => c.shareBps > thresholdBps).length;
}

async function getTraderDashboard(firmId: string): Promise<TraderDashboard> {
  const rfqs = await listRfqs(firmId);
  return {
    role: 'trader',
    kpis: {
      liveAuctions: rfqs.filter((r) => r.status === 'live').length,
      awaitingApproval: rfqs.filter((r) => r.status === 'awaiting_approval').length,
      draftRfqs: rfqs.filter((r) => r.status === 'draft').length,
      responseRatePct: responseRatePct(rfqs),
    },
    recentRfqs: rfqs.slice(0, 5),
    tasks: rfqs.filter((r) => ['live', 'awaiting_approval', 'draft'].includes(r.status)).slice(0, 6),
  };
}

async function getApproverDashboard(firmId: string): Promise<ApproverDashboard> {
  const [queue, concentration] = await Promise.all([
    getApprovalQueue(firmId),
    getDealerConcentration(firmId),
  ]);
  return {
    role: 'approver',
    kpis: {
      pendingApprovals: queue.length,
      openExceptions: queue.reduce((sum, r) => sum + r.exceptions.length, 0),
      policyFlags: queue.reduce((sum, r) => sum + r.award.flags.length, 0),
      highestConcentrationBps: highestConcentrationBps(concentration),
    },
    queue,
  };
}

async function getOpsDashboard(firmId: string): Promise<OpsDashboard> {
  const [trades, handoffs] = await Promise.all([
    getOpsTrades(firmId),
    getOpsHandoffs(firmId),
  ]);
  return {
    role: 'ops',
    kpis: {
      capturedTrades: trades.filter((t) => t.status === 'captured').length,
      activeHandoffs: handoffs.filter((h) => h.status !== 'affirmed').length,
      affirmedTrades: trades.filter((t) => t.status === 'affirmed').length,
      openHandoffExceptions: handoffs.reduce((sum, h) => sum + h.exceptions.filter((e) => e.open).length, 0),
    },
    trades: trades.slice(0, 6),
    handoffs: handoffs.slice(0, 6),
  };
}

async function getComplianceDashboard(firmId: string): Promise<ComplianceDashboard> {
  const overview = await getComplianceOverview(firmId);
  return {
    role: 'compliance',
    kpis: {
      reviewableRfqs: overview.bestEx.length,
      openExceptions: overview.exceptions.filter((e) => e.open).length,
      concentrationBreaches: concentrationBreachCount(overview.concentration),
      recentEvents: overview.events.length,
    },
    overview,
  };
}

async function getAdminDashboard(firmId: string): Promise<AdminDashboard> {
  const overview = await getAdminOverview(firmId);
  return {
    role: 'admin',
    kpis: {
      activeUsers: overview.users.filter((u) => u.active).length,
      bankPanels: overview.panels.length,
      dealerFirms: overview.dealers.length,
      recentEvents: overview.events.length,
    },
    overview,
  };
}

export async function getDashboard(firmId: string, role: UserRole): Promise<DashboardData> {
  switch (role) {
    case 'trader':
      return getTraderDashboard(firmId);
    case 'approver':
      return getApproverDashboard(firmId);
    case 'ops':
      return getOpsDashboard(firmId);
    case 'compliance':
      return getComplianceDashboard(firmId);
    case 'admin':
      return getAdminDashboard(firmId);
  }
}
