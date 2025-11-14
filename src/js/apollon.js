const VERSION = 'v0.15.5';
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
  journeys: [],       // All journeys
  journey: null,      // Current journey
  activity: null,     // Current activity
  activityIdx: null,  // Current activity index
  quiz: [],           // All exercises for current journey
  questionIdx: 0,     // Current exercise index
  question: null,     // Current exercise
  tests: [],          // Tests for current exercise
  over: false,        // currently running program is terminated
  lastFocus: null,    // focused element before program start (for graphical display only)
  nsix: false,        // If embedded in a nsix challenge
  skipLogin: false,   // Don't ask for login anymore
  user: null
};

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
  if (!_context.activity || (msg.data.activity && msg.data.activity !== _context.activity.id)) {
    _context.activity = await lcms.fetchActivity(msg.data.activity);
    if (_context.activity && _context.activity.quiz) {
      _context.quiz = _context.activity.quiz;
    }
  }
  if (_context.quiz && _context.quiz.questions && msg.data.question < _context.quiz.questions.length) {
    const instruction = document.getElementById('instruction');
    _context.questionIdx = msg.data.question;
    gui.displayExercise(_context);
  } else {
    const instruction = document.getElementById('instruction');
    instruction.innerHTML = '<div class="error">🔍️ Erreur : question non trouvée.</div>';
    console.warn(msg.data.question, _context.quiz.questions);
  }

}
window.addEventListener('message', handleMessage, false);



function login() {
  const current = location.href;
  location.href = `${config.nsixLoginUrl}?dest=${current}`;
}
function registerSkipLogin() {
  _context.skipLogin = true;
}


async function init(){
  python.setupSkulpt();
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
  document.getElementById('runbtn').addEventListener('click', () => { python.runit(_context); });
  document.getElementById('homebtn').addEventListener('click', () => { _context.journey = null; gui.displayMenu(); history.pushState(null, '', '/'); });
  document.getElementById('nextbtn').addEventListener('click', () => { gui.nextQuestion(_context); });
  document.getElementById('resetbtn').addEventListener('click', () => { gui.resetProg(_context); });
  document.getElementById('login').addEventListener('click', login);
  document.getElementById('login2').addEventListener('click', login);
  // document.getElementById('skip-login-btn').addEventListener('click', registerSkipLogin);
  document.getElementById('level-1').addEventListener('click', () => lcms.loadJourney(_context, 1, true));
  document.getElementById('level-2').addEventListener('click', () => lcms.loadJourney(_context, 2, true));
  document.getElementById('level-3').addEventListener('click', () => lcms.loadJourney(_context, 3, true));
  document.getElementById('level-4').addEventListener('click', () => lcms.loadJourney(_context, 4, true));
  document.getElementById('profileMenuBtn').addEventListener('click', gui.toggleMenu);

  document.getElementById('help').addEventListener('click', gui.showHelp);
  document.getElementById('help-panel').addEventListener('click', gui.hideHelp);

  // Save script on keystroke
  document.addEventListener('keyup', evt => {
    if(evt.target && evt.target.nodeName === 'TEXTAREA') {
      if(_context.pythonEditor){
        localStorage.setItem(utils.getProgKey(_context.user, _context.question), _context.pythonEditor.getValue());
      }
    }
  });
  addEventListener('popstate', evt => {
    if(evt.state && evt.state.level) {
      lcms.loadJourney(_context, evt.state.level);
    } else {
      _context.journey = null;
      gui.displayMenu();
    }
  });

  lcms.loadUser(async (user) => {
    let loaded = false;
    // TODO session cache
    if(user) {
      _context.user = user;
      document.getElementById('username').innerHTML = user.firstname || 'Moi';
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
        _context.journeys = await lcms.fetchJourneys();
        gui.updateAchievements(_context);
        if(config.parcours >= 0) {
          lcms.loadJourney(_context, config.parcours);
          loaded = true;
        }
      }
    } else {
      document.getElementById('login').classList.remove('hidden');
      _context.user = null;
    }

    if(!loaded) { _context.journey = null; gui.displayMenu(); }
    gui.hideLoading();
  });
}

const elts = document.querySelectorAll(config.nsix ? '.nsix' : '.standalone');
for (let e of elts) {
  e.classList.remove('hidden');
}

init();
