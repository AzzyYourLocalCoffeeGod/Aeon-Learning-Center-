// ── AEON LEARNING CENTER — MAIN SCRIPT ──

const editor = document.getElementById('editor');
let currentFormat = 'general';
const MAX_OPEN_DOCUMENTS = 16;
const MAX_RECENT_FILES = 4;
let openDocuments = [];
let activeDocumentId = null;
let documentSequence = 0;
let savedEditorRange = null;

// ── FORMATTING ──
function fmt(cmd) { document.execCommand(cmd, false, null); editor.focus(); updateToolbarState(); }
function runEditorCommand(command) {
  restoreEditorRange(captureEditorRange());
  document.execCommand(command, false, null);
  rememberEditorSelection();
  syncActiveDocument();
  updateToolbarState();
}

function captureEditorRange() {
  const selection = window.getSelection();
  if (selection && selection.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
    savedEditorRange = selection.getRangeAt(0).cloneRange();
  }
  return savedEditorRange ? savedEditorRange.cloneRange() : null;
}

function restoreEditorRange(range) {
  editor.focus();
  if (!range) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  savedEditorRange = range.cloneRange();
}

async function pasteFromClipboard() {
  const range = captureEditorRange();
  try {
    const text = window.aeonFiles
      ? await window.aeonFiles.readClipboardText()
      : await navigator.clipboard.readText();
    restoreEditorRange(range);
    document.execCommand('insertText', false, text);
    syncActiveDocument();
  } catch {
    restoreEditorRange(range);
    document.execCommand('paste');
    showToast('Clipboard paste was blocked by the system.');
  }
}

function insertImageSource(source) {
  if (!source) return;
  editor.focus();
  document.execCommand('insertImage', false, source);
  editor.querySelectorAll('img:not([data-aeon-sized])').forEach(image => {
    image.style.maxWidth = '100%';
    image.style.height = 'auto';
    image.dataset.aeonSized = 'true';
  });
  syncActiveDocument();
}

async function insertImage() {
  const range = captureEditorRange();
  if (window.aeonFiles) {
    try {
      const source = await window.aeonFiles.openImage();
      if (!source) return;
      restoreEditorRange(range);
      insertImageSource(source);
    } catch (error) {
      showToast(`Could not insert image: ${error.message}`);
    }
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/gif,image/webp';
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      restoreEditorRange(range);
      insertImageSource(reader.result);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function applyFont(font) { document.execCommand('fontName', false, font); editor.focus(); }
function applySize(size) {
  document.execCommand('fontSize', false, '7');
  editor.querySelectorAll('font[size="7"]').forEach(s => { s.removeAttribute('size'); s.style.fontSize = size + 'pt'; });
  editor.focus();
}

let currentFontColor = '#1a1a1a';
let currentHighlightColor = '#fff176';

function onFontColorChange(color) {
  currentFontColor = color;
  document.getElementById('font-color-swatch').style.background = color;
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) {
    document.execCommand('foreColor', false, color);
    editor.focus();
  }
}
function onHighlightColorChange(color) {
  currentHighlightColor = color;
  document.getElementById('highlight-color-swatch').style.boxShadow = `inset 0 0 0 30px ${color}bb`;
}
function applyColor(color) {
  document.execCommand('foreColor', false, color);
  editor.focus();
}
function applyHighlight() {
  document.execCommand('hiliteColor', false, currentHighlightColor);
  const btn = document.getElementById('btn-highlight');
  btn.style.background = currentHighlightColor + '66';
  btn.style.borderColor = currentHighlightColor;
  setTimeout(() => { btn.style.background = ''; btn.style.borderColor = ''; }, 500);
  editor.focus();
}
function applyHeading(level) {
  document.execCommand('formatBlock', false, 'h' + level);
  editor.focus();
  updateChapterNav();
}
function applyBlockquote() { document.execCommand('formatBlock', false, 'blockquote'); editor.focus(); }

function updateToolbarState() {
  document.getElementById('btn-bold').classList.toggle('active', document.queryCommandState('bold'));
  document.getElementById('btn-italic').classList.toggle('active', document.queryCommandState('italic'));
  document.getElementById('btn-underline').classList.toggle('active', document.queryCommandState('underline'));
  document.getElementById('btn-strike').classList.toggle('active', document.queryCommandState('strikeThrough'));
}
function rememberEditorSelection() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) savedEditorRange = range.cloneRange();
}

editor.addEventListener('keyup', () => { updateToolbarState(); rememberEditorSelection(); });
editor.addEventListener('mouseup', () => { updateToolbarState(); rememberEditorSelection(); });
editor.addEventListener('blur', rememberEditorSelection);

// ── STATS ──
function updateStats() {
  const text = editor.innerText.trim();
  const words = text === '' ? 0 : text.split(/\s+/).length;
  document.getElementById('word-count').textContent = words.toLocaleString() + ' words';
  document.getElementById('char-count').textContent = text.length.toLocaleString() + ' chars';
  document.getElementById('modal-word-count').textContent = words.toLocaleString();
  updateChapterNav();
}
editor.addEventListener('input', () => {
  syncActiveDocument();
  updateStats();
});

// ── PAGE SETTINGS ──
function applyPageSetting() {
  const ls = document.getElementById('ps-linespacing').value;
  const pw = document.getElementById('ps-pagewidth').value;
  const mg = document.getElementById('ps-margins').value;
  const bf = document.getElementById('ps-bodyfont').value;
  editor.style.lineHeight = ls;
  editor.style.fontFamily = bf;
  editor.style.padding = mg + 'px';
  document.getElementById('page').style.width = pw + 'px';
  document.getElementById('font-family-select').value = bf;
}

// ── INSERT HELPERS ──
function insertHR() { document.execCommand('insertHTML', false, '<hr>'); editor.focus(); }
function insertDate() { document.execCommand('insertText', false, new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})); editor.focus(); }
function insertPageBreak() { document.execCommand('insertHTML', false, '<div style="page-break-after:always;border-top:2px dashed #ddd;margin:30px 0;text-align:center;color:#ccc;font-size:11px;padding-top:8px;">— Page Break —</div>'); editor.focus(); }
function insertChapter() {
  const num = editor.querySelectorAll('h1').length + 1;
  document.execCommand('insertHTML', false, `<h1>Chapter ${num}</h1><p><br></p>`);
  editor.focus();
  updateChapterNav();
}
function insertPartHeading() {
  document.execCommand('insertHTML', false, `<h1 style="text-align:center;letter-spacing:0.2em;text-transform:uppercase;">PART ONE</h1><p><br></p>`);
  editor.focus();
}
function insertSceneDivider() {
  document.execCommand('insertHTML', false, `<p style="text-align:center;color:#999;letter-spacing:0.3em;">✦ &nbsp; ✦ &nbsp; ✦</p>`);
  editor.focus();
}

