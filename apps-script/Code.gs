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
const ADMIN_EMAIL = 'REPLACE_WITH_ADMIN_EMAIL@example.com';

// Section metadata used for level determination + writing/listening assignment.
const GRAMMAR_SECTIONS = ['grammar_1', 'grammar_2', 'grammar_3', 'grammar_4'];
const LEVEL_LABELS = {
  grammar_1: 'Beginner (A1)',
  grammar_2: 'Elementary (A2)',
  grammar_3: 'Intermediate (B1)',
  grammar_4: 'Upper Intermediate (B2)',
  advanced: 'Advanced (C1)'
};

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
    sectionQuestions.forEach(q => {
      const given = studentAnswers[String(q.question_number)];
      if (given && String(given).toUpperCase() === String(q.correct_answer).toUpperCase()) {
        correct++;
      }
    });

    graded[sectionId] = { correct, total: sectionQuestions.length };
  });

  return graded;
}

function determineLevel(graded) {
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

function saveResults(payload, graded, level) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Results');

  const scoreStr = (id) => graded[id] ? `${graded[id].correct}/${graded[id].total}` : '';
  const textOf = (id) => graded[id] ? (graded[id].text || '') : '';

  let totalScore = 0;
  let maxScore = 0;
  Object.keys(graded).forEach(id => {
    if (graded[id].total) {
      totalScore += graded[id].correct;
      maxScore += graded[id].total;
    }
  });

  sheet.appendRow([
    new Date(),
    payload.email || '',
    payload.fullName || '',
    payload.whatsapp || '',
    scoreStr('grammar_1'),
    scoreStr('grammar_2'),
    scoreStr('grammar_3'),
    scoreStr('grammar_4'),
    scoreStr('reading'),
    scoreStr('listening_1'),
    scoreStr('listening_2'),
    scoreStr('listening_3'),
    textOf('writing_opinion'),
    textOf('writing_routine'),
    textOf('writing_abroad'),
    textOf('writing_place'),
    (payload.sectionsVisited || []).join(' -> '),
    (payload.sectionsSkipped || []).join(', '),
    level,
    totalScore,
    maxScore
  ]);
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
    return g.total ? `${id}: ${g.correct}/${g.total}` : `${id}: (written response)`;
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
