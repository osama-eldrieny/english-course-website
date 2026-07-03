# Pointer Feedback Skill

Apply team feedback and comments from Pointer to your local HTML files using Claude Code.

---

## 📋 SETUP: pointer-config.json (REQUIRED)

### File Location
Create this file in your **project root directory**:
```
pointer-config.json
```

### File Content
The file contains configuration values that Claude uses to fetch comments:

```json
{
  "server_url": "https://pointer2.fly.dev",
  "project_id": "proj_abc123"
}
```

### How to Get Values

1. **Open Pointer Dashboard:** https://pointer2.fly.dev/dashboard
2. **Find your project** in the projects list
3. **Scroll to "Setup on Your Machine"** section
4. **Copy the pointer-config.json** (click blue copy button)
5. **Create file** in your project root and paste

---

## 🤖 How Claude Uses This File

When you ask Claude: **"Apply pending Pointer comments"**

Claude will:
1. **Read** `pointer-config.json` from your project
2. **Extract** the `server_url` and `project_id` values
3. **Fetch** pending comments from: `{server_url}/api/pending?project_id={project_id}`
4. **Apply** changes to your local HTML files
5. **Mark each comment as applied** on the server (syncs status immediately)
6. **Clear the queue** after all comments are processed

---

## ✨ WORKFLOW: Apply Pending Comments

### How to Use

**Ask Claude:**
```
Apply pending Pointer comments
```

**Or:**
```
Fetch comments from Pointer and apply them to the HTML files
```

**Or:**
```
What comments are waiting to be applied?
```

### What Happens

Claude will:
- ✅ Read your `pointer-config.json`
- ✅ Fetch pending comments from Pointer server
- ✅ Apply annotations to your HTML files
- ✅ Clear the queue automatically

### What Gets Applied

Comments appear as HTML annotations in your source files:

```html
<!-- POINTER FEEDBACK: Increase button padding -->
<button class="btn">Click me</button>
```

---

## 🔄 Multi-Environment Workflow

If you use **URL Mappings** in Pointer:

1. **Add comments** on localhost version
2. **Add comments** on production version  
3. **Ask Claude:** "Apply pending Pointer comments"
4. Comments from **ALL environments sync automatically!**

---

## 📁 Project File Structure

```
your-project/
├── index.html
├── about.html
├── styles.css
├── pointer-config.json         ← REQUIRED
├── SKILL.md                    ← This file
└── ...other files
```

---

## ⚠️ Troubleshooting

**"pointer-config.json not found"**
- Make sure file is in project root (same level as index.html, package.json, etc.)
- Check spelling: `pointer-config.json` (exact name)

**"No pending comments"**
- Open Pointer bookmarklet on your website
- Add comments using the annotation tool
- Comments appear in pending queue after submission

**"Can't connect to server"**
- Verify `server_url` in pointer-config.json is correct
- Check that `project_id` matches your Pointer project

---

## 🎯 Key Points

- **pointer-config.json is required** - Without it, Claude can't fetch comments
- **Values are dynamic** - Claude reads them from the config file (works for any project)
- **Generic file** - This SKILL.md works for all users and all projects
- **No hard-coding** - All project-specific values come from pointer-config.json
- **Server is source of truth** - Comments are tracked on Pointer server, not locally
- **Mark on server immediately** - Status syncs to team as soon as applied
- **No local audit trail needed** - Server provides complete comment history

---

## 🔗 Resources

- **Pointer Dashboard:** https://pointer2.fly.dev/dashboard
- **Download Setup Package:** Get pointer-config.json from dashboard
- **Get Bookmarklet:** Visit dashboard → Universal Bookmarklet section

---

**Ready to collaborate! 🐕**

---

## WORKFLOW 1️⃣: APPLY PENDING COMMENTS

**Triggered by:** User says "apply pending comments"

**Files modified:** 
- HTML files (edits to CSS/content)
- GitHub repository (git push with changes)

**Server-side handling:**
- Pointer server is authoritative source for comment status
- No local comment files needed