// ── TEMPLATES ──
const templates = {
  essay: {
    name: 'Essay',
    html: `<h1>Essay Title</h1>
<p><em>Your Name · Date</em></p>
<p><br></p>
<h2>Introduction</h2>
<p>Begin with a hook that draws the reader in. State your thesis clearly at the end of this paragraph.</p>
<p><br></p>
<h2>Body Paragraph 1</h2>
<p>Topic sentence. Supporting evidence and analysis. Transition to next point.</p>
<p><br></p>
<h2>Body Paragraph 2</h2>
<p>Topic sentence. Supporting evidence and analysis. Transition to next point.</p>
<p><br></p>
<h2>Body Paragraph 3</h2>
<p>Topic sentence. Supporting evidence and analysis. Transition to conclusion.</p>
<p><br></p>
<h2>Conclusion</h2>
<p>Restate thesis in new words. Summarize key points. End with a broader reflection or call to action.</p>`
  },
  novel: {
    name: 'Novel',
    html: `<p style="text-align:center;margin-top:120px;"><br></p>
<h1 style="text-align:center;letter-spacing:0.05em;">Novel Title</h1>
<p style="text-align:center;font-style:italic;color:#666;">A Novel</p>
<p style="text-align:center;margin-top:20px;">by Author Name</p>
<div style="page-break-after:always;border-top:2px dashed #ddd;margin:40px 0;text-align:center;color:#ccc;font-size:11px;padding-top:8px;">— Page Break —</div>
<p style="text-align:center;margin-top:60px;font-style:italic;color:#555;">For someone.</p>
<div style="page-break-after:always;border-top:2px dashed #ddd;margin:40px 0;text-align:center;color:#ccc;font-size:11px;padding-top:8px;">— Page Break —</div>
<h1>Chapter One</h1>
<p>The story begins here. Set your scene, introduce your protagonist, and give the reader a reason to turn the page.</p>
<p><br></p>
<p>Continue the opening chapter…</p>
<p><br></p>
<h1>Chapter Two</h1>
<p>The story continues…</p>`
  },
  chapter: {
    name: 'Multi-Chapter Book',
    html: `<h1 style="text-align:center;margin-top:80px;">Book Title</h1>
<p style="text-align:center;color:#666;">Subtitle or Tagline</p>
<p style="text-align:center;margin-top:16px;font-style:italic;">by Author Name</p>
<div style="page-break-after:always;border-top:2px dashed #ddd;margin:40px 0;text-align:center;color:#ccc;font-size:11px;padding-top:8px;">— Page Break —</div>
<h1 style="text-align:center;text-transform:uppercase;letter-spacing:0.25em;">PART ONE</h1>
<h2 style="text-align:center;font-style:italic;">The Beginning of Something</h2>
<div style="page-break-after:always;border-top:2px dashed #ddd;margin:30px 0;text-align:center;color:#ccc;font-size:11px;padding-top:8px;">— Page Break —</div>
<h1>Chapter 1: Opening</h1>
<h3>Section 1.1</h3>
<p>Content for section 1.1 goes here.</p>
<p><br></p>
<h3>Section 1.2</h3>
<p>Content for section 1.2 goes here.</p>
<p><br></p>
<p><em>Use Edit → Chapter Break to add the next chapter with auto-numbering.</em></p>`
  },
  academic: {
    name: 'Academic Paper',
    html: `<h1 style="text-align:center;">Paper Title: A Subtitle That Explains the Study</h1>
<p style="text-align:center;color:#666;font-style:italic;">Author Name · Institution · Date</p>
<p><br></p>
<h2>Abstract</h2>
<p>A concise summary of the paper (150–250 words). State the research question, methodology, key findings, and significance.</p>
<p><br></p>
<h2>1. Introduction</h2>
<p>Introduce the topic and context. State the problem being investigated. Present the thesis or research question. Outline the structure of the paper.</p>
<p><br></p>
<h2>2. Literature Review</h2>
<p>Survey relevant prior research. Identify gaps this paper addresses.</p>
<p><br></p>
<h2>3. Methodology</h2>
<p>Describe your research approach, data sources, and analytical methods.</p>
<p><br></p>
<h2>4. Results</h2>
<p>Present your findings clearly. Use data, examples, or evidence.</p>
<p><br></p>
<h2>5. Discussion</h2>
<p>Interpret results. Discuss implications, limitations, and future directions.</p>
<p><br></p>
<h2>6. Conclusion</h2>
<p>Summarize key contributions. Restate significance.</p>
<p><br></p>
<h2>References</h2>
<p>Author, A. (Year). Title of work. Publisher.</p>
<p>Author, B. (Year). Article title. <em>Journal Name, Volume</em>(Issue), pages.</p>`
  },
  mla: {
    name: 'MLA Essay',
    html: `<p>First Last</p>
<p>Professor Name</p>
<p>Course Name</p>
<p>${new Date().toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric'})}</p>
<h1 style="text-align:center;font-size:1.1em;font-weight:normal;">Essay Title Centered Here</h1>
<p>&nbsp;&nbsp;&nbsp;&nbsp;Begin your essay with an indented first paragraph. MLA format uses double-spacing, Times New Roman 12pt, and 1-inch margins. The first line of each paragraph is indented half an inch.</p>
<p><br></p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;Subsequent paragraphs continue here. In-text citations use the author's last name and page number in parentheses (Smith 42). No comma between name and page number.</p>
<p><br></p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;Continue your argument, analysis, or narrative. Each paragraph should have a clear topic sentence, supporting evidence, and a transition.</p>
<p><br></p>
<p>&nbsp;&nbsp;&nbsp;&nbsp;Conclusion paragraph restates your thesis and synthesizes your argument without simply repeating it.</p>
<p><br></p>
<h2 style="text-align:center;font-size:1em;font-weight:normal;">Works Cited</h2>
<p>Last, First. <em>Title of Book</em>. Publisher, Year.</p>
<p>Last, First. "Article Title." <em>Journal Name</em>, vol. 1, no. 1, Year, pp. 1–10.</p>
<p>Last, First. "Webpage Title." <em>Website Name</em>, Day Month Year, URL.</p>`
  },
  apa: {
    name: 'APA Essay',
    html: `<p style="text-align:center;margin-top:100px;"><br></p>
<h1 style="text-align:center;">Paper Title</h1>
<p style="text-align:center;">Author Name</p>
<p style="text-align:center;">Department, Institution</p>
<p style="text-align:center;">Course: COURSE 101</p>
<p style="text-align:center;">Instructor: Professor Name</p>
<p style="text-align:center;">${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>
<div style="page-break-after:always;border-top:2px dashed #ddd;margin:30px 0;text-align:center;color:#ccc;font-size:11px;padding-top:8px;">— Page Break —</div>
<h2 style="text-align:center;">Abstract</h2>
<p>&nbsp;&nbsp;&nbsp;&nbsp;The abstract is a single paragraph of 150–250 words summarizing the study's purpose, method, results, and conclusions. Do not indent the first line of the abstract.</p>
<p><em>Keywords:</em> keyword one, keyword two, keyword three</p>
<div style="page-break-after:always;border-top:2px dashed #ddd;margin:30px 0;text-align:center;color:#ccc;font-size:11px;padding-top:8px;">— Page Break —</div>
<h1 style="text-align:center;">Paper Title</h1>
<p>&nbsp;&nbsp;&nbsp;&nbsp;APA 7th edition uses double-spacing, Times New Roman or similar 12pt font, and 1-inch margins. Paragraphs are indented 0.5 inches. In-text citations include author and year: (Smith, 2022) or (Smith, 2022, p. 42) for direct quotes.</p>
<p><br></p>
<h2>Method</h2>
<h3>Participants</h3>
<p>Describe your sample here.</p>
<h3>Materials</h3>
<p>Describe instruments or stimuli used.</p>
<h3>Procedure</h3>
<p>Describe what participants did, step by step.</p>
<h2>Results</h2>
<p>Report your findings with statistics as appropriate.</p>
<h2>Discussion</h2>
<p>Interpret your results. Discuss limitations and future directions.</p>
<h2>References</h2>
<p>Last, F. M. (Year). <em>Title of book</em>. Publisher. https://doi.org/xxxxx</p>
<p>Last, F. M., &amp; Last, F. M. (Year). Article title. <em>Journal Name, Volume</em>(Issue), Page–Page. https://doi.org/xxxxx</p>`
  },
  screenplay: {
    name: 'Screenplay',
    html: `<p style="text-align:center;margin-top:80px;font-size:18pt;font-weight:bold;">SCREENPLAY TITLE</p>
<p style="text-align:center;color:#666;">Written by</p>
<p style="text-align:center;">Author Name</p>
<div style="page-break-after:always;border-top:2px dashed #ddd;margin:40px 0;text-align:center;color:#ccc;font-size:11px;padding-top:8px;">— Page Break —</div>
<p style="font-family:'Courier New',monospace;">FADE IN:</p>
<p><br></p>
<p style="font-family:'Courier New',monospace;"><strong>INT. LOCATION — DAY</strong></p>
<p style="font-family:'Courier New',monospace;">Description of the scene. What we see. The atmosphere.</p>
<p><br></p>
<p style="font-family:'Courier New',monospace;margin-left:180px;"><strong>CHARACTER NAME</strong></p>
<p style="font-family:'Courier New',monospace;margin-left:120px;margin-right:120px;">Dialogue goes here. Keep it natural and in character.</p>
<p><br></p>
<p style="font-family:'Courier New',monospace;"><strong>EXT. ANOTHER LOCATION — NIGHT</strong></p>
<p style="font-family:'Courier New',monospace;">More action description.</p>
<p><br></p>
<p style="font-family:'Courier New',monospace;margin-right:60px;text-align:right;">FADE OUT.</p>`
  },
  journal: {
    name: 'Journal',
    html: `<h1 style="text-align:center;">My Journal</h1>
<p style="text-align:center;font-style:italic;color:#888;">Personal Writing · ${new Date().getFullYear()}</p>
<p><br></p>
<hr>
<p><br></p>
<h2>${new Date().toLocaleDateString('en-US', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</h2>
<p>Today I…</p>
<p><br></p>
<p>I've been thinking about…</p>
<p><br></p>
<p>One thing I'm grateful for today:</p>
<p><br></p>
<hr>
<p><br></p>
<h2>Entry Title</h2>
<p>Write your next entry here…</p>`
  },
 resume: {
  name: 'Resume / CV',
  html: `<h1 style="text-align:center;margin-bottom:4px;">Full Name</h1>
<p style="text-align:center;font-size:0.9em;color:#555;">email@example.com · (555) 555-5555 · City, Country · linkedin.com/in/yourname</p>
<hr>

<h2>Professional Summary</h2>
<p>A brief 2-3 sentence overview of who you are, your key strengths, and what you bring to the role.</p>

<h2>Experience</h2>
<h3>Job Title — Company Name</h3>
<p style="color:#666;font-size:0.9em;">Month Year – Month Year · City, Country</p>
<p>• Key responsibility or achievement<br>• Key responsibility or achievement<br>• Key responsibility or achievement</p>

<h3>Job Title — Company Name</h3>
<p style="color:#666;font-size:0.9em;">Month Year – Month Year · City, Country</p>
<p>• Key responsibility or achievement<br>• Key responsibility or achievement</p>

<h2>Education</h2>
<h3>Degree Name — Institution</h3>
<p style="color:#666;font-size:0.9em;">Year – Year · City, Country</p>
<p>Relevant coursework, honours, or achievements.</p>

<h2>Skills</h2>
<p><strong>Technical:</strong> Skill 1, Skill 2, Skill 3, Skill 4</p>
<p><strong>Languages:</strong> Language 1 (Fluent), Language 2 (Intermediate)</p>
<p><strong>Tools:</strong> Tool 1, Tool 2, Tool 3</p>

<h2>Projects</h2>
<h3>Project Name</h3>
<p style="color:#666;font-size:0.9em;">Year · <a href="#">github.com/yourproject</a></p>
<p>Brief description of what the project does and what technologies you used.</p>

<h2>Publications / Research</h2>
<p>Author, A. (Year). <em>Title of paper or publication</em>. Journal or Conference Name.</p>

<h2>Awards & Recognition</h2>
<p>• Award Name — Issuing Organization, Year<br>• Award Name — Issuing Organization, Year</p>

<h2>References</h2>
<p style="color:#666;font-style:italic;">Available upon request.</p>`
}
};

