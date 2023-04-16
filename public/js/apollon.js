(function (){

const VERSION = 'v0.8.1';
document.getElementById('version').textContent = VERSION;

const host = window.location.host;
const dev = host.startsWith('localhost') || host.indexOf('ileauxsciences.test') >= 0;
let debug = () => {};
if(dev || location.href.match('#debug')) {
  debug = console.info;
}

let _pythonEditor = null; // Codemirror editor
let _output = [];     // Current script stdout
let _nsix = false;    // If embedded in a nsix challenge


let NSIX_LOGIN_URL = 'https://app.nsix.fr/connexion';
let LCMS_URL = 'https://webamc.nsix.fr';
let COOKIE_DOMAIN = '.nsix.fr';
if(dev) {
  NSIX_LOGIN_URL = 'http://ileauxsciences.test:4200/connexion'
  LCMS_URL = 'http://dev.ileauxsciences.test:9976';
  COOKIE_DOMAIN = '.ileauxsciences.test';
}

let _journeys = [];    // All journeys
let _exercises = [];   // All exercises for current journey
let _exerciseIdx = 0;  // Current exercise index
let _exercise = null;  // Current exercise
let _tests = [];       // Tests for current exercise
let _over = false;     // currently running program is terminated

let _user = null;

// Callback on exercise achievement
function displaySuccess() {
  const successOverlay = document.getElementById('overlay');
  successOverlay.classList.remove('hidden');
}

function loadTestsCSV(csv) {
  _tests = [];
  let lines = csv.split('\n');
  for (let line of lines) {
    let val = line.split(';');
    if (val.length > 1) {
      _tests.push({
        'python': val[0],
        'value': val[1],
        'option': val[2]
      });
    }
  }
}

function displayMenu() {
  const menu = document.getElementById('mainmenu');
  const progress = document.getElementById('progress');
  const main = document.getElementById('main');
  const instruction = document.getElementById('instruction');
  const help = document.getElementById('help');
  help.classList.add('hidden');
  hideHelp();
  instruction.innerHTML = '';
  progress.classList.add('hidden');
  main.classList.add('hidden');
  menu.style.transform = 'translate(0, 0)';
}

let main = null;
let markers = null;
let delta_x = 0

function updateListTx() {
  if(main === null) { return; }
  console.info(main.attr('transform'));
  main.animate({
    transform: `t${-delta_x * MARKER_W}`
  }, 1000, mina.easeinout, () => {
    for (let i = 0; i < markers.length; i++) {
      let content = markers[i].children();
      content[0].attr('stroke', _exerciseIdx === i ? '#006CC5' : '#444');
      content[1].attr('fill', _exerciseIdx === i ? '#006CC5' : '#444');
    }
  });
  markers[delta_x].attr('display', 'none');
  if(dx > 0) {
  } else if (dx < 0) {
    previous.attr('display', 'inline');
  }
}

function displayExercisesNav() {
  const enabled = ['#ffeebc', '#366f9f', '#234968'];
  const disabled = ['#aaaaaa', '#333333', '#777777'];
  const MARKER_RADIUS = 12;
  const MARKER_PX = 24;
  const MARKER_PY = 24;
  const MARKER_W = 42;
  let elt = document.getElementById('progress');
  let sp = Snap('#progress');
  sp.clear();
  elt.classList.remove('hidden')

  let main = sp.g();
  markers = [];
  for (let i = 0; i < _exercises.length; i++) {
    let x = MARKER_PX + MARKER_W*i;
    let done  = _user.results.find(r => r.exerciseId === _exercises[i].id && r.done === true)
    let colors = (done ? enabled : disabled);
    let marker = sp.circle(x, MARKER_PY, MARKER_RADIUS);
    marker.attr({
      fill: colors[0],
      stroke: _exerciseIdx === i ? '#006CC5' : colors[1],
      stokeWidth: 12
    });
    let label = sp.text(x, MARKER_PX + 5, ''+i);
    label.attr({
      fill: _exerciseIdx === i ? '#006CC5' : colors[2],
      style: 'font-size:15px;text-align:center;text-anchor:middle;'
    });
    let group = sp.g(marker, label);
    group.attr({
      cursor: 'pointer'
    });
    group.click((evt) => {
      _exerciseIdx = i;
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
  }
  let mp = sp.circle(MARKER_PX-4, MARKER_PX, MARKER_RADIUS);
    mp.attr({
      fill: enabled[0],
      stroke: enabled[1],
      stokeWidth: 12
    });
  let lp = sp.text(MARKER_PX-4, MARKER_PY + 5, '<');
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
  let mn = sp.circle(MARKER_PX-4, MARKER_PX, MARKER_RADIUS);
    mn.attr({
      fill: enabled[0],
      stroke: enabled[1],
      stokeWidth: 12
    });
  let ln = sp.text(MARKER_PX-4, MARKER_PY + 5, '<');
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
    let overflow = (MARKER_PX + MARKER_W*markers.length) - elt.clientWidth;
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
 * Affiche l'exercice en cours (_exercises[_exerciseIdx]).
 */
function displayExercise() {
  // const title = document.getElementById('title');
  const instruction = document.getElementById('instruction');
  const main = document.getElementById('main');
  const menu = document.getElementById('mainmenu');
  const help = document.getElementById('help');
  menu.style.transform = 'translate(0, 100vh)';
  main.classList.remove('hidden');
  help.classList.remove('hidden');

  _exercise = _exercises[_exerciseIdx];

  if (_exercise) {
    let prog = '';
    let lastprog = localStorage.getItem(getProgKey());
    if(!_pythonEditor) {
      initPythonEditor();
    }
    loadTestsCSV(_exercise.tests);
    // title.innerHTML = _exercise.title || 'Entrainement';
    instruction.innerHTML = marked.parse(_exercise.instruction);
    renderMathInElement(instruction, {
      delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
      ],
      throwOnError : false
    });
    if(_exercise.proposals && _exercise.proposals.length > 0) {
      prog = _exercise.proposals;
      document.getElementById('resetbtn').classList.remove('hidden');
    } else {
      document.getElementById('resetbtn').classList.add('hidden');
    }
    let helpBtn = document.getElementById('help');
    let helpPanel = document.getElementById('help-panel');
    helpPanel.innerHTML = '';
    if(_exercise.help) {
      let helps = _exercise.help.split(/\n/);
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
    let result = _user.results?.find(r => r.exerciseId === _exercise.id);
    // console.info(result);
    if(lastprog && lastprog.length) {
      prog = lastprog;
    } else {
      if (result) {
        prog = result.content;
      }
    }
    _pythonEditor.setValue(prog);
  } else {
    if(!_pythonEditor) { initPythonEditor(); }
    instruction.innerHTML = marked.parse('**Bravo !** Tous les exercices de ce niveau sont terminés !');
  }

  displayExercisesNav();
}

// Go to next exercise
function nextExercise() {
  const successOverlay = document.getElementById('overlay');
  successOverlay.classList.add('hidden');
  var outputpre = document.getElementById('output');
  outputpre.innerHTML = ''
  _exerciseIdx++;
  displayExercise();
}

// Display login required popup
function loginRequired() {
  let lr = document.getElementById('login-required');
  lr.style.width = '100%';
  lr.onclick = hideLoginPopup;
  document.getElementById('login-popup').style.transform = 'translate(0,0)';
}

function hideLoginPopup() {
  document.getElementById('login-popup').style.transform = 'translate(0,-70vh)';
  document.getElementById('login-required').style.width = '0%';
}

// Load exercises from remote LCMS
function loadExercises(level, pushHistory){
  if(!level) { return console.warn('Missing level'); }
  if(!_user) { return loginRequired(); }
  showLoading();

  let journey = _journeys[level-1];
  _exercises = journey.challenges;
  _exerciseIdx = -1;
  for (let i in _exercises) {
    if(_exerciseIdx < 0) {
      let r = _user.results.find(r => r.exerciseId === _exercises[i].id);
      if(!r || r.done === false) {
        _exerciseIdx = parseInt(i);
      }
    }
  }
  hideLoading();
  if(pushHistory) {
    history.pushState({'level': level}, '', `/#niveau${level}`);
  }
  displayExercise();
}

// Reload initial prog
function resetProg(){
  if(_exercise && _exercise.proposals && _exercise.proposals.length > 0) {
    if(_pythonEditor) {
      _pythonEditor.setValue(_exercise.proposals);
    }
  }
}

// Send succes to lcms api
function registerSuccess(exerciseId, answer){
  const token = getAuthToken();
  if(token) {
    const body = {
      'exerciseId': exerciseId,
      'answer': answer,
      'content': _pythonEditor.getValue()
    };
    const req = new Request(LCMS_URL + '/students/success',  {
      'method': 'POST',
      'headers': {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      'body': JSON.stringify(body)
    });
    fetch(req).then(res => { return res.json(); })
    .then(data => {
      console.info(JSON.stringify(data));
      _user.results.push(data);
      updateAchievements();
    });
  }
}


// On Python script completion
function onCompletion(mod) {
  let nbFailed = _tests.length;
  let table = document.importNode(document.querySelector('#results-table').content, true);
  let lineTemplate = document.querySelector('#result-line');
  if(_tests.length > 0 && _tests.length === _output.length) {
    nbFailed = 0;
    for (let i = 0 ; i < _tests.length; i++) {
      let line = null;
      if(_tests[i].option !== 'hide') {
        line = document.importNode(lineTemplate.content, true);
        let cells = line.querySelectorAll('td');
        cells[0].textContent = _tests[i].python;
        cells[1].textContent = _tests[i].value.trim();
        cells[2].textContent = _output[i].trim();
      }
      if(_tests[i].value.trim() !== _output[i].trim()) {
        nbFailed += 1;
        line && line.querySelector('tr').classList.add('ko');
      } else {
        line && line.querySelector('tr').classList.add('ok');
      }
      if(line) {
        let tbody = table.querySelector('tbody');
        tbody.append(line);
      }
    }
    if (nbFailed === 0) {
      const answer = sha256(_output);
      if(parent) {
        parent.window.postMessage({
          'answer': answer,
          'from': 'pix'
        }, '*');
      }
      registerSuccess(_exercise.id, answer);
      displaySuccess();
    }
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
  if(_tests.find(t => t.option !== 'hide')){
    elt.appendChild(table);
  }
  document.getElementById('output').appendChild(elt);
}

// Python script stdout
function outf(text) {
  if(text.startsWith('### END_OF_USER_INPUT ###')) {
    return _over = true;
  }
  if(_over === false) {
    document.getElementById('output').innerHTML += `<div>${text}</div>`;
  } else {
    _output.push(text.trim());
  }
}

async function loadPygame(){
  debug('Load Pygame');
  document.getElementById('pygamecanvas').classList.remove('hidden');
  // in order to avoid async issue while loading pygame : prefetch all dependencies
  for (let lib in skExternalLibs) {
    if (lib.match(/\/pygame\//) && !sessionStorage.getItem('extlib_' + lib)) {
      let res = await fetch(skExternalLibs[lib]);
      let txt = await res.text();
      sessionStorage.setItem('extlib_' + lib, txt);
    }
  }
}

// Run python script
async function runit() {
  if(_pythonEditor === null) { return; }
  let prog = _pythonEditor.getValue();
  let outputElt = document.getElementById('output');
  outputElt.innerHTML = '';

  if (prog.indexOf('pygame') > 0) {
    await loadPygame();
  }

  Sk.pre = 'output';
  Sk.searchImportUseFullPath = true;
  Sk.configure({
    output: outf,
    read: builtinRead,
    __future__: Sk.python3
  });
  prog += "\nprint('### END_OF_USER_INPUT ###')";
  for (let t of _tests) {
    let instruction = t.python.trim();
    if(!instruction.startsWith('print')) {
      instruction = `print(${instruction})`;
    }
    prog += "\n" + instruction;
  }
  _output = [];
  _over = false;
  if(prog.startsWith('import turtle')) {
    document.getElementById('turtlecanvas').classList.remove('hidden');
    outputElt.style.width = '100%';
  }
  if(prog.startsWith('import webgl')) {
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
  location.href = `${NSIX_LOGIN_URL}?dest=${current}`;
}

function getAuthToken(){
  let token = null;
  if(document.cookie) {
    const name = 'ember_simple_auth-session='
    let cookies = decodeURIComponent(document.cookie).split(';');
    for (let c of cookies) {
      let idx = c.indexOf(name);
      if(idx > -1) {
        let value = c.substring(name.length + idx);
        let json = JSON.parse(value);
        token = json.authenticated.access_token;
      }
    }
  }
  return token;
}

function loadUser(cb) {
  let token = getAuthToken();
  if(token) {
    const meUrl = LCMS_URL + '/students/profile';
    const req = new Request(meUrl);
    fetch(req, {
      'headers': {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }).then(res => {
      let json = null;
      if(res.status === 200) {
        json = res.json();
      }
      return json;
    }).then(data => {
      // console.info(JSON.stringify(data, '', ' '));
      // console.info(data.student);
      cb(data.student);
    }).catch(err => {
      console.warn('Unable to fetch user', err);
      debug(cb);
      cb(null);
    });
  } else {
    cb(null);
  }
}

function getProgKey(){
  let key = 'prog'
  if(_user) {
    key += '_' + _user.studentId;
  }
  if(_exercise) {
    key += '_' + _exercise.id;
  }
  return key;
}

function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

function toggleMenu(evt){
  let eltMenu = document.getElementById('profileMenu');
  if(eltMenu.classList.contains('hidden')){
    eltMenu.classList.remove('hidden');
    document.addEventListener('click', toggleMenu);
  } else {
    eltMenu.classList.add('hidden');
    document.removeEventListener('click', toggleMenu);
  }
  evt.stopPropagation();
}

function logout() {
  const cookies = ['ember_simple_auth-session', 'ember_simple_auth-session-expiration_time'];
  for (let cookie of cookies) {
    document.cookie=`${cookie}=; domain=${COOKIE_DOMAIN}; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
  location.reload();
}

function updateAchievements() {
  if(!_user || !_journeys) { return; }
  for (let i=1; i<4 ; i++){
    let elt = document.querySelector(`#level-${i} .percent`);
    let total =  _journeys[i-1].challenges.length;
    let done = 0;
    for (let ch of _journeys[i-1].challenges){
      let result = _user.results.find(r => r.exerciseId === ch.id);
      if(result && result.done) {
        done++;
      }
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

// TODO if pygame !!!
Sk.main_canvas = document.getElementById("pygamecanvas");
Sk.imgPath = 'test/';

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

function fetchJourney(jid) {
  return new Promise((resolve, reject) => {
    const req = new Request(`${LCMS_URL}/lcms/journey/${jid}`);
    fetch(req).then(res => { return res.json(); })
    .then(journey => {
      resolve(journey);
    });
  });
}

function showHelp(show=true){
  let panel = document.getElementById('help-panel');
  if(show) {
    panel.classList.remove('hidden-right');
  } else {
    panel.classList.add('hidden-right');
  }
}
function hideHelp() { showHelp(false); }

async function init(){
  let purl = new URL(window.location.href);
  if(purl && purl.searchParams) {
    let index = purl.searchParams.get("index");
    if(index) {
      _exerciseIdx = index;
    }
    let challenge = purl.searchParams.get('challenge');
    console.info('Challenge', challenge)
  }

  // Load journeys
  let jids = ['b3579a4c-36ea-446b-9218-e38b1ab97595',
              '81237620-757d-4151-b3a7-efbbeea6ad48',
              '1f9e97a1-29cf-4abb-a38d-5758373adce2']
  for (let jid of jids) {
    _journeys.push(await fetchJourney(jid));
  }

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

  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('runbtn').addEventListener('click', runit);
  document.getElementById('homebtn').addEventListener('click', () => { displayMenu(); history.pushState(null, '', '/'); });
  document.getElementById('nextbtn').addEventListener('click', nextExercise);
  document.getElementById('resetbtn').addEventListener('click', resetProg);
  document.getElementById('login').addEventListener('click', login);
  document.getElementById('login2').addEventListener('click', login);
  document.getElementById('level-1').addEventListener('click', () => loadExercises(1, true));
  document.getElementById('level-2').addEventListener('click', () => loadExercises(2, true));
  document.getElementById('level-3').addEventListener('click', () => loadExercises(3, true));
  document.getElementById('profileMenuBtn').addEventListener('click', toggleMenu);
  document.getElementById('help').addEventListener('click', showHelp);
  document.getElementById('help-panel').addEventListener('click', hideHelp);

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
      loadExercises(evt.state.level);
    } else {
      displayMenu();
    }
  });

  loadUser(async (user) => {
    // TODO session cache
    debug('User loaded', user);

    if(user) {
      _user = user;
      document.getElementById('username').innerHTML = user.firstName || 'Moi';
      document.getElementById('profile-menu').classList.remove('hidden');
      updateAchievements();
    } else {
      document.getElementById('login').classList.remove('hidden');
      _user = null;
    }

    let loaded = false;
    if(location.hash) {
      let levelpath = location.hash.match('#niveau(\\d)');
      if(levelpath) {
        let lvl = parseInt(levelpath[1]);
        if(lvl !== NaN) {
          loadExercises(lvl);
          loaded = true;
        }
      }
    }
    if(!loaded) { displayMenu(); }
    hideLoading();
  });
}

// if in iframe (i.e. nsix challenge)
_nsix = window.location !== window.parent.location;
const elts = document.querySelectorAll(_nsix ? '.nsix' : '.standalone');
for (let e of elts) {
  e.classList.remove('hidden');
}

init();

})();
