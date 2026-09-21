const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const routes = require('../js/course');
const rendererModule = require('../js/renderer');
const progressModule = require('../js/progress');
const learningModule = require('../js/learning');
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
  assert.equal(plan.dataBoundary.evidenceSystemImplemented, true);
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
  task.criteria.forEach(item => {
    assert.equal(item.required, true, item.id);
  });
  assert.equal(plan.dataBoundary.taskCompletionUsesRequiredCriteriaOnly, true);
  assert.equal(plan.dataBoundary.conceptRecordsAreNotAdvancementGates, true);
  assert.equal(plan.dataBoundary.evidenceSourceIsNotOutcome, true);
  const numeric = task.criteria.find(item => item.id === 'numeric');
  assert.match(numeric.text, /NaN|Inf/);
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
  const helpStep = task.steps.find(item => item.title.includes('求助'));
  assert.ok(helpStep);
  assert.match(helpStep.body, /重新实现|换一组输入|换输入/);
  const variantStep = task.steps.find(item => item.title.includes('小变式'));
  assert.ok(variantStep);
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
  assert.equal(plan.tasks.length, 8);
  assert.equal(new Set(plan.tasks.map(item => item.id)).size, 8);
  const weeks = plan.tasks.map(item => item.weekBudget).sort((a, b) => a - b);
  assert.deepEqual(weeks, [1, 2, 3, 4, 5, 6, 7, 8]);
  const conceptIds = new Set(plan.concepts.map(item => item.id));
  plan.tasks.forEach(item => {
    assert.ok(item.workspace && item.workspace.where && item.workspace.inputs && item.workspace.outputs, item.id);
    assert.match(item.workspace.where, /空文件|本机|~\//);
    assert.doesNotMatch(item.workspace.where, /projects\/(?:log-analyzer|hf-mini-lab|llm-eval|rag-service|sft-lora|inference-benchmark)/);
    assert.ok(item.steps && item.steps.length >= 3, item.id);
    assert.ok(item.steps.some(step => /求助/.test(step.title)), item.id);
    assert.ok(item.criteria.some(row => row.required !== false), item.id);
    const ids = item.criteria.map(row => row.id);
    assert.equal(new Set(ids).size, ids.length, item.id);
    const requiredText = item.criteria.filter(row => row.required !== false).map(row => row.text).join('\n');
    assert.doesNotMatch(requiredText, /DDP|FlashAttention|GRPO/);
    item.conceptIds.forEach(id => assert.ok(conceptIds.has(id), `${item.id} 未知概念 ${id}`));
    item.criteria.forEach(row => {
      if (row.conceptId) assert.ok(conceptIds.has(row.conceptId), `${item.id} ${row.id}`);
    });
    (item.materials || []).forEach(material => {
      if (material.href) return;
      const chapter = byId[material.chapterId];
      assert.ok(chapter, `${item.id} ${material.chapterId}`);
      assert.ok(headingsFor(chapter.file).includes(material.section), `${item.id} ${material.chapterId} 缺少小节 ${material.section}`);
    });
  });
  const week3 = plan.tasks.find(item => item.weekBudget === 3);
  const gqa = week3.criteria.find(item => item.id === 'gqa-heads');
  assert.equal(gqa.required, false);
  assert.match(gqa.text, /不能阻挡|不阻挡/);
  const align = week3.criteria.find(item => item.id === 'next-token-align');
  assert.equal(align.required, true);
  assert.match(align.text, /只 shift 一次|只做一次/);
  assert.match(align.text, /不能先训练同位置/);
  const week3Text = [week3.goal, week3.workspace.inputs, week3.workspace.outputs]
    .concat(week3.steps.map(step => step.title + step.body), week3.criteria.map(row => row.text))
    .join('\n');
  assert.match(week3Text, /zero_grad/);
  assert.match(week3Text, /不启用梯度累积/);
  assert.match(week3Text, /下一 token|下一 token 标签/);
  assert.doesNotMatch(week3Text, /细节放到下周|先用同一序列做 next-token/);
  const week2 = plan.tasks.find(item => item.weekBudget === 2);
  assert.match(week2.workspace.outputs, /\[B, T, V\]/);
  assert.equal(week2.criteria.find(item => item.id === 'norm-rope-read').required, false);
  const assembled = week2.criteria.find(item => item.id === 'assembled-causal');
  assert.equal(assembled.required, true);
  assert.match(assembled.text, /dropout/i);
  assert.match(assembled.text, /atol \+ rtol \* abs/);
  assert.match(assembled.text, /完整模型|组装后/);
  const week2Text = week2.steps.map(step => step.title + step.body).concat(week2.criteria.map(row => row.text)).join('\n');
  assert.doesNotMatch(week2Text, /因果已在上周验|不要求本周再验因果|本周不用再验因果/);
  assert.match(week2Text, /不必重写 Attention|不要求重写 Attention/);
  const week8 = plan.tasks.find(item => item.weekBudget === 8);
  assert.equal(week8.criteria.find(item => item.id === 'cache-speed').required, false);
  const realAb = week8.criteria.find(item => item.id === 'real-ab-preds');
  assert.equal(realAb.required, true);
  assert.match(realAb.text, /真实/);
  assert.match(realAb.text, /checkpoint/);
  assert.match(realAb.text, /假输出/);
  const week7 = plan.tasks.find(item => item.weekBudget === 7);
  assert.match(week7.workspace.inputs, /假输出/);
  assert.match(week7.goal, /第 8 周/);
});

