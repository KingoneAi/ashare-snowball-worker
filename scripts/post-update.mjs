#!/usr/bin/env node

/**
 * ashare-snowball: scheduled fetch + post
 *
 * Intended behavior:
 * - Query Xueqiu MCP for:
 *   1) Top 10 stocks by turnover (成交额)
 *   2) Top 10 sectors/boards by % change (涨幅)
 * - Post summary to X/Twitter.
 *
 * Current state:
 * - Xueqiu MCP integration is a stub until we know the MCP invocation details.
 * - Twitter posting attempts to use `bird tweet`. If bird isn't authenticated,
 *   we save the composed tweet to a local log file for manual posting.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const now = new Date();
const ts = now.toISOString().replace('T', ' ').slice(0, 16);

function readEnv(name, fallback = '') {
  return process.env[name] || fallback;
}

// TODO: replace with real Xueqiu MCP call. We need:
// - how to call the MCP (CLI? HTTP endpoint?)
// - query names/params
async function fetchFromXueqiuMcp() {
  const note = readEnv('XUEQIU_MCP_NOTE', 'Xueqiu MCP not configured');
  return {
    turnoverTop10: Array.from({ length: 10 }, (_, i) => ({
      symbol: `STUB${i + 1}`,
      name: `StubStock${i + 1}`,
      turnover: '-'
    })),
    sectorTop10: Array.from({ length: 10 }, (_, i) => ({
      name: `StubSector${i + 1}`,
      pct: '-'
    })),
    note,
  };
}

function buildTweet({ turnoverTop10, sectorTop10 }) {
  // Keep it short-ish for X.
  const lines = [];
  lines.push(`A股 盘中速览 (${ts})`);
  lines.push('');
  // X 对中文等字符有“加权长度”限制；为避免超长，这里只发 Top5。
  lines.push('成交额Top5:');
  turnoverTop10.slice(0, 5).forEach((s, idx) => {
    lines.push(`${idx + 1}. ${s.name}${s.symbol ? `(${s.symbol})` : ''} ${s.turnover}`.trim());
  });
  lines.push('');
  lines.push('涨幅Top5板块:');
  sectorTop10.slice(0, 5).forEach((b, idx) => {
    lines.push(`${idx + 1}. ${b.name} ${b.pct}`.trim());
  });
  return lines.join('\n');
}

function appendLocalLog(text) {
  const logDir = path.resolve(process.cwd(), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const file = path.join(logDir, `tweet-${now.toISOString().slice(0, 10)}.log`);
  fs.appendFileSync(file, `\n---\n${text}\n`, 'utf8');
  return file;
}

function shouldRunNowAsiaShanghai(d = new Date()) {
  // Cron runs every 5 minutes from 09:00-15:55 (workdays). We must skip:
  // - before 09:15
  // - lunch break 11:30-13:00
  // - after 15:00
  // Assumption: host timezone is Asia/Shanghai.
  const h = d.getHours();
  const m = d.getMinutes();
  const mins = h * 60 + m;
  const openStart = 9 * 60 + 15;
  const lunchStart = 11 * 60 + 30;
  const lunchEnd = 13 * 60 + 0;
  const closeEnd = 15 * 60 + 0;

  const inMorning = mins >= openStart && mins <= lunchStart;
  const inAfternoon = mins >= lunchEnd && mins <= closeEnd;
  return inMorning || inAfternoon;
}

async function main() {
  if (!shouldRunNowAsiaShanghai(now)) {
    // Quiet exit; cron will call again later.
    return;
  }

  const data = await fetchFromXueqiuMcp();
  const tweet = buildTweet(data);

  try {
    execFileSync('bird', ['tweet', tweet], { stdio: 'inherit' });
  } catch (e) {
    const file = appendLocalLog(tweet);
    console.error(`\n[ashare-snowball] bird tweet failed; saved tweet to: ${file}`);
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