function applyTemplate(type) {
  if (editor.innerText.trim() && !confirm(`Apply the ${templates[type].name} template? Current content will be replaced.`)) return;
  editor.innerHTML = templates[type].html;
  currentFormat = type;
  syncActiveDocument();
  document.getElementById('format-indicator').textContent = templates[type].name;
  updateStats();
  closeFormatModal();
  showToast(templates[type].name + ' template applied');
  editor.focus();
}

// ── CHAPTER NAVIGATOR ──
let sidebarOpen = false;
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.getElementById('sidebar').classList.toggle('open', sidebarOpen);
  updateChapterNav();
}

function toggleDictionaryPanel() {
  const panel = document.getElementById('dictionary-panel');
  if (panel.classList.contains('open')) closeDictionaryPanel();
  else openDictionaryPanel();
}

function openDictionaryPanel() {
  const panel = document.getElementById('dictionary-panel');
  const library = document.getElementById('library-panel');
  library.classList.remove('open');
  library.setAttribute('aria-hidden', 'true');
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  const button = document.getElementById('btn-dictionary');
  button.classList.add('active');
  button.setAttribute('aria-expanded', 'true');
  const selection = window.getSelection()?.toString().trim();
  const input = document.getElementById('dictionary-query');
  if (selection && selection.length <= 80) input.value = selection;
  if (input.value.trim()) searchDictionary(input.value);
  else input.focus();
}

function closeDictionaryPanel() {
  const panel = document.getElementById('dictionary-panel');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  const button = document.getElementById('btn-dictionary');
  button.classList.remove('active');
  button.setAttribute('aria-expanded', 'false');
  editor.focus();
}
function updateChapterNav() {
  const headings = editor.querySelectorAll('h1, h2, h3');
  const list = document.getElementById('chapter-list');
  list.innerHTML = '';
  let count = 0;
  headings.forEach((h, i) => {
    const level = h.tagName.toLowerCase();
    const item = document.createElement('div');
    item.className = 'chapter-item ' + (level === 'h2' ? 'h2' : level === 'h3' ? 'h3' : '');
    item.textContent = h.innerText.slice(0, 35) || '(untitled)';
    item.onclick = () => h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    list.appendChild(item);
    if (level === 'h1') count++;
  });
  document.getElementById('chapter-count-display').textContent = count;
}

