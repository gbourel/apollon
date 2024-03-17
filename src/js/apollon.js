const VERSION = 'v0.14.2';
document.getElementById('version').textContent = VERSION;

import { marked } from 'marked';
import { baseUrl } from "marked-base-url";
import { pandoc } from "marked-pandoc";
import { newtab } from "marked-newtab";

import { config } from './config.js';
import { gui } from './gui.js';
import { lcms } from './lcms.js';

let _pythonEditor = null; // Codemirror editor
let _output = [];         // Current script stdout
let _userOutput = '';     // Current script user output
let _skipLogin = false;   // Don't ask for login anymore
let _nsix = false;        // If embedded in a nsix challenge

let _journeys = [];       // All journeys
let _journey = null;      // Current journey
let _activity = null;     // Current activity
let _activityIdx = null;  // Current activity index
let _quiz = [];      // All exercises for current journey
let _questionIdx = 0;     // Current exercise index
let _question = null;     // Current exercise
let _tests = [];          // Tests for current exercise
let _over = false;        // currently running program is terminated
let _lastFocus = null;    // focused element before program start (for graphical display only)

let _user = null;

const imgCache = {};

console.info(`Version ${VERSION}.`)

// Resize src textarea when parent div is resized
new ResizeObserver((entries) => {
  for (const entry of entries) {
    let editor = document.querySelector('#pythonsrc > .CodeMirror');
    if (editor) {
      editor.style.height = entry.contentRect.height + 'px';
    }
  }
}).observe(document.getElementById('pythonsrc'));

/**
 * Load CSV tests from question format is :
 * python command (used in print);expected result;option
 * option may either be :
 *  - hide : hide the test content (in order to avoid cheating)
 *  - any sentence : displayed as help
 */
function loadTestsCSV(csv) {
  _tests = [];
  if (!csv) { return console.error('Missing CSV tests.'); }
  let lines = csv.split('\n');
  for (let line of lines) {
    let val = line.split(';');
    if (val.length > 1) {
      // TODO oop for tests
      if(val[0].startsWith('live:')) {
        let elts = val[0].substring(5).trim().split(/\s+/)
        _tests.push({
          'live': true,
          'python': `${val[0].substring(5)} ${val[1]}`,
          'global': elts[0],
          'fn': elts[1],
          'value': val[1],
          'option': val[2],
          'passed': false
        });
      } else {
        _tests.push({
          'live': false,
          'python': val[0],
          'value': val[1],
          'option': val[2]
        });
      }
    }
  }
}

/// Display main menu (journey selection)
function displayMenu() {
  const menu = document.getElementById('mainmenu');
  const progress = document.getElementById('progress');
  const main = document.getElementById('main');
  const instruction = document.getElementById('instruction');
  gui.hideHelp();
  _journey = null;
  instruction.innerHTML = '';
  progress.classList.add('hidden');
  main.classList.add('hidden');
  if (_nsix) {
    menu.style.display = 'none';
  } else {
    menu.style.display = 'block';
    menu.style.transform = 'translate(0, 0)';
  }
}

let main = null;
let markers = null;
let delta_x = 0

function updateListTx() {
  if(main === null) { return; }
  main.animate({
    transform: `t${-delta_x * MARKER_W}`
  }, 1000, main.easeinout, () => {
    for (let i = 0; i < markers.length; i++) {
      let content = markers[i].children();
      content[0].attr('stroke', _activityIdx === i ? '#006CC5' : '#444');
      content[1].attr('fill', _activityIdx === i ? '#006CC5' : '#444');
    }
  });
  markers[delta_x].attr('display', 'none');
  if(dx > 0) {
  } else if (dx < 0) {
    previous.attr('display', 'inline');
  }
}

/// Check if all activity questions are done.
function isDone(journey, actIdx) {
  if (!journey || !journey.results) { return false; }
  const act = journey.activities[actIdx];
  if (act && journey.results[act.id]) {
    let ok = true;
    for (const r of journey.results[act.id]) {
      if (!(r.success || r.done)) {
        ok = false;
      }
    }
    return ok;
  }
  return false;
}

