(function (){

const VERSION = 'v0.3.3';
document.getElementById('version').textContent = VERSION;

let _pythonEditor = null; // Codemirror editor
let _output = [];     // Current script stdout
let _nsix = false;    // If embedded in a nsix challenge

const NSIX_URL = 'https://app.nsix.fr';
const LCMS_URL = 'https://webamc.nsix.fr/lcms/python';
// const NSIX_URL = 'http://localhost:4200';
// const LCMS_URL = 'http://localhost:9976/lcms/python';

let _exercises = [];   // All exercises
let _exerciseIdx = 0;  // Current exercise index
let _exercise = null;  // Current exercise
let _tests = [];       // Tests for current exercise
let _over = false; // current run programme is terminated


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

function displayExercise() {
  const title = document.getElementById('title');
  const instruction = document.getElementById('instruction');

  _exercise = _exercises[_exerciseIdx];

  if (_exercise) {
    loadTestsCSV(_exercise.tests);
    title.innerHTML = _exercise.title || 'Entrainement';
    instruction.innerHTML = marked.parse(_exercise.instruction);
    if(_exercise.proposals && _exercise.proposals.length > 0) {
      _pythonEditor.setValue(_exercise.proposals);
    }
  }
}

// Loads next exercise
function nextExercise() {
  const successOverlay = document.getElementById('overlay');
  successOverlay.classList.add('hidden');
  var outputpre = document.getElementById('output');
  outputpre.innerHTML = ''
  _exerciseIdx++;
  displayExercise();
}

function onCompletion(mod) {
  if(_tests.length > 0 && _tests.length === _output.length) {
    let ok = true
    for (let i = 0 ; i < _tests.length; i++) {
      if(_tests[i].value.trim() !== _output[i].trim()) {
        ok = false;
      }
    }
    if (ok) {
      displaySuccess();
      if(parent) {
        const answer = sha256(_output);
        parent.window.postMessage({
          'answer': answer,
          'from': 'pix'
        }, '*');
      }
    }
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
    console.log(err.toString());
    document.getElementById('output').innerHTML += `<div class="error">${err}</div>`;
  });
}

function loadUser(cb) {
  if(document.cookie) {
    const meUrl = NSIX_URL + '/api/users/me';
    const name = 'ember_simple_auth-session='
    let cookies = decodeURIComponent(document.cookie).split(';');
    cookies.forEach(c => {
      let idx = c.indexOf(name);
      if(idx === 0) {
        let value = c.substring(name.length);
        let json = JSON.parse(value);
        let token = json.authenticated.access_token;
        const req = new Request(meUrl);
        fetch(req, {
          'headers': {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }).then(res => {
          return res.json();
        }).then(data => {
          let user = data.data.attributes;
          if(user) {
            user.id = data.data.id;
          }
          cb(user);
        });
      }
    })
  }
}

function init(){
  const runbtn = document.getElementById('runbtn');
  const nextbtn = document.getElementById('nextbtn');
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

  // Create codemirror editor
  _pythonEditor = CodeMirror(document.getElementById('pythonsrc'), {
    value: "print('Hello world')",
    mode:  "python",
    lineNumbers: true,
    theme: 'monokai'
  });
  if(sessionStorage.getItem('prog')) {
    _pythonEditor.setValue(sessionStorage.getItem('prog'));
  }

  runbtn.addEventListener('click', runit);
  nextbtn.addEventListener('click', nextExercise);

  // run script on CTRL + Enter shortcut
  document.addEventListener('keyup', evt => {
    sessionStorage.setItem('prog', _pythonEditor.getValue());
    if(evt.target && evt.target.nodeName === 'TEXTAREA'
       && evt.key === 'Enter'
       && evt.ctrlKey && !evt.shiftKey && !evt.altKey) {
      runit();
    }
  });

  loadUser((user) => {
    if(user) {
      let elt = document.getElementById('username');
      elt.innerHTML = user["first-name"];
      elt.classList.remove('hidden');
    } else {
      document.getElementById('login').classList.remove('hidden');
    }
  });

  const req = new Request(LCMS_URL);
  fetch(req).then(res => { return res.json(); })
  .then(data => {
    // test data
    // let data = [
    //   {
    //     "id":
    //     "c9b5438d85e07b8","title":
    //     "Modifier un programme","instruction":
    //     "Modifier le programme Python ci-dessous pour afficher le résultat de $a^5 + 79$.\n<br><br>_L'affichage doit être fait à l'aide de la fonction `print`._","proposals":
    //     "a = 7\nprint(a)","solution": "84b1c1cf45ea7a79a126b663df760e034264dae6"
    //   },
    //   {"id":"c9b5438d85e07b8","title":"Modifier un programme","instruction":"Modifier le programme Python ci-dessous pour afficher le résultat de $a^5 + 79$.\n<br><br>_L'affichage doit être fait à l'aide de la fonction `print`._","proposals":"a = 7\nprint(a)","solution":"84b1c1cf45ea7a79a126b663df760e034264dae6"},{"id":"e5b2f3a850b1e60","title":"Utilisation d'une variable de type dictionnaire","instruction":"La variable `p` est une variable de type dictionnaire : afficher la valeur de la clef \"Metier\".\n<br><br>_L'affichage doit être fait à l'aide de la fonction `print`._","proposals":"p = data.personne()","solution":"1f21d635886a46f94cb53e7baeeff638fbca53b8"},{"id":"f41955547593c46","title":"Parcourir un tableau","instruction":"Modifier le programme Python ci-dessous pour afficher la somme des valeurs du tableau `tab`.\n<br><br>_L'affichage doit être fait à l'aide de la fonction `print`._","proposals":"tab = data.tableau()","solution":"0e24cd7267d155500f95a2000cd010da32f7627d"}];
    _exercises = data;
    displayExercise();

    renderMathInElement(document.getElementById('instruction'), {
      delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
      ],
      throwOnError : false
    });
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