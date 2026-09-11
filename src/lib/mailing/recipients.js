const PAGE_SIZE = 500;
const INSERT_BATCH_SIZE = 500;

/**
 * audience: 'system' | 'optional'
 * system → 이메일 있는 전원
 * optional → accepts_optional_mail = true
 */
export async function collectAllRecipients(admin, { audience }) {
  const allUsers = [];
  const seenEmails = new Set();
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = admin
      .from('short_users')
      .select('id, email')
      .not('email', 'is', null)
      .neq('email', '')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (audience === 'optional') {
      query = query.eq('accepts_optional_mail', true);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(`수신자 조회 실패: ${error.message}`);
    if (!rows?.length) break;

    for (const u of rows) {
      const email = String(u.email || '')
        .trim()
        .toLowerCase();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      allUsers.push({ user_id: u.id, email });
    }

    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }

  return allUsers;
}

export async function isRecipientEligible(admin, { userId, audience }) {
  let query = admin
    .from('short_users')
    .select('id, email, accepts_optional_mail')
    .eq('id', userId)
    .maybeSingle();

  const { data: user, error } = await query;
  if (error || !user?.email) return false;

  if (audience === 'optional' && user.accepts_optional_mail === false) {
    return false;
  }

  return true;
}

export async function insertRecipientSnapshot(admin, campaignId, recipients) {
  let inserted = 0;
  for (let i = 0; i < recipients.length; i += INSERT_BATCH_SIZE) {
    const chunk = recipients.slice(i, i + INSERT_BATCH_SIZE).map((r) => ({
      campaign_id: campaignId,
      user_id: r.user_id,
      email: r.email,
      status: 'pending',
    }));
    const { error } = await admin.from('mailing_recipients').insert(chunk);
    if (error) throw new Error(`수신자 스냅샷 저장 실패: ${error.message}`);
    inserted += chunk.length;
  }
  return inserted;
}

export async function countAudienceMembers(admin, audience) {
  let query = admin
    .from('short_users')
    .select('*', { count: 'exact', head: true })
    .not('email', 'is', null)
    .neq('email', '');

  if (audience === 'optional') {
    query = query.eq('accepts_optional_mail', true);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}
