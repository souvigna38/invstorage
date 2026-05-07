"""
InvStorage — Central Data Lake Ingestion API + Live Dashboard
=============================================================
Accepts arbitrary JSON data via POST and uses dlt (Data Load Tool) to load it
into a Postgres "DataLake" database with automatic schema evolution.

Dashboard served at GET /dashboard — monitors all ingestion activity.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Any

import dlt
import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
POSTGRES_DSN = os.environ.get(
    "DESTINATION__POSTGRES__CREDENTIALS",
    "postgresql://datalake:datalake_secret@datalake-db:5432/central_lake",
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ingestion_api")

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="InvStorage Data Lake — Ingestion API",
    description="POST JSON data and dlt handles schema evolution automatically.",
    version="1.0.0",
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class IngestRequest(BaseModel):
    schema_name: str = Field(..., examples=["scrapers"])
    table_name: str = Field(..., examples=["products"])
    data: list[dict[str, Any]] = Field(..., min_length=1)


class IngestResponse(BaseModel):
    success: bool
    schema_name: str
    table_name: str
    rows_loaded: int
    message: str


# ---------------------------------------------------------------------------
# DB helper
# ---------------------------------------------------------------------------
def _get_conn():
    return psycopg2.connect(POSTGRES_DSN)


def _query(sql: str, params=None) -> list[dict]:
    with _get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# Ingestion endpoint (unchanged)
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ingest", response_model=IngestResponse)
def ingest(payload: IngestRequest):
    logger.info("Ingesting %d row(s) → %s.%s", len(payload.data), payload.schema_name, payload.table_name)
    try:
        pipeline = dlt.pipeline(
            pipeline_name="datalake_loader",
            destination=dlt.destinations.postgres(credentials=POSTGRES_DSN),
            dataset_name=payload.schema_name,
        )
        load_info = pipeline.run(payload.data, table_name=payload.table_name, write_disposition="append")

        if load_info.has_failed_jobs:
            failed = load_info.load_packages[0].jobs.get("failed_jobs", [])
            error_msgs = [j.failed_message for j in failed if j.failed_message]
            raise HTTPException(status_code=500, detail=f"dlt load failed: {'; '.join(error_msgs) or 'unknown error'}")

        logger.info("Load complete: %s", load_info)
        return IngestResponse(
            success=True,
            schema_name=payload.schema_name,
            table_name=payload.table_name,
            rows_loaded=len(payload.data),
            message=str(load_info),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Ingestion failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Dashboard API endpoints
# ---------------------------------------------------------------------------
@app.get("/api/stats")
def api_stats():
    """Return schema/table/row overview for the dashboard."""
    tables = _query("""
        SELECT
            t.table_schema  AS schema_name,
            t.table_name    AS table_name,
            (SELECT count(*) FROM information_schema.columns c
             WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name
            ) AS column_count
        FROM information_schema.tables t
        WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'public')
          AND t.table_name NOT LIKE '\\_dlt\\_%'
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_schema, t.table_name
    """)

    # Get row counts (fast estimate from pg_stat)
    for tbl in tables:
        try:
            rows = _query(
                "SELECT count(*) AS cnt FROM {}.{}".format(
                    psycopg2.extensions.quote_ident(tbl["schema_name"], _get_conn()),
                    psycopg2.extensions.quote_ident(tbl["table_name"], _get_conn()),
                )
            )
            tbl["row_count"] = rows[0]["cnt"] if rows else 0
        except Exception:
            tbl["row_count"] = -1

    schemas = sorted(set(t["schema_name"] for t in tables))
    total_rows = sum(t["row_count"] for t in tables if t["row_count"] >= 0)

    return {
        "schemas": schemas,
        "tables": tables,
        "total_schemas": len(schemas),
        "total_tables": len(tables),
        "total_rows": total_rows,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/recent")
def api_recent():
    """Return recent dlt load events across all schemas."""
    # Find all _dlt_loads tables
    load_tables = _query("""
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_name = '_dlt_loads'
          AND table_schema NOT IN ('pg_catalog', 'information_schema', 'public')
    """)

    events = []
    for lt in load_tables:
        try:
            rows = _query("""
                SELECT
                    %s AS schema_name,
                    load_id,
                    schema_name AS dlt_schema,
                    status,
                    inserted_at,
                    schema_version_hash
                FROM {}.{}
                ORDER BY inserted_at DESC
                LIMIT 20
            """.format(
                psycopg2.extensions.quote_ident(lt["table_schema"], _get_conn()),
                psycopg2.extensions.quote_ident(lt["table_name"], _get_conn()),
            ), (lt["table_schema"],))
            for r in rows:
                if r.get("inserted_at"):
                    r["inserted_at"] = r["inserted_at"].isoformat() if hasattr(r["inserted_at"], "isoformat") else str(r["inserted_at"])
                events.append(r)
        except Exception:
            pass

    events.sort(key=lambda e: e.get("inserted_at", ""), reverse=True)
    return {"events": events[:50]}


@app.get("/api/preview/{schema_name}/{table_name}")
def api_preview(schema_name: str, table_name: str, limit: int = 20):
    """Return the latest rows from a specific table."""
    try:
        conn = _get_conn()
        safe_schema = psycopg2.extensions.quote_ident(schema_name, conn)
        safe_table = psycopg2.extensions.quote_ident(table_name, conn)
        conn.close()

        # Get columns
        cols = _query("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (schema_name, table_name))

        # Get latest rows (by _dlt_load_id desc if exists, else just limit)
        has_dlt = any(c["column_name"] == "_dlt_load_id" for c in cols)
        order = "ORDER BY _dlt_load_id DESC" if has_dlt else ""
        rows = _query(f"SELECT * FROM {safe_schema}.{safe_table} {order} LIMIT %s", (limit,))

        # Serialize datetimes
        for row in rows:
            for k, v in row.items():
                if hasattr(v, "isoformat"):
                    row[k] = v.isoformat()

        return {
            "schema_name": schema_name,
            "table_name": table_name,
            "columns": cols,
            "rows": rows,
            "total": len(rows),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Dashboard HTML
# ---------------------------------------------------------------------------
DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Data Lake Monitor</title>
<style>
  :root {
    --bg: #0f172a; --surface: #1e293b; --surface2: #334155;
    --border: #475569; --text: #e2e8f0; --muted: #94a3b8;
    --accent: #38bdf8; --green: #4ade80; --amber: #fbbf24;
    --red: #f87171; --purple: #c084fc;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg); color: var(--text); font-family: 'Inter', -apple-system, system-ui, sans-serif; }

  /* ── Top bar ── */
  .topbar {
    background: var(--surface); border-bottom: 1px solid var(--border);
    padding: 16px 24px; display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 50;
  }
  .topbar h1 { font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
  .topbar h1 span.icon { font-size: 24px; }
  .topbar .status { display: flex; align-items: center; gap: 16px; font-size: 13px; color: var(--muted); }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .dot.green { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .dot.red { background: var(--red); box-shadow: 0 0 6px var(--red); }
  .auto-badge {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 6px;
    padding: 4px 10px; font-size: 12px; cursor: pointer; color: var(--muted);
    transition: all 0.2s;
  }
  .auto-badge.active { border-color: var(--accent); color: var(--accent); }

  .container { max-width: 1280px; margin: 0 auto; padding: 24px; }

  /* ── Stat cards ── */
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 20px; transition: border-color 0.2s;
  }
  .card:hover { border-color: var(--accent); }
  .card .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 6px; }
  .card .value { font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .card .sub { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .val-accent { color: var(--accent); }
  .val-green { color: var(--green); }
  .val-amber { color: var(--amber); }
  .val-purple { color: var(--purple); }

  /* ── Two-column layout ── */
  .grid2 { display: grid; grid-template-columns: 1fr 380px; gap: 20px; }
  @media (max-width: 960px) { .stats { grid-template-columns: repeat(2, 1fr); } .grid2 { grid-template-columns: 1fr; } }

  /* ── Tables panel ── */
  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .panel-header {
    padding: 16px 20px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .panel-header h2 { font-size: 15px; font-weight: 600; }
  .panel-header .count { background: var(--surface2); padding: 2px 10px; border-radius: 20px; font-size: 12px; color: var(--muted); }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); padding: 10px 16px; border-bottom: 1px solid var(--border); }
  td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid rgba(71,85,105,0.4); vertical-align: top; }
  tr:hover td { background: rgba(56,189,248,0.04); }
  .schema-badge {
    display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px;
    font-weight: 600; font-family: monospace;
  }
  .schema-badge.s0 { background: rgba(56,189,248,0.15); color: var(--accent); }
  .schema-badge.s1 { background: rgba(74,222,128,0.15); color: var(--green); }
  .schema-badge.s2 { background: rgba(192,132,252,0.15); color: var(--purple); }
  .schema-badge.s3 { background: rgba(251,191,36,0.15); color: var(--amber); }
  .schema-badge.s4 { background: rgba(248,113,113,0.15); color: var(--red); }
  .tbl-name { font-family: monospace; font-weight: 500; }
  .num { font-variant-numeric: tabular-nums; text-align: right; }
  .btn {
    background: var(--surface2); border: 1px solid var(--border); border-radius: 6px;
    padding: 4px 10px; font-size: 12px; color: var(--accent); cursor: pointer;
    transition: all 0.15s;
  }
  .btn:hover { background: rgba(56,189,248,0.1); border-color: var(--accent); }

  /* ── Activity feed ── */
  .feed { max-height: 540px; overflow-y: auto; }
  .feed-item {
    padding: 12px 20px; border-bottom: 1px solid rgba(71,85,105,0.3);
    transition: background 0.15s;
  }
  .feed-item:hover { background: rgba(56,189,248,0.04); }
  .feed-item .time { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .feed-item .desc { font-size: 13px; margin-top: 3px; }
  .feed-item .status-ok { color: var(--green); }
  .feed-item .status-fail { color: var(--red); }

  /* ── Preview modal ── */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100;
    display: none; align-items: center; justify-content: center; padding: 24px;
  }
  .modal-overlay.open { display: flex; }
  .modal {
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    width: 100%; max-width: 1000px; max-height: 80vh; display: flex; flex-direction: column;
  }
  .modal-header {
    padding: 16px 20px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .modal-header h3 { font-size: 16px; font-weight: 600; font-family: monospace; }
  .modal-close { background: none; border: none; color: var(--muted); font-size: 22px; cursor: pointer; }
  .modal-close:hover { color: var(--text); }
  .modal-body { overflow: auto; flex: 1; }
  .modal-body table th { position: sticky; top: 0; background: var(--surface); }
  .modal-body td { font-family: monospace; font-size: 12px; white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis; }

  /* ── Pulse animation ── */
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  .loading { animation: pulse 1.5s ease-in-out infinite; }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 3px; }
</style>
</head>
<body>

<div class="topbar">
  <h1><span class="icon">&#x1f4ca;</span> Data Lake Monitor</h1>
  <div class="status">
    <span id="conn-status"><span class="dot green"></span> Connected</span>
    <span id="last-refresh">—</span>
    <span class="auto-badge active" id="auto-toggle" onclick="toggleAuto()">Auto-refresh: 10s</span>
  </div>
</div>

<div class="container">
  <!-- Stat cards -->
  <div class="stats">
    <div class="card"><div class="label">Schemas</div><div class="value val-accent" id="stat-schemas">—</div><div class="sub">Postgres schemas</div></div>
    <div class="card"><div class="label">Tables</div><div class="value val-green" id="stat-tables">—</div><div class="sub">Across all schemas</div></div>
    <div class="card"><div class="label">Total Rows</div><div class="value val-purple" id="stat-rows">—</div><div class="sub">All data combined</div></div>
    <div class="card"><div class="label">Last Ingestion</div><div class="value val-amber" id="stat-last" style="font-size:18px;">—</div><div class="sub" id="stat-last-sub">Waiting for data</div></div>
  </div>

  <!-- Main grid -->
  <div class="grid2">
    <!-- Tables -->
    <div class="panel">
      <div class="panel-header">
        <h2>Schemas &amp; Tables</h2>
        <span class="count" id="table-count">0 tables</span>
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead><tr><th>Schema</th><th>Table</th><th class="num">Rows</th><th class="num">Cols</th><th></th></tr></thead>
          <tbody id="table-body"><tr><td colspan="5" style="text-align:center;color:var(--muted);padding:32px;">Loading...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Activity feed -->
    <div class="panel">
      <div class="panel-header">
        <h2>Recent Activity</h2>
        <span class="count" id="event-count">0 events</span>
      </div>
      <div class="feed" id="feed"><div style="padding:32px;text-align:center;color:var(--muted);">Loading...</div></div>
    </div>
  </div>
</div>

<!-- Preview modal -->
<div class="modal-overlay" id="modal" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <div class="modal-header">
      <h3 id="modal-title">—</h3>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body" id="modal-body"></div>
  </div>
</div>

<script>
const SCHEMA_COLORS = ['s0','s1','s2','s3','s4'];
let autoInterval = null;
let autoEnabled = true;
let schemaColorMap = {};

function fmt(n) { return n >= 1000 ? n.toLocaleString() : String(n); }
function timeAgo(iso) {
  if (!iso) return '—';
  const d = new Date(iso), now = new Date(), s = Math.floor((now - d) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}
function schemaColor(name) {
  if (!schemaColorMap[name]) {
    const idx = Object.keys(schemaColorMap).length % SCHEMA_COLORS.length;
    schemaColorMap[name] = SCHEMA_COLORS[idx];
  }
  return schemaColorMap[name];
}

async function refresh() {
  try {
    const [statsRes, recentRes] = await Promise.all([
      fetch('/api/stats'), fetch('/api/recent')
    ]);
    const stats = await statsRes.json();
    const recent = await recentRes.json();

    // Stat cards
    document.getElementById('stat-schemas').textContent = fmt(stats.total_schemas);
    document.getElementById('stat-tables').textContent = fmt(stats.total_tables);
    document.getElementById('stat-rows').textContent = fmt(stats.total_rows);

    const lastEvent = recent.events[0];
    if (lastEvent) {
      document.getElementById('stat-last').textContent = timeAgo(lastEvent.inserted_at);
      document.getElementById('stat-last-sub').textContent = lastEvent.schema_name + ' • ' + (lastEvent.status || 'loaded');
    }

    // Table list
    const tbody = document.getElementById('table-body');
    if (stats.tables.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:32px;">No data yet. POST to /ingest to begin.</td></tr>';
    } else {
      tbody.innerHTML = stats.tables.map(t => `
        <tr>
          <td><span class="schema-badge ${schemaColor(t.schema_name)}">${t.schema_name}</span></td>
          <td class="tbl-name">${t.table_name}</td>
          <td class="num">${fmt(t.row_count)}</td>
          <td class="num">${t.column_count}</td>
          <td><button class="btn" onclick="preview('${t.schema_name}','${t.table_name}')">Preview</button></td>
        </tr>
      `).join('');
    }
    document.getElementById('table-count').textContent = stats.total_tables + ' tables';

    // Activity feed
    const feed = document.getElementById('feed');
    if (recent.events.length === 0) {
      feed.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);">No ingestion events yet.</div>';
    } else {
      feed.innerHTML = recent.events.map(e => `
        <div class="feed-item">
          <div class="time">${e.inserted_at ? new Date(e.inserted_at).toLocaleString() : '—'}</div>
          <div class="desc">
            <span class="${e.status === 'loaded' || e.status === 'completed' ? 'status-ok' : 'status-fail'}">${e.status || '?'}</span>
            &nbsp;→&nbsp; <span class="schema-badge ${schemaColor(e.schema_name)}">${e.schema_name}</span>
            <span style="color:var(--muted);margin:0 4px;">load</span>
            <code style="font-size:11px;color:var(--muted);">${(e.load_id || '').substring(0, 16)}</code>
          </div>
        </div>
      `).join('');
    }
    document.getElementById('event-count').textContent = recent.events.length + ' events';

    // Status
    document.getElementById('conn-status').innerHTML = '<span class="dot green"></span> Connected';
    document.getElementById('last-refresh').textContent = 'Updated ' + new Date().toLocaleTimeString();
  } catch (err) {
    document.getElementById('conn-status').innerHTML = '<span class="dot red"></span> Error';
    console.error(err);
  }
}

async function preview(schema, table) {
  document.getElementById('modal-title').textContent = schema + '.' + table;
  document.getElementById('modal-body').innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);" class="loading">Loading preview...</div>';
  document.getElementById('modal').classList.add('open');

  try {
    const res = await fetch(`/api/preview/${encodeURIComponent(schema)}/${encodeURIComponent(table)}?limit=25`);
    const data = await res.json();

    if (data.rows.length === 0) {
      document.getElementById('modal-body').innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);">Table is empty.</div>';
      return;
    }

    // Filter out dlt internal columns for cleaner view
    const userCols = data.columns.filter(c => !c.column_name.startsWith('_dlt_'));
    const dltCols = data.columns.filter(c => c.column_name.startsWith('_dlt_'));
    const allCols = [...userCols, ...dltCols];

    let html = '<table><thead><tr>';
    allCols.forEach(c => {
      const style = c.column_name.startsWith('_dlt_') ? 'color:var(--muted);font-style:italic;' : '';
      html += `<th style="${style}">${c.column_name}<br><span style="font-weight:400;font-size:10px;text-transform:none;">${c.data_type}</span></th>`;
    });
    html += '</tr></thead><tbody>';

    data.rows.forEach(row => {
      html += '<tr>';
      allCols.forEach(c => {
        let val = row[c.column_name];
        if (val === null || val === undefined) val = '<span style="color:var(--surface2);">null</span>';
        else if (typeof val === 'object') val = JSON.stringify(val);
        else val = String(val);
        if (val.length > 80) val = val.substring(0, 77) + '...';
        html += `<td title="${String(row[c.column_name] ?? '').replace(/"/g, '&quot;')}">${val}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('modal-body').innerHTML = html;
  } catch (err) {
    document.getElementById('modal-body').innerHTML = `<div style="padding:40px;text-align:center;color:var(--red);">Error: ${err.message}</div>`;
  }
}

function closeModal() { document.getElementById('modal').classList.remove('open'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function toggleAuto() {
  autoEnabled = !autoEnabled;
  const el = document.getElementById('auto-toggle');
  if (autoEnabled) {
    el.classList.add('active');
    el.textContent = 'Auto-refresh: 10s';
    startAuto();
  } else {
    el.classList.remove('active');
    el.textContent = 'Auto-refresh: off';
    if (autoInterval) { clearInterval(autoInterval); autoInterval = null; }
  }
}

function startAuto() {
  if (autoInterval) clearInterval(autoInterval);
  autoInterval = setInterval(refresh, 10000);
}

// Boot
refresh();
startAuto();
</script>
</body>
</html>"""


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    """Serve the live monitoring dashboard."""
    return DASHBOARD_HTML
