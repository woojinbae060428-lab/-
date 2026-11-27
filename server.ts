import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDbConfigStatus, getDbPool, getTodayKst } from './src/server/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || '3000');

app.use(express.json({ limit: '64kb' }));

function parsePositiveInt(raw: unknown): number | null {
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    return null;
  }
  return num;
}

function handleDbError(res: Response, err: unknown, fallbackMessage: string) {
  const errorObj = err as { code?: string; errno?: number; message?: string };
  if (errorObj?.code === 'DB_NOT_CONFIGURED') {
    const status = getDbConfigStatus();
    return res.status(503).json({
      error: 'TiDB Cloud 연결 설정(Secrets)이 아직 입력되지 않았어요.',
      code: 'DB_NOT_CONFIGURED',
      missing: status.missing,
    });
  }

  console.error('[DB Error]', errorObj?.code || '', errorObj?.message || err);
  return res.status(500).json({
    error: fallbackMessage,
    code: errorObj?.code || 'DB_ERROR',
  });
}

app.get('/api/health', async (_req: Request, res: Response) => {
  const status = getDbConfigStatus();
  if (!status.configured) {
    return res.status(503).json({
      ok: false,
      dbConfigured: false,
      missing: status.missing,
    });
  }

  try {
    const pool = getDbPool();
    await pool.execute('SELECT 1 AS ok');
    return res.json({ ok: true, dbConfigured: true, todayKst: getTodayKst() });
  } catch (err) {
    return handleDbError(res, err, '데이터베이스 연결을 확인하지 못했어요.');
  }
});

// Screen 1: Home (v_kpi + v_weekday)
app.get('/api/home', async (_req: Request, res: Response) => {
  try {
    const pool = getDbPool();
    const [kpiRows] = await pool.execute<RowDataPacket[]>(
      'SELECT 전체_공연수, 공연장수, 다가오는_공연수, 단독_비율 FROM v_kpi LIMIT 1'
    );
    const [weekdayRows] = await pool.execute<RowDataPacket[]>(
      'SELECT 요일번호, 요일, 공연수 FROM v_weekday ORDER BY 요일번호 ASC'
    );

    const kpi = kpiRows[0] ?? {
      전체_공연수: 0,
      공연장수: 0,
      다가오는_공연수: 0,
      단독_비율: 0,
    };

    return res.json({
      kpi,
      weekdays: weekdayRows,
      todayKst: getTodayKst(),
    });
  } catch (err) {
    return handleDbError(res, err, '홈 통계 데이터를 불러오지 못했어요.');
  }
});

