/**
 * MIGRATION / RE-SYNC SCRIPT
 * Run this from the Google Form's Script Editor:
 *   Form → ⋮ menu → Script editor → paste this file → Run > exportFormToSheet
 *
 * Safe to re-run any time you edit the Form (questions, options, correct
 * answers, or the reading passage). It updates the "Questions" tab of the
 * existing target Sheet IN PLACE — "Routing Rules" and "Results" tabs are
 * left untouched.
 *
 * IMPORTANT: Because this overwrites the Questions tab, make all content
 * edits (questions, options, correct answers, passages) in the FORM, not
 * directly in the Sheet — direct Sheet edits to Questions get wiped out
 * the next time you run this.
 *
 * How sections are detected (by keyword in each Page Break's title —
 * case-insensitive, so "Section 1", "Grammar 1", etc. are all fine as long
 * as the title contains one of these words):
 *   - contains "read"   -> one "reading" section
 *   - contains "listen" -> "listening_1", "listening_2", "listening_3" in
 *                          the order they appear
 *   - contains "writ"   -> mapped to writing_opinion / writing_routine /
 *                          writing_abroad / writing_place by keyword match
 *                          on the title (opinion / routine / daily /
 *                          abroad / another country / place / like)
 *   - anything else      -> treated as a grammar level: "grammar_1",
 *                          "grammar_2", etc. in the order they appear
 *
 * The keywords only decide the section_id. The section_title written to the
 * sheet is the Page Break's title exactly as typed in the Form (a generated
 * title is used only if the Page Break title is blank).
 *
 * Reading passage: put the passage text in a "Section header" form item
 * (Add item -> Section header) placed right before the reading questions,
 * OR as the Page Break's own description field. Either is picked up
 * automatically and attached to the first question of that section — for
 * ANY section, not just ones named "reading" (a Listening section's page can
 * contain its own embedded reading passage and/or writing prompt too).
 *
 * Audio/video and per-question images: Apps Script's FormApp service cannot
 * read back the URL of an embedded Video item (VideoItem exposes only
 * getId/getTitle/getHelpText/getWidth/getAlignment — no getVideoUrl), and an
 * embedded Image item only exposes the image as a Blob, not the public URL
 * Forms serves it at. Because of that API limitation, these URLs can't be
 * extracted automatically — they're hardcoded below in AUDIO_URL_BY_SECTION
 * and IMAGE_URL_BY_QUESTION. Update those maps by hand whenever a Skills
 * section's listening video changes, or a question's embedded image changes.
 */

const TARGET_SPREADSHEET_ID = '1uVAM7SFuO_be7Sb0Wwoir7ZneDT8vMbFvyQGnQS-g1Y';

// section_id -> the section's listening video URL (see comment above).
const AUDIO_URL_BY_SECTION = {
  listening_1: 'https://youtu.be/q6ATcDl7d6E',
  grammar_5: 'https://youtu.be/JOhB8HbNFWk',
  grammar_6: 'https://www.youtube.com/watch?v=zNHLiKQ_rw4',
  listening_2: 'https://www.youtube.com/watch?v=7I1Ij7ZFi7M',
};

// "section_id:question_number" -> that question's embedded image URL.
const IMAGE_URL_BY_QUESTION = {
  'grammar_2:10': 'https://docs.google.com/u/0/forms-images-rt/ANbbkighqZIn687zN5VudzrCzNiWvssyRzbr7XHDBDtrrf1mJwbtjad7kEks-ZC3ciq6yc_G5CHzfVozqYjWT2kE_xVI0SjjizZ0TbbW1eEt0IUEJ1mVF2-9hHsut7yg4xoB4fT46q-BgCVuANJNs7if-cKZMtc3IzolM7XBa6WMDacvGPWyfEe1YM3rTKIjc1RwQik66xkl=w338',
};

