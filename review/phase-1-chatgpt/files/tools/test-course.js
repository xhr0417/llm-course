const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const routes = require('../js/course');
const rendererModule = require('../js/renderer');
const progressModule = require('../js/progress');
const marked = require('../vendor/marked.min.js');
const katex = require('../vendor/katex/katex.js');
const { chapters } = require('../content/manifest.json');
const { tracks } = require('../content/tracks.json');
const { references } = require('../content/references.json');

const CONTENT = path.resolve(__dirname, '..', 'content');
const interactiveRenderer = rendererModule.create({ marked, katex });
const staticRenderer = rendererModule.create({ marked, katex, mode: 'static' });
test('application navigation follows the selected route rather than chapter numbering', () => {
  const track = routes.trackFor(tracks, 'application');
  const route = routes.parse(routes.href('python-engineering', track));
  assert.equal(routes.context(tracks, route), track);
  assert.deepEqual(routes.neighbors(chapters, track, route.page), { previous: null, next: 'pytorch' });
});
test('book links stay in book order and invalid route contexts fall back to book', () => {
  assert.equal(routes.parse('#/python-engineering').trackId, null);
  assert.equal(routes.context(tracks, { page: 'basics', trackId: 'application' }), null);
  assert.equal(routes.context(tracks, { page: 'pytorch', trackId: 'missing' }), null);
  assert.equal(routes.neighbors(chapters, null, 'python-engineering').next, 'huggingface');
});
test('route boundaries stop and links to outside chapters do not carry a misleading track', () => {
  tracks.forEach(track => {
    assert.equal(routes.neighbors(chapters, track, track.chapters[0]).previous, null);
    assert.equal(routes.neighbors(chapters, track, track.chapters.at(-1)).next, null);
    assert.equal(routes.href('map', track), '#/map');
  });
});
test('every route references unique existing chapters', () => {
  tracks.forEach(track => {
    assert.equal(new Set(track.chapters).size, track.chapters.length);
    track.chapters.forEach(id => assert.ok(chapters.some(chapter => chapter.id === id), id));
  });
});
test('resume rejects stale or broken storage and preserves a valid route', () => {
  const storage = value => ({ getItem: () => value });
  assert.equal(routes.readLast(storage('{bad'), chapters, tracks), null);
  assert.equal(routes.readLast(storage('{"chapterId":"gone"}'), chapters, tracks), null);
  assert.deepEqual(routes.readLast(storage('{"chapterId":"pytorch","trackId":"infra"}'), chapters, tracks), { chapterId:'pytorch', trackId:'infra' });
  assert.deepEqual(routes.readLast(storage('{"chapterId":"basics","trackId":"infra"}'), chapters, tracks), { chapterId:'basics', trackId:null });
});

test('shared renderer keeps interactive controls and static links in their respective modes', () => {
  const markdown = [
    '# Demo',
    '',
    ':::lab A small lab',
    'goal: Render both modes',
    ':::step 1 Write it',
    ':::write',
    'Implement the function.',
    ':::',
    ':::solution',
    '```python',
    'print("ok")',
    '```',
    ':::',
    ':::',
    ':::',
    '',
    ':::demo attention Attention demo',
    'Caption.',
    ':::',
  ].join('\n');
  const interactive = interactiveRenderer.renderMarkdown(markdown, 'transformer');
  const statik = staticRenderer.renderMarkdown(markdown, 'transformer');

  assert.match(interactive, /data-demo="attention"/);
  assert.match(interactive, /data-step-id="s1"/);
  assert.match(interactive, /class="gs-btn primary"/);
  assert.doesNotMatch(statik, /data-demo="attention"/);
  assert.match(statik, /index\.html#\/transformer/);
  assert.match(statik, /data-step-id="s1"/);
  assert.doesNotMatch(statik, /@@(CT|PH)\d+@@|:::/);
});

test('progress preserves legacy completion data and keeps storage failures non-fatal', () => {
  let value = JSON.stringify({
    basics: true,
    huggingface: { read: true, guided: { steps: { s1: 'done', s2: 'invalid' }, ran: true } },
  });
  const storage = {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
  };
  const progress = progressModule.create({ storage });
  progress.load();
  assert.equal(progress.isRead('basics'), true);
  assert.equal(progress.isRead('huggingface'), true);
  assert.deepEqual(progress.guidedState('huggingface'), { steps: { s1: 'done' }, ran: true, explained: false });

  progress.toggleRead('basics');
  assert.equal(progress.isRead('basics'), false);

  const failing = progressModule.create({ storage: { getItem: () => { throw new Error('blocked'); } } });
  failing.load();
  assert.equal(failing.storageStatus().persistent, false);
  assert.doesNotThrow(() => failing.toggleRead('basics'));
});

test('default create uses global localStorage without an injected storage option', () => {
  const memory = {
    'llm-course-progress': JSON.stringify({
      transformer: { read: true },
      pytorch: { read: true }
    })
  };
  const globalStorage = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    },
    setItem(key, value) {
      memory[key] = String(value);
    },
    removeItem(key) {
      delete memory[key];
    }
  };
  const previous = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage')
    ? globalThis.localStorage
    : undefined;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: globalStorage
  });
  try {
    const first = progressModule.create();
    first.load();
    assert.equal(first.storageStatus().persistent, true);
    assert.equal(first.isRead('transformer'), true);
    assert.equal(first.isRead('pytorch'), true);
    first.toggleRead('rl-grpo');
    assert.equal(first.isRead('rl-grpo'), true);
    assert.equal(first.isRead('transformer'), true);
    const saved = JSON.parse(memory['llm-course-progress']);
    assert.equal(saved.transformer.read, true);
    assert.equal(saved.pytorch.read, true);
    assert.equal(saved['rl-grpo'].read, true);

    const second = progressModule.create();
    second.load();
    assert.equal(second.isRead('transformer'), true);
    assert.equal(second.isRead('pytorch'), true);
    assert.equal(second.isRead('rl-grpo'), true);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});

