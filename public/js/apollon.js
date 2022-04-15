(function (){

const VERSION = 'v0.1.0';
let _output = [];     // Current script stdout
let _nsix = false;    // If embedded in a nsix challenge
// List of local exercises
const _exercises = {
  'e5b2f3a850b1e60': {
    'title': 'Utilisation d\'une variable de type dictionnaire',
    'instruction': "La variable `p` est une variable de type dictionnaire : afficher la valeur de la clef \"Metier\".\n" +
    "<br><br>" +
    "_L'affichage doit être fait à l'aide de la fonction `print`._",
    'proposals': 'p = data.personne()',
    'solution': '1f21d635886a46f94cb53e7baeeff638fbca53b8'
  },
  'c9b5438d85e07b8': {
    'title': 'Modifier un programme',
    'instruction': "Modifier le programme Python ci-dessous pour afficher le résultat de $a^5 + 79$.\n" +
    "<br><br>" +
    "_L'affichage doit être fait à l'aide de la fonction `print`._",
    'proposals': 'a = 7',
    'solution': '84b1c1cf45ea7a79a126b663df760e034264dae6'
  },
  'f41955547593c46': {
    'title': 'Manipuler un tableau',
    'instruction': "Modifier le programme Python ci-dessous pour afficher la somme des valeurs du tableau `tab`.\n" +
    "<br><br>" +
    "_L'affichage doit être fait à l'aide de la fonction `print`._",
    'proposals': 'tab = [234, 654, 612, 728, 546, 414, 97, 343, 314, 823, 967, 642, 445, 721, 910, 796, 407, 529, 184, 430, 178, 239, 135, 299, 457, 757, 540, 369, 153, 667, 493, 782, 538, 114, 644, 427, 717, 381, 219, 41, 238, 706, 751, 668, 682, 166, 784, 398, 335, 789, 87, 644, 715, 468, 220, 501, 222, 628, 192, 114, 65, 785, 55, 700, 753, 112, 393, 454]',
    'solution': '84b1c1cf45ea7a79a126b663df760e034264dae6'
  }
}
let _exerciseIdx = 1;  // Current exercise index
let _exercise = null;  // Current exercise

document.getElementById('version').textContent = VERSION;

// Callback on exercise achievement
function displaySuccess() {
  const successOverlay = document.getElementById('overlay');
  successOverlay.classList.remove('hidden');
}

function loadexercise() {
  const title = document.getElementById('title');
  const instruction = document.getElementById('instruction');
  const ta = document.getElementById('pythonsrc');

  _exercise = _exercises[Object.keys(_exercises)[_exerciseIdx]];

  title.innerHTML = _exercise.title;
  instruction.innerHTML = marked.parse(_exercise.instruction);
  ta.value = _exercise.proposals;
}

// Loads next exercise
function nextExercise() {
  const successOverlay = document.getElementById('overlay');
  successOverlay.classList.add('hidden');
  var outputpre = document.getElementById('output');
  outputpre.innerHTML = ''
  _exerciseIdx++;
  loadexercise();
}

// Python script stdout
function outf(text) {
  _output.push(text.trim());
  document.getElementById('output').innerHTML += text + '<br>';
}
// Load python modules
function builtinRead(x) {
  console.info('Read', x)
  if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined)
    throw "File not found: '" + x + "'";
  return Sk.builtinFiles["files"][x];
}

// Run python script
function runit() {
  var prog = document.getElementById('pythonsrc').value;
  var mypre = document.getElementById('output');
  mypre.innerHTML = '';
  Sk.pre = 'output';
  Sk.configure({
    output:outf,
    read:builtinRead
  });
  prog = 'import data\n' + prog;
  (Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = 'mycanvas';
  _output = [];
  var myPromise = Sk.misceval.asyncToPromise(function() {
      return Sk.importMainWithBody("<stdin>", false, prog, true);
  });
  myPromise.then(function(mod) {
    if(_output.length === 1 && sha1(_output[0]) === _exercise.solution){
      displaySuccess();
      console.info('Ok')
    }
  },
  function(err) {
    console.log(err.toString());
  });
}

function init(){
  const runbtn = document.getElementById('runbtn');
  const nextbtn = document.getElementById('nextbtn');
  let purl = new URL(window.location.href);
  if(purl && purl.searchParams) {
    let challenge = purl.searchParams.get("challenge");
    if(challenge !== null) {
      if (_exercises[challenge]) {
        _exercise = _exercises[challenge];
      } else {
        console.error(`Unknown exercise "${challenge}"`);
      }
    }
    let autostart = purl.searchParams.get("autostart");
    if(autostart !== null) {
      runit();
    }
  }

  runbtn.addEventListener('click', runit);
  nextbtn.addEventListener('click', nextExercise);

  loadexercise();

  // run script on CTRL + Enter shortcut
  document.addEventListener('keyup', evt => {
    if(evt.target && evt.target.id === 'pythonsrc'
       && evt.key === 'Enter'
       && evt.ctrlKey && !evt.shiftKey && !evt.altKey) {
      runit();
    }
  });
}

// if in iframe (i.e. nsix challenge)
_nsix = window.location !== window.parent.location;
const elts = document.querySelectorAll(_nsix ? '.nsix' : '.standalone');
for (let e of elts) {
  e.classList.remove('hidden');
}

document.addEventListener("DOMContentLoaded", function() {
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

init();

// DEBUG
setTimeout(() => {
  runit();
}, 500);

})();