/**
 * SpeakFirst Placement Test — Backend
 *
 * Deploy: open this Sheet → Extensions → Apps Script → paste this file →
 * Deploy → New deployment → type "Web app" → Execute as "Me" →
 * Who has access "Anyone" → Deploy. Copy the resulting /exec URL into
 * assets/js/placement-test.js (API_URL).
 *
 * Every time you edit this file, you must create a NEW deployment (or use
 * "Manage deployments" → edit → New version) for changes to go live —
 * saving alone does not update the already-deployed /exec URL's behavior.
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
// Comma-separated if you want more than one admin notified.
const ADMIN_EMAIL = 'amalkhayata.ahk@gmail.com,osama.eldrieny@gmail.com';

// Section metadata used for level determination.
// Routing (after_section -> then/else) lives in the "Routing Rules" tab and is
// evaluated by the frontend; here we only translate the track a student ended
// up in into a level label.
const GRAMMAR_SECTIONS = ['grammar_1', 'grammar_2', 'grammar_3', 'grammar_4'];
const LEVEL_LABELS = {
  grammar_1: 'Beginner (A1)',
  grammar_2: 'Elementary (A2)',
  grammar_3: 'Intermediate (B1)',
  grammar_4: 'Upper Intermediate (B2)',
  advanced: 'Advanced (C1)'
};

// Terminal sections of the routing tree, highest level first.
// A student lands in exactly one of these; the first one found in the graded
// answers decides the level.
const TRACK_LEVELS = [
  { section: 'listening_2', label: 'Intermediate (B1)' },     // Intermediate Listening (Skills_4)
  { section: 'grammar_6',   label: 'Pre-Intermediate (A2+)' }, // Pre-Intermediate (Skills_3)
  { section: 'grammar_5',   label: 'Elementary (A2)' },        // Elementary (Skills_2)
  { section: 'listening_1', label: 'Beginner (A1)' }           // Beginner Listening (Skills_1)
];

function doGet(e) {
  const action = e.parameter.action;

  try {
    if (action === 'questions') return serveQuestions();
    if (action === 'routing') return serveRoutingRules();

    return jsonResponse({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    if (isDuplicateSubmission(payload.email)) {
      return jsonResponse({ error: 'You have already submitted this test in the last 24 hours.' });
    }

    const graded = gradeSubmission(payload.answers);
    const level = determineLevel(graded);

    saveResults(payload, graded, level);
    sendStudentEmail(payload.email, payload.fullName, graded, level);
    sendAdminEmail(payload, graded, level);

    return jsonResponse({ success: true, level: level, scores: graded });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============ QUESTIONS / ROUTING ============

function sheetToObjects(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i].every(c => c === '')) continue; // skip blank rows
    const row = {};
    headers.forEach((h, idx) => { row[h] = data[i][idx]; });
    rows.push(row);
  }
  return rows;
}

function serveQuestions() {
  const questions = sheetToObjects('Questions');
  return jsonResponse({ questions });
}

function serveRoutingRules() {
  const rules = sheetToObjects('Routing Rules');
  return jsonResponse({ rules });
}

// ============ GRADING ============

function gradeSubmission(answers) {
  const questions = sheetToObjects('Questions');
  const bySection = {};
  questions.forEach(q => {
    if (!bySection[q.section_id]) bySection[q.section_id] = [];
    bySection[q.section_id].push(q);
  });

  const graded = {};
  Object.keys(answers || {}).forEach(sectionId => {
    const sectionQuestions = bySection[sectionId] || [];
    const studentAnswers = answers[sectionId] || {};

    if (sectionId.indexOf('writing_') === 0) {
      // Writing sections are stored as free text under key "text", not graded automatically.
      graded[sectionId] = { text: studentAnswers.text || '', correct: null, total: null };
      return;
    }

    let correct = 0;
    let total = 0;
    const writtenParts = [];
    sectionQuestions.forEach(q => {
      const given = studentAnswers[String(q.question_number)];
      if (q.question_type === 'long_text') {
        // Written-response question inside a track: keep the text, don't grade it.
        if (given) writtenParts.push(String(given).trim());
        return;
      }
      total++;
      if (given && String(given).toUpperCase() === String(q.correct_answer).toUpperCase()) {
        correct++;
      }
    });

    graded[sectionId] = { correct, total };
    if (writtenParts.length) graded[sectionId].text = writtenParts.join('\n\n');
  });

  return graded;
}

function determineLevel(graded) {
  // New routing: the track the student ended in decides the level.
  for (const t of TRACK_LEVELS) {
    if (graded[t.section]) return t.label;
  }

  // Legacy flow (no track section submitted): fall back to grammar thresholds.
  for (const section of GRAMMAR_SECTIONS) {
    const s = graded[section];
    if (!s) continue; // section wasn't visited
    if (section === 'grammar_1' && s.correct < 10) return LEVEL_LABELS.grammar_1;
    if (section === 'grammar_2' && s.correct < 10) return LEVEL_LABELS.grammar_2;
    if (section === 'grammar_3' && s.correct < 10) return LEVEL_LABELS.grammar_3;
    if (section === 'grammar_4' && s.correct < 15) return LEVEL_LABELS.grammar_4;
  }
  return LEVEL_LABELS.advanced;
}

// ============ RESULTS SHEET ============

function isDuplicateSubmission(email) {
  if (!email) return false;
  const rows = sheetToObjects('Results');
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return rows.some(r => r.email === email && new Date(r.timestamp) > cutoff);
}

// Columns the Results tab must have. Existing columns and their order are
// never changed; any missing ones are appended to the right.
const RESULT_COLUMNS = [
  'timestamp', 'email', 'full_name', 'whatsapp',
  'grammar_1_score', 'grammar_2_score', 'grammar_3_score', 'grammar_4_score',
  'reading_score', 'listening_1_score', 'listening_2_score', 'listening_3_score',
  'writing_opinion_text', 'writing_routine_text', 'writing_abroad_text', 'writing_place_text',
  'sections_visited', 'sections_skipped', 'effective_level', 'total_score', 'max_possible_score',
  'grammar_5_score', 'grammar_6_score', 'track_writing_text'
];

function ensureResultColumns(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  RESULT_COLUMNS.forEach(col => {
    if (headers.indexOf(col) === -1) {
      sheet.getRange(1, headers.length + 1).setValue(col);
      headers.push(col);
    }
  });
  return headers;
}

function saveResults(payload, graded, level) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Results');

  const scoreStr = (id) => graded[id] && graded[id].total != null ? `${graded[id].correct}/${graded[id].total}` : '';
  const textOf = (id) => graded[id] ? (graded[id].text || '') : '';

  let totalScore = 0;
  let maxScore = 0;
  const trackTexts = [];
  Object.keys(graded).forEach(id => {
    if (graded[id].total) {
      totalScore += graded[id].correct;
      maxScore += graded[id].total;
    }
    // Written answer that lives inside a graded track section.
    if (graded[id].total && graded[id].text) trackTexts.push(graded[id].text);
  });

  const values = {
    timestamp: new Date(),
    email: payload.email || '',
    full_name: payload.fullName || '',
    whatsapp: payload.whatsapp || '',
    grammar_1_score: scoreStr('grammar_1'),
    grammar_2_score: scoreStr('grammar_2'),
    grammar_3_score: scoreStr('grammar_3'),
    grammar_4_score: scoreStr('grammar_4'),
    grammar_5_score: scoreStr('grammar_5'),
    grammar_6_score: scoreStr('grammar_6'),
    reading_score: scoreStr('reading'),
    listening_1_score: scoreStr('listening_1'),
    listening_2_score: scoreStr('listening_2'),
    listening_3_score: scoreStr('listening_3'),
    writing_opinion_text: textOf('writing_opinion'),
    writing_routine_text: textOf('writing_routine'),
    writing_abroad_text: textOf('writing_abroad'),
    writing_place_text: textOf('writing_place'),
    track_writing_text: trackTexts.join('\n\n'),
    sections_visited: (payload.sectionsVisited || []).join(' -> '),
    sections_skipped: (payload.sectionsSkipped || []).join(', '),
    effective_level: level,
    total_score: totalScore,
    max_possible_score: maxScore
  };

  const headers = ensureResultColumns(sheet);
  sheet.appendRow(headers.map(h => values[h] !== undefined ? values[h] : ''));
}

// ============ EMAIL ============

function sendStudentEmail(email, fullName, graded, level) {
  if (!email) return;
  const body = `Hi ${fullName || 'there'},

Thank you for completing the SpeakFirst English Placement Test!

Your estimated level: ${level}

Our team will review your results and follow up with course recommendations shortly.

Best,
SpeakFirst`;

  MailApp.sendEmail(email, 'Your SpeakFirst Placement Test Results', body);
}

function sendAdminEmail(payload, graded, level) {
  const lines = Object.keys(graded).map(id => {
    const g = graded[id];
    const score = g.total ? `${id}: ${g.correct}/${g.total}` : `${id}: (written response)`;
    return g.text ? `${score}\n  Written: ${g.text}` : score;
  });

  const body = `New placement test submission

Name: ${payload.fullName}
Email: ${payload.email}
WhatsApp: ${payload.whatsapp}
Level: ${level}

Scores:
${lines.join('\n')}

Sections visited: ${(payload.sectionsVisited || []).join(' -> ')}
Sections skipped: ${(payload.sectionsSkipped || []).join(', ')}`;

  MailApp.sendEmail(ADMIN_EMAIL, `Placement Test: ${payload.fullName} — ${level}`, body);
}
