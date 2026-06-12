// ===== CONFIGURATION =====

const BREAK_INFO = {
  neck: { e: '🙆', t: 'Neck Roll', d: 'Slowly roll your head in a big circle. 5 times clockwise, 5 counter-clockwise. Let gravity do the work.', s: 30 },
  wrist: { e: '🤲', t: 'Wrist Stretch', d: 'Extend your arm, gently pull fingers back with your other hand. 15 seconds each side. Wiggle after.', s: 30 },
  eyes: { e: '👁️', t: '20-20-20 Rule', d: 'Look at something 20 feet away for 20 seconds. Your eyes need this more than you think.', s: 20 },
  stand: { e: '🧍', t: 'Stand & Stretch', d: 'Stand up. Reach for the ceiling. Twist left, twist right. Touch your toes. Sit back down refreshed.', s: 40 },
  breathe: { e: '🌬️', t: 'Box Breathing', d: 'In for 4. Hold for 4. Out for 4. Hold for 4. Repeat. Navy SEALs use this under pressure.', s: 60 },
};

// Sorted by total source count (subreddits + substacks), descending
const CONTENT_CATEGORIES = {
  'Tech & Dev': {
    e: '💻', d: 'Programming, tools, and engineering culture',
    subreddits: ['programming', 'webdev', 'devops', 'netsec', 'selfhosted', 'ExperiencedDevs', 'cscareerquestions', 'linux', 'rust', 'golang', 'typescript', 'reactjs', 'node', 'python', 'cpp', 'java'],
    substacks: [
      { url: 'https://newsletter.pragmaticengineer.com/feed', name: 'The Pragmatic Engineer' },
      { url: 'https://blog.bytebytego.com/feed', name: 'ByteByteGo' },
      { url: 'https://engineercodex.substack.com/feed', name: 'Engineer Codex' },
      { url: 'https://theengineeringmanager.substack.com/feed', name: 'The Engineering Manager' },
    ],
  },
  'Investing & Personal Finance': {
    e: '💰', d: 'Portfolio strategy, value investing, and building wealth',
    subreddits: ['investing', 'stocks', 'ValueInvesting', 'SecurityAnalysis', 'Bogleheads', 'dividends', 'personalfinance', 'FinancialPlanning', 'Fire', 'fatFIRE', 'financialindependence', 'RealEstate', 'options'],
    substacks: [
      { url: 'https://investornotes.substack.com/feed', name: 'Investor Notes' },
      { url: 'https://www.noahpinion.blog/feed', name: 'Noahpinion' },
    ],
  },
  'Science & Learning': {
    e: '🧠', d: 'TIL, explainers, and mind-blowing facts',
    subreddits: ['todayilearned', 'interestingasfuck', 'ELI5', 'science', 'space', 'Futurology', 'askscience', 'DepthHub', 'TrueReddit', 'philosophy', 'AskHistorians', 'explainlikeimfive'],
    substacks: [
      { url: 'https://www.experimental-history.com/feed', name: 'Experimental History' },
      { url: 'https://www.construction-physics.com/feed', name: 'Construction Physics' },
      { url: 'https://www.astralcodexten.com/feed', name: 'Astral Codex Ten' },
      { url: 'https://mindmatters.substack.com/feed', name: 'Mind Matters' },
      { url: 'https://dynomight.net/feed.xml', name: 'Dynomight' },
      { url: 'https://unchartedterritories.tomaspueyo.com/feed', name: 'Uncharted Territories' },
    ],
  },
  'Design & Creative': {
    e: '🎨', d: 'Design inspiration and creative work',
    subreddits: ['Design', 'web_design', 'graphic_design', 'Art', 'mechanical_gifs', 'typography', 'UI_Design', 'InteriorDesign', 'PixelArt', 'generative', 'Lettering', 'Logo_Critique'],
    substacks: [
      { url: 'https://designlobster.substack.com/feed', name: 'Design Lobster' },
    ],
  },
  'AI & Machine Learning': {
    e: '🤖', d: 'AI research, tools, and industry trends',
    subreddits: ['artificial', 'MachineLearning', 'LocalLLaMA', 'singularity', 'ChatGPT', 'ClaudeAI', 'StableDiffusion', 'OpenAI', 'deeplearning'],
    substacks: [
      { url: 'https://www.oneusefulthing.org/feed', name: 'One Useful Thing' },
      { url: 'https://thealgorithmicbridge.substack.com/feed', name: 'The Algorithmic Bridge' },
      { url: 'https://www.interconnects.ai/feed', name: 'Interconnects' },
      { url: 'https://importai.substack.com/feed', name: 'Import AI' },
      { url: 'https://aisnakeoil.substack.com/feed', name: 'AI Snake Oil' },
      { url: 'https://www.latent.space/feed', name: 'Latent Space' },
    ],
  },
  'Startups & Product': {
    e: '🚀', d: 'Founders, product thinking, and growth',
    subreddits: ['startups', 'Entrepreneur', 'SaaS', 'indiehackers', 'ProductManagement', 'growthacking', 'smallbusiness'],
    substacks: [
      { url: 'https://www.lennysnewsletter.com/feed', name: 'Lenny\'s Newsletter' },
      { url: 'https://www.notboring.co/feed', name: 'Not Boring' },
      { url: 'https://sacks.substack.com/feed', name: 'Sacks' },
      { url: 'https://www.newcomer.co/feed', name: 'Newcomer' },
    ],
  },
  'Comedy': {
    e: '😂', d: 'Laughs, memes, and absurdity',
    subreddits: ['ProgrammerHumor', 'Showerthoughts', 'DiWHY', 'tifu', 'AbsoluteUnits', 'funny', 'memes', 'MadeMeSmile', 'ContagiousLaughter', 'WhitePeopleTwitter', 'BlackPeopleTwitter', 'BrandNewSentence', 'rareinsults', 'ATBGE'],
    substacks: [],
  },
  'News & World': {
    e: '🌍', d: 'What\'s happening around the globe',
    subreddits: ['worldnews', 'UpliftingNews', 'MapPorn', 'OldSchoolCool', 'geopolitics', 'TrueReddit', 'neutralnews'],
    substacks: [
      { url: 'https://www.platformer.news/feed', name: 'Platformer' },
      { url: 'https://www.slowboring.com/feed', name: 'Slow Boring' },
      { url: 'https://www.thefitzwilliam.com/feed', name: 'The Fitzwilliam' },
      { url: 'https://www.persuasion.community/feed', name: 'Persuasion' },
      { url: 'https://www.honest-broker.com/feed', name: 'The Honest Broker' },
    ],
  },
  'Business & Economics': {
    e: '📈', d: 'Markets, macro, and business strategy',
    subreddits: ['wallstreetbets', 'econmonitor', 'economics', 'business', 'AskEconomics'],
    substacks: [
      { url: 'https://thegeneralist.substack.com/feed', name: 'The Generalist' },
      { url: 'https://www.noahpinion.blog/feed', name: 'Noahpinion' },
    ],
  },
  'Gaming': {
    e: '🎮', d: 'Games, esports, and gaming culture',
    subreddits: ['gaming', 'Games', 'pcgaming', 'indiegaming', 'GameDeals', 'truegaming', 'patientgamers', 'gamedev', 'NintendoSwitch', 'PS5'],
    substacks: [
      { url: 'https://hitpoints.substack.com/feed', name: 'Hit Points' },
    ],
  },
  'Self-Help & Growth': {
    e: '🌱', d: 'Personal development, motivation, and life advice',
    subreddits: ['selfimprovement', 'DecidingToBeBetter', 'getdisciplined', 'socialskills', 'confidence', 'LifeProTips', 'selfhelp', 'motivation', 'Journaling'],
    substacks: [],
  },
  'Visual & Cozy': {
    e: '🏠', d: 'Beautiful places, food, and good vibes',
    subreddits: ['FoodPorn', 'CozyPlaces', 'spaceporn', 'rarepuppers', 'EarthPorn', 'CityPorn', 'ArchitecturePorn', 'AmateurRoomPorn', 'Baking', 'gardening', 'houseplants'],
    substacks: [],
  },
  'Productivity & Thinking': {
    e: '⚡', d: 'Mental models, habits, and working smarter',
    subreddits: ['productivity', 'Stoicism', 'ZenHabits', 'nosurf'],
    substacks: [],
  },
  'Health & Wellness': {
    e: '🧘', d: 'Fitness, nutrition, and mental health',
    subreddits: ['Fitness', 'nutrition', 'HealthyFood', 'bodyweightfitness', 'Meditation', 'running', 'sleep', 'loseit', 'flexibility'],
    substacks: [],
  },
  'Crypto & Web3': {
    e: '₿', d: 'Blockchain, DeFi, and the decentralized web',
    subreddits: ['CryptoCurrency', 'ethereum', 'defi', 'Bitcoin', 'solana', 'CryptoTechnology'],
    substacks: [],
  },
};

