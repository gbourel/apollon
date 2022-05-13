let pers = 'eyJOb20iOiJTdHJlZXAiLCJQcmVub20iOiJNZXJ5bCIsIkRhdGVEZU5haXNzYW5jZSI6IjE5NDkvMDYvMjIiLCJNZXRpZXIiOiJBY3RyaWNlIiwiRmlsbXMiOlsiVm95YWdlIGF1IGJvdXQgZGUgbCdlbmZlciIsIktyYW1lciBjb250cmUgS3JhbWVyIiwiTGEgTWHudHJlc3NlIGR1IGxpZXV0ZW5hbnQgZnJhbudhaXMiLCJMZSBDaG9peCBkZSBTb3BoaWUiLCJPdXQgb2YgQWZyaWNhIiwiTGUgZGlhYmxlIHMnaGFiaWxsZSBlbiBQcmFkYSIsIk1hbW1hIE1pYSEiLCJMYSBEYW1lIGRlIGZlciIsIlBlbnRhZ29uIFBhcGVycyJdLCJQZXJlIjoiSGFycnkgV2lsbGlhbSBTdHJlZXAgSnIuIiwiTWVyZSI6Ik1hcnkgV29sZiJ9';

function $builtinmodule(name) {
    var mod = {};

    mod.personne = new Sk.builtin.func(function() {
      return Sk.ffi.remapToPy(JSON.parse(atob(pers)));
    });

    mod.tableau = new Sk.builtin.func(function() {
      let t = [234, 654, 612, 728, 546, 414, 97, 343, 314, 823, 967, 642, 445, 721, 910,
        796, 407, 529, 184, 430, 178, 239, 135, 299, 457, 757, 540, 369, 153, 667, 493,
        782, 538, 114, 644, 427, 717, 381, 219, 41, 238, 706, 751, 668, 682, 166, 784,
        398, 335, 789, 87, 644, 715, 468, 220, 501, 222, 628, 192, 114, 65, 785, 55, 700,
        753, 112, 393, 454, 463, 173, 215, 22, 573, 404, 27, 94, 716, 164, 85, 566, 321,
        256, 174, 332, 264, 430, 653, 468, 564, 518, 241, 15, 429, 484, 561, 467, 160,
        596, 94, 245, 184, 134, 436, 142, 62, 326, 792, 728, 94, 580, 682, 542, 652, 738,
        206, 94, 677, 48, 295, 552, 258, 399, 496, 210, 688, 488, 522, 629, 762, 31, 761,
        484, 521, 575, 406, 189, 256, 592, 662, 767, 520, 161, 105, 185, 299, 271, 589,
        681, 98, 157, 524, 733, 408, 798, 77, 381, 444, 142, 166, 757, 108, 773, 258, 705,
        43, 308, 500, 167, 313, 365, 354, 152, 171, 267, 256, 634, 662, 695, 642, 179,
        316, 601, 386, 193, 774, 53, 575, 324, 669, 68, 352, 209, 564, 739, 333, 115,
        749, 216, 459, 98, 192, 731, 282, 340, 227, 736, 552, 281, 360, 53, 774, 623,
        613, 662, 739, 36, 52, 585, 108, 629, 124, 151, 646, 510, 239, 675, 325, 682,
        146, 768, 2, 571, 447, 6, 552, 657, 358, 473, 405, 551, 22, 60, 58, 325, 407,
        356, 378, 84, 385, 654, 466, 177, 338, 44, 142, 71, 229, 144, 703, 614, 617,
        718, 313, 392, 617, 231, 684, 220, 531, 511, 723, 656, 581, 615, 121, 462,
        390, 237, 639, 463, 300, 69, 759, 247, 293, 767, 368, 538, 543, 570, 593,
        115, 73, 104]
      return Sk.ffi.remapToPy(t);
    });

    mod.__name__ = new Sk.builtin.str("data");

    return mod;
};
