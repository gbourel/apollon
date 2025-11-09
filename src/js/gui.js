
import { marked } from 'marked';
import { baseUrl } from "marked-base-url";
import { pandoc } from "marked-pandoc";
import { newtab } from "marked-newtab";

import { config } from './config.js';
import { lcms } from './lcms.js';
import { python } from './python.js';
import { utils } from './utils.js';

export const gui = {
  showHelp: (show=true) => {
    let panel = document.getElementById('help-panel');
    if(show) {
      panel.classList.remove('hidden-right');
    } else {
      panel.classList.add('hidden-right');
    }
  },
  hideHelp: () => { gui.showHelp(false); },

  // Callback on exercise achievement
  displaySuccess: () => {
    const successOverlay = document.getElementById('overlay');
    successOverlay.classList.remove('hidden');
  },

  showLoading: () => {
    document.getElementById('loading').classList.remove('hidden');
  },
  hideLoading: () => {
    document.getElementById('loading').classList.add('hidden');
  },
  // Display login required warning popup
  loginWarning: () => {
    let lr = document.getElementById('login-required');
    lr.style.width = '100%';
    lr.onclick = gui.hideLoginPopup;
    document.getElementById('login-popup').style.transform = 'translate(0,0)';
  },
  hideLoginPopup: () => {
    document.getElementById('login-popup').style.transform = 'translate(0,-70vh)';
    document.getElementById('login-required').style.width = '0%';
  },
  /// Display main menu (journey selection)
  displayMenu: () => {
    const menu = document.getElementById('mainmenu');
    const progress = document.getElementById('progress');
    const main = document.getElementById('main');
    const instruction = document.getElementById('instruction');
    gui.hideHelp();
    instruction.innerHTML = '';
    progress.classList.add('hidden');
    main.classList.add('hidden');
    if (config.nsix) {
      menu.style.display = 'none';
    } else {
      menu.style.display = 'block';
      menu.style.transform = 'translate(0, 0)';
    }
  },
  toggleMenu: (evt) => {
    let eltMenu = document.getElementById('profileMenu');
    if(eltMenu.classList.contains('hidden')){
      eltMenu.classList.remove('hidden');
      document.addEventListener('click', gui.toggleMenu);
    } else {
      eltMenu.classList.add('hidden');
      document.removeEventListener('click', gui.toggleMenu);
    }
    evt.stopPropagation();
  },
  /// Display exercices list for navigation on top.
  displayActivitiesNav: (ctx, journey, activityIdx) => {
    if (!journey || !journey.activities) { return; }

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
    let markers = [];
    for (let i = 0; i < journey.activities.length; i++) {
      const x = MARKER_PX + MARKER_W*i;
      // if (!_user.results) { break; }
      const done  = lcms.isDone(journey, i);
      const colors = (done ? enabled : disabled);
      const marker = sp.circle(x, MARKER_PY, MARKER_RADIUS);
      marker.attr({
        fill: colors[0],
        stroke: activityIdx === i ? '#006CC5' : colors[1],
        stokeWidth: 12
      });
      let label = sp.text(x, MARKER_PX + 5, ''+i);
      label.attr({
        fill: activityIdx === i ? '#006CC5' : colors[2],
        style: 'font-size:15px;text-align:center;text-anchor:middle;'
      });
      let group = sp.g(marker, label);
      group.attr({
        cursor: 'pointer'
      });
      group.click(async (evt) => {
        await gui.loadActivity(ctx, i, true);
        gui.displayExercise(ctx);
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
      if (!done && journey && journey.code === 'WHISRQ') {
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
      let delta_x = Math.round(overflow / MARKER_W);
    }
  },
  /**
   * Affiche l'exercice en cours.
   */
  displayExercise: (ctx) => {
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

    if (ctx.quiz.questions) {
      ctx.question = ctx.quiz.questions[ctx.questionIdx];
    }

    if (ctx.question) {
      let prog = '';
      let lastprog = localStorage.getItem(utils.getProgKey(ctx.user, ctx.question));
      if(!ctx.pythonEditor) {
        gui.initPythonEditor(ctx);
      }
      ctx.tests = lcms.loadTestsCSV(ctx.question.answers);

      // title.innerHTML = ctx.question.title || 'Entrainement';
      // TODO move image base path to activity / exercise content
      marked.use(baseUrl(`https://filedn.nsix.fr/act/${ctx.activity.id}/`));
      marked.use(pandoc);
      marked.use(newtab);

      instruction.innerHTML = marked.parse(ctx.question.instruction);

      renderMathInElement(instruction, {
        delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError : false
      });
      if(ctx.question.proposal && ctx.question.proposal.length > 0) {
        prog = ctx.question.proposal;
        document.getElementById('resetbtn').classList.remove('hidden');
      } else {
        document.getElementById('resetbtn').classList.add('hidden');
      }
      let helpBtn = document.getElementById('help');
      let helpPanel = document.getElementById('help-panel');
      helpPanel.innerHTML = '';
      if(ctx.question.help) {
        let helps = ctx.question.help.split(/\n/);
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
        if (ctx.journey && ctx.journey.results) {
          const result = ctx.journey.results[ctx.activity.id];
          if (result && result[ctx.questionIdx]) {
            const r = result[ctx.questionIdx];
            if (r.response) {
              prog = r.response;
              if (prog && prog.startsWith('"')) {
                prog = JSON.parse(prog)
              }
            }
          }
        }
      }
      ctx.pythonEditor.setValue(prog);
      // register exercise start
      // TODO lcms
    } else {
      if(!ctx.pythonEditor) { gui.initPythonEditor(ctx); }
      instruction.innerHTML = marked.parse('**Bravo !** Tous les exercices de ce niveau sont terminés !');
    }

    gui.displayActivitiesNav(ctx, ctx.journey, ctx.activityIdx);
  },
  initPythonEditor: (ctx) => {
    ctx.pythonEditor = CodeMirror(document.getElementById('pythonsrc'), {
      value: "print('Hello world')",
      mode:  "python",
      lineNumbers: true,
      theme: 'monokai',
      indentUnit: 4,
      extraKeys: {
        'Tab': (cm) => cm.execCommand("indentMore"),
        'Shift-Tab': (cm) => cm.execCommand("indentLess"),
        'Ctrl-Enter': () => { python.runit(ctx); }
      }
    });
  },
  loadActivity: async (ctx, idx, force=false) => {
    ctx.activityIdx = idx;
    ctx.activity = ctx.journey.activities[idx];
    if (ctx.activity && ctx.activity.quiz_id) {
      const results = null;
      if(ctx.journey.results) {
        ctx.journey.results[ctx.activity.id];
      }
      ctx.quiz = await lcms.fetchQuiz(ctx.activity.quiz_id);
      ctx.questionIdx = force ? '0' : -1;
      if (results) {
        for (let i = 0; i < results.length; i++) {
          if(!results[i].done) {
            ctx.questionIdx = i;
            break;;
          }
        }
      } else {
        ctx.questionIdx = 0;
      }
    }
  },
  // Reload initial prog
  resetProg: (ctx) => {
    if(ctx.question && ctx.question.proposal && ctx.question.proposal.length > 0) {
      if(ctx.pythonEditor) {
        ctx.pythonEditor.setValue(ctx.question.proposal);
      }
    }
  },
  updateAchievements: (ctx) => {
    if(!ctx.user || !ctx.journeys) { return; }
    for (let i = 1; i <= ctx.journeys.length ; i++){
      if (!ctx.journeys[i-1].activities) { continue; }
      let elt = document.querySelector(`#level-${i} .percent`);
      let total =  ctx.journeys[i-1].activities.length;
      let done = 0;
      for (let k in ctx.journeys[i-1].results) {
        done += ctx.journeys[i-1].results[k].length;
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
  },
  // Go to next exercise
  nextQuestion: async (ctx) => {
    const successOverlay = document.getElementById('overlay');
    successOverlay.classList.add('hidden');
    const outputpre = document.getElementById('output');
    outputpre.innerHTML = ''
    ctx.userOutput = '';

    // si il reste des questions
    if (ctx.questionIdx + 1 < ctx.quiz.questions.length) {
      ctx.questionIdx++;
    } else {
      // si il reste des activités
      let idx = ctx.activityIdx + 1;
      while (idx < ctx.journey.activities.length) {
        if (!lcms.isDone(ctx.journey, idx)) {
          await lcms.loadActivity(ctx, idx);
          break;
        }
        idx++;
      }
      // si toutes les activites sont terminees
      if (idx >= ctx.journey.activities.length) {
        ctx.activityIdx = -1;
        ctx.questionIdx = -1;
      }
    }

    gui.displayExercise(ctx);
  }

}