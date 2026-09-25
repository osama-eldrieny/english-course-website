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

// Shared password gating the question-editor admin endpoints below. NOT
// hardcoded here on purpose — set it once via Apps Script's own UI:
// Project Settings (gear icon) -> Script Properties -> Add property
// "ADMIN_PASSWORD" -> your chosen password. Anyone with this password can
// add/edit/delete Questions tab rows through the web admin page.
function getAdminPassword_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
}

const QUESTIONS_HEADERS = [
  'section_id', 'section_title', 'question_number',
  'question_text', 'question_type', 'option_a', 'option_b',
  'option_c', 'option_d', 'correct_answer', 'points',
  'image_url', 'audio_url', 'passage_text', 'required'
];

// "Sections" tab: one row per section, holding its title, an optional
// student-facing description (shown under the section title on the test
// page), and its outgoing routing rule. routing_condition is a
// "score < N" / "score >= N" expression; leave it blank for a section with
// no conditional routing (falls through to the frontend's default
// next-section / writing-prompt / finish logic).
const SECTIONS_HEADERS = [
  'section_id', 'title', 'description',
  'routing_condition', 'routing_then', 'routing_else'
];

// Section metadata used for level determination.
// Routing (after_section -> then/else) lives in the "Sections" tab and is
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
    if (action === 'sections') return serveSections();
    if (action === 'admin_questions') return serveAdminQuestions(e.parameter.password);

    return jsonResponse({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    if (payload.type === 'admin_save_question') return adminSaveQuestion(payload);
    if (payload.type === 'admin_insert_question') return adminInsertQuestion(payload);
    if (payload.type === 'admin_delete_question') return adminDeleteQuestion(payload);
    if (payload.type === 'admin_save_section') return adminSaveSection(payload);
    if (payload.type === 'admin_delete_section') return adminDeleteSection(payload);

    if (isDuplicateSubmission(payload.email)) {
      return jsonResponse({ error: 'You have already submitted this test in the last 24 hours.' });
    }

    const graded = gradeSubmission(payload.answers);
    const level = determineLevel(graded);

    saveResults(payload, graded, level);
    sendStudentEmail(payload.email, payload.fullName);
    sendAdminEmail(payload, graded, level);

    return jsonResponse({ success: true, level: level, scores: graded });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ============ ADMIN QUESTION EDITOR ============
// Backs the /admin-placement-questions.html page. Lets an admin add, edit,
// and delete Questions tab rows directly from the browser — no more editing
// the Google Form or re-running the migration script for content changes.

function checkAdminPassword_(password) {
  const expected = getAdminPassword_();
  if (!expected) throw new Error('ADMIN_PASSWORD script property is not set. See Code.gs comment near the top.');
  if (password !== expected) throw new Error('Incorrect admin password.');
}

function serveAdminQuestions(password) {
  checkAdminPassword_(password);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Questions');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i].every(c => c === '')) continue;
    const row = { _row: i + 1 }; // 1-based sheet row, used to target updates/deletes
    headers.forEach((h, idx) => { row[h] = data[i][idx]; });
    rows.push(row);
  }
  return jsonResponse({ questions: rows });
}

// payload: { type, password, row (0/blank = new row), section_id, section_title,
//   question_number, question_text, question_type, option_a..d, correct_answer,
//   points, image_url, audio_url, passage_text }
function adminSaveQuestion(payload) {
  checkAdminPassword_(payload.password);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Questions');
  if (!sheet) {
    sheet = ss.insertSheet('Questions');
    sheet.appendRow(QUESTIONS_HEADERS);
  }

  const values = QUESTIONS_HEADERS.map(h => payload[h] !== undefined ? payload[h] : '');

  if (payload.row) {
    sheet.getRange(payload.row, 1, 1, QUESTIONS_HEADERS.length).setValues([values]);
    return jsonResponse({ success: true, row: payload.row });
  }

  sheet.appendRow(values);
  return jsonResponse({ success: true, row: sheet.getLastRow() });
}

// payload: { type, password, section_id, after_question_number }
// Inserts a blank question right after after_question_number, shifting every
// later question in the section down by one — all within a single Apps
// Script execution (one HTTP round-trip from the browser), instead of the
// admin page doing it as N sequential save calls (one per shifted question),
// which was taking 15+ seconds for sections with many questions.
function adminInsertQuestion(payload) {
  checkAdminPassword_(payload.password);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Questions');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const sectionIdx = headers.indexOf('section_id');
  const numberIdx = headers.indexOf('question_number');
  const titleIdx = headers.indexOf('section_title');

  const newNumber = Number(payload.after_question_number) + 1;
  let sectionTitle = '';

  for (let i = 1; i < data.length; i++) {
    if (data[i][sectionIdx] !== payload.section_id) continue;
    if (!sectionTitle) sectionTitle = data[i][titleIdx];
    const currentNumber = Number(data[i][numberIdx]) || 0;
    if (currentNumber >= newNumber) {
      sheet.getRange(i + 1, numberIdx + 1).setValue(currentNumber + 1);
    }
  }

  const blankValues = QUESTIONS_HEADERS.map(h => {
    if (h === 'section_id') return payload.section_id;
    if (h === 'section_title') return sectionTitle;
    if (h === 'question_number') return newNumber;
    if (h === 'question_type') return 'multiple_choice';
    if (h === 'points') return 1;
    return '';
  });
  sheet.appendRow(blankValues);

  return jsonResponse({ success: true, row: sheet.getLastRow(), question_number: newNumber, section_title: sectionTitle });
}

function adminDeleteQuestion(payload) {
  checkAdminPassword_(payload.password);
  if (!payload.row) throw new Error('Missing row to delete.');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Questions');
  sheet.deleteRow(payload.row);
  return jsonResponse({ success: true });
}

// ============ ADMIN SECTION EDITOR ============

function getOrCreateSectionsSheet_(ss) {
  let sheet = ss.getSheetByName('Sections');
  if (!sheet) {
    sheet = ss.insertSheet('Sections');
    sheet.appendRow(SECTIONS_HEADERS);
    seedSectionsFromExistingData_(ss, sheet);
  }
  return sheet;
}

// First-run only: seeds the new Sections tab from whatever the Questions tab
// already describes, so existing content isn't lost when this tab is
// created. Routing fields are left blank for the admin to fill in.
function seedSectionsFromExistingData_(ss, sheet) {
  const questionsSheet = ss.getSheetByName('Questions');
  if (!questionsSheet) return;
  const seen = {};
  const order = [];
  sheetToObjects('Questions').forEach(q => {
    if (!seen[q.section_id]) {
      seen[q.section_id] = q.section_title || q.section_id;
      order.push(q.section_id);
    }
  });

  const rows = order.map(id => [id, seen[id], '', '', '', '']);
  if (rows.length) sheet.getRange(2, 1, rows.length, SECTIONS_HEADERS.length).setValues(rows);
}

function serveSections() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSectionsSheet_(ss);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i].every(c => c === '')) continue;
    const row = { _row: i + 1 };
    headers.forEach((h, idx) => { row[h] = data[i][idx]; });
    rows.push(row);
  }
  return jsonResponse({ sections: rows });
}

