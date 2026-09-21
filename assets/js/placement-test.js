// SpeakFirst English Placement Test — frontend logic
// Talks to a Google Apps Script web app (see /apps-script/Code.gs) for
// questions, routing rules, and result submission.

const API_URL = 'https://script.google.com/macros/s/AKfycbwkAAAat323vqTYRBn1MXIcUfdTOmh9MxUfOeuBVAwPJtNloo0CADI89reNxPeDd8EhTw/exec';
const STORAGE_KEY = 'speakfirst_placement_test_state';

const DEFAULT_FLOW = [
  'grammar_1', 'grammar_2', 'grammar_3', 'grammar_4',
  'reading',
  'listening_1', 'listening_2', 'listening_3'
];

const WRITING_BY_GRAMMAR_LEVEL = {
  grammar_1: 'writing_place',
  grammar_2: 'writing_routine',
  grammar_3: 'writing_abroad',
  grammar_4: 'writing_opinion'
};

const state = {
  studentInfo: {},
  allQuestions: {},
  routingRules: [],
  currentSectionId: null,
  answers: {},
  scores: {},
  sectionsVisited: [],
  sectionsSkipped: [],
  highestGrammarReached: null,
  sectionStartTime: null,
};

function saveLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      studentInfo: state.studentInfo,
      answers: state.answers,
      scores: state.scores,
      sectionsVisited: state.sectionsVisited,
      sectionsSkipped: state.sectionsSkipped,
      currentSectionId: state.currentSectionId,
      highestGrammarReached: state.highestGrammarReached,
    }));
  } catch (e) { /* ignore storage errors */ }
}

function restoreLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
    return true;
  } catch (e) {
    return false;
  }
}

function clearLocal() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
}

function groupBy(list, key) {
  return list.reduce((acc, item) => {
    (acc[item[key]] = acc[item[key]] || []).push(item);
    return acc;
  }, {});
}