/// Display exercices list for navigation on top.
function displayActivitiesNav() {
  if (!_journey || !_journey.activities) { return; }

  const enabled = ['#ffeebc', '#366f9f', '#234968'];
  const disabled = ['#aaaaaa', '#333333', '#777777'];
  const MARKER_RADIUS = 12;
  const MARKER_PX = 24;
  const MARKER_PY = 24;
  const MARKER_W = 42;

  const elt = document.getElementById('progress');
  const sp = Snap('#progress');
  sp.clear();
  elt.classList.remove('hidden')

  const main = sp.g();
  markers = [];
  for (let i = 0; i < _journey.activities.length; i++) {
    const x = MARKER_PX + MARKER_W*i;
    // if (!_user.results) { break; }
    const done  = isDone(_journey, i);
    const colors = (done ? enabled : disabled);
    const marker = sp.circle(x, MARKER_PY, MARKER_RADIUS);
    marker.attr({
      fill: colors[0],
      stroke: _activityIdx === i ? '#006CC5' : colors[1],
      stokeWidth: 12
    });
    let label = sp.text(x, MARKER_PX + 5, ''+i);
    label.attr({
      fill: _activityIdx === i ? '#006CC5' : colors[2],
      style: 'font-size:15px;text-align:center;text-anchor:middle;'
    });
    let group = sp.g(marker, label);
    group.attr({
      cursor: 'pointer'
    });
    group.click(async (evt) => {
      await loadActivity(i, true);
      displayExercise();
    });
    group.hover(evt => {
      group.animate({
        transform: "s1.4", // Basic rotation around a point. No frills.
      }, 100);
    }, evt => {
      group.animate({
        transform: "s1", // Basic rotation around a point. No frills.
      }, 100);
    });
    markers.push(group);
    main.add(group)

    // FIXME hack to hide nav for 2d game journey only
    if (!done && _journey && _journey.code === 'WHISRQ') {
      return;
    }
  }
  const mp = sp.circle(MARKER_PX-4, MARKER_PX, MARKER_RADIUS);
    mp.attr({
      fill: enabled[0],
      stroke: enabled[1],
      stokeWidth: 12
    });
  const lp = sp.text(MARKER_PX-4, MARKER_PY + 5, '<');
  lp.attr({
    fill: enabled[2],
    style: 'font-size:15px;text-align:center;text-anchor:middle;'
  });
  const previous = sp.g(mp, lp);
  previous.attr({
    'display': 'none',
    'cursor': 'pointer'
  });
  previous.click((evt) => {
    console.info('TODO previous');
  });
  previous.hover(evt => {
    previous.animate({
      transform: "s1.4", // Basic rotation around a point. No frills.
    }, 100);
  }, evt => {
    previous.animate({
      transform: "s1", // Basic rotation around a point. No frills.
    }, 100);
  });
  const mn = sp.circle(MARKER_PX-4, MARKER_PX, MARKER_RADIUS);
    mn.attr({
      fill: enabled[0],
      stroke: enabled[1],
      stokeWidth: 12
    });
  const ln = sp.text(MARKER_PX-4, MARKER_PY + 5, '<');
  ln.attr({
    fill: enabled[2],
    style: 'font-size:15px;text-align:center;text-anchor:middle;'
  });
  const next = sp.g(mn, ln);
  next.attr({
    'display': 'none',
    'cursor': 'pointer'
  });
  next.click((evt) => {
    console.info('TODO next');
  });
  next.hover(evt => {
    next.animate({
      transform: "s1.4", // Basic rotation around a point. No frills.
    }, 100);
  }, evt => {
    next.animate({
      transform: "s1", // Basic rotation around a point. No frills.
    }, 100);
  });

  if(MARKER_PX + MARKER_W*markers.length > elt.clientWidth) {
    const overflow = (MARKER_PX + MARKER_W*markers.length) - elt.clientWidth;
    console.info('Too large', overflow / MARKER_W);
    delta_x = Math.round(overflow / MARKER_W);
  }
}

