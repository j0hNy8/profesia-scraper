#!/usr/bin/env node
/**
 * profesia-scout Step 1: Scraper (v1)
 *
 * Connects to OpenClaw's managed browser via CDP, scrapes all job listings
 * from Profesia.sk with full descriptions. Zero LLM tokens.
 *
 * NEW in v1:
 * - Preflight: if CDP on 127.0.0.1:<port> is not reachable, try to start
 * the OpenClaw-managed browser profile ("openclaw") and wait for CDP.
 *
 * Output: workspace/projects/profesia-scout/YYYY-MM-DD/descriptions.json
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// --- Config ---
const BROWSER_PORT = Number(process.env.OPENCLAW_CDP_PORT || 18800);
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';
const OPENCLAW_BROWSER_PROFILE = process.env.OPENCLAW_BROWSER_PROFILE || 'openclaw';

const BASE_URL = 'https://www.profesia.sk/praca/bratislava/informacne-technologie/?count_days=7&jobtypes[]=1&offer_agent_flags=12484&salary=1600&salary_period=m&skills[]=73__5_';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATE_STR = new Date().toISOString().split('T')[0];

const OUTPUT_DIR = path.join(PROJECT_ROOT, DATE_STR);
const CONFIG_DIR = path.join(PROJECT_ROOT, 'config');

const SEEN_OFFERS_PATH = path.join(CONFIG_DIR, 'seen-offers.json');
const BLACKLIST_PATH = path.join(CONFIG_DIR, 'blacklist.json');
const STATE_PATH = path.join(CONFIG_DIR, 'workflow-state.json');

const EXCLUDE_KEYWORDS = [
  // Frontend / app dev
  'react', 'angular', 'vue', 'svelte', 'next.js', 'nuxt', 'typescript',
  'frontend', 'front-end', 'backend', 'back-end',
  'java', 'c#', '.net', 'php', 'rust', 'c++', 'ruby', 'django', 'fullstack',
  'kotlin', 'swift', 'ios', 'android',

  // AI / advanced data
  'computer vision', 'machine learning', 'data scientist', 'data engineer', 'ml engineer', 'ai engineer',

  // Design / marketing
  'designer', 'ui/ux', 'ux/ui', 'marketing',

  // Seniority / overlevel
  'senior', 'lead', 'principal', 'head', 'manager', 'expert', 'architect',

  // Infra / security / platform
  'devops', 'sre', 'site reliability', 'cloud engineer', 'cloud architect',
  'platform engineer', 'infrastructure engineer', 'network engineer',
  'security engineer', 'security analyst', 'soc',

  // Niche platform / workflow
  'avaloq', 'servicenow', 'salesforce', 'sap abap', 'sap basis',
  'bpmn', 'dmn', 'camunda', 'kogito', 'quarkus', 'workflow engineer', 'process automation engineer',

  // BI-heavy titles
  'power bi', 'tableau', 'qlik',

  // Language blockers
  'nemecký', 'nemecky', 'german',

  // Nitra-specific additions
  'výroby', // manufacturing/production roles
  'zvarovne', // welding shop
  'weld', // welding engineer
  'smt', // SMT electronics manufacturing
  'konštruktér', // mechanical design engineer
  'laserové', // laser cutting tech
  'majster', // shift supervisor / master in metalwork
  'lisov', // press operator
  'chladiare', // refrigeration technician
  'stavby', // construction/building
  'elektro-inštalá', // electrical installation
  'navažovne', // batch/weigh station leader
  'obchodný', // sales/commercial (zástupca, manažér, riaditeľ)
  'field sales', // field sales rep
  'business development',
  'procurement specialist',
  'nákupca', // buyer/procurement
  'špeditér', // freight forwarder
  'doprava', // transport/logistics
  'taxi',
  'stavebný',
  'Obchodník',
  'Rozpočtár',
  'papermachine',
  'facilities',
  'kvality', // quality technician
  'order controller',
  'optometrista',
  'vzdelávanie', // training specialist
  'colného', // customs officer
  'robot framework' // RPA test automation
];

// --- CDP Client ---
let msgId = 0;
let ws;
const pending = new Map();

// --- Helper Functions ---
function loadSeenOffers() {
  try {
    if (fs.existsSync(SEEN_OFFERS_PATH)) {
      const data = fs.readFileSync(SEEN_OFFERS_PATH, 'utf8');
      return new Set(JSON.parse(data));
    }
  } catch (e) {
    console.log(`[profesia-scout] Warning: Could not load seen-offers.json: ${e.message}`);
  }
  return new Set();
}

function saveSeenOffers(seenOffers) {
  try {
    const dir = path.dirname(SEEN_OFFERS_PATH);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SEEN_OFFERS_PATH, JSON.stringify(Array.from(seenOffers), null, 2));
  } catch (e) {
    console.error(`[profesia-scout] Error saving seen-offers.json: ${e.message}`);
  }
}

function loadBlacklist() {
  try {
    if (fs.existsSync(BLACKLIST_PATH)) {
      const data = fs.readFileSync(BLACKLIST_PATH, 'utf8');
      const config = JSON.parse(data);
      return (config.companies || []).map(c => c.toLowerCase());
    }
  } catch (e) {
    console.log(`[profesia-scout] Warning: Could not load blacklist.json: ${e.message}`);
  }
  return [];
}

function cdpSend(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function onMessage(data) {
  const msg = JSON.parse(data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result || {});
  }
}

function sleep(minMs, maxMs) {
  const ms = maxMs ? Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs : minMs;
  return new Promise(r => setTimeout(r, ms));
}

async function navigate(url, minWaitMs = 2500, maxWaitMs = 4000) {
  await cdpSend('Page.navigate', { url });
  await sleep(minWaitMs, maxWaitMs);
}

async function evaluate(expression) {
  const result = await cdpSend('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: false,
  });
  return result?.result?.value;
}

function httpGetJson(url, timeoutMs = 800) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout after ${timeoutMs}ms`));
    });
  });
}

async function isCdpUp() {
  try {
    await httpGetJson(`http://127.0.0.1:${BROWSER_PORT}/json/version`, 800);
    return true;
  } catch {
    return false;
  }
}

function openclawBrowserStart() {
  return new Promise((resolve, reject) => {
    const args = ['browser', '--browser-profile', OPENCLAW_BROWSER_PROFILE, 'start'];
    execFile(OPENCLAW_BIN, args, { timeout: 45_000 }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr || stdout || err.message || '').trim();
        reject(new Error(`Failed to start browser via "${OPENCLAW_BIN} ${args.join(' ')}": ${msg}`));
        return;
      }
      resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

async function ensureBrowserCdpReady() {
  if (await isCdpUp()) return;

  console.log(`[profesia-scout] Browser CDP not reachable on 127.0.0.1:${BROWSER_PORT}. Starting OpenClaw browser profile "${OPENCLAW_BROWSER_PROFILE}"...`);
  await openclawBrowserStart();

  const start = Date.now();
  const timeoutMs = Number(process.env.OPENCLAW_CDP_START_TIMEOUT_MS || 20_000);
  while (Date.now() - start < timeoutMs) {
    if (await isCdpUp()) {
      console.log('[profesia-scout] Browser CDP is up.');
      return;
    }
    await sleep(250);
  }
  throw new Error(`Browser CDP still not reachable on 127.0.0.1:${BROWSER_PORT} after ${timeoutMs}ms. Try: openclaw browser --browser-profile ${OPENCLAW_BROWSER_PROFILE} status`);
}

// --- Extraction JS ---
const EXTRACT_LISTINGS_JS = `
(() => {
  const items = document.querySelectorAll('main ul > li');
  const jobs = [];
  for (const li of items) {
    const h2 = li.querySelector('h2');
    if (!h2) continue;
    const link = h2.querySelector('a');
    if (!link) continue;
    const title = link.textContent.trim();
    const rawUrl = link.getAttribute('href');

    let company = '', location = '', salary = '', posted = '';
    const siblings = Array.from(h2.parentElement.children);

    for (const el of siblings) {
      if (el.tagName === 'H2') continue;
      const txt = el.textContent.trim();

      // Salary
      if (txt.includes('EUR/') || txt.includes('€')) {
        salary = txt.split('\\n')[0].trim();
        if (salary.includes('Uložiť')) salary = salary.split('Uložiť')[0].trim();
        continue;
      }

      // Posted time
      const strong = el.querySelector('strong');
      if (strong && (strong.textContent.includes('Pred ') || strong.textContent.includes('pred '))) {
        posted = strong.textContent.trim();
        continue;
      }

      // Company
      if (!company && txt.length > 0 && txt.length < 120 &&
          !txt.includes('Uložiť') && !txt.includes('Pred ') && !el.querySelector('h2')) {
        company = txt;
        continue;
      }
    }

    // Location from title attribute
    for (const el of siblings) {
      const titleAttr = el.getAttribute && el.getAttribute('title');
      if (titleAttr) { location = titleAttr; break; }
      if (!location) {
        const t = el.textContent.trim();
        if ((t.includes('Bratislava') || t.includes('Remote') || t.includes('Práca z domu') ||
             t.includes('Slovakia') || t.includes('Slovensko')) &&
            !t.includes('EUR') && !t.includes('Pred ') && !t.includes('Uložiť') && t !== company) {
          location = t;
        }
      }
    }

    const offerId = rawUrl ? rawUrl.match(/O(\\d+)/)?.[1] : null;
    const cleanUrl = rawUrl ? 'https://www.profesia.sk' + rawUrl.split('?')[0] : '';
    jobs.push({title, url: cleanUrl, company, location, salary, posted, offerId});
  }

  // Pagination
  const pagLinks = document.querySelectorAll('nav ul li a');
  let maxPage = 1;
  for (const a of pagLinks) {
    const m = a.getAttribute('href')?.match(/page_num=(\\d+)/);
    if (m) maxPage = Math.max(maxPage, parseInt(m[1]));
  }
  return JSON.stringify({jobs, maxPage, count: jobs.length});
})()
`;

const EXTRACT_DESCRIPTION_JS = `
(() => {
  const main = document.querySelector('main');
  if (!main) return JSON.stringify({error: 'no main element'});

  const h1 = main.querySelector('h1');
  const title = h1 ? h1.textContent.trim() : '';

  // Use innerText on a cleaned clone — captures text in bare divs (e.g. Swiss Re, Accenture)
  // which the old p/li/h2/h3 selector missed entirely.
  const clone = main.cloneNode(true);
  for (const el of clone.querySelectorAll('nav, footer, script, style, iframe')) el.remove();
  const rawLines = (clone.innerText || clone.textContent || '').split('\\n');
  const dedupLines = [];
  for (const raw of rawLines) {
    const t = raw.trim();
    if (t.length > 1 && dedupLines[dedupLines.length - 1] !== t) dedupLines.push(t);
  }
  const description = dedupLines.join('\\n');

  const allText = main.textContent;
  const salaryMatch = allText.match(/(?:Základná zložka mzdy|Wage|Salary).*?([\\d\\s,]+EUR\\/\\w+)/);
  const salary = salaryMatch ? salaryMatch[1].trim() : '';
  const idMatch = allText.match(/ID:\\s*(\\d+)/);
  const jobId = idMatch ? idMatch[1] : '';
  const dateMatch = allText.match(/Dátum zverejnenia:\\s*([\\d.]+)/);
  const publishDate = dateMatch ? dateMatch[1] : '';

  const benefits = [];
  const bSeen = new Set();
  for (const b of main.querySelectorAll('[class*="benefit"] span, [class*="benefit"] div')) {
    const t = b.textContent.trim();
    if (t && t.length < 100 && !bSeen.has(t)) { bSeen.add(t); benefits.push(t); }
  }

  return JSON.stringify({title, description, salary, jobId, publishDate, benefits});
})()
`;

const DISMISS_COOKIES_JS = `
(() => {
  for (const b of document.querySelectorAll('button')) {
    if (b.textContent.includes('Prijať nevyhnutné') || b.textContent.includes('Accept necessary')) {
      b.click();
      return 'dismissed';
    }
  }
  return 'no cookie banner';
})()
`;

// --- Main ---
async function getWsUrl() {
  const pages = await httpGetJson(`http://127.0.0.1:${BROWSER_PORT}/json`, 2_500);
  const page = pages.find(p => p.type === 'page');
  if (!page) throw new Error('No pages found');
  return page.webSocketDebuggerUrl;
}

async function main() {
  console.log(`[profesia-scout] Starting scrape for ${DATE_STR}`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // --- NEW: INITIAL LOCK ---
  let initialState = {};
  if (fs.existsSync(STATE_PATH)) {
    try { initialState = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch (e) { }
  }

  // Create the full template so Nova doesn't crash if she reads it mid-scrape
  if (!initialState[DATE_STR]) {
    initialState[DATE_STR] = {
      date: DATE_STR,
      scraper: { status: 'in_progress', jobs_passed_filter: 0 },
      analyzer: { status: '-', strong_matches: 0, potential_matches: 0 },
      researcher: { status: '-', companies_researched: 0 },
      writer: { status: '-', applications_drafted: 0 }
    };
  } else {
    initialState[DATE_STR].scraper.status = 'in_progress';
  }

  fs.writeFileSync(STATE_PATH, JSON.stringify(initialState, null, 2));
  // -------------------------

  // Load seen offers and blacklist
  const seenOffers = loadSeenOffers();
  const blacklist = loadBlacklist();
  console.log(`[profesia-scout] Loaded ${seenOffers.size} seen offers, ${blacklist.length} blacklisted companies`);

  // NEW (v1): ensure CDP is available, otherwise start browser
  await ensureBrowserCdpReady();

  const wsUrl = await getWsUrl();
  console.log(`[profesia-scout] Connecting to browser...`);

  ws = new WebSocket(wsUrl);
  ws.on('message', onMessage);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  await cdpSend('Page.enable');
  await cdpSend('Runtime.enable');

  try {
    // Step 1: Navigate to search results
    console.log('[profesia-scout] Opening search page...');
    await navigate(BASE_URL, 3000, 5000);

    // Dismiss cookies
    const cookieResult = await evaluate(DISMISS_COOKIES_JS);
    console.log(`[profesia-scout] Cookies: ${cookieResult}`);
    await sleep(1000, 2000);

    // Step 2: Extract page 1
    const allJobs = [];
    const p1Str = await evaluate(EXTRACT_LISTINGS_JS);
    const p1 = JSON.parse(p1Str);
    allJobs.push(...p1.jobs);
    let maxPage = p1.maxPage;
    console.log(`[profesia-scout] Page 1: ${p1.count} jobs, initially seeing ${maxPage} pages`);

    // Step 3: Navigate remaining pages
    for (let pageNum = 2; pageNum <= maxPage; pageNum++) {
      const pageUrl = `${BASE_URL}&page_num=${pageNum}`;
      console.log(`[profesia-scout] Loading page ${pageNum}...`);
      await navigate(pageUrl, 2500, 4500);
      const pStr = await evaluate(EXTRACT_LISTINGS_JS);
      const p = JSON.parse(pStr);
      allJobs.push(...p.jobs);

      // Update max limit if new pagination links are revealed
      if (p.maxPage > maxPage) {
        console.log(`[profesia-scout] Revealed more pages: expanding limit to ${p.maxPage}`);
        maxPage = p.maxPage;
      }

      console.log(`[profesia-scout] Page ${pageNum}: ${p.count} jobs`);
    }

    console.log(`[profesia-scout] Total listings: ${allJobs.length}`);

    // Step 4: Filter blacklisted companies
    const beforeBlacklist = allJobs.length;
    const nonBlacklisted = allJobs.filter(job => {
      const companyLower = (job.company || '').toLowerCase();
      return !blacklist.some(bl => companyLower.includes(bl));
    });
    const blacklistedCount = beforeBlacklist - nonBlacklisted.length;
    if (blacklistedCount > 0) {
      console.log(`[profesia-scout] Filtered ${blacklistedCount} blacklisted companies`);
    }

    // Step 5: Mark new vs. seen jobs
    const jobsWithNewFlag = nonBlacklisted.map(job => {
      const isNew = job.offerId ? !seenOffers.has(job.offerId) : true;
      return { ...job, isNew };
    });
    const newJobs = jobsWithNewFlag.filter(j => j.isNew);
    let skippedCount = nonBlacklisted.length - newJobs.length;
    if (skippedCount > 0) {
      console.log(`[profesia-scout] Skipped ${skippedCount} already-seen jobs`);
    }

    // Save listings with ALL jobs (including seen ones) + isNew field
    const listingsPath = path.join(OUTPUT_DIR, 'listings.json');
    fs.writeFileSync(listingsPath, JSON.stringify({
      date: DATE_STR,
      total: allJobs.length,
      afterFilters: nonBlacklisted.length,
      new: newJobs.length,
      blacklisted: blacklistedCount,
      skipped: skippedCount,
      jobs: jobsWithNewFlag
    }, null, 2));
    console.log(`[profesia-scout] Saved listings → ${listingsPath}`);

    // Step 6: Full descriptions (ONLY for new jobs)
    const descriptions = [];
    for (let i = 0; i < newJobs.length; i++) {
      const job = newJobs[i];
      if (!job.url) {
        console.log(`[profesia-scout] [${i + 1}/${newJobs.length}] SKIP (no URL): ${job.title}`);
        skippedCount++;
        continue;
      }

      const shortTitle = job.title.length > 55 ? job.title.substring(0, 55) + '...' : job.title;
      console.log(`[profesia-scout] [${i + 1}/${newJobs.length}] ${shortTitle}`);

      // 1. Title Pre-Filter (Saves page load time)
      const titleLower = job.title.toLowerCase();
      if (EXCLUDE_KEYWORDS.some(kw => titleLower.includes(kw))) {
        console.log(`  -> FILTERED (Title match)`);
        skippedCount++;
        continue;
      }

      try {
        await navigate(job.url, 2000, 5000);
        const descStr = await evaluate(EXTRACT_DESCRIPTION_JS);
        const desc = JSON.parse(descStr);

        descriptions.push({
          ...job,
          fullDescription: desc.description || '',
          detailedSalary: desc.salary || '',
          publishDate: desc.publishDate || '',
          benefits: desc.benefits || [],
        });
      } catch (e) {
        console.error(`[profesia-scout] ERROR on ${job.title}: ${e.message}`);
        descriptions.push({
          ...job,
          fullDescription: '',
          detailedSalary: '',
          publishDate: '',
          benefits: [],
          error: e.message,
        });
      }
    }

    // Save descriptions (ONLY new jobs)
    const descPath = path.join(OUTPUT_DIR, 'descriptions.json');
    fs.writeFileSync(descPath, JSON.stringify({
      date: DATE_STR,
      scrapedAt: new Date().toISOString(),
      totalListings: allJobs.length,
      totalDescriptions: descriptions.length,
      blacklisted: blacklistedCount,
      skipped: skippedCount,
      jobs: descriptions,
    }, null, 2));

    console.log(`[profesia-scout] ✅ Saved ${descriptions.length} descriptions → ${descPath}`);

    // Update seen-offers.json with new offerIds
    newJobs.forEach(job => {
      if (job.offerId) {
        seenOffers.add(job.offerId);
      }
    });
    saveSeenOffers(seenOffers);
    console.log(`[profesia-scout] Updated seen-offers.json (${seenOffers.size} total)`);

    // --- NEW: Update State Machine ---
    let state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));

    const validJobs = descriptions.length;

    // Safely update the scraper object without deleting everything else
    state[DATE_STR].scraper.status = 'completed';
    state[DATE_STR].scraper.jobs_passed_filter = validJobs;

    // Auto-progress logic: If we found jobs, wake up Axiom. If not, skip everything.
    if (validJobs > 0) {
      state[DATE_STR].analyzer.status = 'pending';
    } else {
      state[DATE_STR].analyzer.status = 'skipped';
      state[DATE_STR].researcher.status = 'skipped';
      state[DATE_STR].writer.status = 'skipped';
    }

    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
    console.log(`[profesia-scout] Updated workflow-state.json`);
    // ---------------------------------

  } finally {
    ws.close();
  }
}

main().catch(e => {
  console.error('[profesia-scout] FATAL:', e.message);
  process.exit(1);
});