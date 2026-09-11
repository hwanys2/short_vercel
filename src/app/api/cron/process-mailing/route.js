import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { findResumableRunningCampaigns } from '@/lib/mailing/campaign';
import { runCampaignWorkerLoop, CRON_LOOP_MAX_MS } from '@/lib/mailing/worker';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CRON_RESPONSE_BUDGET_MS = 52_000;
const MIN_CAMPAIGN_BUDGET_MS = 12_000;

function authorizeCron(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET is not configured');
    return false;
  }
  const auth = request.headers.get('authorization') || '';
  if (auth === `Bearer ${secret}`) return true;

  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron && process.env.VERCEL === '1') {
    const url = new URL(request.url);
    const q = url.searchParams.get('secret');
    if (q && q === secret) return true;
  }
  return false;
}

async function handle(request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const startedAt = Date.now();
    const deadlineAt = startedAt + CRON_RESPONSE_BUDGET_MS;
    const admin = getSupabaseAdmin();
    const resumable = await findResumableRunningCampaigns(admin);
    const results = [];
    const deferred = [];

    for (const row of resumable) {
      const remainingMs = deadlineAt - Date.now();
      if (remainingMs < MIN_CAMPAIGN_BUDGET_MS) {
        deferred.push(row.id);
        continue;
      }

      const result = await runCampaignWorkerLoop(admin, row.id, {
        maxDurationMs: Math.min(CRON_LOOP_MAX_MS, remainingMs),
      });
      results.push({ campaignId: row.id, ...result });
    }

    return NextResponse.json({
      success: true,
      resumed: resumable.length,
      campaignIds: resumable.map((r) => r.id),
      processed: results.length,
      deferred,
      results,
    });
  } catch (error) {
    console.error('[cron/process-mailing] error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return handle(request);
}

export async function POST(request) {
  return handle(request);
}