function initPythonEditor() {
  _pythonEditor = CodeMirror(document.getElementById('pythonsrc'), {
    value: "print('Hello world')",
    mode:  "python",
    lineNumbers: true,
    theme: 'monokai',
    indentUnit: 4,
    extraKeys: {
      'Tab': (cm) => cm.execCommand("indentMore"),
      'Shift-Tab': (cm) => cm.execCommand("indentLess"),
      'Ctrl-Enter': runit
    }
  });
}

/**
 * Affiche l'exercice en cours.
 */
function displayExercise() {
  const instruction = document.getElementById('instruction');
  const main = document.getElementById('main');
  const menu = document.getElementById('mainmenu');
  const help = document.getElementById('help');
  const pgcanvas = document.getElementById('pygamecanvas');
  const output = document.getElementById('output');
  menu.style.transform = 'translate(0, 100vh)';
  setTimeout(() => { menu.style.display = 'none' }, 300);
  main.classList.remove('hidden');
  // help.classList.remove('hidden'); TODO
  pgcanvas.classList.add('hidden');
  output.classList.add('md:w-1/2');
  output.innerHTML = ''

  if (_quiz.questions) {
    _question = _quiz.questions[_questionIdx];
  }

  if (_question) {
    let prog = '';
    let lastprog = localStorage.getItem(getProgKey());
    if(!_pythonEditor) {
      initPythonEditor();
    }
    loadTestsCSV(_question.answers);

    // title.innerHTML = _question.title || 'Entrainement';
    // TODO move image base path to activity / exercise content
    marked.use(baseUrl(`https://filedn.nsix.fr/act/${_activity.id}/`));
    marked.use(pandoc);
    marked.use(newtab);

    instruction.innerHTML = marked.parse(_question.instruction);

    renderMathInElement(instruction, {
      delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
      ],
      throwOnError : false
    });
    if(_question.proposal && _question.proposal.length > 0) {
      prog = _question.proposal;
      document.getElementById('resetbtn').classList.remove('hidden');
    } else {
      document.getElementById('resetbtn').classList.add('hidden');
    }
    let helpBtn = document.getElementById('help');
    let helpPanel = document.getElementById('help-panel');
    helpPanel.innerHTML = '';
    if(_question.help) {
      let helps = _question.help.split(/\n/);
      for(let msg of helps) {
        if(msg.startsWith('* ')) { msg = msg.substring(2, msg.length); }
        let c = document.createElement('div');
        c.innerHTML = marked.parse(msg);
        helpPanel.appendChild(c);
      }
      helpBtn.classList.remove('hidden');
    } else {
      helpBtn.classList.add('hidden');
    }
    // load last answer
    if(lastprog && lastprog.length) {
      prog = lastprog;
    } else {
      if (_journey && _journey.results) {
        const result = _journey.results[_activity.id];
        if (result && result[_questionIdx]) {
          const r = result[_questionIdx];
          if (r.response) {
            prog = r.response;
            if (prog && prog.startsWith('"')) {
              prog = JSON.parse(prog)
            }
          }
        }
      }
    }
    _pythonEditor.setValue(prog);
    // register exercise start
    // TODO lcms
  } else {
    if(!_pythonEditor) { initPythonEditor(); }
    instruction.innerHTML = marked.parse('**Bravo !** Tous les exercices de ce niveau sont terminés !');
  }

  displayActivitiesNav();
}

// Go to next exercise
async function nextQuestion() {
  const successOverlay = document.getElementById('overlay');
  successOverlay.classList.add('hidden');
  const outputpre = document.getElementById('output');
  outputpre.innerHTML = ''
  _userOutput = '';

  // si il reste des questions
  if (_questionIdx + 1 < _quiz.questions.length) {
    _questionIdx++;
  } else {
    // si il reste des activités
    let idx = _activityIdx + 1;
    while (idx < _journey.activities.length) {
      if (!isDone(_journey, idx)) {
        await loadActivity(idx);
        break;
      }
      idx++;
    }
    // si toutes les activites sont terminees
    if (idx >= _journey.activities.length) {
      _activityIdx = -1;
      _questionIdx = -1;
    }
  }

  displayExercise();
}

