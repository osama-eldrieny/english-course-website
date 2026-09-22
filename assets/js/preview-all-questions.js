// Read-only admin page: renders every section and question exactly as a
// student would see it (image, audio/video, helper text, options), plus the
// correct answer, so the admin can visually check content without having to
// click through the real test. Temporary QA tool — safe to delete along with
// preview-all-questions.html once question content has been verified.

const API_URL = 'https://script.google.com/macros/s/AKfycbwkAAAat323vqTYRBn1MXIcUfdTOmh9MxUfOeuBVAwPJtNloo0CADI89reNxPeDd8EhTw/exec';
const PASSWORD_KEY = 'speakfirst_admin_password';

function getPassword() {
  return sessionStorage.getItem(PASSWORD_KEY) || '';
}

async function apiGet(action) {
  const params = new URLSearchParams({ action, password: getPassword(), _: Date.now() });
  const res = await fetch(`${API_URL}?${params.toString()}`, { cache: 'no-store' }).then(r => r.json());
  if (res.error) throw new Error(res.error);
  return res;
}

function youtubeEmbedUrl(url) {
  const match = String(url || '').match(/(?:youtu\.be\/|[?&]v=)([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function isTruthy(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
}

function groupBySection(questions) {
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

function renderQuestion(q) {
  const card = document.createElement('div');
  card.className = 'question-card bg-white rounded-2xl p-6 mb-6 border border-gray-200-custom';

  if (q.passage_text) {
    const passage = document.createElement('div');
    passage.className = 'passage bg-cream rounded-lg p-5 mb-4 text-navy';
    passage.innerHTML = q.passage_text;
    card.appendChild(passage);
  }

  if (q.audio_url) {
    const embedUrl = youtubeEmbedUrl(q.audio_url);
    if (embedUrl) {
      const wrapper = document.createElement('div');
      wrapper.className = 'mb-4';
      wrapper.style.aspectRatio = '16 / 9';
      const iframe = document.createElement('iframe');
      iframe.src = embedUrl;
      iframe.className = 'w-full h-full rounded-lg';
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      wrapper.appendChild(iframe);
      card.appendChild(wrapper);
    } else {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = q.audio_url;
      audio.className = 'w-full mb-4';
      card.appendChild(audio);
    }
  }

  const title = document.createElement('p');
  title.className = 'font-semibold text-navy mb-3 text-lg';
  title.innerHTML = `${q.question_number}. ${q.question_text}`;
  if (isTruthy(q.required)) {
    const badge = document.createElement('span');
    badge.className = 'text-terra text-sm font-normal ml-1';
    badge.textContent = '*';
    badge.title = 'Required';
    title.appendChild(badge);
  }
  const typeTag = document.createElement('span');
  typeTag.className = 'text-xs text-slate-blue font-normal ml-2';
  typeTag.textContent = `(${q.question_type})`;
  title.appendChild(typeTag);
  card.appendChild(title);

  if (q.image_url) {
    const img = document.createElement('img');
    img.src = q.image_url;
    img.alt = '';
    img.className = 'w-full rounded-lg mb-4';
    img.onerror = () => {
      const warn = document.createElement('p');
      warn.className = 'text-terra text-sm mb-4';
      warn.textContent = `⚠ Image failed to load: ${q.image_url}`;
      img.replaceWith(warn);
    };
    card.appendChild(img);
  }

  if (q.question_type === 'long_text') {
    const box = document.createElement('div');
    box.className = 'w-full px-4 py-3 rounded-lg border border-dashed border-gray-200-custom text-slate-blue text-sm';
    box.textContent = '(student writes their answer here)';
    card.appendChild(box);
    return card;
  }

  const options = document.createElement('div');
  options.className = 'space-y-2';
  ['option_a', 'option_b', 'option_c', 'option_d'].forEach((key, i) => {
    let value = q[key];
    if (value === '' || value === null || value === undefined) return;
    if (value === true) value = 'TRUE';
    if (value === false) value = 'FALSE';
    const letter = String.fromCharCode(65 + i);
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3 px-4 py-2 rounded-lg border border-gray-200-custom text-sm';
    const isCorrect = String(q.correct_answer).trim().toUpperCase() === letter;
    row.innerHTML = `<span class="font-semibold">${letter}.</span> <span>${value}</span>` + (isCorrect ? '<span class="answer-badge">Correct</span>' : '');
    options.appendChild(row);
  });
  card.appendChild(options);

  if (!q.correct_answer && q.question_type === 'multiple_choice') {
    const warn = document.createElement('span');
    warn.className = 'missing-badge';
    warn.textContent = 'No correct_answer set';
    card.appendChild(warn);
  }

  return card;
}

async function render() {
  const [{ questions }, { sections }] = await Promise.all([apiGet('admin_questions'), apiGet('sections')]);
  const { groups, order } = groupBySection(questions);
  const sectionMeta = {};
  (sections || []).forEach(s => { sectionMeta[s.section_id] = s; });

  const container = document.getElementById('sections-container');
  container.innerHTML = '';

  order.forEach(sectionId => {
    const meta = sectionMeta[sectionId] || {};
    const wrap = document.createElement('div');
    wrap.className = 'preview-section';

    const heading = document.createElement('h2');
    heading.className = 'text-xl font-bold text-navy';
    heading.textContent = meta.title || sectionId;
    wrap.appendChild(heading);

    const metaLine = document.createElement('p');
    metaLine.className = 'preview-meta';
    const routingBits = [];
    if (meta.routing_condition) routingBits.push(`if "${meta.routing_condition}" → ${meta.routing_then || '(end)'}, else → ${meta.routing_else || '(end)'}`);
    metaLine.textContent = `${sectionId} · ${groups[sectionId].length} question${groups[sectionId].length === 1 ? '' : 's'}` + (routingBits.length ? ` · routing: ${routingBits.join(' ')}` : '');
    wrap.appendChild(metaLine);

    if (meta.description) {
      const desc = document.createElement('p');
      desc.className = 'text-slate-blue mb-4';
      desc.textContent = meta.description;
      wrap.appendChild(desc);
    }

    groups[sectionId].forEach(q => wrap.appendChild(renderQuestion(q)));
    container.appendChild(wrap);
  });
}

async function tryLogin(password) {
  sessionStorage.setItem(PASSWORD_KEY, password);
  await apiGet('admin_questions'); // throws if password is wrong
  document.getElementById('password-gate').classList.add('hidden');
  document.getElementById('preview').classList.remove('hidden');
  await render();
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

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-btn').addEventListener('click', onLogin);
  document.getElementById('admin-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') onLogin();
  });
  if (getPassword()) {
    tryLogin(getPassword()).catch(() => {
      sessionStorage.removeItem(PASSWORD_KEY);
    });
  }
});