### Detailed Steps

#### Step 1: Read the work queue

First, read the project configuration:

```bash
cat pointer-config.json
```

This file contains:
- `server_url` — your Pointer server URL (e.g., `https://pointer.fly.dev`)
- `project_id` — your project ID (e.g., `proj_abc123`)

Then fetch pending comments from the server:

```bash
curl "https://your-pointer-server/api/pending?project_id=YOUR_PROJECT_ID"
```

If empty (`[]`), stop and tell user: "No pending comments to apply."

Each pending item contains:
- `id` — unique comment ID
- `html_file_path` — which HTML file to edit (e.g., `"../test.html"`)
- `element_selector` — CSS path (e.g., `"body > h1.title"`)
- `element_snapshot` — exact HTML (e.g., `"<h1 class='title'>Dashboard</h1>"`)
- `applied_css_rules` — **array of CSS rules actually styling this element** (ordered by specificity)
- `text` — what change is requested (e.g., "Make this 24px")
- `apply_to` — either `"element-only"` or `"all-similar"`
- `apply_reply_ids` — (optional) specific replies to mark as applied

#### Step 2: For each pending comment, apply the change

**2a. Find the element in the HTML file:**
1. Use `element_selector` to locate the element
2. If selector doesn't work, search by `element_snapshot` (the exact HTML)
3. If not found, tell user: "Comment ID {id} can't be found — HTML may have changed"

**2b. Understand the requested change:**
- Read comment `text` (e.g., "Make this font-size 24px")
- Understand WHAT needs to change and HOW

**2c. CRITICAL: Find the ACTUAL CSS rule being applied**
- Look at `applied_css_rules` array (last rule in array has highest specificity = actually applies)
- **NEVER create new rules** — always modify existing rules from this array
- Example:
  ```
  applied_css_rules: [".title", ".main-section .title", ".field-box p"]
  ↑ Modify the LAST one (highest specificity)
  ```

**2d. Update that CSS rule in the HTML file's `<style>` tag:**
```html
<!-- Before -->
<style>
  .field-box p { margin: 0; }
</style>

<!-- After: Apply "add 6px margin bottom" -->
<style>
  .field-box p { margin: 0 0 6px 0; }
</style>
```

**2e. Save the HTML file**

**2f. Mark comment as applied on the Pointer server**

After successfully applying the HTML change, notify the Pointer server:

```bash
curl -X POST "https://your-pointer-server/api/comments/{comment_id}/applied?project_id=YOUR_PROJECT_ID"
```

Example:
```bash
curl -X POST "https://pointer2.fly.dev/api/comments/c_1782639877305_c7mpot/applied?project_id=proj_1782598388521_xlrqgp"
```

This update:
- Shows green ✓ badge on the comment in Pointer UI
- Marks comment as resolved
- Other team members see the feedback has been applied
- Syncs status across all team members

#### Step 3: Clear the queue on the server

After all comments are applied and marked on the server:

```bash
curl -X POST "https://your-pointer-server/api/pending/clear?project_id=YOUR_PROJECT_ID"
```

#### Step 4: Done!

Tell user:
```
✓ Applied {N} pending comments to {M} HTML files
✓ All comments marked as applied on server
  - Refresh browser to see green ✓ badges
  - Status synced for entire team
```

---

## WORKFLOW 2️⃣: MERGE COMMENTS

**Triggered by:** User says "merge comments" or "import team comments"  
**Files modified:** 
- `pointer/comments-skill/comments.json`
- `pointer/comments-skill/pending-apply.json`
- `pointer/comments-skill/url-mappings.json`

**Files read:**
- New comments (ZIP or JSON)
- `pointer/comments-skill/comments.json`
- `pointer/comments-skill/url-mappings.json`

**HTML files:** NOT modified (merge only, no applying)

### Critical Rules

🔴 **NEVER apply pending comments during merge**  
🔴 **ONLY merge comments, do NOT:**
   - Edit HTML files
   - Change comment status (leave as-is from imported comments)
   - Apply any pending comments
   - Clear pending-apply.json

