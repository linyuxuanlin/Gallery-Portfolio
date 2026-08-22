import { analyzeBrew, diagnoseBrew } from './pour-brew-analysis.js';

function pct(v) {
  return Number.isFinite(v) ? `${Math.round(v * 100)}%` : '--';
}

function num(v, digits = 1) {
  return Number.isFinite(v) ? Number(v).toFixed(digits) : '--';
}

const ACTIONS = {
  'flow-unstable': {
    title: '先稳流速',
    action: '下一杯把目标设在 5.0 g/s，先练连续 10 秒不频繁修正倾角。',
    target: '流速稳定度 ≥ 75%',
  },
  'dwell-hotspot': {
    title: '减少定点冲刷',
    action: '保持落点连续移动，同一区域不要长时间停住；主体注水用平滑绕圈通过。',
    target: '停留集中度 ≤ 24%',
  },
  'edge-overuse': {
    title: '收回外圈',
    action: '主体轨迹尽量保持在粉床半径约 70% 内，贴近滤纸的位置快速掠过即可。',
    target: '外圈暴露 ≤ 18%',
  },
  'middle-underused': {
    title: '更多使用中圈',
    action: '主体注水让轨迹主要经过中圈，中心和外圈只作为过渡，不要长期锁在中心。',
    target: '中圈利用 ≥ 40%',
  },
  'coverage-low': {
    title: '先做足覆盖',
    action: '闷蒸先扩大有效浸润范围，再进入主体注水；不要只在中心堆水。',
    target: '粉床覆盖 ≥ 75%',
  },
  'uniformity-low': {
    title: '提高湿润均匀度',
    action: '降低固定点停留，绕圈速度保持连续，让各区域获得更接近的累计进水。',
    target: '粉床均匀度 ≥ 70%',
  },
  'bed-hotspot': {
    title: '避开热点重复冲击',
    action: '下一杯在热点区域减少停留时间，并让每圈落点持续推进，不重复冲同一点。',
    target: '热点比值 < 4.0',
  },
};

export function buildNextBrewActions(issues, limit = 2) {
  if (!Array.isArray(issues) || limit <= 0) return [];
  const seen = new Set();
  const actions = [];
  for (const issue of issues) {
    if (seen.has(issue.code)) continue;
    const preset = ACTIONS[issue.code];
    if (!preset) continue;
    seen.add(issue.code);
    actions.push({
      code: issue.code,
      severity: issue.severity,
      ...preset,
    });
    if (actions.length >= limit) break;
  }
  return actions;
}

export function buildBrewInsightModel(replayData) {
  const samples = replayData?.samples;
  const analysis = analyzeBrew(samples || []);
  if (!analysis.valid) return { valid: false, analysis, issues: [], actions: [], summary: '暂无足够数据生成诊断。' };

  const metrics = replayData?.metrics || {};
  const bed = replayData?.bed || {};
  const coverage = Number.isFinite(metrics.coverage) ? metrics.coverage : Number.isFinite(bed.coverage) ? bed.coverage : null;
  const uniformity = Number.isFinite(metrics.uniformity) ? metrics.uniformity : Number.isFinite(bed.uniformity) ? bed.uniformity : null;
  const hotspot = Number.isFinite(metrics.hotspot) ? metrics.hotspot : Number.isFinite(bed.hotspot) ? bed.hotspot : null;
  const issues = diagnoseBrew(analysis, { coverage, uniformity, hotspot });
  const actions = buildNextBrewActions(issues, 2);

  const summary = issues.length
    ? issues.slice(0, 2).map(issue => issue.message).join(' ')
    : '这一杯没有发现明显的轨迹或流速问题，可以尝试保持同样节奏重复一次。';

  return {
    valid: true,
    analysis,
    issues,
    actions,
    summary,
    stats: {
      flowStability: pct(analysis.flowStability),
      edgeExposure: pct(analysis.edgeExposure),
      middleUse: pct(analysis.radial.middle),
      dwellConcentration: pct(analysis.dwellConcentration),
      avgFlow: `${num(analysis.avgFlow)} g/s`,
      pauseCount: String(analysis.pauseCount),
    },
  };
}

function ensureStyle(documentLike) {
  if (documentLike.getElementById('pourBrewInsightsStyle')) return;
  const style = documentLike.createElement('style');
  style.id = 'pourBrewInsightsStyle';
  style.textContent = `.brew-insights{display:none;margin-top:9px;padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:#0003}.brew-insights.show{display:block}.brew-insights-title{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:10px;color:var(--muted);letter-spacing:.06em}.brew-insights-title b{font-size:11px;color:var(--text);letter-spacing:0}.brew-insights-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:7px}.brew-insight-stat{padding:6px;border-radius:9px;background:#fff1;text-align:center}.brew-insight-stat b{display:block;font-size:11px}.brew-insight-stat span{font-size:7px;color:var(--muted)}.brew-insights-copy{margin-top:7px;font-size:10px;line-height:1.45;color:var(--muted)}.brew-next{margin-top:8px;padding-top:8px;border-top:1px solid var(--line)}.brew-next-title{font-size:8px;color:var(--muted);letter-spacing:.08em}.brew-next-list{display:grid;gap:5px;margin-top:5px}.brew-next-item{padding:7px 8px;border-radius:9px;background:#fff1}.brew-next-item b{display:block;font-size:10px;color:var(--text)}.brew-next-item span{display:block;margin-top:3px;font-size:9px;line-height:1.4;color:var(--muted)}.brew-next-item em{display:block;margin-top:4px;font-size:8px;font-style:normal;color:var(--good)}@media(max-width:560px){.brew-insights-stats{grid-template-columns:repeat(2,1fr)}}`;
  documentLike.head.appendChild(style);
}

