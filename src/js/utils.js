
export const utils = {
  /* Format test value (replace \n by new lines and trim). */
  formatTestValue: (val) => {
    val = val.replace(/(?<!\\)\\n/g, '\n');
    return val.trim()
  },
  getProgKey: (user, question) => {
    let key = 'prog'
    if(user) {
      key += '_' + user.externalId;
    }
    if(question) {
      key += '_' + question.id;
    }
    return key;
  }
};