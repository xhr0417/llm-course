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
  task.criteria.forEach(item => {
    assert.ok(item.id && item.text);
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

test('primary entry shows the Attention lab and retires homework projects from main nav', () => {
  const vm = require('node:vm');
  const indexHtml = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  const pagesSource = fs.readFileSync(path.resolve(__dirname, '..', 'js/pages.js'), 'utf8');
  const plan = require('../content/learning-plan.json');
  assert.match(indexHtml, /<a href="#\/">我的学习<\/a>/);
  assert.match(indexHtml, /<a href="#\/catalog">全部章节<\/a>/);
  assert.doesNotMatch(indexHtml, /href="#\/projects">实战项目/);
  const sandbox = { window: { CourseRoutes: routes } };
  vm.runInNewContext(pagesSource, sandbox);
  const pages = sandbox.window.CoursePages({
    chapters,
    tracks,
    plan,
    references,
    progress: { isRead: () => false },
    escapeHtml: value => String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
  });
  const home = pages.home(null);
  assert.match(home, /小模型学习实验室—Attention/);
  assert.match(home, /手写因果多头注意力/);
  assert.match(home, /必要教材/);
  assert.match(home, /验收条件/);
  assert.match(home, /#\/transformer\?section=/);
  assert.doesNotMatch(home, /自动测试通过/);
  assert.doesNotMatch(home, /project-start/);
  assert.doesNotMatch(home, /log-analyzer|hf-mini-lab|llm-eval|rag-service|sft-lora|inference-benchmark/);
  const retired = pages.projects();
  assert.match(retired, /已退出主线/);
  assert.doesNotMatch(retired, /project-start/);
  assert.doesNotMatch(retired, /N 个可运行项目|个可运行项目/);
});
