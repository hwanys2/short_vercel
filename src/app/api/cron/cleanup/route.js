import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { deleteShortFiles } from '@/lib/shortFiles';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH = 200;
const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;

function authorizeCron(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET is not configured');
    return false;
  }
  const auth = request.headers.get('authorization') || '';
  if (auth === `Bearer ${secret}`) return true;

  // Allow Vercel Cron + secret query as fallback
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron && process.env.VERCEL === '1') {
    const url = new URL(request.url);
    const q = url.searchParams.get('secret');
    if (q && q === secret) return true;
  }
  return false;
}

async function cleanupExpiredGuests(supabase) {
  let deleted = 0;
  let filesRemoved = 0;

  for (;;) {
    const { data: rows, error } = await supabase
      .from('short_urls')
      .select('id, type, file_path')
      .is('user_id', null)
      .lt('expiration_date', new Date().toISOString())
      .limit(BATCH);

    if (error) throw error;
    if (!rows || rows.length === 0) break;

    const filePaths = rows
      .filter((r) => r.type === 'file' && r.file_path)
      .map((r) => r.file_path);

    if (filePaths.length > 0) {
      await deleteShortFiles(filePaths);
      filesRemoved += filePaths.length;
    }

    const ids = rows.map((r) => r.id);
    const { error: delErr } = await supabase.from('short_urls').delete().in('id', ids);
    if (delErr) throw delErr;
    deleted += ids.length;

    if (rows.length < BATCH) break;
  }

  return { deleted, filesRemoved };
}

/**
 * 회원 파일: 다운로드 기간 만료 시 단축 주소 행은 유지하고 R2 객체만 삭제.
 * file_path를 null로 비워 공개 URL 우회 다운로드를 막는다.
 */
async function cleanupExpiredMemberFileObjects(supabase) {
  let cleared = 0;
  let filesRemoved = 0;
  const nowIso = new Date().toISOString();

  for (;;) {
    const { data: rows, error } = await supabase
      .from('short_urls')
      .select('id, file_path')
      .eq('type', 'file')
      .not('user_id', 'is', null)
      .lt('expiration_date', nowIso)
      .not('file_path', 'is', null)
      .limit(BATCH);

    if (error) throw error;
    if (!rows || rows.length === 0) break;

    const filePaths = rows.map((r) => r.file_path).filter(Boolean);
    if (filePaths.length > 0) {
      await deleteShortFiles(filePaths);
      filesRemoved += filePaths.length;
    }

    const ids = rows.map((r) => r.id);
    const { error: updErr } = await supabase
      .from('short_urls')
      .update({ file_path: null, original_url: '__file_expired__' })
      .in('id', ids);
    if (updErr) throw updErr;
    cleared += ids.length;

    if (rows.length < BATCH) break;
  }

  return { cleared, filesRemoved };
}

async function cleanupInactiveMemberFiles(supabase) {
  let deleted = 0;
  let filesRemoved = 0;
  const cutoff = new Date(Date.now() - THREE_MONTHS_MS).toISOString();

  for (;;) {
    // last_visit older than 3 months
    const { data: byLastVisit, error: e1 } = await supabase
      .from('short_urls')
      .select('id, file_path')
      .eq('type', 'file')
      .not('user_id', 'is', null)
      .lt('last_visit', cutoff)
      .limit(BATCH);

    if (e1) throw e1;

    // never visited: use created_at
    const { data: byCreated, error: e2 } = await supabase
      .from('short_urls')
      .select('id, file_path')
      .eq('type', 'file')
      .not('user_id', 'is', null)
      .is('last_visit', null)
      .lt('created_at', cutoff)
      .limit(BATCH);

    if (e2) throw e2;

    const map = new Map();
    for (const r of [...(byLastVisit || []), ...(byCreated || [])]) {
      map.set(r.id, r);
    }
    const staleRows = [...map.values()];
    if (staleRows.length === 0) break;

    const filePaths = staleRows.map((r) => r.file_path).filter(Boolean);
    if (filePaths.length > 0) {
      await deleteShortFiles(filePaths);
      filesRemoved += filePaths.length;
    }

    const ids = staleRows.map((r) => r.id);
    const { error: delErr } = await supabase.from('short_urls').delete().in('id', ids);
    if (delErr) throw delErr;
    deleted += ids.length;

    if (staleRows.length < BATCH) break;
  }

  return { deleted, filesRemoved };
}

export async function GET(request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const guests = await cleanupExpiredGuests(supabase);
    const expiredMemberFiles = await cleanupExpiredMemberFileObjects(supabase);
    const memberFiles = await cleanupInactiveMemberFiles(supabase);

    return NextResponse.json({
      success: true,
      guests,
      expired_member_files: expiredMemberFiles,
      member_files: memberFiles,
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cleanup cron error:', error);
    return NextResponse.json({ success: false, error: 'Cleanup failed' }, { status: 500 });
  }
}

export async function POST(request) {
  return GET(request);
}