async function loadActivity(idx, force=false) {
  _activityIdx = idx;
  _activity = _journey.activities[idx];
  if (_activity && _activity.quiz_id) {
    const results = null;
    if(_journey.results) {
      _journey.results[_activity.id];
    }
    _quiz = await lcms.fetchQuiz(_activity.quiz_id);
    _questionIdx = force ? '0' : -1;
    if (results) {
      for (let i = 0; i < results.length; i++) {
        if(!results[i].done) {
          _questionIdx = i;
          break;;
        }
      }
    } else {
      _questionIdx = 0;
    }
  }
}

// Load exercises from remote LCMS
async function loadJourney(level, pushHistory){
  if(!level) { return console.warn('Missing level'); }
  if(!_user && !_skipLogin) {
    return gui.loginWarning();
  }
  gui.showLoading();

  _journey = _journeys[level-1];
  _activityIdx = -1;
  _questionIdx = -1;

  if (_journey) {
    for (let i = 0; i < _journey.activities.length; i++) {
      if (!isDone(_journey, i)) {
        await loadActivity(i);
        break;
      }
    }
  }

  gui.hideLoading();
  if(pushHistory) {
    history.pushState({'level': level}, '', `/?parcours=${level}`);
  }
  displayExercise();
}

async function handleMessage(msg) {
  if (!_activity || (msg.data.activity && msg.data.activity !== _activity.id)) {
    _activity = await lcms.fetchActivity(msg.data.activity);
    if (_activity && _activity.quiz) {
      _quiz = _activity.quiz;
    }
  }
  if (_quiz && _quiz.questions && msg.data.question < _quiz.questions.length) {
    const instruction = document.getElementById('instruction');
    _questionIdx = msg.data.question;
    displayExercise();
  } else {
    const instruction = document.getElementById('instruction');
    instruction.innerHTML = '<div class="error">🔍️ Erreur : question non trouvée.</div>';
    console.warn(msg.data.question, _quiz.questions);
  }

}
window.addEventListener('message', handleMessage, false);

// Reload initial prog
function resetProg(){
  if(_question && _question.proposal && _question.proposal.length > 0) {
    if(_pythonEditor) {
      _pythonEditor.setValue(_question.proposal);
    }
  }
}

/* Format test value (replace \n by new lines and trim). */
function formatTestValue(val) {
  val = val.replace(/(?<!\\)\\n/g, '\n');
  return val.trim()
}

function checkTest(idx) {
  if (idx >= _output.length) { return false; }
  let test = _tests[idx];
  if(test.python == "USER_OUTPUT") {
    let uo = _userOutput.replace(/(?:\r\n|\r|\n)/g, ' ');
    let val = test.value.replace(/(?:\r\n|\r|\n)/g, ' ');
    return uo.trim() === val.trim();
  } else if (test.python == "MAX_LINES") {
    let lines = _pythonEditor.getValue().trim().split(/\r\n|\r|\n/).length;
    return lines <= test.value;
  }
  return formatTestValue(test.value) === _output[idx].trim();
}