🔴 **ASK user about new URL mappings before proceeding**

### Detailed Steps

#### Step 1: Find and extract the new comments

**Option A: ZIP file provided**
```bash
find . -maxdepth 2 -name "*.zip" -o -name "pointer-export.zip" | head -1
```

If found:
```bash
unzip pointer-export.zip -d pointer/comments-skill/import-staging/
```

**Option B: User provides JSON directly**
- Accept the JSON object/array from user
- Save to temporary staging area

**Option C: Neither**
- Ask user: "Please provide a ZIP file or JSON comments to merge"
- Stop

#### Step 2: Read imported comments and mappings

```javascript
const importedComments = JSON.parse(fs.readFileSync('pointer/comments-skill/import-staging/comments.json', 'utf8'));
const currentMappings = JSON.parse(fs.readFileSync('pointer/comments-skill/url-mappings.json', 'utf8'));
```

#### Step 3: Identify unique origins in imported comments

Extract all unique origins from `page_url`:
```javascript
const uniqueOrigins = [...new Set(importedComments.map(c => {
  const url = new URL(c.page_url);
  return `${url.protocol}//${url.host}`;  // e.g., "https://www.uimarkets.com"
}))];
```

Example output:
```
["https://www.uimarkets.com", "https://staging.api.com"]
```

#### Step 4: FOR EACH unique origin, determine mapping

**For each origin:**

1. **Check if already mapped** in `url-mappings.json`:
   ```javascript
   const existingGroup = currentMappings.find(group => 
     group.origins.includes(origin)
   );
   ```

2. **If YES (already mapped):**
   - Use existing mapping
   - Continue to next origin
   - Example: `"https://www.uimarkets.com"` → already maps to `"http://localhost:5000"`

3. **If NO (new origin):**
   - **ASK USER:** "Found comments from `{origin}`. What local URL does this map to? (e.g., `http://localhost:3000`)"
   - User responds with local URL
   - **SAVE this mapping** to `url-mappings.json` for future imports

#### Step 5: Transform imported comments with mapped URLs

For each imported comment:

```javascript
const transformedComments = importedComments.map(comment => {
  // Find the mapping for this comment's origin
  const commentOrigin = new URL(comment.page_url);
  const originString = `${commentOrigin.protocol}//${commentOrigin.host}`;
  
  const mapping = currentMappings.find(group => 
    group.origins.includes(originString)
  );
  
  if (!mapping) {
    // This shouldn't happen if Step 4 was done correctly
    throw new Error(`No mapping found for ${originString}`);
  }
  
  // Get the local origin to map to (first origin in group, or specified local origin)
  const localOrigin = mapping.local_origin || mapping.origins[0];
  
  // Replace the origin in page_url
  const newPageUrl = comment.page_url.replace(originString, localOrigin);
  
  // Recompute html_file_path (same logic as in server.js)
  const newHtmlFilePath = mapUrlToFilePath(newPageUrl);
  
  return {
    ...comment,
    page_url: newPageUrl,
    html_file_path: newHtmlFilePath,
    _imported: true,  // Flag for browser to use fuzzy matching
    _import_source: originString  // Track where it came from
  };
});
```

#### Step 6: Merge into comments.json

Merge new comments into `pointer/comments-skill/comments.json`:

```javascript
const localComments = JSON.parse(fs.readFileSync('pointer/comments-skill/comments.json', 'utf8'));
const merged = [...localComments, ...transformedComments];

// Deduplicate by ID (skip if ID already exists)
const deduped = Object.values(
  Object.fromEntries(merged.map(c => [c.id, c]))
);

fs.writeFileSync('pointer/comments-skill/comments.json', JSON.stringify(deduped, null, 2), 'utf8');
```

Report deduplication: "Skipped X duplicate comments (already imported)"

#### Step 7: Merge into pending-apply.json (same logic)

Merge pending comments into `pointer/comments-skill/pending-apply.json`:

```javascript
const localPending = JSON.parse(fs.readFileSync('pointer/comments-skill/pending-apply.json', 'utf8'));
const importedPending = transformedComments.filter(c => 
  c.status === 'pending-apply' || (c.replies && c.replies.some(r => r.status === 'pending-apply'))
);