function loadPages(plan, planError, extra) {
  extra = extra || {};
  const vm = require('node:vm');
  const pagesSource = fs.readFileSync(path.resolve(__dirname, '..', 'js/pages.js'), 'utf8');
  const sandbox = { window: { CourseRoutes: routes } };
  vm.runInNewContext(pagesSource, sandbox);
  return sandbox.window.CoursePages({
    chapters,
    tracks,
    plan,
    planError,
    selectedTaskId: extra.selectedTaskId,
    learning: extra.learning,
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
  assert.match(home, /第 8 周/);
  assert.match(home, /data-week="2"/);
  assert.doesNotMatch(home, /自动测试通过/);
  assert.match(home, /未检查/);
  assert.match(home, /用户自报通过/);
  assert.match(home, /自己填写/);
  assert.match(home, /不是本站跑过的自动检查/);
  assert.match(home, /短记录/);
  assert.match(home, /简短依据/);
  assert.match(home, /保存本条记录/);
  assert.doesNotMatch(home, /进入下一任务/);
  assert.match(home, /分层求助/);
  assert.match(home, /小变式/);
  assert.doesNotMatch(home, /拓展（不挡完成）/);
  assert.doesNotMatch(home, /project-start/);
  assert.doesNotMatch(home, /log-analyzer|hf-mini-lab|llm-eval|rag-service|sft-lora|inference-benchmark/);
  assert.doesNotMatch(home, /taskId|criterionId|lab\.attention|<code>/);
  assert.doesNotMatch(home, /阶段 1|周预算|停在这里|自动切换/);
  const retired = pages.projects();
  assert.match(retired, /已退出主线/);
  assert.doesNotMatch(retired, /project-start/);
  assert.doesNotMatch(retired, /N 个可运行项目|个可运行项目/);
});

test('home can show another week without treating that as earlier completion', () => {
  const plan = require('../content/learning-plan.json');
  const week2 = loadPages(plan, null, { selectedTaskId: 'lab.decoder.min-lm' }).home(null);
  assert.match(week2, /拼最小 decoder/);
  assert.match(week2, /\[B, T, V\]/);
  assert.match(week2, /拓展（不挡完成）/);
  assert.match(week2, /data-week="2"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-week="2"/);
  assert.doesNotMatch(week2, /手写因果多头注意力/);
  assert.doesNotMatch(week2, /lab\.decoder|criterionId|<code>/);
  assert.match(week2, /不会把前面的周标成完成/);
  assert.match(week2, /组装后/);
  assert.match(week2, /atol \+ rtol \* abs/);
  assert.doesNotMatch(week2, /因果已在上周验|不要求本周再验因果/);
  const week3 = loadPages(plan, null, { selectedTaskId: 'lab.train.step-update' }).home(null);
  assert.match(week3, /一次参数更新/);
  assert.match(week3, /GQA/);
  assert.match(week3, /不能阻挡|不挡完成/);
  assert.match(week3, /拓展（不挡完成）/);
  assert.match(week3, /zero_grad/);
  assert.match(week3, /只做一次|只 shift 一次/);
  assert.doesNotMatch(week3, /自动测试通过/);
  assert.doesNotMatch(week3, /细节放到下周|先用同一序列做 next-token/);
  const week8 = loadPages(plan, null, { selectedTaskId: 'lab.experiment.one-variable' }).home(null);
  assert.match(week8, /真实 A\/B 预测|真实权重|真实 checkpoint/);
  assert.match(week8, /假输出/);
  assert.match(week8, /拓展（不挡完成）/);
  assert.doesNotMatch(week8, /自动测试通过/);
});

test('phase 3 design docs keep completion rules after the record layer', () => {
  const os = fs.readFileSync(path.resolve(__dirname, '..', 'docs/PERSONAL_LEARNING_OS.md'), 'utf8');
  const year = fs.readFileSync(path.resolve(__dirname, '..', 'docs/LEARNING_PLAN.md'), 'utf8');
  const impl = fs.readFileSync(path.resolve(__dirname, '..', 'docs/IMPLEMENTATION_PLAN.md'), 'utf8');
  const eightWeeks = year.split('## 6.')[0];
  assert.match(os, /全部必需验收项/);
  assert.match(os, /四个独立维度/);
  assert.match(os, /表示来源，\*\*不表示成功\*\*/);
  assert.match(os, /未检查/);
  assert.match(os, /未通过/);
  assert.match(os, /重新实现关键部分/);
  assert.match(os, /最小表单已实现|最小记录层/);
  assert.doesNotMatch(os, /本任务三条 criterion/);
  assert.doesNotMatch(os, /至少有「自己实现」或「能解释」的用户记录/);
  assert.match(year, /GQA 是拓展项/);
  assert.match(eightWeeks, /\*\*不能\*\*用这项阻挡本周核心任务完成/);
  assert.match(impl, /issue #3/);
  assert.match(impl, /issue #4/);
  assert.match(impl, /前八周任务写入/);
  assert.match(impl, /GQA 为拓展项/);
  assert.match(impl, /evidenceSystemImplemented.*true|已为 `true`/);
  assert.match(impl, /最小记录层|最小验收记录/);
  assert.match(impl, /阶段 3 第三步|教材任务上下文/);
  assert.match(impl, /组装后整模型因果性|组装后因果性/);
  assert.match(impl, /next-token 对齐/);
  assert.match(impl, /真实 A\/B/);
  assert.doesNotMatch(impl, /本轮实现阶段 3 功能/);
});

test('home keeps the current goal visible and folds detailed checks', () => {
  const plan = require('../content/learning-plan.json');
  const home = loadPages(plan).home(null);
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css/course.css'), 'utf8');
  const primaryAt = home.indexOf('打开必要教材');
  const foldAt = home.indexOf('class="home-fold"');
  const criteriaAt = home.indexOf('验收条件');
  assert.ok(primaryAt >= 0 && foldAt > primaryAt);
  assert.ok(criteriaAt > foldAt);
  assert.match(home, /<details class="home-fold"><summary>必要教材<\/summary>/);
  assert.match(home, /<details class="home-fold"><summary>短记录<\/summary>/);
  assert.match(home, /验收与记录（必需 0 \/ \d+ 条当前通过）/);
  assert.match(home, /保存本条记录/);
  assert.match(css, /\.home-fold:not\(\[open\]\)\s*>\s*\.fold-body\s*\{\s*display:\s*none/);
  assert.doesNotMatch(home, /taskId|criterionId|lab\.attention|<code>/);
});

test('textbook chapters show the current task and the next related section', () => {
  const plan = require('../content/learning-plan.json');
  const pages = loadPages(plan);
  const transformer = chapters.find(item => item.id === 'transformer');
  const map = chapters.find(item => item.id === 'map');
  const first = pages.lesson(transformer, null, '<p>body</p>', null, '7.4 Self-Attention 是什么 ★');
  assert.match(first, /class="task-context"/);
  assert.match(first, /手写因果多头注意力/);
  assert.match(first, /返回当前练习/);
  assert.match(first, /下一相关小节：7\.5 Q、K、V：三个投影/);
  assert.match(first, /写完后对照：7\.12/);
  assert.match(first, /全书下一课/);
  assert.doesNotMatch(first, /lab\.attention|<code>/);
  assert.doesNotMatch(first, /自动测试通过/);
  const lastRequired = pages.lesson(transformer, null, '<p>body</p>', null, '7.14 Multi-Head Attention ★');
  assert.match(lastRequired, /必要教材 · 6 \/ 6 · 7\.14/);
  assert.match(lastRequired, /下一相关小节：7\.12/);
  assert.match(lastRequired, /写完后对照：7\.12/);
  const lastCheck = pages.lesson(transformer, null, '<p>body</p>', null, '7.13 公式 ↔ 代码逐行对应 ★');
  assert.match(lastCheck, /返回当前练习/);
  assert.doesNotMatch(lastCheck, /下一相关小节/);
  assert.doesNotMatch(lastCheck, /写完后对照：/);
  const otherHeading = pages.lesson(transformer, null, '<p>body</p>', null, '7.6 为什么标准 Transformer 使用独立的 Q/K 投影？★');
  assert.match(otherHeading, /返回当前练习/);
  assert.doesNotMatch(otherHeading, /下一相关小节/);
  assert.doesNotMatch(otherHeading, /必要教材/);
  const unrelated = pages.lesson(map, null, '<p>body</p>', null);
  assert.match(unrelated, /手写因果多头注意力/);
  assert.match(unrelated, /返回当前练习/);
  assert.doesNotMatch(unrelated, /下一相关小节/);
  assert.doesNotMatch(unrelated, /写完后对照/);
  const week2 = loadPages(plan, null, { selectedTaskId: 'lab.decoder.min-lm' })
    .lesson(transformer, null, '<p>body</p>', null, '7.4 Self-Attention 是什么 ★');
  assert.match(week2, /拼最小 decoder/);
  assert.match(week2, /返回当前练习/);
  assert.doesNotMatch(week2, /下一相关小节/);
});

function softmaxRows(matrix) {
  return matrix.map(row => {
    const max = Math.max(...row);
    const exps = row.map(value => Math.exp(value - max));
    const sum = exps.reduce((total, value) => total + value, 0);
    return exps.map(value => value / sum);
  });
}

test('7.6 does not equate XX^T score symmetry with softmax attention symmetry', () => {
  const markdown = fs.readFileSync(path.join(CONTENT, '07-transformer.md'), 'utf8');
  const section = markdown.split(/^## 7\.6 /m)[1].split(/^## 7\.7 /m)[0];
  assert.match(section, /raw score/);
  assert.match(section, /softmax/);
  assert.match(section, /A_\{13\}/);
  assert.match(section, /A_\{31\}/);
  assert.match(section, /可以计算|可以共享|可以运行/);
  assert.match(section, /不保证/);
  assert.doesNotMatch(section, /不能 X·X/);
  assert.doesNotMatch(section, /^- \*\*不能用同一个矩阵投影 Q 和 K\*\*：/m);
  assert.doesNotMatch(section, /注意力矩阵就变成\*\*对称\*\*的：A 关注 B 多强，B 就关注 A 多强/);
  assert.doesNotMatch(section, /注意力矩阵恒为对称矩阵/);
  assert.doesNotMatch(section, /论文实验表明/);
  const scores = [[1, 0, 1], [0, 1, 1], [1, 1, 2]];
  const weights = softmaxRows(scores);
  assert.equal(scores[0][2], scores[2][0]);
  assert.ok(Math.abs(weights[0][2] - weights[2][0]) > 0.2, 'row-wise softmax of symmetric logits must yield A13 != A31');
  assert.ok(Math.abs(weights[0][2] - 0.422) < 0.001);
  assert.ok(Math.abs(weights[2][0] - 0.212) < 0.001);
  const quiz = markdown.split('而不是共享投影或直接用 X·Xᵀ')[1].slice(0, 700);
  assert.match(quiz, /答案: B/);
  assert.match(quiz, /共享投影可以运行/);
  assert.doesNotMatch(quiz, /权重被迫相同/);
});

test('README treats GitHub Pages as the current canonical entry', () => {
  const readme = fs.readFileSync(path.resolve(__dirname, '..', 'README.md'), 'utf8');
  const headline = readme.split('\n').find(line => line.includes('在线课程') || line.includes('当前课程入口'));
  assert.ok(headline);
  assert.match(headline, /xhr0417\.github\.io\/llm-course/);
  assert.doesNotMatch(headline, /^\s*🌐[^]*llm\.xhr0417\.cn[^]*镜像：\[GitHub Pages\]/);
  assert.match(readme, /待同步/);
  assert.match(readme, /llm\.xhr0417\.cn/);
  assert.match(readme, /tools\/publish\.sh/);
});

test('chapters 25-27 no longer assign the six old homework labs', () => {
  const files = [
    'content/25-python-engineering.md',
    'content/26-huggingface.md',
    'content/27-capstone-eval.md',
    'content/24-job-ready.md',
    'content/00-map.md'
  ];
  files.forEach((rel) => {
    const md = fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
    assert.doesNotMatch(md, /(^|\n):::lab\s/, rel + ' still has a Guided lab block');
    assert.doesNotMatch(md, /cd\s+projects\/(?:log-analyzer|hf-mini-lab|llm-eval)\/starter/, rel + ' still cds into an old starter');
    assert.match(md, /非当前作业|不是当前作业|查阅分组|小模型学习实验室/, rel + ' should say the old work is not current homework');
  });
  const pages = loadPages(require('../content/learning-plan.json'));
  const retired = pages.projects();
  assert.match(retired, /可选参考|不是当前作业/);
  assert.doesNotMatch(retired, /Guided Build 仍指向旧目录/);
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

test('home week picker switches the current exercise and remembers it', async () => {
  const app = harness.bootApp({ hash: '#/' });
  await harness.waitFor(() => /小模型学习实验室—Attention/.test(app.text()));
  const week2 = app.content.querySelector('[data-week="2"]');
  assert.ok(week2);
  week2.click();
  await harness.waitFor(() => /拼最小 decoder/.test(app.text()));
  assert.match(app.text(), /\[B, T, V\]/);
  assert.doesNotMatch(app.text(), /手写因果多头注意力/);
  assert.equal(app.content.querySelector('[data-week="2"]').getAttribute('aria-pressed'), 'true');
  assert.equal(app.localStorage.getItem('llm-course-current-task'), 'lab.decoder.min-lm');

  const week3 = app.content.querySelector('[data-week="3"]');
  week3.click();
  await harness.waitFor(() => /一次参数更新/.test(app.text()));
  assert.match(app.text(), /拓展（不挡完成）/);
  assert.match(app.text(), /GQA/);

  const restored = harness.bootApp({
    hash: '#/',
    storage: { 'llm-course-current-task': 'lab.decoder.min-lm' }
  });
  await harness.waitFor(() => /拼最小 decoder/.test(restored.text()));
  assert.doesNotMatch(restored.text(), /手写因果多头注意力/);
});

test('opening required material from home keeps task context on the chapter', async () => {
  const app = harness.bootApp({ hash: '#/' });
  await harness.waitFor(() => /打开必要教材/.test(app.text()));
  assert.match(app.html(), /class="home-fold"/);
  const start = app.content.querySelector('a.btn.primary');
  assert.ok(start);
  assert.match(start.getAttribute('href'), /transformer\?section=/);
  app.go(start.getAttribute('href'));
  await harness.waitFor(() => /返回当前练习/.test(app.text()));
  assert.match(app.text(), /手写因果多头注意力/);
  assert.match(app.text(), /下一相关小节/);
  assert.match(app.text(), /全书下一课|全书上一课/);
  const back = app.content.querySelector('.task-context a.btn');
  assert.equal(back.getAttribute('href'), '#/');
  app.go('#/');
  await harness.waitFor(() => /打开必要教材/.test(app.text()));
  assert.match(app.html(), /class="home-fold"/);
  assert.match(app.text(), /保存本条记录/);
});

test('in-chapter TOC and search update the task bar for the heading in view', async () => {
  const app = harness.bootApp({ hash: '#/' });
  await harness.waitFor(() => /打开必要教材/.test(app.text()));
  const start = app.content.querySelector('a.btn.primary');
  app.go(start.getAttribute('href'));
  await harness.waitFor(() => /必要教材 · 1 \/ 6/.test(app.text()));
  assert.match(app.text(), /下一相关小节：7\.5/);
  assert.equal(app.document.documentElement.style['--task-context-h'], '168px');

  const toc = app.byId('tocNav');
  const toLast = Array.from(toc.querySelectorAll('.toc-link')).find(link => /7\.14/.test(link.textContent));
  assert.ok(toLast);
  toLast.click();
  assert.match(app.text(), /必要教材 · 6 \/ 6 · 7\.14/);
  assert.match(app.text(), /下一相关小节：7\.12/);
  assert.doesNotMatch(app.text(), /下一相关小节：7\.5/);

  const toOther = Array.from(toc.querySelectorAll('.toc-link')).find(link => /7\.6/.test(link.textContent));
  assert.ok(toOther);
  toOther.click();
  assert.match(app.text(), /返回当前练习/);
  assert.doesNotMatch(app.text(), /下一相关小节/);
  assert.doesNotMatch(app.text(), /必要教材/);

  const search = app.byId('searchInput');
  search.value = '7.14 Multi-Head';
  search.dispatchEvent({ type: 'input', preventDefault: function () { this.defaultPrevented = true; } });
  await harness.waitFor(() => {
    const hits = app.byId('searchList').querySelectorAll('.search-hit');
    return hits.some(function (hit) { return /7\.14/.test(hit.textContent); });
  });
  const hit = Array.from(app.byId('searchList').querySelectorAll('.search-hit'))
    .find(item => /7\.14/.test(item.textContent));
  hit.click();
  assert.match(app.text(), /必要教材 · 6 \/ 6 · 7\.14/);
  assert.match(app.text(), /下一相关小节：7\.12/);
});

test('task heading scroll offset uses the measured sticky bar height', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css/course.css'), 'utf8');
  assert.match(css, /scroll-margin-top:\s*calc\(var\(--topbar-h\) \+ var\(--task-context-h/);
  assert.doesNotMatch(css, /12rem/);
  assert.match(fs.readFileSync(path.resolve(__dirname, '..', 'js/app.js'), 'utf8'), /measureTaskContext/);
  assert.match(fs.readFileSync(path.resolve(__dirname, '..', 'js/reader-ui.js'), 'utf8'), /onSection/);
});

function memoryStorage(seed) {
  const data = Object.assign(Object.create(null), seed || {});
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; }
  };
}

function fillEvidence(app, id, text) {
  const area = app.content.querySelector('textarea[data-evidence="' + id + '"]');
  assert.ok(area, id);
  area.value = text;
  area.dispatchEvent({ type: 'input', preventDefault: function () { this.defaultPrevented = true; } });
}

function clickChoice(app, check, value) {
  const input = app.content.querySelector('input[data-check="' + check + '"][value="' + value + '"]');
  assert.ok(input, check + '=' + value);
  input.click();
}

function saveCheck(app, id) {
  const button = app.content.querySelector('[data-save-check="' + id + '"]');
  assert.ok(button, 'save ' + id);
  button.click();
}

function unsavedNote(app, id) {
  return app.content.querySelector('[data-unsaved="' + id + '"]');
}

function passRequired(app, ids) {
  ids.forEach(id => {
    fillEvidence(app, id, '依据 ' + id);
    clickChoice(app, id, 'user_passed');
    saveCheck(app, id);
  });
}

test('learning completes a task only when every required item is currently user-passed', () => {
  const plan = require('../content/learning-plan.json');
  const storage = memoryStorage();
  const learning = learningModule.create({ storage });
  learning.load();
  const week1 = plan.tasks.find(item => item.weekBudget === 1);
  const week2 = plan.tasks.find(item => item.weekBudget === 2);
  assert.equal(learning.isTaskComplete(week1), false);
  assert.equal(learning.recordCriterion(week1.id, 'numeric', 'user_passed', ''), false);
  assert.equal(learning.currentResult(week1.id, 'numeric'), 'unchecked');
  assert.equal(learning.isTaskComplete(week1), false);
  learning.recordCriterion(week1.id, 'rewrite', 'failed', '数值对照失败，位置 attn.py');
  learning.recordCriterion(week1.id, 'rewrite', 'failed', '失败 D');
  learning.recordCriterion(week1.id, 'rewrite', 'failed', '失败 D');
  assert.equal(learning.currentEvidence(week1.id, 'rewrite'), '失败 D');
  assert.equal(learning.failedHistory(week1.id, 'rewrite').length, 1);
  assert.equal(learning.failedHistory(week1.id, 'rewrite')[0].evidence, '数值对照失败，位置 attn.py');
  assert.equal(learning.recordCriterion(week1.id, 'rewrite', 'user_passed', ''), false);
  assert.equal(learning.currentResult(week1.id, 'rewrite'), 'failed');
  assert.equal(learning.currentEvidence(week1.id, 'rewrite'), '失败 D');
  assert.equal(learning.isTaskComplete(week1), false);
  ['rewrite', 'shapes', 'causal'].forEach(id => learning.recordCriterion(week1.id, id, 'user_passed', '依据 ' + id));
  assert.equal(learning.currentEvidence(week1.id, 'rewrite'), '依据 rewrite');
  assert.deepEqual(
    learning.failedHistory(week1.id, 'rewrite').map(item => item.evidence),
    ['数值对照失败，位置 attn.py', '失败 D']
  );
  assert.equal(learning.isTaskComplete(week1), false);
  learning.recordCriterion(week1.id, 'numeric', 'user_passed');
  assert.equal(learning.isTaskComplete(week1), false);
  learning.recordCriterion(week1.id, 'numeric', 'user_passed', '   ');
  assert.equal(learning.isTaskComplete(week1), false);
  learning.recordCriterion(week1.id, 'numeric', 'user_passed', '固定输入对照通过');
  assert.equal(learning.isTaskComplete(week1), true);
  assert.equal(learning.currentResult(week1.id, 'rewrite'), 'user_passed');
  const saved = JSON.parse(storage.getItem(learningModule.KEY));
  assert.equal(saved.criteria[week1.id + '::rewrite'].current.source, 'user_reported');
  assert.deepEqual(
    saved.criteria[week1.id + '::rewrite'].history.map(item => item.evidence),
    ['数值对照失败，位置 attn.py', '失败 D']
  );

  ['read', 'implemented', 'verified', 'explained'].forEach(dim => {
    learning.setConceptDim('causal-mask', dim, true);
  });
  assert.equal(learning.isTaskComplete(week2), false);
  assert.equal(learning.currentResult(week2.id, 'assembled-causal'), 'unchecked');
  ['forward-btv', 'residual-head', 'assembled-causal'].forEach(id => {
    learning.recordCriterion(week2.id, id, 'user_passed', '依据 ' + id);
  });
  assert.equal(learning.isTaskComplete(week2), true);
  assert.equal(learning.currentResult(week2.id, 'norm-rope-read'), 'unchecked');

  const pages = loadPages(plan, null, { learning });
  const done = pages.home(null);
  assert.match(done, /进入下一任务/);
  assert.match(done, /不会自动跳转/);
  assert.match(done, /数值对照失败，位置 attn.py/);
  assert.doesNotMatch(done, /自动测试通过/);
  assert.doesNotMatch(done, /taskId|criterionId|lab\.attention|<code>/);
});

test('home record forms keep failures, isolate progress, and wait for confirm-next', async () => {
  const app = harness.bootApp({
    hash: '#/',
    storage: { 'llm-course-progress': JSON.stringify({ transformer: { read: true } }) }
  });
  await harness.waitFor(() => /小模型学习实验室—Attention/.test(app.text()));
  assert.match(app.text(), /未检查/);
  assert.doesNotMatch(app.text(), /进入下一任务/);
  assert.doesNotMatch(app.html(), /自动测试通过/);
  assert.doesNotMatch(app.html(), /taskId|criterionId|lab\.attention|<code>/);

  clickChoice(app, 'rewrite', 'user_passed');
  saveCheck(app, 'rewrite');
  await harness.waitFor(() => /需要写下简短依据/.test(app.text()));
  assert.equal(app.content.querySelector('input[data-check="rewrite"][value="user_passed"]').checked, true);
  assert.doesNotMatch(app.text(), /进入下一任务/);

  fillEvidence(app, 'rewrite', '数值对照失败，位置 attn.py');
  clickChoice(app, 'rewrite', 'failed');
  saveCheck(app, 'rewrite');
  fillEvidence(app, 'rewrite', '修复后对照通过');
  clickChoice(app, 'rewrite', 'user_passed');
  saveCheck(app, 'rewrite');
  await harness.waitFor(() => /曾经未通过/.test(app.text()));
  assert.match(app.text(), /数值对照失败，位置 attn.py/);
  assert.match(app.text(), /修复后对照通过/);
  assert.match(app.text(), /用户自报通过/);
  assert.doesNotMatch(app.text(), /进入下一任务/);

  const mask = app.content.querySelector('input[data-concept="causal-mask"][data-dim="implemented"]');
  assert.ok(mask);
  mask.click();
  passRequired(app, ['shapes', 'causal', 'numeric']);
  await harness.waitFor(() => app.byId('advanceTask'));
  assert.match(app.text(), /小模型学习实验室—Attention/);
  assert.match(app.text(), /需要你确认才会更换练习/);
  assert.equal(JSON.parse(app.localStorage.getItem('llm-course-progress')).transformer.read, true);

  app.byId('advanceTask').click();
  await harness.waitFor(() => /拼最小 decoder/.test(app.text()));
  assert.doesNotMatch(app.text(), /手写因果多头注意力/);
  assert.equal(app.content.querySelector('input[data-check="assembled-causal"][value="unchecked"]').checked, true);
  assert.equal(app.content.querySelector('input[data-concept="causal-mask"][data-dim="implemented"]').checked, true);
  assert.doesNotMatch(app.text(), /进入下一任务/);

  passRequired(app, ['forward-btv', 'residual-head', 'assembled-causal']);
  await harness.waitFor(() => app.byId('advanceTask'));
  assert.match(app.text(), /拓展未完成不阻挡/);
  assert.equal(app.content.querySelector('input[data-check="norm-rope-read"][value="unchecked"]').checked, true);

  const restored = harness.bootApp({
    hash: '#/',
    storage: {
      'llm-course-progress': app.localStorage.getItem('llm-course-progress'),
      'llm-course-learning': app.localStorage.getItem('llm-course-learning'),
      'llm-course-current-task': app.localStorage.getItem('llm-course-current-task')
    }
  });
  await harness.waitFor(() => /拼最小 decoder/.test(restored.text()));
  assert.match(restored.text(), /进入下一任务/);
  assert.equal(JSON.parse(restored.localStorage.getItem('llm-course-progress')).transformer.read, true);
  assert.equal(restored.content.querySelector('input[data-concept="causal-mask"][data-dim="implemented"]').checked, true);

  const week1Again = harness.bootApp({
    hash: '#/',
    storage: {
      'llm-course-progress': app.localStorage.getItem('llm-course-progress'),
      'llm-course-learning': app.localStorage.getItem('llm-course-learning'),
      'llm-course-current-task': 'lab.attention.causal-mha'
    }
  });
  await harness.waitFor(() => /手写因果多头注意力/.test(week1Again.text()));
  assert.match(week1Again.text(), /曾经未通过/);
  assert.match(week1Again.text(), /数值对照失败，位置 attn.py/);
  assert.match(week1Again.text(), /进入下一任务/);
});

test('learning save failure is visible and does not look like an automated pass', async () => {
  const app = harness.bootApp({
    hash: '#/',
    failKeys: ['llm-course-learning']
  });
  await harness.waitFor(() => /小模型学习实验室—Attention/.test(app.text()));
  fillEvidence(app, 'rewrite', '依据 rewrite');
  clickChoice(app, 'rewrite', 'user_passed');
  saveCheck(app, 'rewrite');
  await harness.waitFor(() => /学习记录无法保存/.test(app.byId('storageNotice').textContent || ''));
  assert.equal(app.byId('storageNotice').hidden, false);
  assert.equal(app.content.querySelector('input[data-check="rewrite"][value="user_passed"]').checked, true);
  assert.doesNotMatch(app.html(), /自动测试通过/);
  assert.match(app.text(), /自己填写/);
  passRequired(app, ['shapes', 'causal', 'numeric']);
  await harness.waitFor(() => app.byId('advanceTask'));
  assert.match(app.text(), /小模型学习实验室—Attention/);
  assert.equal(app.localStorage.getItem('llm-course-learning'), null);
});

test('saving a check keeps evidence-only edits and consecutive fail snapshots', async () => {
  const app = harness.bootApp({ hash: '#/' });
  await harness.waitFor(() => /小模型学习实验室—Attention/.test(app.text()));

  fillEvidence(app, 'rewrite', '失败 C');
  clickChoice(app, 'rewrite', 'failed');
  assert.equal(unsavedNote(app, 'rewrite').hidden, false);
  app.content.querySelector('[data-week="2"]').click();
  await harness.waitFor(() => /拼最小 decoder/.test(app.text()));
  app.content.querySelector('[data-week="1"]').click();
  await harness.waitFor(() => /手写因果多头注意力/.test(app.text()));
  assert.equal(app.content.querySelector('textarea[data-evidence="rewrite"]').value, '失败 C');
  assert.equal(unsavedNote(app, 'rewrite').hidden, false);
  assert.equal(app.localStorage.getItem(learningModule.KEY), null);

  saveCheck(app, 'rewrite');
  await harness.waitFor(() => unsavedNote(app, 'rewrite') && unsavedNote(app, 'rewrite').hidden);
  assert.equal(JSON.parse(app.localStorage.getItem(learningModule.KEY)).criteria['lab.attention.causal-mha::rewrite'].current.evidence, '失败 C');

  fillEvidence(app, 'rewrite', '失败 D');
  assert.equal(unsavedNote(app, 'rewrite').hidden, false);
  saveCheck(app, 'rewrite');
  await harness.waitFor(() => /曾经未通过/.test(app.text()) && /失败 C/.test(app.text()));
  assert.equal(app.content.querySelector('textarea[data-evidence="rewrite"]').value, '失败 D');
  assert.equal(unsavedNote(app, 'rewrite').hidden, true);

  const afterEvidenceEdit = harness.bootApp({
    hash: '#/',
    storage: { 'llm-course-learning': app.localStorage.getItem(learningModule.KEY) }
  });
  await harness.waitFor(() => /手写因果多头注意力/.test(afterEvidenceEdit.text()));
  assert.equal(afterEvidenceEdit.content.querySelector('textarea[data-evidence="rewrite"]').value, '失败 D');
  assert.match(afterEvidenceEdit.text(), /失败 C/);
  assert.doesNotMatch(afterEvidenceEdit.html(), /taskId|criterionId|lab\.attention|<code>/);

  fillEvidence(afterEvidenceEdit, 'rewrite', '');
  clickChoice(afterEvidenceEdit, 'rewrite', 'user_passed');
  saveCheck(afterEvidenceEdit, 'rewrite');
  await harness.waitFor(() => /需要写下简短依据/.test(afterEvidenceEdit.text()));
  assert.equal(afterEvidenceEdit.content.querySelector('textarea[data-evidence="rewrite"]').value, '');
  const kept = JSON.parse(afterEvidenceEdit.localStorage.getItem(learningModule.KEY)).criteria['lab.attention.causal-mha::rewrite'];
  assert.equal(kept.current.result, 'failed');
  assert.equal(kept.current.evidence, '失败 D');
  assert.equal(kept.history[0].evidence, '失败 C');

  fillEvidence(afterEvidenceEdit, 'rewrite', '通过 E');
  clickChoice(afterEvidenceEdit, 'rewrite', 'user_passed');
  saveCheck(afterEvidenceEdit, 'rewrite');
  await harness.waitFor(() => /通过 E/.test(afterEvidenceEdit.content.querySelector('textarea[data-evidence="rewrite"]').value));
  const passed = JSON.parse(afterEvidenceEdit.localStorage.getItem(learningModule.KEY)).criteria['lab.attention.causal-mha::rewrite'];
  assert.equal(passed.current.result, 'user_passed');
  assert.equal(passed.current.evidence, '通过 E');
  assert.deepEqual(passed.history.filter(item => item.result === 'failed').map(item => item.evidence), ['失败 C', '失败 D']);
  assert.match(afterEvidenceEdit.text(), /失败 C/);
  assert.match(afterEvidenceEdit.text(), /失败 D/);
  assert.doesNotMatch(afterEvidenceEdit.text(), /进入下一任务/);
  assert.doesNotMatch(afterEvidenceEdit.html(), /自动测试通过/);
});