const DEFAULT_CATEGORIES = new Set(['Comedy', 'Tech & Dev', 'Science & Learning']);

// ===== STATE =====

let curBreak = 'neck';
let brkIv = null;
let feedPosts = [];
let feedLoading = false;
let selectedCategories = new Set(DEFAULT_CATEGORIES);
let sourceFilter = 'both'; // 'both', 'substack', 'reddit'
let customSources = []; // { type: 'reddit'|'substack', label: string, url?: string, sub?: string }
let claudeSnapshot = { instances: [], count: 0, anyActive: false, totalActive: 0 };
let dropdownOpen = true; // open by default on launch
let editingCategories = false;
let isCompactView = false; // compact mode = stats only, no feed

// ===== CONTENT CACHE =====

const cache = {};
const STALE_AFTER = 5 * 60 * 1000;

function clearCache() { for (const k in cache) delete cache[k]; }

async function getCached(key, fetcher) {
  const cached = cache[key];
  if (cached && Date.now() - cached.fetchedAt < STALE_AFTER) return cached.data;
  const fresh = await fetcher();
  cache[key] = { data: fresh, fetchedAt: Date.now() };
  return fresh;
}

// ===== HELPERS =====

function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

function formatScore(n) {
  if (n == null) return null;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function formatTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60;
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(sc).padStart(2, '0');
  return String(m).padStart(2, '0') + ':' + String(sc).padStart(2, '0');
}

function parseEtime(etime) {
  if (!etime) return 0;
  const p = etime.trim().split(/[-:]/);
  if (p.length === 2) return +p[0] * 60 + +p[1];
  if (p.length === 3) return +p[0] * 3600 + +p[1] * 60 + +p[2];
  if (p.length === 4) return +p[0] * 86400 + +p[1] * 3600 + +p[2] * 60 + +p[3];
  return 0;
}

function formatMem(kb) {
  if (kb >= 1048576) return (kb / 1048576).toFixed(1) + ' GB';
  if (kb >= 1024) return (kb / 1024).toFixed(0) + ' MB';
  return kb + ' KB';
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return Math.floor(diff / 604800) + 'w ago';
}

// ===== FEED FETCHERS =====

