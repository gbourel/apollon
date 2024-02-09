import { config } from './config.js';

export const lcms = {
  getAuthToken: () => {
    let token = null;
    if(document.cookie) {
      const name = 'neossot='
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
    const cookies = ['neossot'];
    for (let cookie of cookies) {
      document.cookie=`${cookie}=; domain=${config.cookieDomain}; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
    if (reload) {
      window.location.reload();
    }
  },
  loadUser: (cb) => {
    let token = lcms.getAuthToken();
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
  fetchJourney: (jid) => {
    const token = lcms.getAuthToken();
    return new Promise((resolve, reject) => {
      const req = new Request(`${jid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetch(req).then(res => { return res.json(); })
      .then(journey => {
        resolve(journey);
      });
    });
  },
  fetchJourneys: async () => {
    let res = [];
    let jids = [
      `${config.lcmsUrl}/parcours/code/EXNZJN`, // Initiation
      `${config.lcmsUrl}/parcours/code/NZGTIQ`, // 1ere
      `${config.lcmsUrl}/parcours/code/KIYYTB`, // Tale
      `${config.lcmsUrl}/parcours/code/WHISRQ`  // Jeu 2D "pirates"
    ];
    for (let jid of jids) {
      res.push(await lcms.fetchJourney(jid));
    }
    return res
  },
  fetchActivity: (actId) => {
    const token = lcms.getAuthToken();
    return new Promise((resolve, reject) => {
      const req = new Request(`${config.lcmsUrl}/activity/${actId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      fetch(req).then(res => { return res.json(); })
      .then(act => {
        resolve(act);
      });
    });
  },
  // Send succes to lcms api
  registerSuccess: (activityId, answer, content, cb) => {
    if (config.preview) {
      return console.info('Preview mode: no success registration');
    }
    const token = lcms.getAuthToken();
    if(token) {
      const body = {
        activity_id: activityId,
        duration: 0,
        success: true,
        response: content
      };
      // FIXME start_time end_time duration attempts
      const req = new Request(`${config.lcmsUrl}/activity/${activityId}`,  {
        method: 'POST',
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