const mergedPending = [...localPending, ...importedPending];
const dedupedPending = Object.values(
  Object.fromEntries(mergedPending.map(c => [c.id, c]))
);

fs.writeFileSync('pointer/comments-skill/pending-apply.json', JSON.stringify(dedupedPending, null, 2), 'utf8');
```

#### Step 8: Save new mappings

```javascript
fs.writeFileSync('pointer/comments-skill/url-mappings.json', JSON.stringify(currentMappings, null, 2), 'utf8');
```

#### Step 9: Cleanup

```bash
rm -rf pointer/comments-skill/import-staging/
rm -f pointer-export.zip
```

#### Step 10: Report success to user

```
✓ Merged {N} comments
  - Added X new comments
  - Skipped Y duplicates
  - Mapping: www.uimarkets.com → localhost:5000
  - Mapping: staging.api.com → localhost:3000 (new)

Next: Visit each page in your browser to see the merged pins.
Note: If a mapped comment's element no longer exists, you can place the pin manually.

⚠️ To apply these comments, say: "apply pending comments"
```

---

## Common Patterns (Apply Workflow)

| Request | Action |
|---------|--------|
| "Make this text bold" | Find the element's CSS rule, add `font-weight: bold;` |
| "Change color to blue" | Find the rule, change/add `color: blue;` |
| "Add 10px padding" | Find the rule, add/modify `padding: 10px;` |
| "Increase font size" | Find the rule, increase the `font-size` value |
| "Remove this element" | Delete the entire HTML element (remove from DOM) |
| "Fix typo: X → Y" | Find and replace text content in the element |

**Important:** Each comment requires **TWO actions**:
1. **Modify HTML/CSS** — Edit the file
2. **Mark on Server** — POST to `/api/comments/{id}/applied` to sync status

---

## API Endpoints Reference

### Mark Single Comment as Applied

**Endpoint:**
```
POST {server_url}/api/comments/{comment_id}/applied?project_id={project_id}
```

**Parameters:**
- `comment_id` — The unique ID of the comment (e.g., `c_1782639877305_c7mpot`)
- `project_id` — Your project ID from `pointer-config.json`
- `server_url` — From `pointer-config.json`

**Example:**
```bash
curl -X POST "https://pointer2.fly.dev/api/comments/c_1782639877305_c7mpot/applied?project_id=proj_1782598388521_xlrqgp"
```

**Response:**
```json
{ "success": true, "message": "Comment c_1782639877305_c7mpot marked as applied" }
```

**What this does:**
- Updates comment status on server to `applied`
- Shows green ✓ badge in Pointer UI
- Marks as resolved for team members
- Syncs automatically across team

### Fetch Pending Comments

**Endpoint:**
```
GET {server_url}/api/pending?project_id={project_id}
```

**Example:**
```bash
curl "https://pointer2.fly.dev/api/pending?project_id=proj_1782598388521_xlrqgp"
```

### Clear All Pending Comments

**Endpoint:**
```
POST {server_url}/api/pending/clear?project_id={project_id}
```

**Example:**
```bash
curl -X POST "https://pointer2.fly.dev/api/pending/clear?project_id=proj_1782598388521_xlrqgp"
```

**What this does:**
- Clears the entire pending queue
- Only use after all comments are applied and marked on server

---

## Apply Type Modifiers

### `apply_to: "element-only"`
- Modify CSS rule for THIS specific element only
- Only elements in that rule's context are affected
- Example: `.field-box p` affects only `<p>` tags inside `.field-box`

### `apply_to: "all-similar"`
- User selected a pure CSS class selector (e.g., `.button`)
- Modify the global class rule
- **All elements with that class** are affected everywhere
- Higher impact, use carefully

---

## Handling Stale Selectors (Apply Workflow)

If `element_selector` doesn't work in the HTML:

1. Try using `element_snapshot` to find the element
2. Search by text content (if available)
3. If not found, tell user: "Comment ID {id} can't be found — the HTML may have changed since the comment was created"
4. **Do NOT proceed with other comments** — stop and report

---

## URL Mapping Structure

The `pointer/comments-skill/url-mappings.json` file stores groups of related URLs:

```json
[
  {
    "group_id": "uimarkets",
    "origins": ["https://www.uimarkets.com", "http://localhost:5000"],
    "local_origin": "http://localhost:5000",
    "created_at": "2026-06-26T10:00:00Z"
  },
  {
    "group_id": "staging_api",
    "origins": ["https://staging.api.com", "http://localhost:3000"],
    "local_origin": "http://localhost:3000",
    "created_at": "2026-06-26T11:30:00Z"
  }
]
```

Each group has:
- `group_id` — unique identifier
- `origins` — array of URLs that are considered equivalent
- `local_origin` — the local development URL
- `created_at` — when the mapping was created

When merging, if a new origin is found, ask user which local URL it should map to, then create/add to a group.

---

## Troubleshooting

### Apply Workflow Issues

**Q: What if multiple CSS rules apply to the element?**
A: The `applied_css_rules` array is ordered by specificity. **Always update the last rule** (highest specificity = what actually applies).

**Q: Should I create new CSS rules?**
A: NO. Always modify existing rules from `applied_css_rules`. Creating new rules with higher specificity is fragile and wrong.

**Q: What if the element doesn't exist anymore?**
A: Stop applying that comment. Report to user: "Element no longer exists in HTML for comment {id}"

**Q: Comment marked as applied but still appears as pending in Pointer UI?**
A: Check:
1. Did you call POST `/api/comments/{comment_id}/applied`? (Not just clear the queue)
2. Is the `comment_id` exactly correct? (Copy-paste the full ID)
3. Is the `project_id` correct in the URL?
4. Refresh the Pointer UI/browser to see updated status
5. Check server logs if endpoint returns error
6. Verify the comment_id exists before marking applied

If all above are correct but status still doesn't update, the server may not have the comment. Check that the comment exists with: `curl "https://your-server/api/pending?project_id=YOUR_ID"`

**Q: Do I need to maintain pointer/comments-skill/comments.json locally?**
A: NO. The Pointer server is the authoritative source of truth. Local comment files are no longer needed. Delete them if they exist. Server maintains complete history.

**Q: Where can I see the history of applied comments?**
A: Check the Pointer server's comment history via the web UI:
- **Dashboard:** https://pointer2.fly.dev/dashboard
- **View project:** Click project name to see all comments + status
- **Filter by status:** See applied, pending, and archived comments

### Merge Workflow Issues

**Q: What if the imported comments already exist locally (duplicate IDs)?**
A: Skip them during merge. Report: "Skipped X duplicate comments (already imported)"

**Q: What if a new origin isn't mapped?**
A: Stop and ask the user: "Found comments from {origin}. What local URL does this map to?"

**Q: What if imported comments have elements that don't exist locally?**
A: That's OK — merge them anyway. Browser will try fuzzy pin matching (due to `_imported: true` flag). If matching fails, user can manually place pins.

**Q: Should I apply comments after merging?**
A: NO, NEVER. Only merge when user says "merge comments". **Do NOT apply pending comments** — that's a separate action only when user explicitly says "apply pending comments". After merging, tell user: "Merged {N} comments. Comments are ready to apply when you're ready. To apply any pending comments, say: 'apply pending comments'"

**Q: Will merging change the status of comments?**
A: NO. Keep imported comments exactly as they are (preserve their status from the ZIP). Only update status during the APPLY workflow, never during merge.

---

## Decision Tree: Which Workflow?

```
User says...
│
├─ "apply pending comments" / "apply comments"
│  └─ → WORKFLOW 1: APPLY PENDING COMMENTS
│     • Read: pointer/comments-skill/pending-apply.json
│     • EDIT HTML files (apply CSS changes)
│     • UPDATE: pointer/comments-skill/comments.json (status → "applied")
│     • CLEAR: pointer/comments-skill/pending-apply.json
│     • Result: HTML files changed, comments marked ✓
│
├─ "merge comments" / "import team comments" / "import comments"
│  └─ → WORKFLOW 2: MERGE COMMENTS
│     • READ: ZIP or JSON with new comments
│     • MERGE: pointer/comments-skill/comments.json
│     • MERGE: pointer/comments-skill/pending-apply.json
│     • SAVE: pointer/comments-skill/url-mappings.json
│     • DO NOT: Edit HTML files
│     • DO NOT: Change comment status
│     • DO NOT: Apply pending comments
│     • DO NOT: Clear pending-apply.json
│     • Result: Comments imported, mappings saved, no HTML changed
│
└─ Anything else
   └─ Ask for clarification