async function fetchRedditFeed(sub) {
  if (!window.api) return [];
  const posts = await getCached(`reddit:${sub}`, () => window.api.fetchReddit(sub, 'hot', 25));
  return posts.filter(p => p.score >= 100).map(p => {
    // Resolve best image: direct URL for image posts, preview for all others
    let image_url = null;
    const directUrl = p.url || '';
    if (/\.(jpe?g|png|gif|webp)$/i.test(directUrl)) {
      image_url = directUrl;
    } else if (p.preview) {
      image_url = p.preview; // use preview even for external-preview URLs
    }
    // External link detection: url points outside reddit (any non-reddit, non-image URL)
    const isExternalLink = p.domain
      && !p.domain.includes('reddit.com')
      && !p.domain.includes('redd.it')
      && !p.domain.includes('i.imgur.com')
      && !/\.(jpe?g|png|gif|webp)$/i.test(directUrl);
    return {
      id: `reddit-${p.id}`, source: 'reddit', platform_label: `r/${p.subreddit}`, avatar: '🔸',
      author: p.author, text: p.title + (p.selftext ? '\n' + p.selftext.slice(0, 200) : ''),
      image_url,
      video_url: p.video_url || p.gif_url || null,
      is_video: p.is_video || !!p.video_url || !!p.gif_url,
      link_url: isExternalLink ? p.url : null,
      link_domain: isExternalLink ? p.domain : null,
      score: p.score, comments: p.num_comments, url: p.permalink, timestamp: p.created_utc,
    };
  });
}

async function fetchSubstackFeed(url, feedName) {
  if (!window.api) return [];
  const items = await getCached(`substack:${url}`, () => window.api.fetchRSS(url));
  const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
  return items.filter(item => {
    if (!item.pubDate) return true;
    return new Date(item.pubDate).getTime() > ninetyDaysAgo;
  }).map(item => ({
    id: `substack-${item.id || item.link}`,
    source: 'substack',
    platform_label: feedName || item.feedTitle || 'Substack',
    avatar: '📝',
    author: item.creator || feedName || item.feedTitle,
    title: item.title,
    text: item.contentSnippet || '',
    image_url: null,
    video_url: null,
    is_video: false,
    score: null,
    comments: null,
    url: item.link,
    timestamp: item.pubDate ? new Date(item.pubDate).getTime() / 1000 : Date.now() / 1000,
  }));
}

// Build a lookup: subreddit/source → category name
function buildSourceCategoryMap() {
  const map = {};
  for (const [catName, cat] of Object.entries(CONTENT_CATEGORIES)) {
    for (const sub of cat.subreddits) map[`reddit:${sub}`] = catName;
    for (const ss of (cat.substacks || [])) map[`substack:${ss.name}`] = catName;
  }
  return map;
}
const SOURCE_CAT_MAP = buildSourceCategoryMap();

function getCategoryForPost(post) {
  if (post.source === 'reddit') {
    const sub = post.platform_label.replace('r/', '');
    return SOURCE_CAT_MAP[`reddit:${sub}`] || null;
  }
  if (post.source === 'substack') {
    return SOURCE_CAT_MAP[`substack:${post.platform_label}`] || SOURCE_CAT_MAP[`substack:${post.author}`] || null;
  }
  return null;
}

async function fetchAllFeeds() {
  const fetchers = [];
  for (const catName of selectedCategories) {
    const cat = CONTENT_CATEGORIES[catName];
    if (!cat) continue;
    if (sourceFilter !== 'substack') {
      const subs = [...cat.subreddits].sort(() => Math.random() - 0.5).slice(0, 3);
      subs.forEach(s => fetchers.push(fetchRedditFeed(s)));
    }
    if (sourceFilter !== 'reddit') {
      const ss = [...(cat.substacks || [])].sort(() => Math.random() - 0.5);
      ss.forEach(s => fetchers.push(fetchSubstackFeed(s.url, s.name)));
    }
  }
  // Add custom sources
  for (const cs of customSources) {
    if (cs.type === 'reddit' && sourceFilter !== 'substack') {
      fetchers.push(fetchRedditFeed(cs.sub));
    } else if (cs.type === 'substack' && sourceFilter !== 'reddit') {
      fetchers.push(fetchSubstackFeed(cs.url, cs.label));
    }
  }

  if (!fetchers.length) return [];
  const results = await Promise.allSettled(fetchers);
  return results.filter(r => r.status === 'fulfilled').flatMap(r => r.value).sort(() => Math.random() - 0.5);
}

// ===== POST RENDERING =====

