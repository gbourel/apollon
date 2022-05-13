
function $builtinmodule(name) {
    var mod = {};

    // mod.personne = new Sk.builtin.func(function() {
    //   return Sk.ffi.remapToPy(JSON.parse(atob(pers)));
    // });

    mod.tableau = new Sk.builtin.func(function() {
      let t = [234, 654, 612, 728, 546, 414, 97, 343, 314, 823, 967, 642, 445, 721, 910,
        115, 73, 104]
      return Sk.ffi.remapToPy(t);
    });

    mod.__name__ = new Sk.builtin.str("snap");

    return mod;
};