function showStep(stepId) {
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
  document.getElementById(stepId).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showLoading(show) {
  document.getElementById('loading-overlay').hidden = !show;
}

// ============ INIT ============

async function init() {
  showLoading(true);
  try {
    const [questionsRes, routingRes] = await Promise.all([
      fetch(`${API_URL}?action=questions`).then(r => r.json()),
      fetch(`${API_URL}?action=routing`).then(r => r.json()),
    ]);

    if (questionsRes.error) throw new Error(questionsRes.error);
    state.allQuestions = groupBy(questionsRes.questions, 'section_id');
    state.routingRules = routingRes.rules || [];
  } catch (err) {
    document.getElementById('step-info').innerHTML =
      `<p class="text-terra">Sorry — we couldn't load the test right now. Please try again later.</p>`;
    console.error(err);
  } finally {
    showLoading(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  document.getElementById('info-form').addEventListener('submit', onInfoSubmit);
  document.getElementById('next-section-btn').addEventListener('click', onNextSectionClick);
  document.getElementById('submit-writing-btn').addEventListener('click', onWritingSubmit);
  document.getElementById('writing-answer').addEventListener('input', updateWordCount);
});

function onInfoSubmit(e) {
  e.preventDefault();
  state.studentInfo = {
    email: document.getElementById('email').value.trim(),
    fullName: document.getElementById('fullName').value.trim(),
    whatsapp: document.getElementById('whatsapp').value.trim(),
  };
  startTest();
}

function startTest() {
  state.currentSectionId = 'grammar_1';
  state.sectionsVisited = ['grammar_1'];
  saveLocal();
  renderSection('grammar_1');
}

// ============ FLOW CONTROL ============

function onNextSectionClick() {
  const sectionId = state.currentSectionId;
  const questions = state.allQuestions[sectionId] || [];

  // Collect answers from the DOM into state before grading.
  const answers = {};
  questions.forEach(q => {
    if (q.question_type === 'long_text') {
      const box = document.querySelector(`textarea[name="q_${q.question_number}"]`);
      answers[q.question_number] = box ? box.value.trim() : '';
      return;
    }
    const selected = document.querySelector(`input[name="q_${q.question_number}"]:checked`);
    answers[q.question_number] = selected ? selected.value : null;
  });
  state.answers[sectionId] = answers;
  saveLocal();

  onSectionComplete(sectionId);
}

function onSectionComplete(sectionId) {
  const sectionQuestions = state.allQuestions[sectionId] || [];
  const studentAnswers = state.answers[sectionId] || {};
  let correct = 0;

  let total = 0;
  sectionQuestions.forEach(q => {
    if (q.question_type === 'long_text') return; // written response, not graded
    total++;
    if (studentAnswers[q.question_number] === q.correct_answer) correct++;
  });

  state.scores[sectionId] = { correct, total };

  if (sectionId.indexOf('grammar_') === 0) {
    state.highestGrammarReached = sectionId;
  }

  const rule = state.routingRules.find(r => r.after_section === sectionId);
  let nextSection;

  if (rule) {
    const target = evaluateCondition(rule, correct);
    nextSection = resolveSectionId(target);
    if (!nextSection) {
      console.warn(`Routing rule after "${sectionId}" points to unknown section "${target}"; falling back to writing.`);
      nextSection = assignedWritingSection();
    }
  } else {
    nextSection = nextDefaultSection(sectionId);
  }

  if (nextSection) {
    markSkippedSections(sectionId, nextSection);
    state.currentSectionId = nextSection;
    state.sectionsVisited.push(nextSection);
    saveLocal();
    transitionTo(nextSection);
  } else {
    finishTest();
  }
}

// A section with no routing rule ends its track. If the section already
// contained its own written question the test is finished; otherwise fall
// back to the standalone writing step.
function nextDefaultSection(sectionId) {
  const hasWrittenQuestion = (state.allQuestions[sectionId] || [])
    .some(q => q.question_type === 'long_text');
  return hasWrittenQuestion ? null : assignedWritingSection();
}

// Routing rules may name a target by section_id (e.g. "listening_1") or by the
// section_title shown in the Questions tab (e.g. "Beginner Listening (Skills_1)").
function resolveSectionId(target) {
  const wanted = String(target || '').trim();
  if (!wanted) return null;
  if (state.allQuestions[wanted] || wanted.indexOf('writing_') === 0) return wanted;

  const key = wanted.toLowerCase();
  return Object.keys(state.allQuestions).find(id => {
    const title = (state.allQuestions[id][0] || {}).section_title;
    return String(title || '').trim().toLowerCase() === key;
  }) || null;
}

function assignedWritingSection() {
  const level = state.highestGrammarReached || 'grammar_1';
  return WRITING_BY_GRAMMAR_LEVEL[level] || 'writing_place';
}

function markSkippedSections(fromSectionId, toSectionId) {
  const fromIdx = DEFAULT_FLOW.indexOf(fromSectionId);
  const toIdx = DEFAULT_FLOW.indexOf(toSectionId);
  if (fromIdx === -1 || toIdx === -1) return;
  for (let i = fromIdx + 1; i < toIdx; i++) {
    if (!state.sectionsSkipped.includes(DEFAULT_FLOW[i])) {
      state.sectionsSkipped.push(DEFAULT_FLOW[i]);
    }
  }
}

function evaluateCondition(rule, score) {
  const match = String(rule.condition).match(/score\s*([<>=!]+)\s*(\d+)/i);
  if (!match) return rule.else_go_to;

  const operator = match[1];
  const threshold = parseInt(match[2], 10);
  let conditionMet = false;

  switch (operator) {
    case '<': conditionMet = score < threshold; break;
    case '<=': conditionMet = score <= threshold; break;
    case '>': conditionMet = score > threshold; break;
    case '>=': conditionMet = score >= threshold; break;
    case '==': conditionMet = score === threshold; break;
  }

  return conditionMet ? rule.then_go_to : rule.else_go_to;
}

function transitionTo(sectionId) {
  const overlay = document.getElementById('transition-overlay');
  const label = state.allQuestions[sectionId]
    ? (state.allQuestions[sectionId][0] || {}).section_title
    : sectionTitleFor(sectionId);

  document.getElementById('transition-text').textContent = `Section complete! Moving to ${label || 'the next section'}...`;
  overlay.hidden = false;

  setTimeout(() => {
    overlay.hidden = true;
    renderSection(sectionId);
  }, 1400);
}

function sectionTitleFor(sectionId) {
  const titles = {
    writing_opinion: 'Writing — Opinion Essay',
    writing_routine: 'Writing — Daily Routine',
    writing_abroad: 'Writing — Studying Abroad',
    writing_place: 'Writing — A Place I Like',
  };
  return titles[sectionId] || sectionId;
}

// ============ RENDERING ============

function renderSection(sectionId) {
  if (sectionId.indexOf('writing_') === 0) {
    renderWritingSection(sectionId);
    return;
  }

  const questions = state.allQuestions[sectionId];
  if (!questions || questions.length === 0) {
    onSectionComplete(sectionId); // nothing to show, skip forward
    return;
  }

  document.getElementById('section-title').textContent = questions[0].section_title;
  updateProgress(sectionId);

  const container = document.getElementById('questions-container');
  container.innerHTML = '';

  if (questions[0].passage_text) {
    const passage = document.createElement('div');
    passage.className = 'passage bg-cream rounded-lg p-5 mb-6 text-navy';
    passage.textContent = questions[0].passage_text;
    container.appendChild(passage);
  }
  if (questions[0].audio_url) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = questions[0].audio_url;
    audio.className = 'w-full mb-6';
    container.appendChild(audio);
  }

  questions.forEach(q => container.appendChild(createQuestionElement(q)));

  showStep('step-questions');
}

function createQuestionElement(q) {
  const wrapper = document.createElement('div');
  wrapper.className = 'question-card bg-white rounded-2xl p-6 mb-6';

  const title = document.createElement('p');
  title.className = 'font-semibold text-navy mb-4';
  // question_text already includes its own leading number (e.g. "5. ...")
  // from the source Form, so it's shown as-is without adding another one.
  title.textContent = q.question_text;
  wrapper.appendChild(title);

  if (q.question_type === 'long_text') {
    const box = document.createElement('textarea');
    box.name = `q_${q.question_number}`;
    box.rows = 8;
    box.className = 'w-full px-4 py-3 rounded-lg border border-gray-200-custom focus:outline-none focus:ring-2 focus:ring-navy';
    box.setAttribute('aria-label', 'Your written answer');
    const saved = (state.answers[state.currentSectionId] || {})[q.question_number];
    if (saved) box.value = saved;
    wrapper.appendChild(box);
    return wrapper;
  }

  const options = document.createElement('div');
  options.className = 'space-y-3';

  ['option_a', 'option_b', 'option_c', 'option_d'].forEach((key, i) => {
    // Sheets stores TRUE/FALSE cells as booleans, so `false` is a real option.
    let value = q[key];
    if (value === '' || value === null || value === undefined) return;
    if (value === true) value = 'TRUE';
    if (value === false) value = 'FALSE';
    const letter = String.fromCharCode(65 + i);

    const label = document.createElement('label');
    label.className = 'flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200-custom hover:bg-navy-tint cursor-pointer transition-colors';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `q_${q.question_number}`;
    input.value = letter;
    input.className = 'accent-navy';

    label.appendChild(input);
    label.appendChild(document.createTextNode(value));
    options.appendChild(label);
  });

  wrapper.appendChild(options);
  return wrapper;
}

function renderWritingSection(sectionId) {
  const prompts = {
    writing_place: { title: 'Writing — A Place I Like', prompt: 'Describe a place you like. Say what it is, where it is, and why you like it. (70–100 words)' },
    writing_routine: { title: 'Writing — Daily Routine', prompt: 'Describe your daily routine. What do you usually do every day? (50–70 words)' },
    writing_abroad: { title: 'Writing — Studying Abroad', prompt: 'Would you like to study abroad? Explain why or why not. (100–150 words)' },
    writing_opinion: { title: 'Writing — Opinion Essay', prompt: 'Give your opinion on a topic of your choice related to modern life and support it with reasons. (150–200 words)' },
  };
  const config = prompts[sectionId] || { title: sectionTitleFor(sectionId), prompt: '' };

  state.currentSectionId = sectionId;
  document.getElementById('writing-title').textContent = config.title;
  document.getElementById('writing-prompt').textContent = config.prompt;
  document.getElementById('writing-answer').value = (state.answers[sectionId] || {}).text || '';
  updateWordCount();
  updateProgress(sectionId);

  showStep('step-writing');
}

function updateWordCount() {
  const text = document.getElementById('writing-answer').value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  document.getElementById('word-count').textContent = `${words} words`;
}

function onWritingSubmit() {
  const sectionId = state.currentSectionId;
  const text = document.getElementById('writing-answer').value.trim();
  state.answers[sectionId] = { text };
  state.scores[sectionId] = { text: true };
  saveLocal();
  finishTest();
}

function updateProgress(sectionId) {
  const totalSteps = DEFAULT_FLOW.length + 1; // + writing
  const idx = DEFAULT_FLOW.indexOf(sectionId);
  const current = idx === -1 ? totalSteps : idx + 1;
  const pct = Math.round((current / totalSteps) * 100);
  document.getElementById('progress-fill').style.width = `${pct}%`;
}

// ============ SUBMIT & RESULTS ============

async function finishTest() {
  showLoading(true);

  const payload = {
    email: state.studentInfo.email,
    fullName: state.studentInfo.fullName,
    whatsapp: state.studentInfo.whatsapp,
    answers: state.answers,
    sectionsVisited: state.sectionsVisited,
    sectionsSkipped: state.sectionsSkipped,
  };

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(r => r.json());

    if (res.error) throw new Error(res.error);

    renderResults(res.level, res.scores);
    clearLocal();
  } catch (err) {
    console.error(err);
    renderResults(null, state.scores, true);
  } finally {
    showLoading(false);
  }
}