function renderPost(post) {
  const scoreStr = formatScore(post.score);
  const commentsStr = formatScore(post.comments);
  const timeStr = timeAgo(post.timestamp);
  const category = getCategoryForPost(post);
  const catMeta = category ? CONTENT_CATEGORIES[category] : null;
  const catBadge = catMeta ? `<span class="p-cat">${catMeta.e} ${category}</span>` : '';

  // Substack gets a distinct card style
  if (post.source === 'substack') {
    const title = post.title || '';
    let snippet = (post.text || '').trim();
    // Ensure at least 200 chars if content is available, cap at 500
    if (snippet.length < 200) {
      snippet = ''; // too short to be useful, hide it
    } else if (snippet.length > 500) {
      snippet = snippet.slice(0, 497) + '…';
    }
    return `<div class="post post-substack" data-url="${escapeHtml(post.url || '')}">
      <div class="p-head">
        <div class="p-av" style="background:#fff4ed">📝</div>
        <div class="p-who">${escapeHtml(post.platform_label)}</div>
        ${catBadge}
        <div class="p-plat substack">substack</div>
      </div>
      <div class="p-substack-title">${escapeHtml(title)}</div>
      ${snippet ? `<div class="p-substack-snippet">${escapeHtml(snippet)}</div>` : ''}
      <div class="p-foot">
        <span class="p-stat">by ${escapeHtml(post.author || '')}</span>
        ${timeStr ? `<span class="p-time">${timeStr}</span>` : ''}
      </div>
    </div>`;
  }

  const platformClass = post.source;
  const platformLabel = post.source === 'reddit' ? 'reddit' : post.source;
  const bgColor = post.source === 'reddit' ? '#fff4ed' : '#e7f5ff';
  let imageHtml = '';
  if (post.video_url) {
    imageHtml = `<div class="p-img p-video"><video src="${escapeHtml(post.video_url)}" muted loop playsinline preload="metadata" onerror="this.parentElement.style.display='none'"></video><div class="p-play-btn">▶</div></div>`;
  } else if (post.image_url) {
    imageHtml = `<div class="p-img"><img src="${escapeHtml(post.image_url)}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"></div>`;
  }
  let footHtml = '<div class="p-foot">';
  if (scoreStr) footHtml += `<span class="p-stat">❤️ ${scoreStr}</span>`;
  if (commentsStr) footHtml += `<span class="p-stat">💬 ${commentsStr}</span>`;
  if (timeStr) footHtml += `<span class="p-time">${timeStr}</span>`;
  footHtml += '</div>';
  let text = post.text; if (text.length > 280) text = text.slice(0, 277) + '…';
  let linkHtml = '';
  if (post.link_url && post.link_domain) {
    linkHtml = `<div class="p-link" data-href="${escapeHtml(post.link_url)}"><span class="p-link-icon">🔗</span><span class="p-link-domain">${escapeHtml(post.link_domain)}</span><span class="p-link-open">Open</span></div>`;
  }
  return `<div class="post" data-url="${escapeHtml(post.url || '')}">
    <div class="p-head"><div class="p-av" style="background:${bgColor}">${post.avatar}</div><div class="p-who">${escapeHtml(post.platform_label)}</div>${catBadge}<div class="p-plat ${platformClass}">${platformLabel}</div></div>
    ${imageHtml}<div class="p-txt">${escapeHtml(text)}</div>${linkHtml}${footHtml}</div>`;
}

function showLoading(c) { c.innerHTML += '<div class="loading"><div class="loading-spinner"></div><br>loading…</div>'; }
function removeLoading(c) { const l = c.querySelector('.loading'); if (l) l.remove(); }

// ===== CLAUDE INSTANCE UI =====

function updateStatusBar(snapshot) {
  claudeSnapshot = snapshot;
  const statusEl = document.getElementById('status');
  const msgEl = document.getElementById('stMsg');
  const subEl = document.getElementById('stSub');

  if (snapshot.count === 0) {
    statusEl.className = 'status idle';
    msgEl.textContent = 'No Claude instances detected';
    subEl.textContent = 'waiting…';
  } else if (snapshot.anyActive) {
    statusEl.className = 'status active';
    msgEl.textContent = `${snapshot.count} total · ${snapshot.totalActive} working`;
    updateActiveSubtext(subEl);
  } else {
    statusEl.className = 'status idle';
    msgEl.textContent = `${snapshot.count} total · all ready`;
    subEl.textContent = snapshot.instances.map(i => {
      if (i.idleStart) return `${i.project} (ready)`;
      return i.project;
    }).join(', ');
  }

  document.getElementById('ssInstances').textContent = snapshot.count;
  document.getElementById('ssActive').textContent = snapshot.totalActive;
  if (snapshot.instances.length > 0) {
    const maxEtime = snapshot.instances.reduce((max, i) => Math.max(max, parseEtime(i.etime)), 0);
    document.getElementById('ssUptime').textContent = formatTime(maxEtime);
  }
  if (dropdownOpen) renderInstanceList();
}

function updateActiveSubtext(subEl) {
  if (!subEl) subEl = document.getElementById('stSub');
  subEl.textContent = claudeSnapshot.instances.filter(i => i.active).map(i => {
    if (i.activeStart) {
      const dur = Math.floor((Date.now() - i.activeStart) / 1000);
      return `${i.project} (${formatTime(dur)})`;
    }
    return i.project;
  }).join(', ');
}

function formatTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function getContextLimit(model, oneMBeta, contextTokens = 0) {
  if (!model) return 200000;
  const m = model.toLowerCase();
  // Only opus-4-6/4-7/4-8, sonnet-4-6, and fable-5 support the 1M-context beta.
  const supports1M = /opus-4-[678]\b|sonnet-4-6\b|fable-5\b/.test(m);
  if (!supports1M) return 200000;
  // Two signals for 1M: env var (shell or settings.json) OR observed context
  // exceeding 200k (catches `/model [1m]` runtime toggle which isn't persisted).
  if (oneMBeta || contextTokens > 200000) return 1000000;
  return 200000;
}