test('route content and reference pages have one data source', () => {
  interactiveRenderer.setCatalog({ chapters, tracks });
  const routeHtml = interactiveRenderer.renderMarkdown(':::routes compact\n:::', 'map');
  assert.match(routeHtml, /AI 应用开发/);
  assert.match(routeHtml, /#\/python-engineering/);
  references.forEach(reference => {
    assert.ok(chapters.some(chapter => chapter.id === reference.chapter), reference.chapter);
    assert.match(reference.file, /^references\/[\w-]+\.md$/);
  });
});

test('every :::reference container points at a declared reference in both modes', () => {
  const ids = new Set(references.map(reference => reference.id));
  chapters.forEach(chapter => {
    const markdown = fs.readFileSync(path.join(CONTENT, chapter.file), 'utf8');
    const containers = [...markdown.matchAll(/^:::reference\s+(\S+)\s*$/gm)].map(match => match[1]);
    containers.forEach(id => {
      assert.ok(ids.has(id), `${chapter.file} 引用了未声明的参考手册 "${id}"`);
      assert.match(interactiveRenderer.renderMarkdown(`:::reference ${id}\n打开\n:::`, chapter.id),
        new RegExp(`href="#/reference/${id}"`));
      assert.match(staticRenderer.renderMarkdown(`:::reference ${id}\n打开\n:::`, chapter.id),
        new RegExp(`href="reference-${id}\\.html"`));
    });
  });
  references.forEach(reference => {
    const chapter = chapters.find(item => item.id === reference.chapter);
    const markdown = fs.readFileSync(path.join(CONTENT, chapter.file), 'utf8');
    assert.match(markdown, new RegExp(`^:::reference ${reference.id}$`, 'm'),
      `${chapter.file} 没有链接到它的参考手册 ${reference.id}`);
  });
});

test('小节定位的滚动必须显式指定 behavior', () => {
  const read = name => fs.readFileSync(path.resolve(__dirname, '..', name), 'utf8');
  // 只要全局还开着平滑滚动，继承 behavior 的 scrollIntoView 就会被丢弃，搜索结果只能停在页顶。
  assert.match(read('css/style.css'), /html\s*\{[^}]*scroll-behavior:\s*smooth/);
  [...read('js/reader-ui.js').matchAll(/scrollIntoView\(([^)]*)\)/g)].forEach(([call, args]) => {
    assert.match(args, /behavior:/, `reader-ui.js 的 ${call} 会继承 css 的平滑滚动而失效`);
  });
  assert.doesNotMatch(read('js/app.js'), /updateProgress\(\); window\.scrollTo\(\{ top: 0 \}\)/,
    'route() 渲染后的归零滚动紧接着 focusSection，必须是 instant，否则两个动画互相取消');
});

test('chapter links can carry a section query for textbook headings', () => {
  const href = routes.href('transformer', null, '7.4 Self-Attention 是什么 ★');
  const parsed = routes.parse(href);
  assert.equal(parsed.page, 'transformer');
  assert.equal(parsed.trackId, null);
  assert.equal(parsed.section, '7.4 Self-Attention 是什么 ★');
  const withTrack = routes.href('pytorch', routes.trackFor(tracks, 'application'), '11.3 形状变换四件套（LLM 代码的重灾区）');
  const parsedTrack = routes.parse(withTrack);
  assert.equal(parsedTrack.trackId, 'application');
  assert.equal(parsedTrack.section, '11.3 形状变换四件套（LLM 代码的重灾区）');
});

