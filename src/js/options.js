
export const options = {
  debug: false,
  parcours: -1,
  exidx: -1,
  preview: false
};
const types = {
  debug: 'bool',
  parcours: 'int',
  exidx: 'int',
  preview: 'bool'
}

function loadParams() {
  let search = window.location.search;
  if(search && search.length > 0) {
    let vars = search.substring(1).split("&");
    for (let v of vars) {
      let pair = v.split("=");
      if (types[pair[0]] === 'bool') {
        options[pair[0]] = true;
      } else if (types[pair[0]] === 'int') {
        options[pair[0]] = parseInt(pair[1]);
      } else {
        options[pair[0]] = pair[1];
      }
    }
  }
}
loadParams();
