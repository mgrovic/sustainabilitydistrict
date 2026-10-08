const fs = require('node:fs/promises');

const membersIndex = 'https://washington.org/sustainability-district/members';
const fellowsPage = 'https://washington.org/members/dei-fellowship/application';
const dataFile = new URL('../data.js', `file://${process.cwd()}/scripts/`).pathname;
const requestTimeoutMs = 15_000;
const maxAttempts = 3;
const maxMemberPages = 100;

async function fetchHtml(url) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'DDC-Sustainability-Dashboard/1.0' },
        signal: controller.signal
      });
      if (response.ok) return response.text();

      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      if (!retryable || attempt === maxAttempts) {
        throw new Error(`Request failed (${response.status}): ${url}`);
      }
    } catch (error) {
      const retryable = error.name === 'AbortError' || error.name === 'TypeError';
      if (!retryable || attempt === maxAttempts) {
        throw new Error(`Request failed after ${attempt} attempt${attempt === 1 ? '' : 's'}: ${url}`, { cause: error });
      }
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1_000));
  }
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
    .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—').replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function unique(values) {
  return [...new Set(values)];
}

function extractLinks(html) {
  return [...html.matchAll(/href\s*=\s*(['"])(.*?)\1/gi)]
    .map((match) => decodeEntities(match[2]).trim());
}

function extractMemberPaths(html) {
  return unique(extractLinks(html).map((href) => {
    try {
      const url = new URL(href, membersIndex);
      return url.hostname === 'washington.org' && url.pathname.startsWith('/meetings/find-dc-listings/')
        ? url.pathname
        : null;
    } catch {
      return null;
    }
  }).filter(Boolean));
}

async function scrapeMembers() {
  const firstPage = await fetchHtml(membersIndex);
  const pages = [firstPage];
  for (let page = 1; page < maxMemberPages; page += 1) {
    const pageHtml = await fetchHtml(`${membersIndex}?page=${page}`);
    if (/No results are currently available for your search/i.test(pageHtml)) break;
    pages.push(pageHtml);
  }
  if (pages.length === maxMemberPages) {
    throw new Error(`Reached the ${maxMemberPages}-page member scrape limit`);
  }
  const paths = unique(pages.flatMap(extractMemberPaths));
  const members = [];
  for (const path of paths) {
    const html = await fetchHtml(`https://washington.org${path}`);
    const title = html.match(/<title>\s*([^<]+?)\s*<\/title>/i)?.[1] || path.split('/').pop();
    const name = decodeEntities(title).replace(/\s*\|\s*Washington(?:,?\s*DC)?\s*$/i, '').trim();
    members.push({ name, category: 'Sustainability District member', website: `https://washington.org${path}` });
  }
  return members.sort((left, right) => left.name.localeCompare(right.name));
}

async function scrapeFellows() {
  const html = await fetchHtml(fellowsPage);
  const cohort = html.match(/Meet the (\d{4}) DEI Business Fellows/i)?.[1] || String(new Date().getFullYear());
  return [...html.matchAll(/<h5>\s*<a href="([^"]+)">([^<]+)<\/a>/gi)].map((match) => {
    const name = decodeEntities(match[2]).trim();
    return { name, business: name, cohort, status: 'current', website: match[1] };
  });
}

function serialize(value) {
  return JSON.stringify(value, null, 2).slice(1, -1).replace(/^/gm, '  ');
}

function replaceArray(source, key, values, nextKey) {
  const pattern = nextKey
    ? new RegExp(`(${key}: \\[)[\\s\\S]*?(\\n  \\],\\n  ${nextKey}:)`)
    : new RegExp(`(${key}: \\[)[\\s\\S]*?(\\n  \\]\\n})`);
  const match = source.match(pattern);
  if (!match) throw new Error(`Could not find ${key} in data.js`);
  return source.replace(pattern, `$1\n${serialize(values)}${match[2]}`);
}

async function main() {
  const [members, fellows, source] = await Promise.all([scrapeMembers(), scrapeFellows(), fs.readFile(dataFile, 'utf8')]);
  let updated = replaceArray(source, 'members', members, 'fellows');
  updated = replaceArray(updated, 'fellows', fellows);
  updated = updated.replace(/membersLink: "[^"]+"/, `membersLink: "${membersIndex}"`);
  updated = updated.replace(/fellowsLink: "[^"]+"/, 'fellowsLink: "https://washington.org/dei-business-fellows"');
  updated = updated.replace(/\{ label: "District members", current: \d+, target: \d+ \}/, `{ label: "District members", current: ${members.length}, target: 100 }`);
  updated = updated.replace(/\{ label: "DEI fellows", current: \d+, target: \d+ \}/, `{ label: "DEI fellows", current: ${fellows.length}, target: ${fellows.length} }`);
  await fs.writeFile(dataFile, updated);
  console.log(`Updated ${members.length} members and ${fellows.length} DEI fellows.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });