
import { config } from './config.js';
import { gui } from './gui.js';
import { lcms } from './lcms.js';
import { utils } from './utils.js';

const debug = console.log; //() => {};

const imgCache = {};
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

// Python script stdout
function outf(ctx, text) {
  if(text.startsWith('### END_OF_CONTEXT.USER_INPUT ###')) {
    ctx.over = true;
  } else if(ctx.over === true && text.startsWith('__TESTRES__')) {
    ctx.output.push(text.substring(12).trim());
  } else {
    ctx.userOutput += text;
    document.getElementById('output').innerHTML += `<pre>${text}</pre>`;
  }
}

function builtinRead(file) {
  console.log("Attempting file: " + Sk.ffi.remapToJs(file));
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

function checkTest(ctx, idx) {
  if (idx >= ctx.output.length) { return false; }
  let test = ctx.tests[idx];
  if(test.python == "USER_OUTPUT") {
    let uo = ctx.userOutput.replace(/(?:\r\n|\r|\n)/g, ' ');
    let val = test.value.replace(/(?:\r\n|\r|\n)/g, ' ');
    return uo.trim() === val.trim();
  } else if (test.python == "MAX_LINES") {
    let lines = ctx.pythonEditor.getValue().trim().split(/\r\n|\r|\n/).length;
    return lines <= test.value;
  }
  return utils.formatTestValue(test.value) === ctx.output[idx].trim();
}

// On Python script completion
function onCompletion(ctx, mod) {
  if (!ctx.nsix && !ctx.question) { return; }
  let nbFailed = ctx.tests.length;
  let table = document.importNode(document.querySelector('#results-table').content, true);
  let lineTemplate = document.querySelector('#result-line');
  let hasHelp = false;
  ctx.tests.forEach(t => {
    if (t && t.option && (t.option.toLowerCase() !== 'hide')) { hasHelp = true; }
    if (t && t.live && t.fn === 'call' && Sk.callCount[t.global] >= t.value) {
      t.passed = true;
    }
  });
  table.querySelector('thead td.aide').style.display = hasHelp ? 'table-cell' : 'none';
  if(ctx.tests.length > 0) {
    nbFailed = 0;
    for (let i = 0 ; i < ctx.tests.length; i++) {
      let line = null;
      if(!ctx.tests[i].option || ctx.tests[i].option.toLowerCase() !== 'hide') {
        line = document.importNode(lineTemplate.content, true);
        let cells = line.querySelectorAll('td');
        if (ctx.tests[i].python === 'USER_OUTPUT') {
          cells[0].textContent = 'Affichage avec print';
          cells[1].textContent = ctx.tests[i].value.trim();
          cells[2].textContent = ctx.userOutput.trim();
        } else if (ctx.tests[i].python === 'MAX_LINES') {
          cells[0].textContent = 'Nombre de lignes';
          cells[1].textContent = `Max. ${ctx.tests[i].value.trim()}`;
          cells[2].textContent = ctx.pythonEditor.getValue().trim().split(/\r\n|\r|\n/).length;
        } else {
          cells[0].textContent = ctx.tests[i].python;
          cells[1].textContent = utils.formatTestValue(ctx.tests[i].value);
          if (i < ctx.output.length) {
            cells[2].textContent = ctx.tests[i].live ? ctx.tests[i].passed : ctx.output[i].trim();
          } else {
            cells[2].textContent = "Erreur, valeur non trouvée";
          }
        }
        if(hasHelp) {
          cells[3].textContent = ctx.tests[i].option;
          cells[3].style.display = 'table-cell';
        } else {
          cells[3].style.display = 'none';
        }
      } else {
        line = document.importNode(lineTemplate.content, true);
        let cells = line.querySelectorAll('td');
        cells[0].textContent = "Test caché";
      }
      if((ctx.tests[i].live && ctx.tests[i].passed) ||
         (!ctx.tests[i].live && checkTest(ctx, i))) {
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
    if(ctx.nsix) {
      window.parent.window.postMessage({
        'state': '__completed__',
        'answer': (nbFailed === 0) ? '__done__' : '__ongoing__',
        'content': ctx.pythonEditor.getValue(),
        'from': 'python.nsix.fr'
      }, '*');
    } else {
      if (nbFailed === 0) {
        const answer = sha256('' + ctx.question.id);
        lcms.registerSuccess(ctx.question.id, ctx.activity.id, answer, ctx.pythonEditor.getValue(), (data) => {
          if(!ctx.journey.results[ctx.activity.id]) {
            ctx.journey.results[ctx.activity.id] = [data];
          } else {
            ctx.journey.results[ctx.activity.id].push(data);
          }
          gui.updateAchievements(ctx);
        });
        gui.displaySuccess();
      }
    }
  } else {
    console.warn('Output count unmatched', ctx.output);
  }
  const elt = document.createElement('div');
  let content = '';
  if(nbFailed > 0) {
    elt.classList.add('failed');
    content = `Résultat : ${ctx.tests.length} test`;
    if(ctx.tests.length > 1) { content += 's'; }
    content += `, ${nbFailed} échec`
    if(nbFailed > 1) { content += 's'; }
  } else {
    elt.classList.add('success');
    if(ctx.tests.length > 1) {
      content = `Succès des ${ctx.tests.length} tests`;
    } else {
      content = `Succès de ${ctx.tests.length} test`;
    }
  }
  elt.innerHTML += `<div class="result">${content}</div>`;
  if(ctx.tests.find(t => (!t.option || t.option.toLowerCase() !== 'hide'))){
    elt.appendChild(table);
  }
  document.getElementById('output').appendChild(elt);

  if(ctx.lastFocus) { ctx.lastFocus.focus(); }
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

async function loadPygame(ctx, prog){
  config.log('Load Pygame');
  const output = document.getElementById('output');
  const canvas = document.getElementById('pygamecanvas')
  const ctx2d = canvas.getContext("2d");
  ctx2d.fillStyle = "rgb(39, 40, 34)";
  ctx2d.fillRect(0, 0, canvas.width, canvas.height);
  ctx2d.fillStyle = "rgb(166, 226, 46)";
  ctx2d.font = '12px sans-serif';
  ctx2d.textAlign = 'center';
  ctx2d.fillText('Chargement en cours', canvas.width/2, canvas.height/2);
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
  ctx.lastFocus = document.activeElement;
  canvas.focus();
}



export const python = {
  setupSkulpt: () => {
    Sk.main_canvas = document.getElementById("pygamecanvas");
    Sk.imgPath = 'https://filedn.nsix.fr/NSI/assets/';
    Sk.audioPath = 'https://filedn.nsix.fr/NSI/assets/';
  },
  // Run python script
  runit: async (ctx) => {
    if(ctx.pythonEditor === null) { return; }
    let prog = ctx.pythonEditor.getValue();
    let outputElt = document.getElementById('output');
    outputElt.innerHTML = '';

    if (prog.indexOf('pygame') > 0) {
      await loadPygame(ctx, prog);
    }
    // reinit live tests
    for (let t of ctx.tests) { if (t.live) { t.passed = false; } }

    Sk.pre = 'output';
    Sk.imgCache = imgCache;
    Sk.searchImportUseFullPath = true;
    Sk.updateListener = () => {
      for (let lt of ctx.tests) {
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
    for (let lt of ctx.tests) {
      // TODO call type
      if(lt.live && lt.fn === 'call') {
        calls[lt.global] = 0
      }
    }
    if (Object.keys(calls).length > 0) { Sk.callCount = calls; }
    Sk.configure({
      output: (text) => { outf(ctx, text); },
      read: builtinRead,
      __future__: Sk.python3,
      inputfunTakesPrompt: true
    });
    prog += "\nprint('### END_OF_CONTEXT.USER_INPUT ###')\n";
    for (let t of ctx.tests) {
      let instruction = t.python.trim();
      if(t.live || instruction == 'USER_OUTPUT' || instruction == 'MAX_LINES') {
        instruction = 'print("__TESTRES__ -")';
      } else if(!instruction.startsWith('print')) {
        instruction = `print("__TESTRES__", ${instruction})`;
      }
      prog += "\n" + instruction;
    }
    ctx.output = [];
    ctx.userOutput = '';
    ctx.over = false;
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
    }).then((mod) => { onCompletion(ctx, mod); },
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
      if(!ctx.over) {
        document.getElementById('output').innerHTML += `<div class="error">${msg}</div>`;
      } else {
        if(msg.startsWith('NameError: name')) {
          let idx = msg.lastIndexOf('on line');
          document.getElementById('output').innerHTML += `<div class="error">${msg.substring(0, idx)}</div>`;
        }
        onCompletion(ctx);
      }
    });
  }

};