// payload: { type, password, section_id, title, description,
//   routing_condition, routing_then, routing_else }
// Upserts by section_id (not row index) since the admin page always knows
// the section_id but may be creating this Sections row for the first time.
function adminSaveSection(payload) {
  checkAdminPassword_(payload.password);
  if (!payload.section_id) throw new Error('Missing section_id.');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSectionsSheet_(ss);
  const data = sheet.getDataRange().getValues();

  const values = SECTIONS_HEADERS.map(h => payload[h] !== undefined ? payload[h] : '');
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payload.section_id) {
      sheet.getRange(i + 1, 1, 1, SECTIONS_HEADERS.length).setValues([values]);
      return jsonResponse({ success: true });
    }
  }
  sheet.appendRow(values);
  return jsonResponse({ success: true });
}

// Deletes the section's row from the Sections tab AND every Questions tab
// row belonging to it — an explicit, deliberate action from the admin page.
function adminDeleteSection(payload) {
  checkAdminPassword_(payload.password);
  if (!payload.section_id) throw new Error('Missing section_id.');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const sectionsSheet = getOrCreateSectionsSheet_(ss);
  const sectionsData = sectionsSheet.getDataRange().getValues();
  for (let i = sectionsData.length - 1; i >= 1; i--) {
    if (sectionsData[i][0] === payload.section_id) sectionsSheet.deleteRow(i + 1);
  }

  const questionsSheet = ss.getSheetByName('Questions');
  if (questionsSheet) {
    const qData = questionsSheet.getDataRange().getValues();
    for (let i = qData.length - 1; i >= 1; i--) {
      if (qData[i][0] === payload.section_id) questionsSheet.deleteRow(i + 1);
    }
  }

  return jsonResponse({ success: true });
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
      if (q.question_type === 'content') return; // display-only block, nothing to grade
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

  // appendRow lets Sheets turn "0060111234567" into a number and drop the zeros,
  // so rewrite the phone cell explicitly as text.
  const phoneCol = headers.indexOf('whatsapp') + 1;
  if (phoneCol > 0 && payload.whatsapp) {
    sheet.getRange(sheet.getLastRow(), phoneCol)
      .setNumberFormat('@')
      .setValue(String(payload.whatsapp));
  }
}

// ============ EMAIL ============

function sendStudentEmail(email, fullName) {
  if (!email) return;
  const body = `Hi ${fullName || 'there'},

Thank you for completing the SpeakFirst English Placement Test!

Your answers have been received. We're reviewing them now and will contact you with your results shortly.

Best,
SpeakFirst`;

  // The level is deliberately not included — students hear their result
  // from the team (it's only in the admin email and the Results sheet).
  MailApp.sendEmail(email, 'We received your SpeakFirst Placement Test', body);
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