function exportFormToSheet() {
  const form = FormApp.getActiveForm();
  const items = form.getItems();
  const ss = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);

  let sheet = ss.getSheetByName('Questions');
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet('Questions');
  }

  const headers = [
    'section_id', 'section_title', 'question_number',
    'question_text', 'question_type', 'option_a', 'option_b',
    'option_c', 'option_d', 'correct_answer', 'points',
    'image_url', 'audio_url', 'passage_text'
  ];
  sheet.appendRow(headers);

  const grammarCounter = { n: 0 };
  const listeningCounter = { n: 0 };

  let currentSectionId = 'intro';
  let currentTitle = 'Introduction';
  let currentPassage = '';
  let currentAudioUrl = '';
  let questionNum = 0;
  const rows = [];
  let passageAttachedForSection = false;
  let audioAttachedForSection = false;

  const writingMap = [
    { keywords: ['opinion'], id: 'writing_opinion', title: 'Writing — Opinion Essay' },
    { keywords: ['routine', 'daily'], id: 'writing_routine', title: 'Writing — Daily Routine' },
    { keywords: ['abroad', 'another country', 'studying'], id: 'writing_abroad', title: 'Writing — Studying Abroad' },
    { keywords: ['place', 'like'], id: 'writing_place', title: 'Writing — A Place I Like' },
  ];

  function classifySection(title) {
    const t = title.toLowerCase();
    if (t.indexOf('read') !== -1) {
      return { id: 'reading', title: 'Reading' };
    }
    if (t.indexOf('listen') !== -1) {
      listeningCounter.n++;
      return { id: `listening_${listeningCounter.n}`, title: `Listening — Set ${listeningCounter.n}` };
    }
    if (t.indexOf('writ') !== -1) {
      for (const w of writingMap) {
        if (w.keywords.some(k => t.indexOf(k) !== -1)) {
          return { id: w.id, title: w.title };
        }
      }
      return { id: slugify(title), title: title }; // fallback, won't match routing/frontend
    }
    grammarCounter.n++;
    return { id: `grammar_${grammarCounter.n}`, title: `Grammar — Level ${grammarCounter.n}` };
  }

  for (const item of items) {
    if (item.getType() === FormApp.ItemType.PAGE_BREAK) {
      const pb = item.asPageBreakItem();
      const formTitle = (pb.getTitle() || '').trim();
      const classified = classifySection(formTitle);
      currentSectionId = classified.id;
      // Use the title exactly as typed in the Form; fall back to the generated one if blank.
      currentTitle = formTitle || classified.title;
      questionNum = 0;
      currentPassage = '';
      currentAudioUrl = AUDIO_URL_BY_SECTION[currentSectionId] || '';
      passageAttachedForSection = false;
      audioAttachedForSection = false;
      // Some authors put the passage in the page break's own help text.
      try {
        const helpText = pb.getHelpText && pb.getHelpText();
        if (helpText) currentPassage = helpText;
      } catch (e) { /* not all versions expose this on PageBreakItem */ }
      continue;
    }

    if (item.getType() === FormApp.ItemType.SECTION_HEADER) {
      const sh = item.asSectionHeaderItem();
      // "Untitled Title" is Forms' own placeholder for a Section Header whose
      // title was never set (e.g. one added purely as a visual divider) — not
      // real content, so it's excluded rather than appended to the passage.
      const title = sh.getTitle();
      const parts = [(title && title !== 'Untitled Title') ? title : '', sh.getHelpText()].filter(Boolean);
      const text = parts.join('\n\n');
      if (text) currentPassage = currentPassage ? currentPassage + '\n\n' + text : text;
      continue;
    }

    // Video and Image items embedded on the page: Apps Script can't read
    // their URLs back (see the AUDIO_URL_BY_SECTION/IMAGE_URL_BY_QUESTION
    // comment above), so these items are just skipped — the hardcoded maps
    // supply the URLs instead.
    if (item.getType() === FormApp.ItemType.VIDEO || item.getType() === FormApp.ItemType.IMAGE) {
      continue;
    }

    if (item.getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
      questionNum++;
      const mc = item.asMultipleChoiceItem();
      const choices = mc.getChoices();
      const correctIdx = choices.findIndex(c => c.isCorrectAnswer());
      const letters = ['A', 'B', 'C', 'D'];

      rows.push([
        currentSectionId,
        currentTitle,
        questionNum,
        mc.getTitle(),
        'multiple_choice',
        choices[0] ? choices[0].getValue() : '',
        choices[1] ? choices[1].getValue() : '',
        choices[2] ? choices[2].getValue() : '',
        choices[3] ? choices[3].getValue() : '',
        correctIdx >= 0 ? letters[correctIdx] : '',
        mc.getPoints() || 1,
        IMAGE_URL_BY_QUESTION[`${currentSectionId}:${questionNum}`] || '',
        (!audioAttachedForSection && currentAudioUrl) ? currentAudioUrl : '',
        (!passageAttachedForSection && currentPassage) ? currentPassage : ''
      ]);
      passageAttachedForSection = passageAttachedForSection || !!currentPassage;
      audioAttachedForSection = audioAttachedForSection || !!currentAudioUrl;
      continue;
    }

    if (item.getType() === FormApp.ItemType.TEXT || item.getType() === FormApp.ItemType.PARAGRAPH_TEXT) {
      questionNum++;
      rows.push([
        currentSectionId,
        currentTitle,
        questionNum,
        item.getTitle(),
        'long_text',
        '', '', '', '', '', 0,
        '',
        (!audioAttachedForSection && currentAudioUrl) ? currentAudioUrl : '',
        (!passageAttachedForSection && currentPassage) ? currentPassage : ''
      ]);
      passageAttachedForSection = passageAttachedForSection || !!currentPassage;
      audioAttachedForSection = audioAttachedForSection || !!currentAudioUrl;
      continue;
    }
  }

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  ensureRoutingRulesTab(ss);
  ensureResultsTab(ss);

  Logger.log('Updated Questions tab in: ' + ss.getUrl());
  return ss.getUrl();
}

function ensureRoutingRulesTab(ss) {
  if (ss.getSheetByName('Routing Rules')) return; // don't touch existing rules
  const sheet = ss.insertSheet('Routing Rules');
  sheet.appendRow(['after_section', 'condition', 'then_go_to', 'else_go_to']);
  sheet.appendRow(['grammar_1', 'score < 10', 'reading', 'grammar_2']);
  sheet.appendRow(['grammar_2', 'score < 10', 'reading', 'grammar_3']);
  sheet.appendRow(['grammar_3', 'score < 10', 'reading', 'grammar_4']);
}

function ensureResultsTab(ss) {
  if (ss.getSheetByName('Results')) return; // don't touch existing results
  const sheet = ss.insertSheet('Results');
  sheet.appendRow([
    'timestamp', 'email', 'full_name', 'whatsapp',
    'grammar_1_score', 'grammar_2_score', 'grammar_3_score', 'grammar_4_score',
    'reading_score', 'listening_1_score', 'listening_2_score', 'listening_3_score',
    'writing_opinion_text', 'writing_routine_text', 'writing_abroad_text', 'writing_place_text',
    'sections_visited', 'sections_skipped', 'effective_level', 'total_score', 'max_possible_score'
  ]);
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