// ── FORMAT MODAL ──
function openFormatModal(tab) {
  document.getElementById('format-modal').classList.add('open');
  switchTab(tab || 'templates');
  updateStats();
}
function closeFormatModal() { document.getElementById('format-modal').classList.remove('open'); }
function switchTab(name) {
  document.querySelectorAll('.fp-tab').forEach((t,i) => {
    const tabs = ['templates','page','novel','export'];
    t.classList.toggle('active', tabs[i] === name);
  });
  document.querySelectorAll('.fp-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
}

// ── SAVE FUNCTIONS ──
function getFilename() {
  const first = editor.innerText.trim().split('\n')[0].slice(0, 40) || 'Untitled';
  document.getElementById('titlebar-file').textContent = first;
  return first.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}
function dl(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
function saveTxt() { return saveCurrentDocument(); }

function activeDocument() {
  return openDocuments.find(doc => doc.id === activeDocumentId) || null;
}

function syncActiveDocument() {
  const doc = activeDocument();
  if (!doc) return;
  const wasDirty = doc.dirty;
  doc.html = editor.innerHTML;
  doc.format = currentFormat;
  doc.dirty = doc.html !== doc.savedHtml;
  if (wasDirty !== doc.dirty) renderDocumentTabs();
}

function updateDocumentTitle() {
  const doc = activeDocument();
  document.getElementById('titlebar-file').textContent = doc
    ? `${doc.name}${doc.dirty ? ' *' : ''}`
    : 'Untitled Document';
}

function renderDocumentTabs() {
  const strip = document.getElementById('document-tabs');
  const menuList = document.getElementById('open-documents-list');
  if (!strip || !menuList) return;
  strip.replaceChildren();
  menuList.replaceChildren();

  openDocuments.forEach(doc => {
    const tab = document.createElement('div');
    tab.className = `document-tab${doc.id === activeDocumentId ? ' active' : ''}`;
    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'document-tab-select';
    select.setAttribute('role', 'tab');
    select.setAttribute('aria-selected', String(doc.id === activeDocumentId));
    select.textContent = `${doc.name}${doc.dirty ? ' *' : ''}`;
    select.title = doc.filePath || doc.name;
    select.onclick = () => activateDocument(doc.id);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'document-tab-close';
    close.textContent = '×';
    close.title = `Close ${doc.name}`;
    close.setAttribute('aria-label', `Close ${doc.name}`);
    close.onclick = () => closeDocument(doc.id);
    tab.append(select, close);
    strip.appendChild(tab);

    const menuItem = document.createElement('div');
    menuItem.className = 'dropdown-item';
    menuItem.textContent = `${doc.name}${doc.dirty ? ' *' : ''}`;
    menuItem.onclick = () => activateDocument(doc.id);
    menuList.appendChild(menuItem);
  });

  updateDocumentTitle();
}

function createDocument(options = {}) {
  if (openDocuments.length >= MAX_OPEN_DOCUMENTS) {
    showToast(`You can have up to ${MAX_OPEN_DOCUMENTS} documents open.`);
    return null;
  }
  const html = options.html || '<p><br></p>';
  const doc = {
    id: `document-${++documentSequence}`,
    name: options.name || 'Untitled',
    filePath: options.filePath || null,
    html,
    savedHtml: options.dirty ? '' : html,
    format: options.format || 'general',
    dirty: Boolean(options.dirty)
  };
  openDocuments.push(doc);
  activateDocument(doc.id);
  return doc;
}

function activateDocument(id) {
  syncActiveDocument();
  const doc = openDocuments.find(item => item.id === id);
  if (!doc) return;
  activeDocumentId = id;
  editor.innerHTML = doc.html;
  currentFormat = doc.format;
  document.getElementById('format-indicator').textContent = currentFormat === 'general' ? '—' : currentFormat;
  updateStats();
  renderDocumentTabs();
  editor.focus();
}

function closeDocument(id) {
  const index = openDocuments.findIndex(doc => doc.id === id);
  if (index < 0) return;
  const doc = openDocuments[index];
  if (doc.dirty && !confirm(`Discard unsaved changes to "${doc.name}"?`)) return;
  openDocuments.splice(index, 1);
  if (activeDocumentId === id) {
    activeDocumentId = null;
    const replacement = openDocuments[Math.min(index, openDocuments.length - 1)];
    if (replacement) activateDocument(replacement.id);
    else {
      editor.innerHTML = '';
      updateStats();
      renderDocumentTabs();
    }
  } else {
    renderDocumentTabs();
  }
}

function serializeCurrentDocument(doc, saveAs = false) {
  if (!saveAs && doc.filePath && /\.txt$/i.test(doc.filePath)) return editor.innerText;
  if (!saveAs && doc.filePath && /\.html?$/i.test(doc.filePath)) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${doc.name}</title></head><body>${doc.html}</body></html>`;
  }
  return JSON.stringify({ html: doc.html, text: editor.innerText, format: doc.format, saved: new Date().toISOString() }, null, 2);
}

async function saveCurrentDocument(saveAs = false) {
  const doc = activeDocument();
  if (!doc) return;
  syncActiveDocument();
  if (!window.aeonFiles) {
    const filename = `${doc.name.replace(/\.[^.]+$/, '') || getFilename()}.scrb`;
    dl(new Blob([doc.html], { type: 'text/html' }), filename);
    showToast('Saved document download');
    return;
  }

  try {
    const fallbackName = /\.scrb$/i.test(doc.name) ? doc.name : `${doc.name}.scrb`;
    const result = await window.aeonFiles.saveDocument({
      filePath: doc.filePath,
      saveAs,
      name: fallbackName,
      content: serializeCurrentDocument(doc, saveAs)
    });
    if (!result) return;
    doc.filePath = result.filePath;
    doc.name = result.name;
    doc.savedHtml = doc.html;
    doc.dirty = false;
    addToRecent(doc.name, 'scrb', doc.filePath);
    renderDocumentTabs();
    showToast('Document saved');
  } catch (error) {
    showToast(`Could not save: ${error.message}`);
  }
}
function saveHtml() {
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${getFilename()}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=DM+Mono:wght@400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="aeon-learning-center.css">
</head>
<body>${document.documentElement.querySelector('body').innerHTML}</body>
<script src="aeon-learning-center.js"></script>
</html>`;
  dl(new Blob([fullHtml], {type:'text/html'}), getFilename() + '_full.html');
  showToast('Saved full app + content .html');
}
function saveJson() {
  const data = JSON.stringify({html: editor.innerHTML, text: editor.innerText, format: currentFormat, saved: new Date().toISOString()}, null, 2);
  dl(new Blob([data], {type:'application/json'}), getFilename() + '_aeon_learning_center.json');
  showToast('Saved archive');
}

async function saveOfficeExport(format) {
  if (!window.aeonFiles) {
    showToast('ODT and DOC export require the desktop app.');
    return;
  }
  try {
    const result = await window.aeonFiles.exportOffice({
      format,
      name: getFilename(),
      html: editor.innerHTML
    });
    if (result) showToast(`Saved ${format.toUpperCase()} document`);
  } catch (error) {
    showToast(error.message || `Could not export ${format.toUpperCase()}.`);
  }
}

function saveOdt() { return saveOfficeExport('odt'); }
function saveDoc() { return saveOfficeExport('doc'); }

// .docx export via html-docx-js (CDN)
function saveDocx() {
  showToast('Generating .docx…');
  if (window.htmlDocx) { _doDocxSave(); return; }
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html-docx-js/0.3.1/html-docx.js';
  script.onload = _doDocxSave;
  script.onerror = () => showToast('Word exporter unavailable. Try ODT or Word 97 export.');
  document.head.appendChild(script);
}
function _doDocxSave() {
  try {
    const content = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Georgia,serif;font-size:12pt;line-height:1.8;">${editor.innerHTML}</body></html>`;
    const blob = window.htmlDocx.asBlob(content);
    saveAs(blob, getFilename() + '.docx');
    showToast('Saved .docx → check Downloads ✓');
  } catch(e) {
    showToast(`Could not create DOCX: ${e.message}`);
  }
}

// PDF export via print dialog
function savePdf() {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=EB+Garamond:ital,wght@0,400;1,400&display=swap" rel="stylesheet">
<style>
  @page { margin: 1in; size: letter; }
  * { box-sizing: border-box; }
  body { font-family:'EB Garamond',serif; font-size:12pt; line-height:1.8; color:#000; max-width:100%; }
  h1 { font-family:'Playfair Display',serif; font-size:22pt; font-weight:700; margin:18pt 0 8pt; page-break-after:avoid; }
  h2 { font-family:'Playfair Display',serif; font-size:16pt; font-weight:400; margin:14pt 0 6pt; border-bottom:0.5pt solid #999; padding-bottom:3pt; page-break-after:avoid; }
  h3 { font-family:'Playfair Display',serif; font-size:13pt; font-weight:700; margin:10pt 0 4pt; page-break-after:avoid; }
  blockquote { border-left:2pt solid #c8a96e; padding-left:12pt; color:#444; font-style:italic; margin:10pt 0; }
  p { margin:0 0 8pt; orphans:3; widows:3; }
  hr { border:none; border-top:0.5pt solid #ccc; margin:16pt 0; }
</style>
</head><body>${editor.innerHTML}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script></body></html>`);
  printWindow.document.close();
  showToast('PDF dialog opened — choose "Save as PDF"');
}

// ── LOAD HELPER ──
function loadTextEditor(content) {
  editor.innerHTML = typeof content === 'string' ? content : '<p><br></p>';
  syncActiveDocument();
  updateStats();
  editor.focus();
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function sanitizeImportedHtml(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.querySelectorAll('script, iframe, object, embed, link, meta').forEach(node => node.remove());
  parsed.body.querySelectorAll('*').forEach(node => {
    Array.from(node.attributes).forEach(attribute => {
      if (/^on/i.test(attribute.name) || (/^(href|src)$/i.test(attribute.name) && /^\s*javascript:/i.test(attribute.value))) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return parsed.body.innerHTML || '<p><br></p>';
}

function parseOpenedDocument(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (extension === 'json' || extension === 'scrb') {
    try {
      const data = JSON.parse(file.content);
      if (data && typeof data === 'object' && (data.html || data.text)) {
        return { html: sanitizeImportedHtml(data.html || `<p>${escapeHtml(data.text)}</p>`), format: data.format || 'general' };
      }
    } catch {
      if (extension === 'json') throw new Error('This JSON file is not an Aeon document.');
    }
  }
  if (extension === 'html' || extension === 'htm') {
    return { html: sanitizeImportedHtml(file.content), format: 'general' };
  }
  return { html: `<p>${escapeHtml(file.content).replace(/\r?\n/g, '<br>')}</p>`, format: 'general' };
}

function openDocumentData(file) {
  const existing = openDocuments.find(doc => doc.filePath === file.filePath);
  if (existing) {
    activateDocument(existing.id);
    return;
  }
  if (openDocuments.length >= MAX_OPEN_DOCUMENTS) {
    showToast(`Close a document before opening more than ${MAX_OPEN_DOCUMENTS}.`);
    return;
  }
  const parsed = parseOpenedDocument(file);
  createDocument({ name: file.name, filePath: file.filePath, html: parsed.html, format: parsed.format });
  addToRecent(file.name, 'document', file.filePath);
}

// ── FILE TYPE HANDLING ──
function openAeonFile(fileData) {
    const extension = fileData.name.split('.').pop();

    switch(extension) {
        case 'scrb':  return loadTextEditor(fileData.body);
        case 'spsh':  return loadDataGrid(fileData.body);
        case 'note':  return loadMusicStaff(fileData.body);
        case 'math':  return loadEquationEditor(fileData.body);
        case 'prgrm': return loadCodeConsole(fileData.body);
        case 'stpt':  return loadAnimationCanvas(fileData.body);
        default:      return console.error("Unknown Covenant Fragment.");
    }
}

function saveAsType(type) {
    const filename = getFilename();
    switch(type) {
        case 'prsn': savePresentation(filename); break;
        case 'lxlg': startLuxLogue(filename); break;
        case 'edut': sealMasterTool(filename); break;
    }
}

function loadFile() {
  if (window.aeonFiles) {
    window.aeonFiles.openDocuments().then(files => files.forEach(openDocumentData)).catch(error => {
      showToast(`Could not open file: ${error.message}`);
    });
    return;
  }
    const input = document.createElement('input');
    input.type = 'file';
  input.accept = '.scrb,.txt,.html,.htm,.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
      try { openDocumentData({ name: file.name, content: event.target.result }); }
      catch (error) { showToast(`Could not open file: ${error.message}`); }
        };
        reader.readAsText(file);
    };
    input.click();
}

// Placeholder functions for future editors
function loadDataGrid(data) { console.log('Loading data grid:', data); }
function loadMusicStaff(data) { console.log('Loading music staff:', data); }
function loadEquationEditor(data) { console.log('Loading equation editor:', data); }
function loadCodeConsole(data) { console.log('Loading code console:', data); }
function loadAnimationCanvas(data) { console.log('Loading animation canvas:', data); }
function savePresentation(filename) { console.log('Saving presentation:', filename); }
function startLuxLogue(filename) { console.log('Starting Lux Logue:', filename); }
function sealMasterTool(filename) { console.log('Sealing master tool:', filename); }

// ── RECENT FILES ──
let recentFiles = [];
try {
  recentFiles = JSON.parse(localStorage.getItem('aeonRecentFiles') || '[]')
    .filter(file => typeof file.filePath === 'string')
    .slice(0, MAX_RECENT_FILES);
} catch {
  recentFiles = [];
}

function addToRecent(filename, type, filePath) {
    if (!filePath) return;
    recentFiles = recentFiles.filter(file => file.filePath !== filePath);
    recentFiles.unshift({ name: filename, type, filePath, timestamp: Date.now() });
    recentFiles = recentFiles.slice(0, MAX_RECENT_FILES);
    localStorage.setItem('aeonRecentFiles', JSON.stringify(recentFiles));
    updateRecentMenu();
}

function updateRecentMenu() {
    const list = document.getElementById('recent-files-list');
    if (!list) return;
    list.innerHTML = '';
    if (!recentFiles.length) {
      const empty = document.createElement('div');
      empty.className = 'dropdown-item dropdown-empty';
      empty.textContent = 'No recent files';
      list.appendChild(empty);
      return;
    }
    recentFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.textContent = file.name;
      item.title = file.filePath;
        item.onclick = () => loadRecentFile(file);
        list.appendChild(item);
    });
}

  async function loadRecentFile(file) {
    if (!window.aeonFiles) return showToast('Recent files are available in the desktop app.');
    try {
      openDocumentData(await window.aeonFiles.openRecent(file.filePath));
    } catch (error) {
      recentFiles = recentFiles.filter(item => item.filePath !== file.filePath);
      localStorage.setItem('aeonRecentFiles', JSON.stringify(recentFiles));
      updateRecentMenu();
      showToast(`Could not open recent file: ${error.message}`);
    }
}

// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── KEYBOARD SHORTCUTS ──
// NOTE: Tab suppression removed from non-chaos state to allow normal typing behaviour
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); loadFile(); }
  if (mod && e.key.toLowerCase() === 's' && !e.shiftKey) { e.preventDefault(); saveCurrentDocument(); }
  if (mod && e.key.toLowerCase() === 's' && e.shiftKey) { e.preventDefault(); saveCurrentDocument(true); }
  if (mod && e.key === 'd') { e.preventDefault(); saveDocx(); }
  if (mod && e.key === 'p') { e.preventDefault(); savePdf(); }
  if (mod && e.key === 'n') { e.preventDefault(); newDoc(); }
  if (mod && e.key === 'Tab' && openDocuments.length > 1) {
    e.preventDefault();
    const activeIndex = openDocuments.findIndex(doc => doc.id === activeDocumentId);
    const direction = e.shiftKey ? -1 : 1;
    const nextIndex = (activeIndex + direction + openDocuments.length) % openDocuments.length;
    activateDocument(openDocuments[nextIndex].id);
  }
  if (mod && e.shiftKey && e.key === 'C') { e.preventDefault(); insertChapterBreak(); }
  if (mod && e.key === '\\') { e.preventDefault(); toggleSidebar(); }
  if (mod && e.key === '1') { e.preventDefault(); applyHeading(1); }
  if (mod && e.key === '2') { e.preventDefault(); applyHeading(2); }
  if (mod && e.key === '3') { e.preventDefault(); applyHeading(3); }
  if (e.key === 'Tab' && chaosActive) { e.preventDefault(); exitChaos(); }
  // REMOVED: if (e.key === 'Tab' && !chaosActive) { e.preventDefault(); }
  if (e.key === 'Escape') {
    closeFormatModal();
    if (document.getElementById('dictionary-panel').classList.contains('open')) closeDictionaryPanel();
    if (document.getElementById('library-panel').classList.contains('open')) closeLibrary();
  }
});

function newDoc() {
  createDocument();
}

function closeMenus(returnFocus = false) {
  document.querySelectorAll('#menubar .menu-item.open').forEach(menu => {
    menu.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
    if (returnFocus) menu.focus();
  });
}

function initializeMenus() {
  const menus = Array.from(document.querySelectorAll('#menubar .menu-item'));
  menus.forEach(menu => {
    menu.tabIndex = 0;
    menu.setAttribute('aria-haspopup', 'true');
    menu.setAttribute('aria-expanded', 'false');
    menu.querySelectorAll('.dropdown-item').forEach(item => { item.tabIndex = 0; });

    menu.addEventListener('click', event => {
      if (event.target.closest('.dropdown')) {
        if (event.target.closest('.dropdown-item')) closeMenus();
        return;
      }
      const shouldOpen = !menu.classList.contains('open');
      closeMenus();
      if (shouldOpen) {
        menu.classList.add('open');
        menu.setAttribute('aria-expanded', 'true');
      }
    });

    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenus(true);
      } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        if (!menu.classList.contains('open')) menu.click();
        if (event.key === 'ArrowDown') menu.querySelector('.dropdown-item')?.focus();
      }
    });

    menu.querySelector('.dropdown')?.addEventListener('keydown', event => {
      const items = Array.from(menu.querySelectorAll('.dropdown-item'));
      const index = items.indexOf(event.target.closest('.dropdown-item'));
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenus(true);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const offset = event.key === 'ArrowDown' ? 1 : -1;
        items[(index + offset + items.length) % items.length]?.focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.target.closest('.dropdown-item')?.click();
      }
    });
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('#menubar .menu-item')) closeMenus();
  });
}

// ── CHAPTER BREAK (smart auto-numbered) ──
function insertChapterBreak() {
  const h1s = Array.from(editor.querySelectorAll('h1'));
  const chapterH1s = h1s.filter(h => !h.style.textTransform || h.style.textTransform !== 'uppercase');
  const nextNum = chapterH1s.length + 1;
  const html = `
<div style="page-break-after:always;border-top:2px dashed #ddd;margin:40px 0;text-align:center;color:#ccc;font-size:11px;padding-top:8px;">— Chapter Break —</div>
<h1>Chapter ${nextNum}</h1>
<h3>Section ${nextNum}.1</h3>
<p>Begin writing Chapter ${nextNum} here.</p>
<p><br></p>
<h3>Section ${nextNum}.2</h3>
<p>Continue the chapter…</p>
<p><br></p>`;
  document.execCommand('insertHTML', false, html);
  setTimeout(() => {
    const newH1s = editor.querySelectorAll('h1');
    const last = newH1s[newH1s.length - 1];
    if (last) last.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
  editor.focus();
  updateChapterNav();
  showToast(`Chapter ${nextNum} added`);
}

function insertPartBreak() {
  const parts = editor.querySelectorAll('h1[style*="uppercase"]').length;
  const nextPart = parts + 1;
  const romans = ['ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN'];
  const label = romans[nextPart - 1] || nextPart;
  const html = `
<div style="page-break-after:always;border-top:2px dashed #ddd;margin:40px 0;text-align:center;color:#ccc;font-size:11px;padding-top:8px;">— Part Break —</div>
<h1 style="text-align:center;text-transform:uppercase;letter-spacing:0.25em;">PART ${label}</h1>
<h2 style="text-align:center;font-style:italic;">Part Subtitle</h2>
<p><br></p>`;
  document.execCommand('insertHTML', false, html);
  editor.focus();
  updateChapterNav();
}

function renameLastChapter() {
  const h1s = editor.querySelectorAll('h1');
  if (!h1s.length) { showToast('No chapters found'); return; }
  const last = h1s[h1s.length - 1];
  const newName = prompt('Rename chapter:', last.innerText);
  if (newName !== null) { last.innerText = newName; updateChapterNav(); }
}

// ── ACADEMIC FORMAT SELECTOR ──
const academicFormatDescs = {
  mla: 'MLA is used in humanities — literature, language arts, philosophy. Uses author-page in-text citations and a Works Cited page.',
  apa: 'APA is used in social sciences, psychology, education. Uses author-year in-text citations and a References page.',
  academic: 'General academic format — suitable for most research papers without a specific style requirement.',
  chicago_notes: 'Chicago Notes-Bibliography is used in history, arts, humanities. Uses footnotes/endnotes and a Bibliography.',
  chicago_author: 'Chicago Author-Date is used in social sciences. Uses author-year in-text citations and a References list.',
  harvard: 'Harvard is widely used in UK universities across many disciplines. Uses author-year in-text and a References list.',
  ieee: 'IEEE is used in engineering, CS, and technical fields. Uses numbered citations [1] in order of appearance.',
  ama: 'AMA is used in medicine, health sciences, and biology. Uses superscript numbered citations and a References list.'
};
const academicTemplateMap = {
  mla: 'mla', apa: 'apa', academic: 'academic',
  chicago_notes: 'academic', chicago_author: 'academic',
  harvard: 'academic', ieee: 'academic', ama: 'academic'
};
document.getElementById('academic-format-select')?.addEventListener('change', function() {
  document.getElementById('academic-format-desc').textContent = academicFormatDescs[this.value] || '';
});
function applyAcademicFormat() {
  const sel = document.getElementById('academic-format-select').value;
  const tpl = academicTemplateMap[sel] || 'academic';
  applyTemplate(tpl);
}

// ── REFERENCE MODAL ──
const refContent = {
  mla: {
    title: 'MLA Format Guide',
    subtitle: 'Modern Language Association · 9th Edition · Humanities',
    body: `
<h3>Overview</h3>
<p>MLA is the standard format for papers in <strong>literature, language arts, philosophy, and humanities</strong>. It emphasizes the author and the specific page of a source.</p>
<h4>Page Setup</h4>
<ul>
  <li>12pt Times New Roman (or similar serif font)</li>
  <li>Double-spaced throughout — no extra space between paragraphs</li>
  <li>1-inch margins on all sides</li>
  <li>Header: Last name + page number, top right</li>
  <li>First paragraph indented 0.5 inches</li>
</ul>
<h4>Header Block (Top Left, First Page)</h4>
<div class="example">Your Full Name<br>Professor Name<br>Course Name and Number<br>Day Month Year</div>
<h4>Title</h4>
<p>Centered, standard capitalization, no bold or italics. No separate title page unless requested.</p>
<h4>In-Text Citations</h4>
<p>Author's last name and page number in parentheses — no comma between them.</p>
<div class="example">"The sky was red" (Smith 42).<br>According to Smith, the sky turned red (42).<br>For two authors: (Smith and Jones 14).<br>For no author, use shortened title: ("Article Title" 5).</div>
<h4>Works Cited Page</h4>
<p>Title "Works Cited" centered. Entries alphabetized by author's last name. Hanging indent (first line flush, subsequent lines indented 0.5").</p>
<div class="example"><strong>Book:</strong> Last, First. <em>Title of Book</em>. Publisher, Year.<br><br><strong>Article:</strong> Last, First. "Article Title." <em>Journal</em>, vol. 1, no. 2, Year, pp. 10–20.<br><br><strong>Website:</strong> Last, First. "Page Title." <em>Site Name</em>, Day Mon. Year, URL.<br><br><strong>No author:</strong> "Article Title." <em>Site Name</em>, Year, URL.</div>
<h4>Quick Rules</h4>
<ul>
  <li>Italicize titles of long works (books, journals, films)</li>
  <li>Put titles of short works in "quotation marks" (articles, poems, chapters)</li>
  <li>Use "et al." after first author when 3 or more authors</li>
  <li>DOI preferred over URL for journal articles</li>
</ul>`
  },
  apa: {
    title: 'APA Format Guide',
    subtitle: 'American Psychological Association · 7th Edition · Social Sciences',
    body: `
<h3>Overview</h3>
<p>APA is standard in <strong>psychology, education, social sciences, nursing, and business</strong>. It emphasizes recency — the year of publication is prominent in every citation.</p>
<h4>Page Setup</h4>
<ul>
  <li>12pt Times New Roman, Calibri 11pt, or Arial 11pt</li>
  <li>Double-spaced throughout, including references</li>
  <li>1-inch margins on all sides</li>
  <li>Running head (paper title, shortened to 50 chars) top left; page number top right</li>
  <li>Paragraphs indented 0.5 inches</li>
</ul>
<h4>Title Page</h4>
<div class="example">Paper Title (bold, centered, upper half of page)<br>Author Name(s)<br>Department, University<br>Course Number and Name<br>Instructor Name<br>Date</div>
<h4>In-Text Citations</h4>
<div class="example">One author: (Smith, 2022)<br>Two authors: (Smith &amp; Jones, 2022)<br>Three or more: (Smith et al., 2022)<br>Direct quote: (Smith, 2022, p. 42)<br>Narrative: Smith (2022) found that…</div>
<h4>References Page</h4>
<p>Title "References" bold and centered. Hanging indent. Alphabetical by last name.</p>
<div class="example"><strong>Journal article:</strong><br>Last, F. M., &amp; Last, F. M. (Year). Title of article. <em>Journal Name, Volume</em>(Issue), Page–Page. https://doi.org/xxxxx<br><br><strong>Book:</strong><br>Last, F. M. (Year). <em>Title of book</em>. Publisher.<br><br><strong>Webpage:</strong><br>Last, F. M. (Year, Month Day). Title of page. Site Name. URL<br><br><strong>No author:</strong><br>Title of article. (Year). <em>Journal, Volume</em>(Issue), Page–Page.</div>
<h4>Quick Rules</h4>
<ul>
  <li>Only capitalize the first word of article/chapter titles (and proper nouns)</li>
  <li>Italicize journal names and volume numbers</li>
  <li>Include DOI as hyperlink when available</li>
  <li>List up to 20 authors; use ellipsis for more (Last author listed after …)</li>
</ul>`
  },
  chicago_notes: {
    title: 'Chicago Notes-Bibliography',
    subtitle: 'Chicago Manual of Style · 17th Edition · History & Humanities',
    body: `
<h3>Overview</h3>
<p>The Notes-Bibliography (NB) system is preferred in <strong>history, literature, arts, and some social sciences</strong>. Sources are cited in footnotes or endnotes plus a separate Bibliography.</p>
<h4>Page Setup</h4>
<ul>
  <li>12pt Times New Roman, double-spaced body text</li>
  <li>1-inch margins; first line of paragraphs indented 0.5"</li>
  <li>Page numbers top right or bottom center</li>
  <li>Footnotes single-spaced, 10pt, separated from body by short line</li>
</ul>
<h4>Footnotes / Endnotes</h4>
<div class="example">In text: The war ended in a stalemate.<sup>1</sup><br><br>Note: <sup>1</sup> John Smith, <em>The Great War</em> (New York: Publisher, 2020), 142.<br><br>Subsequent citation: <sup>2</sup> Smith, <em>Great War</em>, 150.</div>
<h4>Bibliography</h4>
<div class="example"><strong>Book:</strong> Last, First. <em>Title of Book</em>. City: Publisher, Year.<br><br><strong>Article:</strong> Last, First. "Article Title." <em>Journal Name</em> Volume, no. Issue (Year): Page–Page.<br><br><strong>Website:</strong> Last, First. "Page Title." Site Name. Month Day, Year. URL.</div>`
  },
  chicago_author: {
    title: 'Chicago Author-Date',
    subtitle: 'Chicago Manual of Style · 17th Edition · Social Sciences',
    body: `
<h3>Overview</h3>
<p>The Author-Date system is used in <strong>social sciences, physical sciences, and some humanities</strong>.</p>
<h4>In-Text Citations</h4>
<div class="example">(Smith 2020)<br>(Smith 2020, 142)<br>(Smith and Jones 2020)<br>(Smith et al. 2020)</div>
<h4>References Page</h4>
<div class="example"><strong>Book:</strong> Last, First. Year. <em>Title of Book</em>. City: Publisher.<br><br><strong>Article:</strong> Last, First. Year. "Article Title." <em>Journal</em> Volume (Issue): Page–Page. https://doi.org/xxxxx<br><br><strong>Website:</strong> Last, First. Year. "Page Title." Site Name. Accessed Month Day. URL.</div>
<h4>Key Differences from APA</h4>
<ul>
  <li>No comma between author and year: (Smith 2020) not (Smith, 2020)</li>
  <li>Capitalize all major words in journal titles</li>
  <li>City of publication included for books</li>
</ul>`
  },
  harvard: {
    title: 'Harvard Referencing',
    subtitle: 'Author-Date System · Common in UK Universities',
    body: `
<h3>Overview</h3>
<p>Harvard is widely used across UK and Australian universities in <strong>social sciences, business, law, and humanities</strong>.</p>
<h4>In-Text Citations</h4>
<div class="example">One author: (Smith 2022)<br>Two authors: (Smith and Jones 2022)<br>Three or more: (Smith et al. 2022)<br>Direct quote: (Smith 2022, p. 42)</div>
<h4>Reference List</h4>
<div class="example"><strong>Book:</strong> Last, F. (Year) <em>Title of Book</em>. City: Publisher.<br><br><strong>Chapter:</strong> Last, F. (Year) 'Chapter title', in Editor, F. (ed.) <em>Book Title</em>. City: Publisher, pp. 10–20.<br><br><strong>Journal:</strong> Last, F. (Year) 'Article title', <em>Journal Name</em>, Volume(Issue), pp. 10–20.<br><br><strong>Website:</strong> Last, F. (Year) Title [Online]. Available at: URL (Accessed: Day Month Year).</div>
<h4>Key Notes</h4>
<ul>
  <li>Format varies slightly between institutions — always check your university's guide</li>
  <li>Article and chapter titles use single quotation marks</li>
  <li>"et al." used for 3 or more authors</li>
</ul>`
  },
  ieee: {
    title: 'IEEE Citation Style',
    subtitle: 'Institute of Electrical and Electronics Engineers · Engineering & CS',
    body: `
<h3>Overview</h3>
<p>IEEE is the standard for <strong>engineering, computer science, and technology</strong> papers. Citations are numbered in order of appearance.</p>
<h4>In-Text Citations</h4>
<div class="example">The algorithm was first proposed in [1].<br>Several studies confirm this [2], [3], [4].<br>As shown in [1]–[3], the method converges.</div>
<h4>Reference List</h4>
<div class="example"><strong>Journal:</strong><br>[1] F. Last and F. Last, "Title," <em>Abbrev. Journal</em>, vol. 1, no. 2, pp. 10–20, Month Year, doi: xxxxx.<br><br><strong>Conference:</strong><br>[2] F. Last, "Paper title," in <em>Proc. Conf. Name</em>, City, Year, pp. 1–5.<br><br><strong>Book:</strong><br>[3] F. Last, <em>Title of Book</em>, xth ed. City: Publisher, Year.<br><br><strong>Website:</strong><br>[4] F. Last, "Title," Site. [Online]. Available: URL. [Accessed: Day-Mon.-Year].</div>
<h4>Key Rules</h4>
<ul>
  <li>Use abbreviated journal names</li>
  <li>Author initials before last name: F. M. Last</li>
  <li>Article titles in quotes, book/journal titles in italics</li>
  <li>Numbers cited consecutively — never jump back</li>
</ul>`
  },
  ama: {
    title: 'AMA Citation Style',
    subtitle: 'American Medical Association · Medicine & Health Sciences',
    body: `
<h3>Overview</h3>
<p>AMA is used in <strong>medicine, health sciences, biology, and nursing</strong>. Uses numbered citations in order of appearance.</p>
<h4>In-Text Citations</h4>
<div class="example">The treatment was effective.<sup>1</sup><br>Multiple studies agree.<sup>2,3</sup><br>See references 4 through 6.<sup>4-6</sup></div>
<h4>Reference List</h4>
<div class="example"><strong>Journal:</strong><br>1. Last FM, Last FM. Article title. <em>J Abbrev Name</em>. Year;Volume(Issue):Page-Page. doi:xxxxx<br><br><strong>Book:</strong><br>2. Last FM. <em>Title of Book</em>. xth ed. Publisher; Year.<br><br><strong>Chapter:</strong><br>3. Last FM. Chapter title. In: Editor FM, ed. <em>Book Title</em>. Publisher; Year:Page-Page.<br><br><strong>Website:</strong><br>4. Last FM. Page title. Site Name. Published Month Day, Year. Accessed Month Day, Year. URL</div>
<h4>Key Rules</h4>
<ul>
  <li>Up to 6 authors; if more, list first 3 then "et al."</li>
  <li>Journal names abbreviated using standard medical abbreviations</li>
  <li>No space before superscript numbers</li>
  <li>Semicolons separate volume/issue/pages: 2023;12(3):45-50</li>
</ul>`
  },
  turabian: {
    title: 'Turabian Style',
    subtitle: 'A Manual for Writers · Based on Chicago · Student Papers',
    body: `
<h3>Overview</h3>
<p>Turabian is a simplified Chicago style for <strong>student research papers, theses, and dissertations</strong>. See Chicago NB or Chicago AD tabs for full citation examples.</p>
<h4>Key Differences from Chicago</h4>
<ul>
  <li>Title pages are standard</li>
  <li>Some flexibility in formatting for student submissions</li>
  <li>Same footnote/bibliography rules as Chicago NB</li>
  <li>Same author-date rules as Chicago AD</li>
</ul>
<h4>Title Page</h4>
<div class="example">Title of Paper<br><br>Your Name<br><br>Course Name and Number<br>Professor Name<br>University Name<br>Date</div>`
  }
};

function openRefModal(fmt) {
  const modal = document.getElementById('ref-modal');
  modal.style.display = 'flex';
  const data = refContent[fmt] || refContent['mla'];
  document.getElementById('ref-title').textContent = data.title;
  document.getElementById('ref-subtitle').textContent = data.subtitle;
  document.getElementById('ref-body').innerHTML = data.body;
  document.querySelectorAll('.ref-tab').forEach(t => t.classList.toggle('active', t.dataset.fmt === fmt));
}
function closeRefModal() {
  document.getElementById('ref-modal').style.display = 'none';
}
document.getElementById('ref-modal').addEventListener('click', function(e) {
  if (e.target === this) closeRefModal();
});

// ── CHAOS EASTER EGG ──
let chaosActive = false, chaosBuffer = '', chaosAnim;

editor.addEventListener('keydown', e => {
  if (e.key.length === 1) {
    chaosBuffer = (chaosBuffer + e.key.toLowerCase()).slice(-8);
    if (chaosBuffer.includes('chaoslux')) triggerChaos();
  }
});

function triggerChaos() {
  chaosActive = true;
  const overlay = document.getElementById('chaos-overlay');
  const c = document.getElementById('chaos-canvas');
  overlay.classList.add('active');
  c.width = window.innerWidth; c.height = window.innerHeight;
  const ctx = c.getContext('2d');
  const words = (editor.innerText.trim() || 'chaosLux Aeon Learning Center').split(/\s+/).filter(w => w.length > 0);
  const particles = words.map(w => ({
    text: w,
    x: Math.random() * c.width, y: Math.random() * c.height,
    vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
    hue: Math.random() * 360,
    size: 14 + Math.random() * 30,
    rot: (Math.random() - 0.5) * 0.1
  }));
  function loop() {
    ctx.fillStyle = 'rgba(10,10,15,0.12)';
    ctx.fillRect(0, 0, c.width, c.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -100) p.x = c.width + 50;
      if (p.x > c.width + 100) p.x = -50;
      if (p.y < -50) p.y = c.height + 20;
      if (p.y > c.height + 50) p.y = -20;
      p.hue = (p.hue + 0.8) % 360;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.font = `${p.size}px 'Playfair Display', serif`;
      ctx.fillStyle = `hsl(${p.hue},80%,70%)`;
      ctx.shadowColor = `hsl(${p.hue},90%,60%)`;
      ctx.shadowBlur = 16;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    });
    chaosAnim = requestAnimationFrame(loop);
  }
  loop();
  chaosBuffer = '';
}

function exitChaos() {
  chaosActive = false;
  cancelAnimationFrame(chaosAnim);
  document.getElementById('chaos-overlay').classList.remove('active');
  document.getElementById('chaos-canvas').getContext('2d').clearRect(0,0,9999,9999);
  editor.focus();
}

initializeMenus();
initializeDictionaryUI();
initializeLibraryUI();
newDoc();
updateRecentMenu();

// Ensure editor is focused whenever possible
editor.focus();