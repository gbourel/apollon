const VERSION = 'v0.15.0';
document.getElementById('version').textContent = VERSION;

import { marked } from 'marked';
import { baseUrl } from "marked-base-url";
import { pandoc } from "marked-pandoc";
import { newtab } from "marked-newtab";

import { config } from './config.js';
import { gui } from './gui.js';
import { lcms } from './lcms.js';
import { python } from './python.js';
import { utils } from './utils.js';


let _context = {
  pythonEditor: null, // Codemirror editor
  output: [],         // Current script stdout
  userOutput: '',     // Current script user output
  question: null,     // Current exercise
  tests: [],          // Tests for current exercise
  over: false,        // currently running program is terminated
  lastFocus: null,    // focused element before program start (for graphical display only)
  nsix: true,         // If embedded in a nsix challenge
  skipLogin: false,   // Don't ask for login anymore
  user: null,

  journeys: [],       // All journeys
  journey: null,      // Current journey
  activity: null,     // Current activity
  activityIdx: null,  // Current activity index
  quiz: [],           // All exercises for current journey
  questionIdx: 0      // Current exercise index
};

let _prog = null;
let _questionId = null;

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


// let main = null;
// let markers = null;
// let delta_x = 0

// function updateListTx() {
//   if(main === null) { return; }
//   main.animate({
//     transform: `t${-delta_x * MARKER_W}`
//   }, 1000, main.easeinout, () => {
//     for (let i = 0; i < markers.length; i++) {
//       let content = markers[i].children();
//       content[0].attr('stroke', _context.activityIdx === i ? '#006CC5' : '#444');
//       content[1].attr('fill', _context.activityIdx === i ? '#006CC5' : '#444');
//     }
//   });
//   markers[delta_x].attr('display', 'none');
//   if(dx > 0) {
//   } else if (dx < 0) {
//     previous.attr('display', 'inline');
//   }
// }

// Message ?
async function handleMessage(msg) {
  if (msg.data && msg.data.state) {
    if (msg.data.state === '__load__') {
      _prog = '';
      if(msg.data.proposal && msg.data.proposal.length > 0) {
        _prog = msg.data.proposal;
        document.getElementById('resetbtn').classList.remove('hidden');
      } else {
        document.getElementById('resetbtn').classList.add('hidden');
      }

      _questionId = msg.data.question;
      _context.tests = lcms.loadTestsCSV(msg.data.tests);

      let last = localStorage.getItem(`prog_embedded_${_questionId}`);
      _context.pythonEditor.setValue(last ? last : _prog);

      gui.hideLoading();
    } else {
      console.warn('Unknown message state', msg.data.state);
    }
  }
  // if (!_context.activity || (msg.data.activity && msg.data.activity !== _context.activity.id)) {
  //   _context.activity = await lcms.fetchActivity(msg.data.activity);
  //   if (_context.activity && _context.activity.quiz) {
  //     _context.quiz = _context.activity.quiz;
  //   }
  // }
  // if (_context.quiz && _context.quiz.questions && msg.data.question < _context.quiz.questions.length) {
  //   const instruction = document.getElementById('instruction');
  //   _context.questionIdx = msg.data.question;
  //   gui.displayExercise(_context);
  // } else {
  //   const instruction = document.getElementById('instruction');
  //   instruction.innerHTML = '<div class="error">🔍️ Erreur : question non trouvée.</div>';
  //   console.warn(msg.data.question, _context.quiz.questions);
  // }

}
window.addEventListener('message', handleMessage, false);



async function init(){
  python.setupSkulpt();
  (Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = 'turtlecanvas';

  marked.setOptions({
    gfm: true
  });

  document.getElementById('runbtn').addEventListener('click', () => { python.runit(_context); });
  document.getElementById('resetbtn').addEventListener('click', () => { _context.pythonEditor.setValue(_prog); });

  // Save script on keystroke
  document.addEventListener('keyup', evt => {
    if(evt.target && evt.target.nodeName === 'TEXTAREA') {
      if(_context.pythonEditor){
        localStorage.setItem(`prog_embedded_${_questionId}`, _context.pythonEditor.getValue());
      }
    }
  });

  gui.initPythonEditor(_context);

  window.parent.window.postMessage({
    'state': '__initialized__',
    'from': 'python.nsix.fr'
  }, '*');
}

init();