function renderInstanceList() {
  const listEl = document.getElementById('instList');
  if (claudeSnapshot.count === 0) { listEl.innerHTML = '<div class="inst-empty">No Claude Code instances running</div>'; return; }
  listEl.innerHTML = claudeSnapshot.instances.map(inst => {
    const sc = inst.active ? 'active' : 'idle';
    let durHtml = '';
    if (inst.active && inst.activeStart) {
      durHtml = `<div class="inst-dur">${formatTime(Math.floor((Date.now() - inst.activeStart) / 1000))}</div>`;
    }
    const memStr = inst.rss ? formatMem(inst.rss) : '';
    const branchStr = inst.gitBranch ? ` · ${escapeHtml(inst.gitBranch)}` : '';
    const modelStr = inst.model ? inst.model.replace(/^claude-/, '').split('-2')[0] : '';

    // Token stats + context usage bar
    let statsHtml = '';
    if (inst.turnCount > 0) {
      const totalIn = inst.inputTokens + inst.cacheReadTokens + inst.cacheCreateTokens;
      // Context usage: contextTokens = last API call's total input (current window fill)
      const contextLimit = getContextLimit(inst.model, inst.oneMBeta, inst.contextTokens);
      const ctxPct = inst.contextTokens > 0 ? Math.min(100, (inst.contextTokens / contextLimit) * 100) : 0;
      const ctxColor = ctxPct > 80 ? 'var(--acc)' : ctxPct > 50 ? '#e8a33e' : '#5ba8c8';
      const ctxBar = inst.contextTokens > 0
        ? `<div class="ctx-usage">
            <div class="ctx-bar"><div class="ctx-fill" style="width:${ctxPct.toFixed(1)}%;background:${ctxColor}"></div></div>
            <span class="ctx-label">${formatTokens(inst.contextTokens)} / ${formatTokens(contextLimit)} (${ctxPct.toFixed(0)}%)</span>
          </div>`
        : '';
      statsHtml = `<div class="inst-stats">
        <span class="inst-stat">${inst.turnCount} turn${inst.turnCount !== 1 ? 's' : ''}</span>
        <span class="inst-stat">↑${formatTokens(totalIn)}</span>
        <span class="inst-stat">↓${formatTokens(inst.outputTokens)}</span>
        ${modelStr ? `<span class="inst-stat inst-model">${modelStr}</span>` : ''}
      </div>${ctxBar}`;
    }

    return `<div class="inst-row" data-pid="${inst.pid}">
      <div class="inst-dot ${sc}"></div>
      <div class="inst-info">
        <div class="inst-project">${escapeHtml(inst.project)}${branchStr}</div>
        <div class="inst-meta">PID ${inst.pid} · up ${inst.etime || '—'} · CPU ${inst.cpu.toFixed(1)}%${memStr ? ' · ' + memStr : ''}</div>
        ${statsHtml}
      </div>
      ${durHtml}
      <div class="inst-status ${sc}">${sc === 'active' ? 'working' : 'ready'}</div>
    </div>`;
  }).join('');
}

function toggleDropdown() {
  dropdownOpen = !dropdownOpen;
  document.getElementById('instDropdown').classList.toggle('open', dropdownOpen);
  document.getElementById('stToggle').classList.toggle('open', dropdownOpen);
  if (dropdownOpen) renderInstanceList();
}

// ===== FEED TAB (merged with Discover) =====

function renderFeedHeader(container) {
  const pills = [...selectedCategories].map(c => {
    const cat = CONTENT_CATEGORIES[c];
    return `<span class="feed-cat-pill">${cat ? cat.e : ''} ${c}</span>`;
  }).join('');
  const filterLabel = sourceFilter === 'both' ? '' : ` <span class="feed-cat-pill" style="background:var(--bgi);color:var(--t3);">${sourceFilter}</span>`;
  container.insertAdjacentHTML('afterbegin', `<div class="feed-edit-bar">
    <div class="feed-cats-pills">${pills || '<span style="color:var(--t3);font-size:10px;">no categories</span>'}${filterLabel}</div>
    <button class="feed-edit-btn" id="feedEditBtn">edit</button>
    <button class="shuffle-btn" id="feedShuffleBtn"><span>🎲</span> shuffle</button>
  </div>`);
  document.getElementById('feedEditBtn').addEventListener('click', showCategorySelector);
  document.getElementById('feedShuffleBtn').addEventListener('click', shuffleCurrent);
}

function showCategorySelector() {
  editingCategories = true;
  previewingCategory = null;
  const container = document.getElementById('p-feed');
  container.innerHTML = '';

  let html = `<div class="cat-selector">
    <div class="cat-selector-title">Select categories</div>
    <div class="source-filter">
      <div class="sf-label">Sources:</div>
      <button class="sf-btn ${sourceFilter === 'both' ? 'on' : ''}" data-sf="both">Both</button>
      <button class="sf-btn ${sourceFilter === 'substack' ? 'on' : ''}" data-sf="substack">Substack</button>
      <button class="sf-btn ${sourceFilter === 'reddit' ? 'on' : ''}" data-sf="reddit">Reddit</button>
    </div>`;
  for (const [name, cat] of Object.entries(CONTENT_CATEGORIES)) {
    const sel = selectedCategories.has(name);
    const redditCount = cat.subreddits.length;
    const ssCount = (cat.substacks || []).length;
    let srcDesc = '';
    if (sourceFilter === 'substack') srcDesc = `${ssCount} substack${ssCount !== 1 ? 's' : ''}`;
    else if (sourceFilter === 'reddit') srcDesc = `${redditCount} reddit`;
    else srcDesc = `${redditCount} reddit · ${ssCount} substack`;
    html += `<div class="cat-item ${sel ? 'selected' : ''}" data-cat="${name}">
      <div class="cat-check">${sel ? '✓' : ''}</div>
      <div class="cat-em">${cat.e}</div>
      <div class="cat-info"><div class="cat-name">${name}</div><div class="cat-desc">${cat.d} · ${srcDesc}</div></div>
      <div class="cat-arrow" data-cat-preview="${name}" title="Preview">→</div>
    </div>`;
  }
  html += `<button class="cat-submit" id="catSubmit" ${selectedCategories.size === 0 ? 'disabled' : ''}>Load my feed →</button>
  </div>
  <div class="cat-selector" style="margin-top:8px;">
    <div class="cat-selector-title">Add Custom Source</div>
    <div class="custom-src-row">
      <input type="text" class="custom-src-input" id="customSrcInput" placeholder="r/subreddit or substack-name.substack.com">
      <button class="btn btn-p custom-src-add" id="customSrcAdd">add</button>
    </div>
    ${customSources.length ? '<div class="custom-src-list">' + customSources.map((s, i) =>
      `<div class="custom-src-item"><span>${escapeHtml(s.label)}</span><button class="custom-src-rm" data-idx="${i}">×</button></div>`
    ).join('') + '</div>' : ''}
  </div>`;
  container.innerHTML = html;

  document.getElementById('catSubmit').addEventListener('click', () => {
    editingCategories = false;
    clearCache();
    feedPosts = [];
    loadFeed(false);
  });

  // Source filter buttons
  document.querySelectorAll('.sf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sourceFilter = btn.dataset.sf;
      showCategorySelector();
    });
  });

  // Custom source add
  document.getElementById('customSrcAdd').addEventListener('click', addCustomSource);
  document.getElementById('customSrcInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCustomSource();
  });

  // Custom source remove
  document.querySelectorAll('.custom-src-rm').forEach(btn => {
    btn.addEventListener('click', () => {
      customSources.splice(parseInt(btn.dataset.idx), 1);
      showCategorySelector();
    });
  });
}

