(function (){

const VERSION = 'v0.4.3';
document.getElementById('version').textContent = VERSION;

let _pythonEditor = null; // Codemirror editor
let _output = [];     // Current script stdout
let _nsix = false;    // If embedded in a nsix challenge

const NSIX_LOGIN_URL = 'http://app.nsix.fr/connexion'
const LCMS_URL = 'https://webamc.nsix.fr';
const COOKIE_DOMAIN = '.ileauxsciences.test';

let _exercises = [];   // All exercises
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
        'value': val[1]
      })
    }
  }
}

function displayMenu() {
  const menu = document.getElementById('mainmenu');
  const main = document.getElementById('main');
  const instruction = document.getElementById('instruction');
  instruction.innerHTML = '';
  main.classList.add('hidden');
  menu.style.transform = 'translate(0, 0)';
}

function displayExercise(level) {
  // const title = document.getElementById('title');
  const instruction = document.getElementById('instruction');
  const main = document.getElementById('main');
  const menu = document.getElementById('mainmenu');
  menu.style.transform = 'translate(0, 100vh)';
  main.classList.remove('hidden');

  _exercise = _exercises[_exerciseIdx];

  if (_exercise) {
    let prog = '';
    let lastprog = localStorage.getItem(getProgKey());
    if(!_pythonEditor) {
      _pythonEditor = CodeMirror(document.getElementById('pythonsrc'), {
        value: "print('Hello world')",
        mode:  "python",
        lineNumbers: true,
        theme: 'monokai'
      });
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
    if(lastprog && lastprog.length) {
      prog = lastprog;
    } else {
      if(_user && _user.results) {
        let found = _user.results.find(r => r.exerciseId === _exercise.id);
        if (found) {
          prog = found.content;
        }
      }
    }
    _pythonEditor.setValue(prog);
  } else {
    displayMenu();
    history.pushState(null, '', '/');
  }
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
  const req = new Request(`${LCMS_URL}/lcms/python/${level}`);
  fetch(req).then(res => { return res.json(); })
  .then(data => {
    _exercises = data;
    _exerciseIdx = 0;
    if(_user) {
      let list = _exercises.filter(e => {
        let found = _user.results.find(r => r.exerciseId === e.id && r.done === true)
        return !found;
      })
      _exercises = list;
    }
    hideLoading();
    if(_exercises.length) {
      if(pushHistory) {
        history.pushState({'level': level}, '', `/#niveau${level}`);
      }
      displayExercise();
    }
  });
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

// On program completion
function onCompletion(mod) {
  let failed = _tests.length;
  if(_tests.length > 0 && _tests.length === _output.length) {
    failed = 0;
    for (let i = 0 ; i < _tests.length; i++) {
      if(_tests[i].value.trim() !== _output[i].trim()) {
        ok = false;
        failed += 1;
      }
    }
    if (failed === 0) {
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
  if(failed > 0) {
    let content = `Résultat : ${_tests.length} test`;
    if(_tests.length > 1) { content += 's'; }
    content += `, ${failed} échec`
    if(failed > 1) { content += 's'; }
    document.getElementById('output').innerHTML += `<div class="failed">${content}</div>`;
  }
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
// Load python modules
function builtinRead(x) {
  if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined)
    throw "File not found: '" + x + "'";
  return Sk.builtinFiles["files"][x];
}

// Run python script
function runit() {
  if(_pythonEditor === null) { return; }
  var prog = _pythonEditor.getValue();
  var mypre = document.getElementById('output');
  mypre.innerHTML = '';
  Sk.pre = 'output';
  Sk.configure({
    output: outf,
    read: builtinRead,
    __future__: Sk.python3
  });
  prog += "\nprint('### END_OF_USER_INPUT ###')";
  for (let t of _tests) {
    prog += "\n" + t.python;
  }
  // (Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = 'mycanvas';
  _output = [];
  _over = false;
  var myPromise = Sk.misceval.asyncToPromise(function() {
      return Sk.importMainWithBody("<stdin>", false, prog, true);
  });
  myPromise.then(onCompletion,
  function(err) {
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
      cb(data.student);
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
  if(!_user || !_user.exercises) { return; }
  for (let i=1; i<4 ; i++){
    let elt = document.querySelector(`#level-${i} .percent`);
    let total =  _user.exercises[`level${i}`];
    let done = 0;
    for (let r of _user.results){
      if(r.level === i) {
        done++;
      }
    }
    let percent = 100.0 * done / total;
    let stars = Math.round(percent/20);
    let starsContent = '';
    for(let i = 1; i <= 5; i++){
      let color = 'text-gray-400';
      if(i <= stars) { color = 'text-yellow-500'; }
      starsContent += `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 fill-current ${color}"><path d="M8.128 19.825a1.586 1.586 0 0 1-1.643-.117 1.543 1.543 0 0 1-.53-.662 1.515 1.515 0 0 1-.096-.837l.736-4.247-3.13-3a1.514 1.514 0 0 1-.39-1.569c.09-.271.254-.513.475-.698.22-.185.49-.306.776-.35L8.66 7.73l1.925-3.862c.128-.26.328-.48.577-.633a1.584 1.584 0 0 1 1.662 0c.25.153.45.373.577.633l1.925 3.847 4.334.615c.29.042.562.162.785.348.224.186.39.43.48.704a1.514 1.514 0 0 1-.404 1.58l-3.13 3 .736 4.247c.047.282.014.572-.096.837-.111.265-.294.494-.53.662a1.582 1.582 0 0 1-1.643.117l-3.865-2-3.865 2z"></path></svg>`;
    }
    elt.innerHTML = `&nbsp; ${Math.round(percent)} % terminé`;
    document.querySelector(`#level-${i} .stars`).innerHTML = starsContent;
    document.querySelector(`#level-${i} .achievement`).title = `${done} / ${total} réussi${(done > 0) ? 's' : ''}`;
  }
}

function init(){
  let purl = new URL(window.location.href);
  if(purl && purl.searchParams) {
    let index = purl.searchParams.get("index");
    if(index) {
      _exerciseIdx = index;
    }
    let autostart = purl.searchParams.get("autostart");
    if(autostart !== null) {
      runit();
    }
  }

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

  // run script on CTRL + Enter shortcut
  document.addEventListener('keyup', evt => {
    if(evt.target && evt.target.nodeName === 'TEXTAREA') {
      if(_pythonEditor){
        localStorage.setItem(getProgKey(), _pythonEditor.getValue());
      }
      if(evt.key === 'Enter' && evt.ctrlKey && !evt.shiftKey && !evt.altKey) {
        runit();
      }
    }
  });
  addEventListener('popstate', evt => {
    console.info(evt.state);
    if(evt.state && evt.state.level) {
      loadExercises(evt.state.level);
    } else {
      displayMenu();
    }
  });

  loadUser((user) => {
    // TODO session cache
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
      if(location.hash === '#sandbox') {
        const main = document.getElementById('main');
        const menu = document.getElementById('mainmenu');
        menu.style.transform = 'translate(0, 100vh)';
        main.classList.remove('hidden');
        if(!_pythonEditor) {
          _pythonEditor = CodeMirror(document.getElementById('pythonsrc'), {
            value: "print('Hello world')",
            mode:  "python",
            lineNumbers: true,
            theme: 'monokai'
          });
        }
        if(localStorage.getItem(getProgKey())) {
          _pythonEditor.setValue(localStorage.getItem(getProgKey()));
        }
        loaded = true;
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
