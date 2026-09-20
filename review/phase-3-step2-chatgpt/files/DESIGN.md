# LLM Course design contract

## 1. Identity
Preserve the existing Chinese textbook appearance, light/dark themes and interactive demonstrations. The primary reader follows one personal learning spine; the next action comes from「我的学习」and its current task, not from choosing among three job tracks. Returning readers need to resume a textbook chapter without that resume being treated as mastery. Experienced readers need a searchable reference. Reduce repeated navigation and administrative learning terminology. This is an extraction of the current system, not a visual rebrand.

## 2. Color
Use the existing paired light/dark variables in `css/style.css`: `--bg`, `--bg-panel`, `--bg-soft`, `--text`, `--text-soft`, `--text-faint`, `--border`, `--accent`, `--accent-soft`, `--accent-text`, `--green`, `--green-soft`, `--amber`, `--amber-soft`, `--red`, `--red-soft`, `--purple`, `--purple-soft`, `--code-bg`, `--shadow`. New navigation uses the accent only for links, current state and the primary action. Text conveying information uses `--text` or `--text-soft`, not the faint decorative color. Preserve semantic colors in existing teaching diagrams.

## 3. Typography
Keep the system CJK stack and monospace code stack. New UI tokens: `--text-xs:12px`, `--text-sm:14px`, `--text-base:16px`, `--text-lg:20px`, `--text-title:32px`. Body line height 1.75; titles 1.35. Use one H1 per page. Sidebar uses concise chapter labels; full descriptive titles belong to lesson headers. No new web fonts.

## 4. Spacing and layout
New spacing tokens: `--space-1:4px`, `--space-2:8px`, `--space-3:12px`, `--space-4:16px`, `--space-6:24px`, `--space-8:32px`, `--space-12:48px`. Keep `--radius:12px`, `--sidebar-w:288px`, `--toc-w:232px`, `--topbar-h:58px`. Document scroll owns the main reading surface; sidebar and TOC own independent scroll. Entry pages omit the empty right TOC column. Route rows stack naturally and wrap long Chinese titles. Mobile at 375px uses the existing drawer and a single column; tablet 768px and desktop 1280px must remain readable without page-level horizontal overflow.

## 5. Shared components
- Page header: eyebrow, single title, short description. No repeated H1 from Markdown.
- Primary action: existing `.btn`, one prominent start/resume action per entry page. Hover, pressed and keyboard focus visible. Links navigate; buttons change state. On「我的学习」, the primary button opens the current task’s first required textbook section; parallel basics are secondary links.
- Route list: the home page no longer presents three job tracks as the main choice. Remaining track pages are lookup groupings, not the progress spine.
- Lesson list: the current task comes from `content/learning-plan.json`. On「我的学习」, the reader can manually pick another week of the same spine; this only changes which exercise is shown and does not mark earlier weeks complete. Required checks use 未检查 / 未通过 / 用户自报通过; stretch uses the same choices and does not block completion. Concept dimensions are independent checkboxes and are not a second gate. After every required item is currently self-reported as passed, a confirmation control appears; the page does not auto-advance. Catalog and track lists may still use `content/tracks.json` or the full book. Read status is text as well as color and means only “read”, never “task complete”. Footer navigation retains route context when a lookup track is open. Catalog navigation explicitly follows the full book.
- Reference disclosure: native `details/summary` using `.fold`; collapsed by default, keyboard operable, linked headings automatically open ancestor disclosures before scrolling.
- Guided project: existing `.guided-lab`, `.guided-step`, `.gs-btn`, `.gl-bar` primitives. One step progress summary; native details at end contains final run/explanation self-checks. Preserve stored legacy read/lab/project/guided data. Opening a solution does not complete a step.
- Secondary navigation:「我的学习」/「全部章节」, current page marked with `aria-current`. The six homework projects are not in primary navigation. `#/projects` remains a retired-mainline explanation page so old bookmarks do not 404. No empty home TOC.

## 6. Interaction
Keep existing purposeful interactions and diagrams. New transitions only change opacity/transform over 150ms; no entrance animation, no decorative motion. All new controls have visible `:focus-visible`, hover and active states. Respect `prefers-reduced-motion`. Search opens collapsed references when navigating to their heading. Storage failure leaves a usable session and an honest persistence notice. Learning-record save failure has its own notice and still allows filling in the session. User-reported results are labeled as self-filled, never as an automated pass. 未检查 / 未通过 / 用户自报通过 are text labels, not color-only.

## 7. Surface
Use existing panel backgrounds with a single border. Route rows use dividers instead of nesting cards inside cards. Existing teaching callouts keep their semantic visual treatment. Entry pages use whitespace to separate decisions.

## 8. Accessibility and verification
Keyboard navigation, labeled search, native disclosures and one page title are required. No clipped CJK text; mobile controls at least 44px high, including record radios, concept checkboxes and short-record textareas. Verify「我的学习」, catalog, textbook chapters, search, theme and storage-failure states at 375/768/1280, plus the retired `#/projects` explanation page. Also verify learning-record save failure and confirm-next on home. If the learning plan file fails to load, the home page shows an understandable error and retry while catalog, chapter routes and search still start. A later plan success or failure must not re-route an open chapter, catalog or reference page; returning home shows the latest plan. Route-aware next/previous and reload/resume of read records remain required; do not treat read as mastery. Existing demonstration styling is retained; unrelated diagram redesign is outside this simplification. Do not claim performance scores without measuring them.
