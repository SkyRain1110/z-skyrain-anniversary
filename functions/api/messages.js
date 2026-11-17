/**
 * Cloudflare Pages Function —— 共享留言板
 * 路由：/api/messages
 *
 * 需要在 Pages 项目里绑定一个 D1 数据库，变量名必须是 DB。
 * 建表语句见仓库根目录的 schema.sql。
 */

const MAX_NAME = 12;
const MAX_CONTENT = 120;
const MAX_ROWS = 200;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function clean(value) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
}

function charLength(value) {
  return Array.from(value).length;
}

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return json({ error: "DB_NOT_CONFIGURED" }, 503);
  }

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, name, content, created_at
         FROM messages
        ORDER BY id DESC
        LIMIT ?`
    )
      .bind(MAX_ROWS)
      .all();

    return json({ messages: results || [] });
  } catch (err) {
    return json({ error: "READ_FAILED" }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return json({ error: "DB_NOT_CONFIGURED" }, 503);
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return json({ error: "BAD_CONTENT_TYPE" }, 415);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ error: "BAD_JSON" }, 400);
  }

  const name = clean(body && body.name).replace(/\s+/g, " ").slice(0, 64);
  const content = clean(body && body.content).slice(0, 512);

  if (!name || !content) {
    return json({ error: "EMPTY_FIELDS" }, 400);
  }
  if (charLength(name) > MAX_NAME) {
    return json({ error: "NAME_TOO_LONG" }, 400);
  }
  if (charLength(content) > MAX_CONTENT) {
    return json({ error: "CONTENT_TOO_LONG" }, 400);
  }

  try {
    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      `INSERT INTO messages (name, content, created_at) VALUES (?, ?, ?)`
    )
      .bind(name, content, now)
      .run();

    const id = result.meta && result.meta.last_row_id;
    return json(
      {
        message: { id, name, content, created_at: now },
      },
      201
    );
  } catch (err) {
    return json({ error: "WRITE_FAILED" }, 500);
  }
}