function addCustomSource() {
  const input = document.getElementById('customSrcInput');
  let val = input.value.trim();
  if (!val) return;

  if (val.startsWith('r/')) {
    // Reddit subreddit
    customSources.push({ type: 'reddit', label: val, sub: val.replace('r/', '') });
  } else if (val.match(/^[a-zA-Z0-9_-]+$/)) {
    // Bare name — could be subreddit or substack, treat as subreddit
    customSources.push({ type: 'reddit', label: 'r/' + val, sub: val });
  } else if (val.includes('substack.com')) {
    // Substack URL
    if (!val.startsWith('http')) val = 'https://' + val;
    if (!val.endsWith('/feed')) val = val.replace(/\/?$/, '/feed');
    const name = val.match(/\/\/([^.]+)/)?.[1] || val;
    customSources.push({ type: 'substack', label: name, url: val });
  } else if (val.includes('.') && !val.includes(' ')) {
    // Some other URL — try as Substack feed
    if (!val.startsWith('http')) val = 'https://' + val;
    if (!val.endsWith('/feed')) val = val.replace(/\/?$/, '/feed');
    customSources.push({ type: 'substack', label: val.replace(/https?:\/\//, '').replace('/feed', ''), url: val });
  }

  input.value = '';
  showCategorySelector();
}

async function showCategoryPreview(catName) {
  const cat = CONTENT_CATEGORIES[catName];
  if (!cat) return;
  const container = document.getElementById('p-feed');
  const scroll = document.getElementById('feedScroll');
  scroll.scrollTop = 0;

  container.innerHTML = `<div class="sub-detail-hdr">
    <button class="sub-back" id="previewBack">←</button>
    <div class="sub-detail-name">${cat.e} ${catName}</div>
    <div class="sub-detail-tag">${cat.subreddits.length + (cat.substacks || []).length} sources</div>
  </div><div class="loading"><div class="loading-spinner"></div><br>loading ${catName}…</div>`;

  document.getElementById('previewBack').addEventListener('click', showCategorySelector);

  try {
    const subs = [...cat.subreddits].sort(() => Math.random() - 0.5).slice(0, 2);
    const fetchers = subs.map(s => fetchRedditFeed(s));
    (cat.substacks || []).forEach(ss => fetchers.push(fetchSubstackFeed(ss.url, ss.name)));
    const results = await Promise.allSettled(fetchers);
    const posts = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value).sort(() => Math.random() - 0.5);
    removeLoading(container);
    if (!posts.length) { container.insertAdjacentHTML('beforeend', '<div class="loading">no posts found</div>'); }
    else { posts.slice(0, 15).forEach(p => container.insertAdjacentHTML('beforeend', renderPost(p))); }
  } catch { const l = container.querySelector('.loading'); if (l) l.textContent = 'failed to load'; }
}

async function loadFeed(append = false) {
  const container = document.getElementById('p-feed');
  if (feedLoading) return;
  feedLoading = true;
  if (!append) { container.innerHTML = ''; showLoading(container); }
  try {
    const posts = await fetchAllFeeds();
    feedPosts = append ? [...feedPosts, ...posts] : posts;
    // Cap at 200 posts to prevent unbounded memory growth
    if (feedPosts.length > 200) feedPosts = feedPosts.slice(0, 200);
    if (!append) container.innerHTML = '';
    removeLoading(container);
    if (!append) renderFeedHeader(container);
    const start = append ? feedPosts.length - posts.length : 0;
    for (let i = start; i < feedPosts.length; i++) container.insertAdjacentHTML('beforeend', renderPost(feedPosts[i]));
    if (!feedPosts.length) container.innerHTML = '<div class="loading">no posts — hit edit to select categories</div>';
  } catch { removeLoading(container); container.innerHTML = '<div class="loading">failed to load — try shuffle</div>'; }
  feedLoading = false;
}

// ===== BREAK TAB =====

function renderBreak() {
  const b = BREAK_INFO[curBreak];
  if (brkIv) { clearInterval(brkIv); brkIv = null; }
  document.getElementById('p-break').innerHTML = `
    <div class="brk"><span class="brk-em">${b.e}</span><h3 class="brk-t">${b.t}</h3><p class="brk-d">${b.d}</p>
    <div class="brk-ring" id="brkRing">${b.s}s</div>
    <div class="brk-btns" id="brkBtns">
      <button class="btn btn-p" id="startBrkBtn">start timer</button>
    </div></div>
    <div class="brk-picks">${Object.entries(BREAK_INFO).map(([k, v]) =>
      `<div class="brk-pick ${k === curBreak ? 'sel' : ''}" data-brk="${k}" title="${v.t}">${v.e}</div>`).join('')}</div>`;
  document.getElementById('startBrkBtn').addEventListener('click', () => startBreakTimer(b.s));
  document.querySelectorAll('.brk-pick').forEach(el => el.addEventListener('click', () => { curBreak = el.dataset.brk; renderBreak(); }));
}

function startBreakTimer(sec) { runBreakTimer(sec); }

function runBreakTimer(remaining) {
  let t = remaining;
  const ring = document.getElementById('brkRing');
  const btns = document.getElementById('brkBtns');
  if (brkIv) clearInterval(brkIv);

  btns.innerHTML = `
    <button class="btn btn-stop" id="stopBrkBtn">stop</button>
    <button class="btn btn-restart" id="restartBrkBtn">start over</button>`;
  document.getElementById('stopBrkBtn').addEventListener('click', () => {
    clearInterval(brkIv); brkIv = null;
    btns.innerHTML = `
      <button class="btn btn-p" id="resumeBrkBtn">resume</button>
      <button class="btn btn-restart" id="restartBrkBtn2">start over</button>`;
    document.getElementById('resumeBrkBtn').addEventListener('click', () => runBreakTimer(t));
    document.getElementById('restartBrkBtn2').addEventListener('click', () => renderBreak());
  });
  document.getElementById('restartBrkBtn').addEventListener('click', () => renderBreak());

  brkIv = setInterval(() => {
    t--;
    ring.textContent = t > 0 ? t + 's' : '✓';
    if (t <= 0) {
      clearInterval(brkIv); brkIv = null;
      ring.classList.add('ok');
      btns.innerHTML = `<button class="btn btn-p" id="doneBrkBtn">done — start over</button>`;
      document.getElementById('doneBrkBtn').addEventListener('click', () => renderBreak());
    }
  }, 1000);
}

// ===== VOCAB TAB =====

// Word list loaded from JSON file (1700+ curated GRE/SAT-level words)
let VOCAB_WORDS = [];
fetch('vocab-words.json').then(r => r.json()).then(words => { VOCAB_WORDS = words; }).catch(() => {
  // Fallback if JSON fails to load
  VOCAB_WORDS = ['ephemeral','ubiquitous','pragmatic','eloquent','resilient','esoteric','sanguine','ineffable','cacophony','mellifluous'];
});

let vocabLoading = false;
let vocabHistory = []; // words already shown this session

async function loadVocabWord() {
  const container = document.getElementById('p-vocab');
  if (vocabLoading) return;
  vocabLoading = true;
  container.innerHTML = '<div class="loading"><div class="loading-spinner"></div><br>finding a word…</div>';

  try {
    // Pick a random word from curated list (avoid repeats)
    const available = VOCAB_WORDS.filter(w => !vocabHistory.includes(w));
    if (available.length === 0) vocabHistory = []; // reset if exhausted
    const pool = available.length > 0 ? available : VOCAB_WORDS;
    const word = pool[Math.floor(Math.random() * pool.length)];
    vocabHistory.push(word);

    // Fetch definition from dictionary API
    const data = window.api ? await window.api.fetchWord(word) : null;
    if (data) {
      renderVocabCard(container, data);
    } else {
      container.innerHTML = `<div class="loading">couldn't find "${escapeHtml(word)}" — tap shuffle</div>`;
    }
  } catch {
    container.innerHTML = '<div class="loading">failed to load — try again</div>';
  }
  vocabLoading = false;
}

function renderVocabCard(container, data) {
  const phoneticText = data.phonetic ? `<span class="vocab-phonetic">${escapeHtml(data.phonetic)}</span>` : '';
  const audioBtn = data.audioUrl ? `<button class="vocab-audio-btn" id="vocabAudioBtn" title="Listen">🔊</button>` : '';

  let meaningsHtml = '';
  for (const meaning of data.meanings) {
    meaningsHtml += `<div class="vocab-pos">${escapeHtml(meaning.partOfSpeech)}</div>`;
    for (const def of meaning.definitions) {
      meaningsHtml += `<div class="vocab-def">${escapeHtml(def.definition)}</div>`;
      if (def.example) {
        meaningsHtml += `<div class="vocab-example">"${escapeHtml(def.example)}"</div>`;
      }
    }
    if (meaning.synonyms.length) {
      meaningsHtml += `<div class="vocab-syns"><span class="vocab-syn-label">Synonyms:</span> ${meaning.synonyms.map(s => `<span class="vocab-syn">${escapeHtml(s)}</span>`).join(' ')}</div>`;
    }
    if (meaning.antonyms.length) {
      meaningsHtml += `<div class="vocab-syns"><span class="vocab-syn-label">Antonyms:</span> ${meaning.antonyms.map(s => `<span class="vocab-ant">${escapeHtml(s)}</span>`).join(' ')}</div>`;
    }
  }

  container.innerHTML = `
    <div class="vocab-card">
      <div class="vocab-header">
        <div class="vocab-word">${escapeHtml(data.word)}</div>
        <div class="vocab-pronounce">${phoneticText} ${audioBtn}</div>
      </div>
      <div class="vocab-meanings">${meaningsHtml}</div>
    </div>`;

  if (data.audioUrl) {
    document.getElementById('vocabAudioBtn').addEventListener('click', () => {
      new Audio(data.audioUrl).play().catch(() => {});
    });
  }
}

// ===== TABS =====

function goTab(tabEl) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.pnl').forEach(p => p.classList.remove('on'));
  tabEl.classList.add('on');
  document.getElementById('p-' + tabEl.dataset.p).classList.add('on');
  document.getElementById('feedScroll').scrollTop = 0;
  // If leaving feed while editing, reset
  if (tabEl.dataset.p !== 'feed' && editingCategories) { editingCategories = false; previewingCategory = null; }
  // Show/hide vocab bar
  document.getElementById('vocabBar').classList.toggle('show', tabEl.dataset.p === 'vocab');
  // Load vocab on first visit
  if (tabEl.dataset.p === 'vocab' && !document.getElementById('p-vocab').hasChildNodes()) {
    loadVocabWord();
  }
}

// ===== SHUFFLE =====

function shuffleCurrent() {
  const active = document.querySelector('.tab.on').dataset.p;
  document.getElementById('feedScroll').scrollTop = 0;
  if (active === 'feed') {
    if (editingCategories) { showCategorySelector(); return; }
    clearCache();
    feedPosts = [];
    loadFeed(false);
  } else if (active === 'vocab') {
    loadVocabWord();
  } else if (active === 'break') {
    const keys = Object.keys(BREAK_INFO);
    curBreak = keys[Math.floor(Math.random() * keys.length)];
    renderBreak();
  }
}

// ===== EVENT LISTENERS =====

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => goTab(tab)));
document.getElementById('vocabNextBtn').addEventListener('click', () => loadVocabWord());
document.getElementById('ssReset').addEventListener('click', () => {
  document.getElementById('ssUptime').textContent = '00:00';
  if (window.api) window.api.resetWatcherStats();
});