```

---

## Apply Workflow Decision Tree

For each pending comment, follow this decision path:

```
For each pending comment:
│
├─ Find element in HTML using selector or snapshot
│  ├─ Found? → Continue
│  └─ Not found? → Report error, skip this comment
│
├─ Understand the requested change from comment.text
│  └─ Continue
│
├─ Find the actual CSS rule being applied (last item in applied_css_rules)
│  ├─ Found? → Continue
│  └─ Not found? → Report error, stop
│
├─ Modify the CSS rule in the HTML file
│  ├─ Success? → Continue
│  └─ Failed? → Report error, skip this comment
│
├─ Save the HTML file
│  └─ Continue
│
├─ [CRITICAL] Mark comment as applied on server
│  └─ POST /api/comments/{comment_id}/applied?project_id={project_id}
│     ├─ Success (200 OK)? → Continue
│     └─ Error? → Report error, stop this comment
│
└─ Repeat for next pending comment
   ↓
   After ALL comments processed:
   ├─ Clear the queue: POST /api/pending/clear?project_id={project_id}
   └─ Report success and instruct user to refresh browser
```

**Key Points:**
- ✅ Must mark on server (step 2f) for status to sync
- ✅ If server marking fails, stop and report error
- ✅ Server is authoritative - no local files needed
- ✅ Clear queue only after ALL comments processed
- ✅ User refreshes to see green ✓ badges

---

## Example Conversation Flow

### Apply Workflow

```
User: "apply pending comments"

