(function (){

const VERSION = 'v0.3.6';
document.getElementById('version').textContent = VERSION;

let _pythonEditor = null; // Codemirror editor
let _output = [];     // Current script stdout
let _nsix = false;    // If embedded in a nsix challenge

const LCMS_URL = 'https://webamc.nsix.fr';

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
    if(_exercise.proposals && _exercise.proposals.length > 0) {
      _pythonEditor.setValue(_exercise.proposals);
    }
    if(localStorage.getItem(getProgKey())) {
      prog = localStorage.getItem(getProgKey());
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

// Load exercises from remote LCMS
function loadExercises(level){
  if(!level) { return console.warn('Missing level'); }
  const req = new Request(LCMS_URL + '/lcms/python');
  fetch(req).then(res => { return res.json(); })
  .then(data => {
    _exercises = data;
    if(_user) {
      let list = _exercises.filter(e => {
        let found = _user.results.find(r => r.exerciseId === e.id && r.done === true)
        return !found;
      })
      _exercises = list;
    }
    displayExercise();
  });
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
    const req = new Request(LCMS_URL + '/lcms/success',  {
      'method': 'POST',
      'headers': {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      'body': JSON.stringify(body)
    });
    fetch(req).then(res => { return res.json(); })
    .then(data => {
      console.info('Ahoy', JSON.stringify(data));
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
      displaySuccess();
      const answer = sha256(_output);
      if(parent) {
        parent.window.postMessage({
          'answer': answer,
          'from': 'pix'
        }, '*');
      }
      registerSuccess(_exercise.id, answer);
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
  // location.href = 'http://ileauxsciences.test:4200/external-login?dest=http://dev.ileauxsciences.test:36505/';
}

function getAuthToken(){
  let token = null;
  if(document.cookie) {
    const name = 'ember_simple_auth-session='
    let cookies = decodeURIComponent(document.cookie).split(';');
    for (let c of cookies) {
      let idx = c.indexOf(name);
      if(idx === 0) {
        let value = c.substring(name.length);
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
    const meUrl = LCMS_URL + '/lcms/students/profile';
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
    login();
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

function startLoading() {
  document.getElementById('loading').classList.remove('hidden');
}

function endLoading() {
  document.getElementById('loading').classList.add('hidden');
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

  document.getElementById('runbtn').addEventListener('click', runit);
  document.getElementById('homebtn').addEventListener('click', displayMenu);
  document.getElementById('nextbtn').addEventListener('click', nextExercise);
  document.getElementById('login').addEventListener('click', login);
  document.getElementById('level-0').addEventListener('click', () => loadExercises(1));
  document.getElementById('level-1').addEventListener('click', () => loadExercises(2));
  document.getElementById('level-2').addEventListener('click', () => loadExercises(3));

  // run script on CTRL + Enter shortcut
  document.addEventListener('keyup', evt => {
    localStorage.setItem(getProgKey(), _pythonEditor.getValue());
    if(evt.target && evt.target.nodeName === 'TEXTAREA'
       && evt.key === 'Enter'
       && evt.ctrlKey && !evt.shiftKey && !evt.altKey) {
      runit();
    }
  });

  loadUser((user) => {
    if(user) {
      // TODO cache user
      // let menu = document.getElementById('profile-menu');
      // let btn = document.getElementById('username');
      // btn.innerHTML = user["first-name"];
      // menu.classList.remove('hidden');
      _user = user;
    } else {
      // loginbtn.classList.remove('hidden');
      _user = null;
    }

    renderMathInElement(document.getElementById('instruction'), {
      delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
      ],
      throwOnError : false
    });

    displayMenu();
    endLoading();
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