function renderResults(level, scores, submissionFailed) {
  const container = document.getElementById('results-content');
  container.innerHTML = '';

  if (submissionFailed) {
    container.innerHTML = `<p class="text-terra mb-4">We couldn't submit your results automatically. Please contact us on WhatsApp so we can record your score manually.</p>`;
  } else if (level) {
    const levelEl = document.createElement('p');
    levelEl.className = 'text-2xl font-bold text-navy mb-6';
    levelEl.textContent = `Your Level: ${level}`;
    container.appendChild(levelEl);
  }

  const breakdown = document.createElement('div');
  breakdown.className = 'space-y-2 mb-8';
  Object.keys(scores || {}).forEach(sectionId => {
    const s = scores[sectionId];
    const row = document.createElement('div');
    row.className = 'flex justify-between border-b border-gray-200-custom py-2';
    const label = document.createElement('span');
    label.textContent = sectionTitleFor(sectionId) !== sectionId ? sectionTitleFor(sectionId) : sectionId;
    const value = document.createElement('span');
    value.className = 'font-semibold text-navy';
    value.textContent = (s.total !== undefined && s.total !== null) ? `${s.correct}/${s.total}` : 'Submitted';
    row.appendChild(label);
    row.appendChild(value);
    breakdown.appendChild(row);
  });
  container.appendChild(breakdown);

  const message = document.createElement('p');
  message.className = 'text-sm text-slate-blue mb-8';
  message.textContent = "Thank you! Your detailed results have been sent to your email.";
  container.appendChild(message);

  showStep('step-results');
}
