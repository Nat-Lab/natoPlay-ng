var toneControl = (function () {

  destroy = function (tid) {
    window.clearInterval(tid);
  };

  create = function(freq, lvl, intv, dur) {
    var fire_intv = intv + dur;
    var tone = new Tone.Oscillator({
      "type": "square",
      "frequency" : freq,
      "volume" : lvl
    }).toMaster().start();
    window.setTimeout(function() {
      tone.stop();
    }, dur);
    var tid = window.setInterval(function() {
      window.setTimeout(function() {
        tone.stop();
      }, fire_intv);
      window.setTimeout(function() {
        tone.start();
      }, intv);
    }, fire_intv);
    return tid;
  };

  return {
    create: create,
    destroy: destroy
  };

})();