function ensurePanel(documentLike) {
  let panel = documentLike.getElementById('brewInsights');
  if (panel) return panel;
  const results = documentLike.getElementById('results');
  const host = results?.parentElement;
  if (!host) return null;
  panel = documentLike.createElement('div');
  panel.id = 'brewInsights';
  panel.className = 'brew-insights';
  panel.innerHTML = `<div class="brew-insights-title"><span>BREW ANALYSIS</span><b id="brewInsightsGrade">--</b></div><div class="brew-insights-stats"><div class="brew-insight-stat"><b id="brewInsightFlow">--</b><span>流速稳定</span></div><div class="brew-insight-stat"><b id="brewInsightEdge">--</b><span>外圈暴露</span></div><div class="brew-insight-stat"><b id="brewInsightMiddle">--</b><span>中圈利用</span></div><div class="brew-insight-stat"><b id="brewInsightDwell">--</b><span>停留集中</span></div><div class="brew-insight-stat"><b id="brewInsightAvgFlow">--</b><span>平均流速</span></div><div class="brew-insight-stat"><b id="brewInsightPauses">--</b><span>暂停次数</span></div></div><div class="brew-insights-copy" id="brewInsightsCopy"></div><div class="brew-next" id="brewNext"><div class="brew-next-title">NEXT BREW · 下一杯优先练</div><div class="brew-next-list" id="brewNextList"></div></div>`;
  results.insertAdjacentElement('afterend', panel);
  return panel;
}

function renderActions(documentLike, actions) {
  const host = documentLike.getElementById('brewNext');
  const list = documentLike.getElementById('brewNextList');
  if (!host || !list) return;
  list.replaceChildren();
  if (!actions.length) {
    host.style.display = 'none';
    return;
  }
  host.style.display = '';
  for (const action of actions) {
    const item = documentLike.createElement('div');
    item.className = 'brew-next-item';
    const title = documentLike.createElement('b');
    title.textContent = action.title;
    const copy = documentLike.createElement('span');
    copy.textContent = action.action;
    const target = documentLike.createElement('em');
    target.textContent = `目标：${action.target}`;
    item.append(title, copy, target);
    list.appendChild(item);
  }
}

export function renderBrewInsights(documentLike, replayData) {
  const panel = ensurePanel(documentLike);
  if (!panel) return { rendered: false, model: null };
  const model = buildBrewInsightModel(replayData);
  if (!model.valid) {
    panel.classList.remove('show');
    return { rendered: false, model };
  }

  documentLike.getElementById('brewInsightFlow').textContent = model.stats.flowStability;
  documentLike.getElementById('brewInsightEdge').textContent = model.stats.edgeExposure;
  documentLike.getElementById('brewInsightMiddle').textContent = model.stats.middleUse;
  documentLike.getElementById('brewInsightDwell').textContent = model.stats.dwellConcentration;
  documentLike.getElementById('brewInsightAvgFlow').textContent = model.stats.avgFlow;
  documentLike.getElementById('brewInsightPauses').textContent = model.stats.pauseCount;
  documentLike.getElementById('brewInsightsCopy').textContent = model.summary;
  documentLike.getElementById('brewInsightsGrade').textContent = model.issues[0]?.severity === 'high' ? '优先修正' : model.issues.length ? '可优化' : '稳定';
  renderActions(documentLike, model.actions);
  panel.classList.add('show');
  return { rendered: true, model };
}

export function installBrewInsights(documentLike = globalThis.document, storage = globalThis.localStorage) {
  if (!documentLike || documentLike.__pourBrewInsightsInstalled) return { installed: false };
  documentLike.__pourBrewInsightsInstalled = true;
  ensureStyle(documentLike);
  ensurePanel(documentLike);

  const readReplay = () => {
    try { return JSON.parse(storage?.getItem?.('pourLabLastBrew') || 'null'); }
    catch { return null; }
  };
  const update = () => {
    const results = documentLike.getElementById('results');
    const panel = documentLike.getElementById('brewInsights');
    if (!results?.classList.contains('show')) {
      panel?.classList.remove('show');
      return;
    }
    renderBrewInsights(documentLike, readReplay());
  };

  const results = documentLike.getElementById('results');
  if (results && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(update);
    observer.observe(results, { attributes: true, attributeFilter: ['class'] });
  }
  update();
  return { installed: true, update };
}