// Status bar dropdown
document.getElementById('status').addEventListener('click', toggleDropdown);
document.getElementById('stToggle').addEventListener('click', (e) => { e.stopPropagation(); toggleDropdown(); });

// Return overlay
document.getElementById('retGoBack').addEventListener('click', () => document.getElementById('returnOverlay').classList.remove('show'));
document.getElementById('retDismiss').addEventListener('click', () => document.getElementById('returnOverlay').classList.remove('show'));

// Window controls
document.getElementById('btnClose').addEventListener('click', () => { if (window.api) window.api.close(); });
document.getElementById('btnMinimize').addEventListener('click', () => { if (window.api) window.api.minimize(); });

// Dark mode toggle
let isDark = false;
document.getElementById('darkModeBtn').addEventListener('click', () => {
  isDark = !isDark;
  document.body.classList.toggle('dark', isDark);
  document.getElementById('darkModeBtn').textContent = isDark ? '☀️' : '🌙';
});

// Dynamic Island
document.getElementById('compactBtn').addEventListener('click', () => { if (window.api) window.api.toggleCompact(); });

// Compact Mode (stats only — hide tabs/feed, shrink window)
document.getElementById('compactModeBtn').addEventListener('click', toggleCompactView);

function toggleCompactView() {
  isCompactView = !isCompactView;
  const tabs = document.querySelector('.tabs');
  const scroll = document.getElementById('feedScroll');
  const btn = document.getElementById('compactModeBtn');

  if (isCompactView) {
    tabs.style.display = 'none';
    scroll.style.display = 'none';
    btn.textContent = 'Expand';
    if (!dropdownOpen) toggleDropdown();
    // Shrink window to fit just stats
    if (window.api) window.api.resizeWindow(420, 320);
  } else {
    tabs.style.display = '';
    scroll.style.display = '';
    btn.textContent = 'Compact';
    if (window.api) window.api.restoreWindow();
  }
}

