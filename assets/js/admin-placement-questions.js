// SpeakFirst Placement Test — admin question editor
// Talks to the same Apps Script web app as placement-test.js, using the
// admin_questions / admin_save_question / admin_delete_question actions.

const API_URL = 'https://script.google.com/macros/s/AKfycbwkAAAat323vqTYRBn1MXIcUfdTOmh9MxUfOeuBVAwPJtNloo0CADI89reNxPeDd8EhTw/exec';
const PASSWORD_KEY = 'speakfirst_admin_password';

const QUESTION_TYPES = [
  ['multiple_choice', 'Multiple choice'],
  ['long_text', 'Long text'],
  ['content', 'Content block (not a question)'],
];

const FIELDS = [
  'question_text', 'question_type', 'option_a', 'option_b',
  'option_c', 'option_d', 'correct_answer', 'points',
  'image_url', 'audio_url', 'passage_text', 'required'
];

let questions = [];
let sections = [];
let activeSectionId = null;
// Set right before a render() that just added a question, so render() can
// scroll to and focus it — otherwise a newly added row silently lands off
// -screen at the bottom of a long section and looks like nothing happened.
let pendingFocusQuestionNumber = null;

function getPassword() {
  return sessionStorage.getItem(PASSWORD_KEY) || '';
}

async function apiGet(action, extraParams) {
  // Cache-bust: browsers reuse cached responses for identical GET URLs,
  // which would make the editor show stale data after a save.
  const params = new URLSearchParams({ action, password: getPassword(), _: Date.now(), ...extraParams });
  const res = await fetch(`${API_URL}?${params.toString()}`, { cache: 'no-store' }).then(r => r.json());
  if (res.error) throw new Error(res.error);
  return res;
}

async function apiPost(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ ...body, password: getPassword() }),
  }).then(r => r.json());
  if (res.error) throw new Error(res.error);
  return res;
}

async function tryLogin(password) {
  sessionStorage.setItem(PASSWORD_KEY, password);
  // admin_questions requires the correct password and must succeed for login
  // to proceed. sections is best-effort — falls back to an empty list if the
  // backend hasn't been redeployed with the "sections" action yet, so
  // question editing still works while that's pending.
  const questionsRes = await apiGet('admin_questions');
  questions = questionsRes.questions;
  sections = await apiGet('sections').then(r => r.sections).catch(() => []);
  document.getElementById('password-gate').classList.add('hidden');
  document.getElementById('session-loading').style.display = 'none';
  document.getElementById('editor').classList.remove('hidden');
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-btn').addEventListener('click', onLogin);
  document.getElementById('admin-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') onLogin();
  });
  document.getElementById('add-section-btn').addEventListener('click', async () => {
    const btn = document.getElementById('add-section-btn');
    btn.disabled = true;
    try {
      await onAddSection();
    } finally {
      btn.disabled = false;
    }
  });
  document.getElementById('logout-btn').addEventListener('click', onLogout);

  if (getPassword()) {
    tryLogin(getPassword()).catch(() => {
      sessionStorage.removeItem(PASSWORD_KEY);
      // Auto-login failed (e.g. password was rotated) — fall back to the
      // normal gate instead of leaving the "Signing you back in…" spinner up.
      document.documentElement.classList.remove('admin-session-pending');
      document.getElementById('session-loading').style.display = 'none';
      document.getElementById('password-gate').classList.remove('hidden');
    });
  }
});

function onLogout() {
  sessionStorage.removeItem(PASSWORD_KEY);
  document.getElementById('editor').classList.add('hidden');
  document.getElementById('password-gate').classList.remove('hidden');
  document.getElementById('admin-password').value = '';
}

async function onLogin() {
  const password = document.getElementById('admin-password').value.trim();
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  errorEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Logging in…';
  try {
    await tryLogin(password);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Continue';
  }
}

// Pasted content (e.g. from Word/Google Docs) carries font-family/font-size/
// color styling that would fight the site's own typography. This keeps only
// the structural formatting an admin actually wants — bold/italic/underline
// and line breaks/lists — and drops everything else (inline styles, font
// tags, spans), regardless of what the source document looked like.
const RICHTEXT_ALLOWED_TAGS = {
  B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u',
  BR: 'br', DIV: 'div', P: 'div', LI: 'li', UL: 'ul', OL: 'ol',
};

function sanitizeRichtextHtml(html) {
  const source = document.createElement('div');
  source.innerHTML = html;

  function clean(node) {
    const out = document.createDocumentFragment();
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        out.appendChild(child.cloneNode());
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;

      const mapped = RICHTEXT_ALLOWED_TAGS[child.tagName];
      const cleanedChildren = clean(child);
      if (mapped) {
        const el = document.createElement(mapped);
        el.appendChild(cleanedChildren);
        out.appendChild(el);
      } else {
        // Unknown/disallowed tag (span, font, etc.) — drop the tag itself
        // but keep its text/children so no content is lost.
        out.appendChild(cleanedChildren);
      }
    });
    return out;
  }

  const wrapper = document.createElement('div');
  wrapper.appendChild(clean(source));
  return wrapper.innerHTML;
}

function isTruthy(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
}

function groupBySection() {
  const groups = {};
  const order = [];
  questions.forEach(q => {
    if (!groups[q.section_id]) {
      groups[q.section_id] = [];
      order.push(q.section_id);
    }
    groups[q.section_id].push(q);
  });
  order.forEach(id => groups[id].sort((a, b) => a.question_number - b.question_number));
  return { groups, order };
}

function sectionMetaFor(sectionId) {
  return sections.find(s => s.section_id === sectionId) || { section_id: sectionId, _row: null };
}

// Prefer the admin-set title (Sections tab) over the raw section_id/legacy
// section_title, for anywhere a section needs a human-friendly label —
// notably the routing "go to" dropdowns.
function sectionLabelFor(sectionId, fallbackRows) {
  const meta = sectionMetaFor(sectionId);
  if (meta.title) return meta.title;
  if (fallbackRows && fallbackRows[0] && fallbackRows[0].section_title) return fallbackRows[0].section_title;
  return sectionId;
}