// On Python script completion
function onCompletion(mod) {
  if (!_question) { return; }
  let nbFailed = _tests.length;
  let table = document.importNode(document.querySelector('#results-table').content, true);
  let lineTemplate = document.querySelector('#result-line');
  let hasHelp = false;
  _tests.forEach(t => {
    if (t && t.option && (t.option.toLowerCase() !== 'hide')) { hasHelp = true; }
    if (t && t.live && t.fn === 'call' && Sk.callCount[t.global] >= t.value) {
      t.passed = true;
    }
  });
  table.querySelector('thead td.aide').style.display = hasHelp ? 'table-cell' : 'none';
  if(_tests.length > 0) {
    nbFailed = 0;
    for (let i = 0 ; i < _tests.length; i++) {
      let line = null;
      if(!_tests[i].option || _tests[i].option.toLowerCase() !== 'hide') {
        line = document.importNode(lineTemplate.content, true);
        let cells = line.querySelectorAll('td');
        if (_tests[i].python === 'USER_OUTPUT') {
          cells[0].textContent = 'Affichage avec print';
          cells[1].textContent = _tests[i].value.trim();
          cells[2].textContent = _userOutput.trim();
        } else if (_tests[i].python === 'MAX_LINES') {
          cells[0].textContent = 'Nombre de lignes';
          cells[1].textContent = `Max. ${_tests[i].value.trim()}`;
          cells[2].textContent = _pythonEditor.getValue().trim().split(/\r\n|\r|\n/).length;
        } else {
          cells[0].textContent = _tests[i].python;
          cells[1].textContent = formatTestValue(_tests[i].value);
          if (i < _output.length) {
            cells[2].textContent = _tests[i].live ? _tests[i].passed : _output[i].trim();
          } else {
            cells[2].textContent = "Erreur, valeur non trouvée";
          }
        }
        if(hasHelp) {
          cells[3].textContent = _tests[i].option;
          cells[3].style.display = 'table-cell';
        } else {
          cells[3].style.display = 'none';
        }
      } else {
        line = document.importNode(lineTemplate.content, true);
        let cells = line.querySelectorAll('td');
        cells[0].textContent = "Test caché";
      }
      if((_tests[i].live && _tests[i].passed) ||
         (!_tests[i].live && checkTest(i))) {
        line && line.querySelector('tr').classList.add('ok');
      } else {
        nbFailed += 1;
        line && line.querySelector('tr').classList.add('ko');
      }
      if(line) {
        let tbody = table.querySelector('tbody');
        tbody.append(line);
      }
    }
    if (nbFailed === 0) {
      if(_nsix) {
        window.parent.window.postMessage({
          'answer': '__done__',
          'content': _pythonEditor.getValue(),
          'from': 'python.nsix.fr'
        }, '*');
      } else {
        const answer = sha256('' + _question.id);
        lcms.registerSuccess(_question.id, _activity.id, answer, _pythonEditor.getValue(), (data) => {
          if(!_journey.results[_activity.id]) {
            _journey.results[_activity.id] = [data];
          } else {
            _journey.results[_activity.id].push(data);
          }
          updateAchievements();
        });
        gui.displaySuccess();
      }
    }
  } else {
    console.warn('Output count unmatched', _output);
  }
  const elt = document.createElement('div');
  let content = '';
  if(nbFailed > 0) {
    elt.classList.add('failed');
    content = `Résultat : ${_tests.length} test`;
    if(_tests.length > 1) { content += 's'; }
    content += `, ${nbFailed} échec`
    if(nbFailed > 1) { content += 's'; }
  } else {
    elt.classList.add('success');
    if(_tests.length > 1) {
      content = `Succès des ${_tests.length} tests`;
    } else {
      content = `Succès de ${_tests.length} test`;
    }
  }
  elt.innerHTML += `<div class="result">${content}</div>`;
  if(_tests.find(t => (!t.option || t.option.toLowerCase() !== 'hide'))){
    elt.appendChild(table);
  }
  document.getElementById('output').appendChild(elt);

  if(_lastFocus) { _lastFocus.focus(); }
}

// Python script stdout
function outf(text) {
  if(text.startsWith('### END_OF_USER_INPUT ###')) {
    _over = true;
  } else if(_over === true && text.startsWith('__TESTRES__')) {
    _output.push(text.substring(12).trim());
  } else {
    _userOutput += text;
    document.getElementById('output').innerHTML += `<pre>${text}</pre>`;
  }
}

function preloadImg(url) {
  return new Promise(async (resolve, reject) => {
    config.log('Fetch image', url);
    const res = await fetch(url);
    const reader = new FileReader();
    const blob = await res.blob();
    reader.onload = (e) => {
      if (e) { resolve(e.target.result); }
    }
    reader.readAsDataURL(blob);
  });
}

