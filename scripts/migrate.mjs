/**
 * 숏.한국 데이터 마이그레이션 스크립트
 * MySQL 덤프 → Supabase (PostgreSQL)로 데이터 이전
 * 
 * 사용법:
 *   1. .env.local 파일에 Supabase 환경변수 설정
 *   2. MySQL 덤프 파일 경로 확인
 *   3. node scripts/migrate.js 실행
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ======= 설정 =======
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SQL_DUMP_PATH = process.argv[2] || '../hkz9d1x2cyxa5923_short.sql';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  console.error('   .env.local 파일을 설정한 후 다시 시도하세요.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ======= MySQL INSERT 파싱 =======
function parseInsertValues(sql, tableName) {
  // INSERT INTO `tableName` (...) VALUES (...), (...); 형식 파싱
  const regex = new RegExp(
    `INSERT INTO \`${tableName}\`\\s*\\([^)]+\\)\\s*VALUES\\s*`,
    'gi'
  );

  const rows = [];
  const lines = sql.split('\n');

  let inInsert = false;
  let buffer = '';

  for (const line of lines) {
    if (line.match(new RegExp(`INSERT INTO \`${tableName}\``, 'i'))) {
      inInsert = true;
      buffer = line;
      continue;
    }

    if (inInsert) {
      buffer += '\n' + line;
      if (line.trim().endsWith(';')) {
        inInsert = false;
        // 값 추출
        const valuesMatch = buffer.match(/VALUES\s*([\s\S]*);$/i);
        if (valuesMatch) {
          const valuesStr = valuesMatch[1];
          const parsed = parseValueTuples(valuesStr);
          rows.push(...parsed);
        }
        buffer = '';
      }
    }
  }

  return rows;
}

function parseValueTuples(str) {
  const tuples = [];
  let depth = 0;
  let current = '';
  let inString = false;
  let escapeNext = false;
  let stringChar = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escapeNext) {
      current += ch;
      escapeNext = false;
      continue;
    }

    if (ch === '\\') {
      current += ch;
      escapeNext = true;
      continue;
    }

    if (inString) {
      current += ch;
      if (ch === stringChar) {
        inString = false;
      }
      continue;
    }

    if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }

    if (ch === '(') {
      depth++;
      if (depth === 1) {
        current = '';
        continue;
      }
    }

    if (ch === ')') {
      depth--;
      if (depth === 0) {
        tuples.push(parseTupleValues(current));
        current = '';
        continue;
      }
    }

    if (depth > 0) {
      current += ch;
    }
  }

  return tuples;
}

function parseTupleValues(str) {
  const values = [];
  let current = '';
  let inString = false;
  let escapeNext = false;
  let stringChar = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (escapeNext) {
      current += ch;
      escapeNext = false;
      continue;
    }

    if (ch === '\\') {
      escapeNext = true;
      // MySQL escape → 실제 문자
      continue;
    }

    if (inString) {
      if (ch === stringChar) {
        // 다음 문자도 같은 따옴표면 이스케이프
        if (i + 1 < str.length && str[i + 1] === stringChar) {
          current += ch;
          i++;
          continue;
        }
        inString = false;
        values.push(current);
        current = '';
        continue;
      }
      current += ch;
      continue;
    }

    if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      current = '';
      continue;
    }

    if (ch === ',') {
      if (current.trim() !== '') {
        const val = current.trim();
        values.push(val === 'NULL' ? null : val);
      }
      current = '';
      continue;
    }

    current += ch;
  }

  // 마지막 값
  if (current.trim() !== '') {
    const val = current.trim();
    values.push(val === 'NULL' ? null : val);
  }

  return values;
}

// ======= 마이그레이션 실행 =======
async function migrate() {
  console.log('🚀 숏.한국 데이터 마이그레이션 시작...\n');

  // SQL 덤프 읽기
  const dumpPath = path.resolve(SQL_DUMP_PATH);
  if (!fs.existsSync(dumpPath)) {
    console.error(`❌ SQL 덤프 파일을 찾을 수 없습니다: ${dumpPath}`);
    process.exit(1);
  }

  console.log(`📂 SQL 덤프 파일: ${dumpPath}`);
  const sql = fs.readFileSync(dumpPath, 'utf-8');

  // ---- 1. Users 마이그레이션 ----
  console.log('\n📋 Users 테이블 데이터 파싱 중...');
  const userRows = parseInsertValues(sql, 'users');
  console.log(`   → ${userRows.length}명의 사용자 발견`);

  const BATCH_SIZE = 100;
  let userInserted = 0;
  let userErrors = 0;

  for (let i = 0; i < userRows.length; i += BATCH_SIZE) {
    const batch = userRows.slice(i, i + BATCH_SIZE).map((row) => ({
      legacy_id: parseInt(row[0]),
      username: row[1],
      email: row[2],
      password: row[3], // bcrypt 해시 그대로 유지
      created_at: row[4] ? row[4] + '+09:00' : new Date().toISOString(), // Asia/Seoul
      updated_at: row[5] ? row[5] + '+09:00' : new Date().toISOString(),
      last_login: row[6] ? row[6] + '+09:00' : null,
    }));

    const { error } = await supabase.from('short_users').upsert(batch, {
      onConflict: 'legacy_id',
      ignoreDuplicates: false,
    });

    if (error) {
      console.error(`   ❌ Users 배치 ${i / BATCH_SIZE + 1} 오류:`, error.message);
      userErrors += batch.length;
    } else {
      userInserted += batch.length;
    }

    process.stdout.write(`   진행: ${Math.min(i + BATCH_SIZE, userRows.length)}/${userRows.length}\r`);
  }

  console.log(`\n   ✅ Users: ${userInserted}명 삽입, ${userErrors}명 오류`);

  // legacy_id → id 매핑 테이블 생성
  console.log('\n📋 User ID 매핑 생성 중...');
  const { data: allUsers } = await supabase
    .from('short_users')
    .select('id, legacy_id')
    .not('legacy_id', 'is', null);

  const userIdMap = {};
  if (allUsers) {
    for (const u of allUsers) {
      userIdMap[u.legacy_id] = u.id;
    }
  }
  console.log(`   → ${Object.keys(userIdMap).length}개 매핑 생성`);

  // ---- 2. URLs 마이그레이션 ----
  console.log('\n📋 URLs 테이블 데이터 파싱 중...');
  const urlRows = parseInsertValues(sql, 'urls');
  console.log(`   → ${urlRows.length}개의 URL 발견`);

  let urlInserted = 0;
  let urlErrors = 0;

  for (let i = 0; i < urlRows.length; i += BATCH_SIZE) {
    const batch = urlRows.slice(i, i + BATCH_SIZE).map((row) => {
      const legacyUserId = row[7] ? parseInt(row[7]) : null;
      const newUserId = legacyUserId ? userIdMap[legacyUserId] || null : null;

      return {
        legacy_id: parseInt(row[0]),
        original_url: row[1],
        code: row[2],
        created_at: row[3] ? row[3] + '+09:00' : new Date().toISOString(),
        expiration_date: row[4] ? row[4] + '+09:00' : new Date().toISOString(),
        visits: row[5] ? parseInt(row[5]) : 0,
        last_visit: row[6] ? row[6] + '+09:00' : null,
        user_id: newUserId,
      };
    });

    const { error } = await supabase.from('short_urls').insert(batch);

    if (error) {
      console.error(`   ❌ URLs 배치 ${i / BATCH_SIZE + 1} 오류:`, error.message);
      // 개별 삽입 시도
      for (const item of batch) {
        const { error: singleError } = await supabase.from('short_urls').insert(item);
        if (singleError) {
          urlErrors++;
        } else {
          urlInserted++;
        }
      }
    } else {
      urlInserted += batch.length;
    }

    process.stdout.write(`   진행: ${Math.min(i + BATCH_SIZE, urlRows.length)}/${urlRows.length}\r`);
  }

  console.log(`\n   ✅ URLs: ${urlInserted}개 삽입, ${urlErrors}개 오류`);

  // ---- 3. 검증 ----
  console.log('\n📋 데이터 검증 중...');

  const { count: dbUsers } = await supabase
    .from('short_users')
    .select('*', { count: 'exact', head: true });

  const { count: dbUrls } = await supabase
    .from('short_urls')
    .select('*', { count: 'exact', head: true });

  const { count: urlsWithUser } = await supabase
    .from('short_urls')
    .select('*', { count: 'exact', head: true })
    .not('user_id', 'is', null);

  console.log(`   Users: 원본 ${userRows.length}명 → DB ${dbUsers}명`);
  console.log(`   URLs:  원본 ${urlRows.length}개 → DB ${dbUrls}개`);
  console.log(`   회원 URL: ${urlsWithUser}개`);

  if (dbUsers === userRows.length && dbUrls === urlRows.length) {
    console.log('\n🎉 마이그레이션 완료! 모든 데이터가 정상적으로 이전되었습니다.');
  } else {
    console.log('\n⚠️ 마이그레이션 완료. 일부 데이터 차이가 있을 수 있습니다. 위 로그를 확인하세요.');
  }
}

migrate().catch((err) => {
  console.error('❌ 마이그레이션 실패:', err);
  process.exit(1);
});