function render() {
  const { groups, order } = groupBySection();
  if (!activeSectionId || !groups[activeSectionId]) activeSectionId = order[0];

  renderSectionNav(order, groups);

  const container = document.getElementById('sections-container');
  container.innerHTML = '';
  if (!activeSectionId) return;

  const rows = groups[activeSectionId];
  const meta = sectionMetaFor(activeSectionId);
  const section = document.createElement('div');
  section.className = 'card-flat bg-white p-5 mb-8';

  section.appendChild(renderSectionHeader(activeSectionId, meta, rows, order, groups));

  const sectionTitleForNewRows = meta.title || (rows[0] && rows[0].section_title) || activeSectionId;

  rows.forEach((q, i) => {
    section.appendChild(renderQuestionRow(q));
    section.appendChild(renderInsertBetweenButton(activeSectionId, q.question_number));
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-secondary text-sm';
  addBtn.textContent = '+ Add Question';
  addBtn.addEventListener('click', async () => {
    addBtn.disabled = true;
    addBtn.textContent = 'Adding…';
    try {
      await onAddQuestion(activeSectionId, sectionTitleForNewRows, rows);
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = '+ Add Question';
    }
  });
  section.appendChild(addBtn);

  container.appendChild(section);
  if (window.lucide) lucide.createIcons();

  if (pendingFocusQuestionNumber !== null) {
    const target = section.querySelector(`[data-question-number="${pendingFocusQuestionNumber}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('q-row-flash');
      const focusEl = target.querySelector('.richtext-editor');
      if (focusEl) focusEl.focus();
      setTimeout(() => target.classList.remove('q-row-flash'), 1600);
    }
    pendingFocusQuestionNumber = null;
  }
}

// Small "+" control between two question cards, for inserting a question at
// that exact position instead of always at the end of the section.
function renderInsertBetweenButton(sectionId, afterQuestionNumber) {
  const wrap = document.createElement('div');
  wrap.className = 'q-insert-between';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'q-insert-btn';
  btn.title = 'Insert question here';
  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', 'plus');
  btn.appendChild(icon);

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await onInsertQuestionAfter(sectionId, afterQuestionNumber);
    } catch (err) {
      alert('Could not insert question: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  });

  wrap.appendChild(btn);
  return wrap;
}

function renderSectionNav(order, groups) {
  const nav = document.getElementById('section-nav');
  nav.innerHTML = '';
  order.forEach(sectionId => {
    const btn = document.createElement('button');
    btn.className = 'section-nav-item' + (sectionId === activeSectionId ? ' active' : '');
    const label = document.createElement('span');
    label.textContent = sectionLabelFor(sectionId, groups[sectionId]);
    btn.appendChild(label);
    const idLine = document.createElement('span');
    idLine.className = 'nav-id';
    idLine.textContent = `${sectionId} · ${groups[sectionId].length} question${groups[sectionId].length === 1 ? '' : 's'}`;
    btn.appendChild(idLine);
    btn.addEventListener('click', () => {
      activeSectionId = sectionId;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    nav.appendChild(btn);
  });
}

// Section-level card: id (read-only), title, description, routing
// (condition + then/else target section), Save/Delete-section.
function renderSectionHeader(sectionId, meta, rows, order, groups) {
  const wrap = document.createElement('div');
  wrap.className = 'q-row bg-navy-tint';

  const idLine = document.createElement('p');
  idLine.className = 'text-sm text-slate-blue mb-3';
  idLine.textContent = `Section ID: ${sectionId} (fixed — questions reference this id)`;
  wrap.appendChild(idLine);

  const grid = document.createElement('div');
  grid.className = 'q-grid';
  const inputs = {};

  function addField(key, label, el) {
    const fwrap = document.createElement('div');
    fwrap.className = 'field';
    const lab = document.createElement('label');
    lab.textContent = label;
    fwrap.appendChild(lab);
    el.value = meta[key] || '';
    inputs[key] = el;
    fwrap.appendChild(el);
    grid.appendChild(fwrap);
    return fwrap;
  }

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'input-base';
  addField('title', 'Section Title (shown to students)', titleInput);

  const otherSectionIds = order.filter(id => id !== sectionId);

  function makeSectionSelect() {
    const sel = document.createElement('select');
    sel.className = 'input-base';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '(end test / default flow)';
    sel.appendChild(blank);
    otherSectionIds.forEach(id => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = sectionLabelFor(id, groups[id]);
      sel.appendChild(opt);
    });
    return sel;
  }

  const condInput = document.createElement('input');
  condInput.type = 'text';
  condInput.className = 'input-base';
  condInput.placeholder = 'e.g. score < 15 (leave blank for no conditional routing)';
  addField('routing_condition', 'Routing Condition (based on this section\'s score)', condInput);

  const thenSelect = makeSectionSelect();
  const thenWrap = addField('routing_then', 'If condition TRUE, go to', thenSelect);
  thenSelect.value = meta.routing_then || '';

  const elseSelect = makeSectionSelect();
  const elseWrap = addField('routing_else', 'If condition FALSE (or blank), go to', elseSelect);
  elseSelect.value = meta.routing_else || '';

  const descInput = document.createElement('textarea');
  descInput.className = 'input-base';
  const descWrap = addField('description', 'Description (shown to students under the title)', descInput);
  descWrap.style.gridColumn = '1 / -1';

  wrap.appendChild(grid);

  const actions = document.createElement('div');
  actions.className = 'actions-row';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary text-sm';
  saveBtn.textContent = 'Save Section';
  saveBtn.addEventListener('click', async () => {
    saveBtn.textContent = 'Saving…';
    saveBtn.disabled = true;
    try {
      const payload = {
        type: 'admin_save_section',
        section_id: sectionId,
        title: inputs.title.value,
        description: inputs.description.value,
        routing_condition: inputs.routing_condition.value,
        routing_then: inputs.routing_then.value,
        routing_else: inputs.routing_else.value,
      };
      await apiPost(payload);
      Object.assign(meta, payload);
      if (!sections.includes(meta)) sections.push(meta);
      const { order, groups } = groupBySection();
      renderSectionNav(order, groups);
      saveBtn.textContent = 'Saved ✓';
      setTimeout(() => { saveBtn.textContent = 'Save Section'; saveBtn.disabled = false; }, 1200);
    } catch (err) {
      alert('Save failed: ' + err.message);
      saveBtn.textContent = 'Save Section';
      saveBtn.disabled = false;
    }
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-secondary text-sm';
  deleteBtn.textContent = 'Delete Whole Section';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm(`Delete section "${sectionId}" and ALL ${rows.length} of its questions? This can't be undone.`)) return;
    try {
      await apiPost({ type: 'admin_delete_section', section_id: sectionId });
      questions = questions.filter(q => q.section_id !== sectionId);
      sections = sections.filter(s => s.section_id !== sectionId);
      render();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  });

  actions.appendChild(saveBtn);
  actions.appendChild(deleteBtn);
  wrap.appendChild(actions);

  return wrap;
}

function renderQuestionRow(q) {
  const row = document.createElement('div');
  row.className = 'q-row';
  row.dataset.questionNumber = q.question_number;

  const inputs = {};

  // Header row — collapse icon, Question #, and Type live together on one
  // line, always visible. The question preview text only shows up here
  // while collapsed (it'd be redundant with the Question Text field below
  // while expanded).
  const headerRow = document.createElement('div');
  headerRow.className = 'q-row-header';

  const chevronBtn = document.createElement('button');
  chevronBtn.type = 'button';
  chevronBtn.className = 'q-row-chevron-btn';
  const chevron = document.createElement('span');
  chevron.className = 'q-row-chevron';
  const chevronDown = document.createElement('i');
  chevronDown.setAttribute('data-lucide', 'chevron-down');
  const chevronRight = document.createElement('i');
  chevronRight.setAttribute('data-lucide', 'chevron-right');
  chevronRight.style.display = 'none';
  chevron.appendChild(chevronDown);
  chevron.appendChild(chevronRight);
  chevronBtn.appendChild(chevron);
  headerRow.appendChild(chevronBtn);

  const body = document.createElement('div');
  body.className = 'q-row-body';

  const collapsedTitle = document.createElement('span');
  collapsedTitle.className = 'q-row-toggle-label';
  collapsedTitle.style.display = 'none';
  function updateCollapsedTitle() {
    const raw = inputs.question_text ? inputs.question_text.innerHTML : q.question_text;
    const preview = (raw ? raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '') || '(no text yet)';
    const shortPreview = preview.slice(0, 80);
    collapsedTitle.textContent = `Q${inputs.question_number ? inputs.question_number.value : q.question_number}: ${shortPreview}${preview.length > 80 ? '…' : ''}`;
  }
  updateCollapsedTitle();

  chevronBtn.addEventListener('click', () => {
    row.classList.toggle('collapsed');
    const collapsed = row.classList.contains('collapsed');
    chevronDown.style.display = collapsed ? 'none' : '';
    chevronRight.style.display = collapsed ? '' : 'none';
    collapsedTitle.style.display = collapsed ? '' : 'none';
    if (collapsed) updateCollapsedTitle();
  });

  const grid = document.createElement('div');
  grid.className = 'q-grid';

  function addField(key, label, type, target) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const lab = document.createElement('label');
    lab.textContent = label;
    wrap.appendChild(lab);
    let input;
    if (type === 'richtext') {
      // Contenteditable so pasted formatting (bold, colors, lists, line
      // breaks — e.g. from Word/Google Docs) is kept as-is instead of
      // being flattened to plain text like a <textarea> would do.
      input = document.createElement('div');
      input.contentEditable = 'true';
      input.className = 'input-base richtext-editor';
      input.setAttribute('data-placeholder', 'Paste styled text here (bold & line breaks kept, fonts stripped)…');
      input.innerHTML = q[key] !== undefined ? q[key] : '';
      input.addEventListener('paste', e => {
        e.preventDefault();
        const clipboard = e.clipboardData || window.clipboardData;
        const html = clipboard.getData('text/html');
        const plain = clipboard.getData('text/plain');
        const cleaned = html
          ? sanitizeRichtextHtml(html)
          : plain.split('\n').map(line => `<div>${line.replace(/</g, '&lt;')}</div>`).join('');
        document.execCommand('insertHTML', false, cleaned);
      });
      inputs[key] = input;
      wrap.appendChild(input);
      (target || grid).appendChild(wrap);
      return wrap;
    } else if (type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'input-base';
    } else if (type === 'select') {
      input = document.createElement('select');
      input.className = 'input-base';
      QUESTION_TYPES.forEach(([v, label]) => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = label;
        input.appendChild(opt);
      });
    } else {
      input = document.createElement('input');
      input.type = type;
      input.className = 'input-base';
    }
    input.value = q[key] !== undefined ? q[key] : '';
    inputs[key] = input;
    wrap.appendChild(input);
    (target || grid).appendChild(wrap);
    return wrap;
  }

  const qnumWrap = addField('question_number', 'Question #', 'number', headerRow);
  qnumWrap.classList.add('q-row-header-field');
  // Read-only: position is now managed automatically by "+ Add Question"
  // and the insert-between "+" button, which shift every other question's
  // number for you. Hand-editing this directly could create duplicate or
  // out-of-order numbers within a section since Save doesn't shift neighbors.
  inputs.question_number.readOnly = true;
  inputs.question_number.title = 'Position is set automatically — use the insert-between "+" button to reorder.';
  inputs.question_number.classList.add('opacity-70', 'cursor-not-allowed');
  const typeWrap = addField('question_type', 'Type', 'select', headerRow);
  typeWrap.classList.add('q-row-header-field');
  headerRow.appendChild(collapsedTitle);
  row.appendChild(headerRow);

  const textHelperGrid = document.createElement('div');
  textHelperGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-3';
  textHelperGrid.style.gridColumn = '1 / -1';
  grid.appendChild(textHelperGrid);

  const questionTextWrap = addField('question_text', 'Question', 'richtext', textHelperGrid);
  addField('passage_text', 'Helper text', 'richtext', textHelperGrid);

  // Options A–D together on one row, and Correct Answer/Points/Image/Audio
  // together on another — each its own 4-column sub-grid spanning the full
  // width of the card, instead of falling into the card's normal 2-column
  // layout.
  const optionsGrid = document.createElement('div');
  optionsGrid.className = 'grid grid-cols-2 md:grid-cols-4 gap-3';
  optionsGrid.style.gridColumn = '1 / -1';
  grid.appendChild(optionsGrid);

  const metaGrid = document.createElement('div');
  metaGrid.className = 'meta-grid';
  metaGrid.style.gridColumn = '1 / -1';
  grid.appendChild(metaGrid);

  // Only meaningful for multiple_choice — hidden for long_text questions,
  // which only use question_text (+ optionally passage_text/image/audio).
  addField('option_a', 'Option A', 'text', optionsGrid);
  addField('option_b', 'Option B', 'text', optionsGrid);
  addField('option_c', 'Option C', 'text', optionsGrid);
  addField('option_d', 'Option D', 'text', optionsGrid);
  const correctAnswerWrap = addField('correct_answer', 'Correct Answer', 'text', metaGrid);
  const correctAnswerLabel = correctAnswerWrap.querySelector('label');
  const correctAnswerHelp = document.createElement('span');
  correctAnswerHelp.className = 'help-hint';
  correctAnswerHelp.title = 'A/B/C/D/TRUE/FALSE';
  const correctAnswerHelpIcon = document.createElement('i');
  correctAnswerHelpIcon.setAttribute('data-lucide', 'info');
  correctAnswerHelp.appendChild(correctAnswerHelpIcon);
  correctAnswerLabel.appendChild(correctAnswerHelp);
  const pointsWrap = addField('points', 'Points', 'number', metaGrid);
  addField('image_url', 'Image URL', 'text', metaGrid);
  addField('audio_url', 'Audio/Video URL', 'text', metaGrid);

  body.appendChild(grid);

  // Save/Delete and the Required toggle share one row — Required on the
  // right, separated from the fields above by a divider.
  const footer = document.createElement('div');
  footer.className = 'q-row-footer';

  const actions = document.createElement('div');
  actions.className = 'flex gap-3';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary text-sm';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', async () => {
    saveBtn.textContent = 'Saving…';
    saveBtn.disabled = true;
    try {
      const payload = {
        type: 'admin_save_question',
        row: q._row,
        section_id: q.section_id,
        section_title: q.section_title,
        question_number: Number(inputs.question_number.value) || 0,
      };
      FIELDS.forEach(f => {
        if (f === 'required') payload[f] = inputs[f].checked;
        else if (f === 'passage_text' || f === 'question_text') payload[f] = inputs[f].innerHTML;
        else payload[f] = inputs[f].value;
      });
      await apiPost(payload);
      updateCollapsedTitle();
      saveBtn.textContent = 'Saved ✓';
      setTimeout(() => { saveBtn.textContent = 'Save'; saveBtn.disabled = false; }, 1200);
    } catch (err) {
      alert('Save failed: ' + err.message);
      saveBtn.textContent = 'Save';
      saveBtn.disabled = false;
    }
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-secondary text-sm';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm(`Delete question ${q.question_number} from ${q.section_id}?`)) return;
    try {
      await apiPost({ type: 'admin_delete_question', row: q._row });
      questions = questions.filter(item => item._row !== q._row);
      render();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  });

  actions.appendChild(saveBtn);
  actions.appendChild(deleteBtn);
  footer.appendChild(actions);

  const requiredLabel = document.createElement('label');
  requiredLabel.className = 'toggle-switch';
  const requiredInput = document.createElement('input');
  requiredInput.type = 'checkbox';
  requiredInput.checked = isTruthy(q.required);
  inputs.required = requiredInput;
  const track = document.createElement('span');
  track.className = 'track';
  const requiredText = document.createElement('span');
  requiredText.textContent = 'Required';
  requiredLabel.appendChild(requiredInput);
  requiredLabel.appendChild(track);
  requiredLabel.appendChild(requiredText);
  footer.appendChild(requiredLabel);

  // Content blocks (title/helper text/image/video, no answer) hide every
  // answer-related field; long_text hides only the multiple-choice ones.
  const questionTextLabel = questionTextWrap.querySelector('label');
  function syncTypeFieldsVisibility() {
    const type = inputs.question_type.value;
    const isMc = type === 'multiple_choice';
    const isContent = type === 'content';
    optionsGrid.style.display = isMc ? '' : 'none';
    correctAnswerWrap.style.display = isMc ? '' : 'none';
    pointsWrap.style.display = isContent ? 'none' : '';
    requiredLabel.style.display = isContent ? 'none' : '';
    questionTextLabel.textContent = isContent ? 'Title' : 'Question';
    if (isContent) requiredInput.checked = false;
  }
  inputs.question_type.addEventListener('change', syncTypeFieldsVisibility);
  syncTypeFieldsVisibility();

  body.appendChild(footer);
  row.appendChild(body);

  return row;
}

async function onAddQuestion(sectionId, sectionTitle, existingRows) {
  const nextNumber = Math.max(0, ...existingRows.map(r => Number(r.question_number) || 0)) + 1;
  const blank = {
    _row: null,
    section_id: sectionId,
    section_title: sectionTitle,
    question_number: nextNumber,
    question_text: '',
    question_type: 'multiple_choice',
    option_a: '', option_b: '', option_c: '', option_d: '',
    correct_answer: '', points: 1,
    image_url: '', audio_url: '', passage_text: '', required: false,
  };
  try {
    const res = await apiPost({ type: 'admin_save_question', ...blank });
    blank._row = res.row;
    questions.push(blank);
    pendingFocusQuestionNumber = nextNumber;
    render();
  } catch (err) {
    alert('Could not add question: ' + err.message);
  }
}

// Inserts a new blank question directly after `afterQuestionNumber` in a
// section, shifting every later question's number down to make room —
// instead of always appending at the very end like "+ Add Question". The
// shift + insert both happen server-side in one request (admin_insert_
// question), not as N separate save calls, since that was taking 15+
// seconds for sections with many questions.
async function onInsertQuestionAfter(sectionId, afterQuestionNumber) {
  const res = await apiPost({ type: 'admin_insert_question', section_id: sectionId, after_question_number: afterQuestionNumber });
  const newNumber = res.question_number;

  questions.forEach(q => {
    if (q.section_id === sectionId && q._row !== res.row && Number(q.question_number) >= newNumber) {
      q.question_number = Number(q.question_number) + 1;
    }
  });

  questions.push({
    _row: res.row,
    section_id: sectionId,
    section_title: res.section_title,
    question_number: newNumber,
    question_text: '',
    question_type: 'multiple_choice',
    option_a: '', option_b: '', option_c: '', option_d: '',
    correct_answer: '', points: 1,
    image_url: '', audio_url: '', passage_text: '', required: false,
  });
  pendingFocusQuestionNumber = newNumber;
  render();
}

async function onAddSection() {
  const sectionId = prompt('New section id (e.g. grammar_7, listening_3) — must be unique, lowercase, no spaces:');
  if (!sectionId) return;
  if (questions.some(q => q.section_id === sectionId)) {
    alert('A section with that id already exists.');
    return;
  }
  const sectionTitle = prompt('Section title shown to students:', sectionId) || sectionId;
  try {
    await apiPost({ type: 'admin_save_section', section_id: sectionId, title: sectionTitle, description: '', routing_condition: '', routing_then: '', routing_else: '' });
    sections.push({ section_id: sectionId, title: sectionTitle, description: '', routing_condition: '', routing_then: '', routing_else: '' });
    activeSectionId = sectionId;
    await onAddQuestion(sectionId, sectionTitle, []);
  } catch (err) {
    alert('Could not create section: ' + err.message);
  }
}