// Opacity control
document.querySelectorAll('.opacity-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = parseFloat(btn.dataset.op);
    if (window.api) window.api.setOpacity(val);
    document.querySelectorAll('.opacity-btn').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  });
});

// Infinite scroll
document.getElementById('feedScroll').addEventListener('scroll', function () {
  if (this.scrollTop + this.clientHeight >= this.scrollHeight - 80) {
    if (document.getElementById('p-feed').classList.contains('on') && !feedLoading && !editingCategories) loadFeed(true);
  }
});

// External link bar click → open the article URL
document.addEventListener('click', (e) => {
  const linkBar = e.target.closest('.p-link');
  if (linkBar) {
    e.stopPropagation();
    const href = linkBar.dataset.href;
    if (href) {
      if (window.api) window.api.openExternal(href);
      else window.open(href, '_blank');
    }
    return;
  }
});

// Video play/pause on click
document.addEventListener('click', (e) => {
  const videoWrapper = e.target.closest('.p-video');
  if (videoWrapper) {
    e.stopPropagation();
    const video = videoWrapper.querySelector('video');
    if (video) {
      if (video.paused) {
        video.play();
        videoWrapper.classList.add('playing');
      } else {
        video.pause();
        videoWrapper.classList.remove('playing');
      }
    }
    return;
  }

  // Post click → open URL
  const post = e.target.closest('.post');
  if (!post || e.target.closest('.cat-item') || e.target.closest('.cat-arrow')) return;
  const url = post.dataset.url;
  if (url) { if (window.api) window.api.openExternal(url); else window.open(url, '_blank'); }
});

// Category selector: toggle + preview
document.addEventListener('click', (e) => {
  // Preview arrow
  const arrow = e.target.closest('[data-cat-preview]');
  if (arrow) { e.stopPropagation(); showCategoryPreview(arrow.dataset.catPreview); return; }
  // Toggle category
  const item = e.target.closest('.cat-item[data-cat]');
  if (item) {
    const name = item.dataset.cat;
    if (selectedCategories.has(name)) selectedCategories.delete(name); else selectedCategories.add(name);
    showCategorySelector();
  }
});

// Instance click → focus terminal
document.addEventListener('click', (e) => {
  const row = e.target.closest('.inst-row[data-pid]');
  if (row && window.api) {
    window.api.focusInstance(parseInt(row.dataset.pid));
  }
});

// Claude Code instance updates
if (window.api) {
  window.api.onClaudeInstances((snapshot) => updateStatusBar(snapshot));
}

// Tick durations every second (only re-renders when dropdown is visible or status has active/idle timers)
setInterval(() => {
  if (claudeSnapshot.count === 0) return;
  const subEl = document.getElementById('stSub');
  if (claudeSnapshot.anyActive) {
    updateActiveSubtext(subEl);
  } else {
    subEl.textContent = claudeSnapshot.instances.map(i => {
      if (i.idleStart) return `${i.project} (ready)`;
      return i.project;
    }).join(', ');
  }
  if (dropdownOpen) renderInstanceList();
}, 1000);

// ===== INIT =====

loadFeed(false);
renderBreak();
