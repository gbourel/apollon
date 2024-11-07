import { config } from './config.js';

const TOKCOOKIE = 'usrssot';

const debug = console.log; //() => {};

export const lcms = {
  getAuthToken: () => {
    let token = null;
    if(document.cookie) {
      const name = `${TOKCOOKIE}=`
      let cookies = decodeURIComponent(document.cookie).split(';');
      for (let c of cookies) {
        if(token == null) {
          let idx = c.indexOf(name);
          if(idx > -1) {
            token = c.substring(name.length + idx);
          }
        }
      }
    }
    return token;
  },
  logout: (reload=true) => {
    const cookies = [`${TOKCOOKIE}`];
    for (let cookie of cookies) {
      document.cookie=`${cookie}=; domain=${config.cookieDomain}; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
    if (reload) {
      window.location.reload();
    }
  },
  loadUser: (cb) => {
    let token = lcms.getAuthToken();
    debug('Load user', token);
    if(token) {
      try {
        const meUrl = `${config.lcmsUrl}/auth/userinfo`;
        const req = new Request(meUrl);
        fetch(req, {
          'headers': {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }).then(res => {
          if(res.status === 200) {
            return res.json();
          }
          return lcms.logout(false);
        }).then(data => {
          debug('data', data);
          cb(data);
        }).catch(err => {
          console.warn('Unable to fetch user', err);
          lcms.logout(false);
          config.log(cb);
          cb(null);
        });
      } catch (error) {
        console.info('error', error);
      }
    } else {
      cb(null);
    }
  },
  fetchJourney: (code) => {
    console.info('fetchJourney', code);
    return new Promise((resolve, reject) => {
      const token = lcms.getAuthToken();
      const req = new Request(`${config.lcmsUrl}/parcours/code/${code}`, {
        'headers': { 'Authorization': `Bearer ${token}` }
      });
      fetch(req).then(res => { return res.json(); })
      .then(journey => {
        resolve(journey);
      });
    });
  },
  fetchJourneys: async () => {
    let res = [];
    let codes = [
      'EXNZJN', // Initiation
      'NZGTIQ', // 1ere
      'KIYYTB', // Tale
      'WHISRQ'  // Jeu 2D "pirates"
    ];
    for (let code of codes) {
      res.push(await lcms.fetchJourney(code));
    }
    return res
  },
  fetchActivity: (actId) => {
    return new Promise((resolve, reject) => {
      const token = lcms.getAuthToken();
      const req = new Request(`${config.lcmsUrl}/activity/${actId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetch(req).then(res => { return res.json(); })
      .then(async act => {
        const res = await fetch(`${config.lcmsUrl}/quiz/${act.quiz_id}`);
        act.quiz = await res.json();
        resolve(act);
      });
    });
  },
  fetchQuiz: (quizId) => {
    return new Promise((resolve, reject) => {
      const token = lcms.getAuthToken();
      const req = new Request(`${config.lcmsUrl}/quiz/${quizId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetch(req).then(res => { return res.json(); })
      .then(async quiz => {
        resolve(quiz);
      });
    });
  },
  // Send succes to lcms api
  registerSuccess: (questionId, activityId, answer, content, cb) => {
    if (config.preview) {
      return console.info('Preview mode: no success registration');
    }
    const token = lcms.getAuthToken();
    if(token) {
      const body = {
        question_id: questionId,
        activity_id: activityId,
        duration: 0,
        success: true,
        response: content
      };
      // FIXME start_time end_time duration attempts
      const req = new Request(`${config.lcmsUrl}/resultats/save/question`,  {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      fetch(req).then(res => { return res.json(); })
      .then(cb)
      .catch(err => {
        console.error('Unable to register success', err);
      });
    }
  }
};