test('learning plan current task is executable Attention and points at real headings', () => {
  const plan = require('../content/learning-plan.json');
  const byId = Object.fromEntries(chapters.map(chapter => [chapter.id, chapter]));
  assert.equal(plan.currentStageId, 'lab');
  assert.equal(plan.currentTaskId, 'lab.attention.causal-mha');
  assert.equal(plan.dataBoundary.evidenceSystemImplemented, false);
  assert.deepEqual(plan.dataBoundary.criterionEvidenceKey, ['taskId', 'criterionId']);
  assert.equal(plan.dataBoundary.conceptEvidenceDoesNotCompleteTasks, true);
  const task = plan.tasks.find(item => item.id === plan.currentTaskId);
  assert.ok(task);
  assert.equal(task.stageId, 'lab');
  ['attention', 'causal-mask', 'tensor-shape'].forEach(id => {
    assert.ok(task.conceptIds.includes(id), id);
  });
  const criterionIds = task.criteria.map(item => item.id);
  assert.equal(new Set(criterionIds).size, criterionIds.length);
  ['rewrite', 'shapes', 'causal', 'numeric'].forEach(id => {
    assert.ok(criterionIds.includes(id), id);
  });
  const numeric = task.criteria.find(item => item.id === 'numeric');
  assert.match(numeric.text, /dropout/i);
  assert.match(numeric.text, /单头/);
  assert.match(numeric.text, /多头/);
  assert.match(numeric.text, /atol \+ rtol \* abs/);
  assert.match(numeric.text, /dtype/);
  assert.match(numeric.text, /拆头/);
  assert.match(numeric.text, /无因果掩码|无掩码/);
  assert.doesNotMatch(numeric.text, /两道门/);
  assert.doesNotMatch(numeric.text, /softmax\(|QK/);
  assert.doesNotMatch(numeric.text, /7\.12[\s\S]{0,40}1e-5|1e-5[\s\S]{0,40}7\.12/);
  const handcalc = task.materials.find(item => item.section && item.section.startsWith('7.12'));
  assert.ok(handcalc);
  assert.match(handcalc.label, /无掩码/);
  assert.doesNotMatch(handcalc.label, /1e-5/);
  const checkStep = task.steps.find(item => item.title.includes('检查单头'));
  assert.match(checkStep.body, /atol \+ rtol \* abs/);
  assert.doesNotMatch(checkStep.body, /两道门/);
  assert.match(checkStep.body, /不是因果|不能当/);
  const multiStep = task.steps.find(item => item.title.includes('多头'));
  assert.match(multiStep.body, /拆头顺序|输出投影/);
  task.criteria.forEach(item => {
    assert.ok(item.id && item.text && item.label);
    if (item.conceptId) assert.ok(plan.concepts.some(concept => concept.id === item.conceptId), item.conceptId);
  });
  assert.match(task.workspace.where, /空文件/);
  assert.match(task.workspace.inputs, /\[B, T, D\]/);
  assert.match(task.workspace.outputs, /\[B, T, D\]/);
  assert.ok(task.steps.length >= 4);
  const headingCache = {};
  function headingsFor(file) {
    if (!headingCache[file]) {
      const markdown = fs.readFileSync(path.join(CONTENT, file), 'utf8');
      headingCache[file] = [...markdown.matchAll(/^#{2,6}\s+(.+?)\s*$/gm)].map(match => match[1].replace(/\s+#+\s*$/, '').trim());
    }
    return headingCache[file];
  }
  task.materials.forEach(item => {
    if (item.href) return;
    const chapter = byId[item.chapterId];
    assert.ok(chapter, item.chapterId);
    assert.ok(headingsFor(chapter.file).includes(item.section), `${item.chapterId} 缺少小节 ${item.section}`);
  });
});

function loadPages(plan, planError) {
  const vm = require('node:vm');
  const pagesSource = fs.readFileSync(path.resolve(__dirname, '..', 'js/pages.js'), 'utf8');
  const sandbox = { window: { CourseRoutes: routes } };
  vm.runInNewContext(pagesSource, sandbox);
  return sandbox.window.CoursePages({
    chapters,
    tracks,
    plan,
    planError,
    references,
    progress: { isRead: () => false },
    escapeHtml: value => String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
  });
}

test('primary entry shows the Attention lab and retires homework projects from main nav', () => {
  const indexHtml = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const plan = require('../content/learning-plan.json');
  assert.match(indexHtml, /<a href="#\/">我的学习<\/a>/);
  assert.match(indexHtml, /<a href="#\/catalog">全部章节<\/a>/);
  assert.doesNotMatch(indexHtml, /href="#\/projects">实战项目/);
  const pages = loadPages(plan);
  const home = pages.home(null);
  assert.match(home, /小模型学习实验室—Attention/);
  assert.match(home, /手写因果多头注意力/);
  assert.match(home, /必要教材/);
  assert.match(home, /验收条件/);
  assert.match(home, /数值正确性/);
  assert.match(home, /atol \+ rtol \* abs/);
  assert.doesNotMatch(home, /两道门/);
  assert.match(home, /无掩码/);
  assert.match(home, /#\/transformer\?section=/);
  assert.doesNotMatch(home, /7\.12[\s\S]{0,80}1e-5|1e-5[\s\S]{0,80}7\.12/);
  assert.doesNotMatch(home, /自动测试通过/);
  assert.doesNotMatch(home, /project-start/);
  assert.doesNotMatch(home, /log-analyzer|hf-mini-lab|llm-eval|rag-service|sft-lora|inference-benchmark/);
  assert.doesNotMatch(home, /taskId|criterionId|lab\.attention|<code>/);
  assert.doesNotMatch(home, /阶段 1|周预算|停在这里|自动切换/);
  const retired = pages.projects();
  assert.match(retired, /已退出主线/);
  assert.doesNotMatch(retired, /project-start/);
  assert.doesNotMatch(retired, /N 个可运行项目|个可运行项目/);
});

test('catalog search and chapters boot even if learning-plan.json fails', () => {
  const pages = loadPages(null, { message: '无法加载 content/learning-plan.json' });
  const home = pages.home(null);
  assert.match(home, /没有加载到学习计划/);
  assert.match(home, /id="retryPlan"/);
  assert.match(home, /全部章节/);
  assert.match(home, /搜索仍然可用/);
  assert.doesNotMatch(home, /手写因果多头注意力/);
  const catalog = pages.catalog();
  assert.match(catalog, /全部章节/);
  assert.ok(catalog.includes('Transformer') || catalog.includes('课程'));
});

const harness = require('./test-app-harness');

test('plan request can fail then retry while catalog routing and search stay up', async () => {
  const app = harness.bootApp({
    fetch: harness.createFetch({ planFailUntil: 1 }),
    hash: '#/'
  });
  await harness.waitFor(() => /没有加载到学习计划|重新加载当前练习/.test(app.text()));
  assert.match(app.html(), /id="retryPlan"/);
  assert.doesNotMatch(app.text(), /手写因果多头注意力/);

  app.go('#/catalog');
  await harness.settle();
  assert.match(app.text(), /全部章节/);
  assert.match(app.text(), /Transformer/);

  const input = app.byId('searchInput');
  input.value = 'GRPO-TOKEN';
  input.dispatchEvent({ type: 'input', preventDefault() {} });
  await harness.waitFor(() => /找到 \d+ 条/.test(app.byId('searchSummary').textContent || ''));
  assert.equal(app.byId('searchResults').hidden, false);
  assert.ok(app.byId('searchList').querySelector('.search-hit'));

  app.go('#/');
  await harness.waitFor(() => app.byId('retryPlan'));
  app.byId('retryPlan').click();
  await harness.waitFor(() => /小模型学习实验室—Attention/.test(app.text()));
  assert.match(app.text(), /数值正确性/);
  assert.match(app.text(), /atol/);
});

test('late plan success or failure does not rerender an open chapter', async () => {
  async function openChapterDuringPlan(planError) {
    let release;
    const planGate = new Promise(resolve => { release = resolve; });
    const app = harness.bootApp({
      fetch: harness.createFetch({ planGate, planError }),
      hash: '#/'
    });
    await harness.waitFor(() => /正在载入当前练习/.test(app.text()));
    app.go('#/transformer');
    await harness.waitFor(() => /id="markRead"/.test(app.html()));
    const html = app.html();
    const writes = app.writes();
    release();
    await harness.settle(12);
    assert.equal(app.writes(), writes, planError ? 'plan failure rerendered the chapter' : 'plan success rerendered the chapter');
    assert.equal(app.html(), html);
    assert.match(app.html(), /id="markRead"/);
    app.go('#/');
    await harness.settle(8);
    if (planError) assert.match(app.text(), /没有加载到学习计划|重新加载当前练习/);
    else assert.match(app.text(), /小模型学习实验室—Attention/);
  }
  await openChapterDuringPlan(false);
  await openChapterDuringPlan(true);
});