// Screen 2 & Screen 4 picker: Gigs (gigs JOIN venues + gig_bands)
app.get('/api/gigs', async (req: Request, res: Response) => {
  try {
    const pool = getDbPool();
    const tabParam = typeof req.query.tab === 'string' ? req.query.tab : 'upcoming';
    const searchRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const todayKst = getTodayKst();

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (tabParam === 'festival') {
      conditions.push('g.gig_type = ?');
      params.push('페스티벌');
    } else if (tabParam === 'past') {
      conditions.push('g.gig_date < ?');
      params.push(todayKst);
    } else {
      conditions.push('g.gig_date >= ?');
      params.push(todayKst);
    }

    if (searchRaw.length > 0) {
      const escaped = searchRaw.slice(0, 80).replace(/[%_\\]/g, '\\$&');
      const likePattern = `%${escaped}%`;
      conditions.push('(g.gig_title LIKE ? OR v.venue_name LIKE ?)');
      params.push(likePattern, likePattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause =
      tabParam === 'past'
        ? 'ORDER BY g.gig_date DESC, g.gig_id DESC'
        : 'ORDER BY g.gig_date ASC, g.gig_id ASC';

    const sql = `
      SELECT
        g.gig_id,
        g.kopis_id,
        g.venue_id,
        v.venue_name,
        g.gig_title,
        g.gig_type,
        g.gig_date,
        g.end_date,
        g.poster_url
      FROM gigs g
      JOIN venues v ON g.venue_id = v.venue_id
      ${whereClause}
      ${orderClause}
      LIMIT 150
    `;

    const [gigRows] = await pool.execute<RowDataPacket[]>(sql, params);

    const gigIds = gigRows
      .map((row) => Number(row.gig_id))
      .filter((id) => Number.isInteger(id) && id > 0);

    const bandsByGig = new Map<number, string[]>();
    if (gigIds.length > 0) {
      const placeholders = gigIds.map(() => '?').join(', ');
      const [bandRows] = await pool.execute<RowDataPacket[]>(
        `
        SELECT gb.gig_id, b.band_name
        FROM gig_bands gb
        JOIN bands b ON gb.band_id = b.band_id
        WHERE gb.gig_id IN (${placeholders})
        ORDER BY gb.play_order ASC, b.band_name ASC
        `,
        gigIds
      );

      for (const row of bandRows) {
        const gid = Number(row.gig_id);
        const list = bandsByGig.get(gid) ?? [];
        if (typeof row.band_name === 'string') {
          list.push(row.band_name);
        }
        bandsByGig.set(gid, list);
      }
    }

    const gigs = gigRows.map((row) => ({
      ...row,
      bands: bandsByGig.get(Number(row.gig_id)) ?? [],
    }));

    return res.json({
      gigs,
      todayKst,
    });
  } catch (err) {
    return handleDbError(res, err, '공연 목록을 불러오지 못했어요.');
  }
});

// Users list (no login, member switcher)
app.get('/api/users', async (_req: Request, res: Response) => {
  try {
    const pool = getDbPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT user_id, nickname FROM users ORDER BY user_id ASC'
    );
    return res.json({ users: rows });
  } catch (err) {
    return handleDbError(res, err, '회원 목록을 불러오지 못했어요.');
  }
});

// Screen 3: Top 15 venues from v_venue_visits for selected member
app.get('/api/venues', async (req: Request, res: Response) => {
  try {
    const pool = getDbPool();
    const nicknameParam = typeof req.query.nickname === 'string' ? req.query.nickname.trim() : '';

    let targetNickname = nicknameParam;
    if (!targetNickname) {
      const [userRows] = await pool.execute<RowDataPacket[]>(
        'SELECT nickname FROM users ORDER BY user_id ASC LIMIT 1'
      );
      targetNickname = userRows[0]?.nickname ? String(userRows[0].nickname) : '';
    }

    if (!targetNickname) {
      return res.json({ nickname: '', venues: [] });
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT 회원, 공연장, 공연수, 간_횟수
      FROM v_venue_visits
      WHERE 회원 = ?
      ORDER BY 공연수 DESC, 간_횟수 DESC, 공연장 ASC
      LIMIT 15
      `,
      [targetNickname]
    );

    return res.json({
      nickname: targetNickname,
      venues: rows,
    });
  } catch (err) {
    return handleDbError(res, err, '공연장 목록을 불러오지 못했어요.');
  }
});

// Screen 4: My attendance log (v_my_log + attendance_id lookup + v_follow_upcoming)
app.get('/api/my-log', async (req: Request, res: Response) => {
  try {
    const pool = getDbPool();
    const userIdParam = parsePositiveInt(req.query.userId);

    let userRow: RowDataPacket | undefined;
    if (userIdParam) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT user_id, nickname FROM users WHERE user_id = ? LIMIT 1',
        [userIdParam]
      );
      userRow = rows[0];
    } else {
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT user_id, nickname FROM users ORDER BY user_id ASC LIMIT 1'
      );
      userRow = rows[0];
    }

    if (!userRow) {
      return res.status(404).json({ error: '회원을 찾지 못했어요.' });
    }

    const userId = Number(userRow.user_id);
    const nickname = String(userRow.nickname);

    const [myLogRows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT 회원, 날짜, 공연, 공연장, 메모
      FROM v_my_log
      WHERE 회원 = ?
      ORDER BY 날짜 DESC
      `,
      [nickname]
    );

    const [attendanceRows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT
        a.attendance_id,
        a.gig_id,
        a.memo,
        a.created_at,
        g.gig_title,
        g.gig_date,
        v.venue_name
      FROM attendances a
      JOIN gigs g ON a.gig_id = g.gig_id
      JOIN venues v ON g.venue_id = v.venue_id
      WHERE a.user_id = ?
      ORDER BY g.gig_date DESC, a.created_at DESC
      `,
      [userId]
    );

    const [followUpcomingRows] = await pool.execute<RowDataPacket[]>(
      `
      SELECT 회원, 날짜, 밴드, 공연, 공연장
      FROM v_follow_upcoming
      WHERE 회원 = ?
      ORDER BY 날짜 ASC
      `,
      [nickname]
    );

    // Match each v_my_log entry with its exact attendance_id for DELETE
    const usedIds = new Set<number>();
    const logs = myLogRows.map((log) => {
      const logDate = String(log.날짜 ?? '').slice(0, 10);
      const logTitle = String(log.공연 ?? '');
      const logVenue = String(log.공연장 ?? '');
      const logMemo = log.메모 == null ? '' : String(log.메모);

      const match =
        attendanceRows.find((att) => {
          const aid = Number(att.attendance_id);
          if (usedIds.has(aid)) return false;
          const attDate = String(att.gig_date ?? '').slice(0, 10);
          const attMemo = att.memo == null ? '' : String(att.memo);
          return (
            attDate === logDate &&
            String(att.gig_title ?? '') === logTitle &&
            String(att.venue_name ?? '') === logVenue &&
            attMemo === logMemo
          );
        }) ??
        attendanceRows.find((att) => {
          const aid = Number(att.attendance_id);
          if (usedIds.has(aid)) return false;
          const attDate = String(att.gig_date ?? '').slice(0, 10);
          return (
            attDate === logDate &&
            String(att.gig_title ?? '') === logTitle &&
            String(att.venue_name ?? '') === logVenue
          );
        });

      const attendanceId = match ? Number(match.attendance_id) : null;
      const gigId = match ? Number(match.gig_id) : null;
      if (attendanceId) {
        usedIds.add(attendanceId);
      }

      return {
        attendance_id: attendanceId,
        gig_id: gigId,
        회원: nickname,
        날짜: log.날짜,
        공연: log.공연,
        공연장: log.공연장,
        메모: log.메모 ?? '',
      };
    });

    const attendedGigIds = attendanceRows
      .map((row) => Number(row.gig_id))
      .filter((id) => Number.isInteger(id) && id > 0);

    return res.json({
      user: { user_id: userId, nickname },
      totalCount: logs.length,
      logs,
      followUpcoming: followUpcomingRows,
      attendedGigIds,
      todayKst: getTodayKst(),
    });
  } catch (err) {
    return handleDbError(res, err, '직관 기록을 불러오지 못했어요.');
  }
});

// Insert attendance record (only allowed write #1)
app.post('/api/attendances', async (req: Request, res: Response) => {
  try {
    const userId = parsePositiveInt(req.body?.userId);
    const gigId = parsePositiveInt(req.body?.gigId);
    const memoRaw = typeof req.body?.memo === 'string' ? req.body.memo.trim() : '';

    if (!userId || !gigId) {
      return res.status(400).json({ error: '회원과 공연을 올바르게 선택해 주세요.' });
    }

    if (memoRaw.length > 200) {
      return res.status(400).json({ error: '한 줄 메모는 200자 이내로 작성해 주세요.' });
    }

    const pool = getDbPool();
    const todayKst = getTodayKst();

    const [userRows] = await pool.execute<RowDataPacket[]>(
      'SELECT user_id FROM users WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: '선택한 회원을 찾을 수 없어요.' });
    }

    const [gigRows] = await pool.execute<RowDataPacket[]>(
      'SELECT gig_id, gig_date FROM gigs WHERE gig_id = ? LIMIT 1',
      [gigId]
    );
    if (gigRows.length === 0) {
      return res.status(404).json({ error: '선택한 공연을 찾을 수 없어요.' });
    }

    const gigDate = String(gigRows[0].gig_date ?? '').slice(0, 10);
    if (gigDate >= todayKst) {
      return res.status(400).json({ error: '이미 지난 공연만 직관 기록으로 남길 수 있어요.' });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO attendances (user_id, gig_id, memo) VALUES (?, ?, ?)',
      [userId, gigId, memoRaw]
    );

    return res.status(201).json({
      ok: true,
      attendanceId: result.insertId,
    });
  } catch (err) {
    const errorObj = err as { errno?: number; code?: string };
    if (errorObj?.errno === 1062 || errorObj?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: '이미 기록한 공연이에요' });
    }
    return handleDbError(res, err, '직관 기록을 저장하지 못했어요.');
  }
});

// Delete attendance record (only allowed write #2)
app.delete('/api/attendances/:attendanceId', async (req: Request, res: Response) => {
  try {
    const attendanceId = parsePositiveInt(req.params.attendanceId);
    const userId = parsePositiveInt(req.query.userId ?? req.body?.userId);

    if (!attendanceId || !userId) {
      return res.status(400).json({ error: '삭제할 기록 정보가 올바르지 않아요.' });
    }

    const pool = getDbPool();
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM attendances WHERE attendance_id = ? AND user_id = ?',
      [attendanceId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '이미 삭제되었거나 권한이 없는 기록이에요.' });
    }

    return res.json({ ok: true });
  } catch (err) {
    return handleDbError(res, err, '직관 기록을 삭제하지 못했어요.');
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SoundLog server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
