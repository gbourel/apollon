(function (){

const VERSION = 'v0.1.0';
let output = [];

document.getElementById('version').textContent = VERSION;

function displaySuccess() {
  const successOverlay = document.getElementById('overlay');
  successOverlay.classList.remove('hidden');
}

function outf(text) {
  output.push(text.trim());
  document.getElementById('output').innerHTML += text + '<br>';
}
function builtinRead(x) {
  console.info('Read', x)
  if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined)
    throw "File not found: '" + x + "'";
  return Sk.builtinFiles["files"][x];
}

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
  output = [];
  var myPromise = Sk.misceval.asyncToPromise(function() {
      return Sk.importMainWithBody("<stdin>", false, prog, true);
  });
  myPromise.then(function(mod) {
    if(output.length === 1 && sha1(output[0]) === exercise.solution){
      displaySuccess();
      console.info('Ok')
    }
  },
  function(err) {
    console.log(err.toString());
  });
}

function init(){
  const title = document.getElementById('title');
  const instruction = document.getElementById('instruction');
  const ta = document.getElementById('pythonsrc');
  const btn = document.getElementById('runbtn');
  title.innerHTML = exercise.title;
  instruction.innerHTML = marked.parse(exercise.instruction);
  ta.value = exercise.proposals;
  btn.addEventListener('click', runit);
}

// if in iframe
if ( window.location !== window.parent.location ) {
  // let elt = document.getElementById('title-header');
  // elt.style.display = 'none';
}

// console.info(sha1('test'))
const exercises = {
  'e5b2f3a850b1e60': {
    'title': 'Utilisation d\'une variable de type dictionnaire',
    'instruction': "La variable `p` est une variable de type dictionnaire : afficher la valeur de la clef \"Metier\".\n" +
    "\n" +
    "_L'affichage doit être fait à l'aide de la fonction `print`._",
    'proposals': 'p = data.personne()',
    'solution': '1f21d635886a46f94cb53e7baeeff638fbca53b8'
  },
  'c9b5438d85e07b8': {
    'title': 'Modifier un programme',
    'instruction': "Modifier le programme Python ci-dessous pour afficher le résultat de a^5 + 79.\n" +
    "\n" +
    "_L'affichage doit être fait à l'aide de la fonction `print`._",
    'proposals': 'a = 7',
    'solution': '84b1c1cf45ea7a79a126b663df760e034264dae6'
  },
  'f41955547593c46': {
    'title': 'Manipuler un tableau',
    'instruction': "Modifier le programme Python ci-dessous pour afficher la somme des valeurs du tableau `tab`.\n" +
    "\n" +
    "_L'affichage doit être fait à l'aide de la fonction `print`._",
    'proposals': 'tab = [234, 654, 612, 728, 546, 414, 97, 343, 314, 823, 967, 642, 445, 721, 910, 796, 407, 529, 184, 430, 178, 239, 135, 299, 457, 757, 540, 369, 153, 667, 493, 782, 538, 114, 644, 427, 717, 381, 219, 41, 238, 706, 751, 668, 682, 166, 784, 398, 335, 789, 87, 644, 715, 468, 220, 501, 222, 628, 192, 114, 65, 785, 55, 700, 753, 112, 393, 454]',
    'solution': '84b1c1cf45ea7a79a126b663df760e034264dae6'
  }
}
let exercise = exercises['e5b2f3a850b1e60'];

let purl = new URL(window.location.href);
if(purl && purl.searchParams) {
  let challenge = purl.searchParams.get("challenge");
  if(challenge !== null) {
    if (exercises[challenge]) {
      exercise = exercises[challenge];
    } else {
      console.error(`Unknown exercise "${challenge}"`);
    }
  }
  let autostart = purl.searchParams.get("autostart");
  if(autostart !== null) {
    runit();
  }
}

init();

setTimeout(() => {
  runit();
}, 500);

})();