async function loadPygame(prog){
  config.log('Load Pygame');
  const output = document.getElementById('output');
  const canvas = document.getElementById('pygamecanvas')
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgb(39, 40, 34)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgb(166, 226, 46)";
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Chargement en cours', canvas.width/2, canvas.height/2);
  canvas.classList.remove('hidden');
  output.classList.remove('md:w-1/2');
  // in order to avoid async issue while loading pygame : prefetch all dependencies
  for (let lib in skExternalLibs) {
    if (lib.match(/\/pygame\//) && !sessionStorage.getItem('extlib_' + lib)) {
      config.log('Fetch module', lib);
      let res = await fetch(skExternalLibs[lib]);
      let txt = await res.text();
      sessionStorage.setItem('extlib_' + lib, txt);
    }
  }

  let images = prog.matchAll(/pygame\.image\.load\(['"](.+)['"]\)/g)
  const loader = document.createElement('canvas');
  document.body.appendChild(loader);

  for (let img of images) {
    const url = Sk.imgPath + img[1];
    if (!imgCache[url]) {
      imgCache[url] = await preloadImg(url);
    }
  }
  _lastFocus = document.activeElement;
  canvas.focus();
}

// Run python script
async function runit() {
  if(_pythonEditor === null) { return; }
  let prog = _pythonEditor.getValue();
  let outputElt = document.getElementById('output');
  outputElt.innerHTML = '';

  if (prog.indexOf('pygame') > 0) {
    await loadPygame(prog);
  }
  // reinit live tests
  for (let t of _tests) { if (t.live) { t.passed = false; } }

  Sk.pre = 'output';
  Sk.imgCache = imgCache;
  Sk.searchImportUseFullPath = true;
  Sk.updateListener = () => {
    for (let lt of _tests) {
      if (!lt.live || lt.passed) { continue; }
      // TODO switch, oop ?
      if (lt.fn === '>') {
        if(Sk.globals[lt.global] > lt.value) { lt.passed = true; }
      } else if (lt.fn === '<') {
        if(Sk.globals[lt.global] < lt.value) { lt.passed = true; }
      } else if (lt.fn === '==') {
        if(Sk.globals[lt.global] == lt.value) { lt.passed = true; }
      }
    }
  };
  let calls = {};
  for (let lt of _tests) {
    // TODO call type
    if(lt.live && lt.fn === 'call') {
      calls[lt.global] = 0
    }
  }
  if (Object.keys(calls).length > 0) { Sk.callCount = calls; }
  Sk.configure({
    output: outf,
    read: builtinRead,
    __future__: Sk.python3
  });
  prog += "\nprint('### END_OF_USER_INPUT ###')\n";
  for (let t of _tests) {
    let instruction = t.python.trim();
    if(t.live || instruction == 'USER_OUTPUT' || instruction == 'MAX_LINES') {
      instruction = 'print("__TESTRES__ -")';
    } else if(!instruction.startsWith('print')) {
      instruction = `print("__TESTRES__", ${instruction})`;
    }
    prog += "\n" + instruction;
  }
  _output = [];
  _userOutput = '';
  _over = false;
  if(prog.includes('import turtle')) {
    document.getElementById('turtlecanvas').classList.remove('hidden');
    outputElt.style.width = '100%';
  }
  else if(prog.includes('import webgl')) {
    document.getElementById('webglcanvas').classList.remove('hidden');
    outputElt.style.width = '100%';
  }
  Sk.misceval.asyncToPromise(function() {
    return Sk.importMainWithBody("<stdin>", false, prog, true);
  }).then(onCompletion,
  function(err) {
    // TODO use this hack to change line numbers if we want to prepend some python lines
    // eg. max = lambda _: 'Without using max !'
    // if(err.traceback) {
    //   err.traceback.forEach(tb => {
    //     console.info(tb)
    //     if(tb && tb.lineno > -1) {
    //       tb.lineno -= x;
    //     }
    //   });
    // }
    let msg = err.toString();
    if(typeof PygameLib !== "undefined") {   // ensure pygame has stopped
      PygameLib.running = false;
    }
    if(!_over) {
      document.getElementById('output').innerHTML += `<div class="error">${msg}</div>`;
    } else {
      if(msg.startsWith('NameError: name')) {
        let idx = msg.lastIndexOf('on line');
        document.getElementById('output').innerHTML += `<div class="error">${msg.substring(0, idx)}</div>`;
      }
      onCompletion();
    }
  });
}

function login() {
  const current = location.href;
  location.href = `${config.nsixLoginUrl}?dest=${current}`;
}
function registerSkipLogin() {
  _skipLogin = true;
}

function getProgKey(){
  let key = 'prog'
  if(_user) {
    key += '_' + _user.externalId;
  }
  if(_question) {
    key += '_' + _question.id;
  }
  return key;
}

function updateAchievements() {
  if(!_user || !_journeys) { return; }
  for (let i = 1; i <= _journeys.length ; i++){
    if (!_journeys[i-1].activities) { continue; }
    let elt = document.querySelector(`#level-${i} .percent`);
    let total =  _journeys[i-1].activities.length;
    let done = 0;
    for (let k in _journeys[i-1].results) {
      done += _journeys[i-1].results[k].length;
    }
    let percent = 100.0 * done / total;
    let stars = Math.round(percent/20);
    let starsContent = '';
    for(let j = 1; j <= 5; j++){
      let color = 'text-gray-400';
      if(j <= stars) { color = 'text-yellow-500'; }
      starsContent += `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 fill-current ${color}"><path d="M8.128 19.825a1.586 1.586 0 0 1-1.643-.117 1.543 1.543 0 0 1-.53-.662 1.515 1.515 0 0 1-.096-.837l.736-4.247-3.13-3a1.514 1.514 0 0 1-.39-1.569c.09-.271.254-.513.475-.698.22-.185.49-.306.776-.35L8.66 7.73l1.925-3.862c.128-.26.328-.48.577-.633a1.584 1.584 0 0 1 1.662 0c.25.153.45.373.577.633l1.925 3.847 4.334.615c.29.042.562.162.785.348.224.186.39.43.48.704a1.514 1.514 0 0 1-.404 1.58l-3.13 3 .736 4.247c.047.282.014.572-.096.837-.111.265-.294.494-.53.662a1.582 1.582 0 0 1-1.643.117l-3.865-2-3.865 2z"></path></svg>`;
    }
    elt.innerHTML = `&nbsp; ${Math.round(percent)} % terminé`;
    document.querySelector(`#level-${i} .stars`).innerHTML = starsContent;
    document.querySelector(`#level-${i} .achievement`).title = `${done} / ${total} réussi${(done > 0) ? 's' : ''}`;
  }
}

Sk.main_canvas = document.getElementById("pygamecanvas");
Sk.imgPath = 'https://filedn.nsix.fr/NSI/assets/';
Sk.audioPath = 'https://filedn.nsix.fr/NSI/assets/';
const skExternalLibs = {
  './data.js': './lib/skulpt/externals/data.js',
  './snap.js': './lib/skulpt/externals/snap.js',
  './pygame.js': './lib/skulpt/externals/pygame/__init__.js',
  './pygame/display.js':  './lib/skulpt/externals/pygame/display.js',
  './pygame/event.js':  './lib/skulpt/externals/pygame/event.js',
  './pygame/image.js': './lib/skulpt/externals/pygame/image.js',
  './pygame/key.js': './lib/skulpt/externals/pygame/key.js',
  './pygame/mouse.js': './lib/skulpt/externals/pygame/mouse.js',
  './pygame/mixer.js': './lib/skulpt/externals/pygame/mixer.js',
  './pygame/time.js': './lib/skulpt/externals/pygame/time.js',
  './pygame/version.js': './lib/skulpt/externals/pygame/version.js',
  './pygame/draw.js': './lib/skulpt/externals/pygame/draw.js',
  './pygame/font.js': './lib/skulpt/externals/pygame/font.js',
  './pygame/transform.js': './lib/skulpt/externals/pygame/transform.js',
  './pygame/locals.js': './lib/skulpt/externals/pygame/locals.js'
};

function builtinRead(file) {
  // console.log("Attempting file: " + Sk.ffi.remapToJs(file));
  if (skExternalLibs[file] !== undefined) {
    let src = sessionStorage.getItem('extlib_' + file);
    if(src) { return src; }
    return Sk.misceval.promiseToSuspension(
      fetch(skExternalLibs[file]).then(function (resp){
        return resp.text();
      }).then(txt => {
        sessionStorage.setItem('extlib_' + file, txt);
        return txt;
      }));
  }
  if (Sk.builtinFiles === undefined || Sk.builtinFiles.files[file] === undefined) {
    throw "File not found: '" + file + "'";
  }
  return Sk.builtinFiles.files[file];
}

async function init(){
  (Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = 'turtlecanvas';

  // Sk.onBeforeImport = function(library) {
  //   console.info('Importing', library);
  // };
  // Sk.onAfterImport = function(library) {
  //   console.info('Imported', library);
  // };

  marked.setOptions({
    gfm: true
  });

  document.getElementById('logoutBtn').addEventListener('click', lcms.logout);
  document.getElementById('runbtn').addEventListener('click', runit);
  document.getElementById('homebtn').addEventListener('click', () => { displayMenu(); history.pushState(null, '', '/'); });
  document.getElementById('nextbtn').addEventListener('click', nextQuestion);
  document.getElementById('resetbtn').addEventListener('click', resetProg);
  document.getElementById('login').addEventListener('click', login);
  document.getElementById('login2').addEventListener('click', login);
  // document.getElementById('skip-login-btn').addEventListener('click', registerSkipLogin);
  document.getElementById('level-1').addEventListener('click', () => loadJourney(1, true));
  document.getElementById('level-2').addEventListener('click', () => loadJourney(2, true));
  document.getElementById('level-3').addEventListener('click', () => loadJourney(3, true));
  document.getElementById('level-4').addEventListener('click', () => loadJourney(4, true));
  document.getElementById('profileMenuBtn').addEventListener('click', gui.toggleMenu);

  document.getElementById('help').addEventListener('click', gui.showHelp);
  document.getElementById('help-panel').addEventListener('click', gui.hideHelp);

  // Save script on keystroke
  document.addEventListener('keyup', evt => {
    if(evt.target && evt.target.nodeName === 'TEXTAREA') {
      if(_pythonEditor){
        localStorage.setItem(getProgKey(), _pythonEditor.getValue());
      }
    }
  });
  addEventListener('popstate', evt => {
    if(evt.state && evt.state.level) {
      loadJourney(evt.state.level);
    } else {
      displayMenu();
    }
  });

  lcms.loadUser(async (user) => {
    let loaded = false;
    // TODO session cache
    if(user) {
      _user = user;
      document.getElementById('username').innerHTML = user.firstName || 'Moi';
      document.getElementById('profile-menu').classList.remove('hidden');

      if (config.activity || config.embedded) {
        console.info("Embedded activity");
        const menu = document.getElementById('mainmenu');
        menu.style.display = 'none';
        window.parent.window.postMessage({
          'state': '__intialized__',
          'from': 'python.nsix.fr'
        }, '*');
        loaded = true;
      } else {
        _journeys = await lcms.fetchJourneys();
        updateAchievements();
        if(config.parcours >= 0) {
          loadJourney(config.parcours);
          loaded = true;
        }
      }
    } else {
      document.getElementById('login').classList.remove('hidden');
      _user = null;
    }

    if(!loaded) { displayMenu(); }
    gui.hideLoading();
  });
}

// if in iframe (i.e. nsix challenge)
_nsix = window.location !== window.parent.location;
const elts = document.querySelectorAll(_nsix ? '.nsix' : '.standalone');
for (let e of elts) {
  e.classList.remove('hidden');
}

init();