AI: Reading pointer/comments-skill/pending-apply.json...
    Found 3 pending comments.
    
    Applying changes:
    • test.html — Updated .main-section h1 (font-size: 24px)
      Marking comment c_123abc as applied on server...
    • test.html — Updated .button (color: blue)
      Marking comment c_124def as applied on server...
    • about.html — Updated .title (font-weight: bold)
      Marking comment c_125ghi as applied on server...
    
    ✓ Applied 3 comments to 2 HTML files
    ✓ All statuses synced to Pointer server
    
    Clearing pending queue on Pointer server...
    
    Done! Refresh your browser to see the changes with green ✓ badges.
```

### Merge Workflow

```
User: "merge comments from my teammate"

AI: Looking for ZIP file...
    Found: pointer-export.zip
    
    Extracting to pointer/comments-skill/import-staging/...
    
    Analyzing imported comments:
    Found 12 comments from: www.uimarkets.com
    
    Checking pointer/comments-skill/url-mappings.json...
    This is a NEW origin (not mapped yet).
    
    Question: www.uimarkets.com corresponds to which local URL?
    (e.g., http://localhost:5000)

User: "localhost:5000"

AI: Saving mapping to pointer/comments-skill/url-mappings.json...
    ✓ Mapping saved: www.uimarkets.com → http://localhost:5000
    
    Transforming imported comments...
    Merging into pointer/comments-skill/comments.json...
    Merging into pointer/comments-skill/pending-apply.json...
    
    Cleaning up import-staging folder...
    
    ✓ Merged 12 comments
    - Added 12 new comments
    - Skipped 0 duplicates
    - Mapping saved: www.uimarkets.com → http://localhost:5000
    
    Visit the page in your browser to see the merged pins.
    Comments are ready to apply when you're ready.
    
    To apply any pending comments, say: "apply pending comments"
```

---

## Detailed Examples

### Apply Workflow Example

**Scenario:** User marks 2 comments for apply on index.html

**User input:** "apply pending comments"

**File reads:**
- `pointer/comments-skill/pending-apply.json` contains:
```json
[
  {
    "id": "c_1718450000_abc123",
    "html_file_path": "../index.html",
    "element_selector": "body > header h1.title",
    "element_snapshot": "<h1 class=\"title\">Dashboard</h1>",
    "applied_css_rules": [
      { "selector": "h1", "styles": "font-size: 36px;" },
      { "selector": ".title", "styles": "color: #333;" }
    ],
    "text": "Change font-size to 24px",
    "apply_to": "element-only"
  },
  {
    "id": "c_1718450100_xyz789",
    "html_file_path": "../index.html",
    "element_selector": ".button-primary",
    "element_snapshot": "<button class=\"button-primary\">Submit</button>",
    "applied_css_rules": [
      { "selector": ".button-primary", "styles": "background-color: #007bff;" }
    ],
    "text": "Change button color to red",
    "apply_to": "all-similar"
  }
]
```

**Claude applies:**
1. Reads pending-apply.json (2 items)
2. Opens `../index.html`
3. **Comment 1:** Updates `h1` rule (highest specificity in applied_css_rules)
   - Before: `h1 { font-size: 36px; }`
   - After: `h1 { font-size: 24px; }`
4. **Comment 2:** Updates `.button-primary` rule (affects all similar buttons)
   - Before: `.button-primary { background-color: #007bff; }`
   - After: `.button-primary { background-color: red; }`
5. Updates `pointer/comments-skill/comments.json`: both comments now have status="applied"
6. Clears `pointer/comments-skill/pending-apply.json`

**Result:** User refreshes browser → sees changes live with green ✓ badges

---

### Merge Workflow Example

**Scenario:** Teammate sends pointer-export.zip with comments from dev.company.com

**User input:** "merge comments"

**File reads:**
- ZIP contains `comments.json` with 8 comments from `https://dev.company.com/dashboard`
- `pointer/comments-skill/url-mappings.json` is empty (first import)

**Claude merges:**
1. Extracts ZIP to `pointer/comments-skill/import-staging/`
2. Reads imported comments → finds origin: `https://dev.company.com`
3. Checks `pointer/comments-skill/url-mappings.json` → not mapped yet
4. **Asks user:** "Found 8 comments from https://dev.company.com. Map to which local URL?"
5. User responds: "http://localhost:3000"
6. Saves new mapping to `pointer/comments-skill/url-mappings.json`:
```json
[
  {
    "group_id": "dev_company",
    "origins": ["https://dev.company.com", "http://localhost:3000"],
    "local_origin": "http://localhost:3000",
    "created_at": "2026-06-26T15:30:00Z"
  }
]
```
7. Transforms each comment: changes `page_url` from `https://dev.company.com/dashboard` → `http://localhost:3000/dashboard`
8. Merges into `pointer/comments-skill/comments.json` (8 new + 0 local = 8 total)
9. Merges pending comments into `pointer/comments-skill/pending-apply.json` if any
10. Cleans up `pointer/comments-skill/import-staging/`

**Next import:** Teammate sends more comments from same origin → mapping auto-applies, no questions asked

**Result:** Comments from dev.company.com now appear on localhost:3000 automatically

---

**For more details, see:**
- `WORKFLOWS.md` — Quick entry point (which command to use)
- `comments-skill/CLAUDE_CODE_INTEGRATION.md` — Detailed guide with more examples
- `comments-skill/QUICK_REFERENCE.md` — Quick lookup
- `comments-skill/SKILL_SETUP.md` — Architecture and v2.0 features
- `comments-skill/server.js` — Backend implementation
- `comments-skill/config.json` — Configuration options
