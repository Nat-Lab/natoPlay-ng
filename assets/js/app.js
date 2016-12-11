(function () {

  var tasks = [];

  var taskFilter = function() {
    return function (t) {
      return "每 " + t.task.interval + " 毫秒，發生 " + t.task.freq + " 赫茲的方波 " + t.task.duration + " 毫秒，音量 " + t.task.level + " 杜比。"; 
    };
  };

  function natoPlayServer(server) {
  }

  function natoPlayClient(server) {
    var tonesControler = (function () {
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

    var tasksController = (function() {
      add = function(task) {};
      remove = function(tid) {};
    })();

    var clientRpc = (function() {
      start = function() { console.log("start client from: ", server); }; 
      stop = function() { consloe.log("stop it."); };
      return {
        start: start, 
        stop: stop
      };
    })();
    return clientRpc;
  }

  angular.module('natoPlay', ['ngMaterial'])
    .controller('mainController', function ($scope) {
      $scope.setmode = function(mode) { console.log('set mode to:', mode); }
    })
    .controller('playServer', function($scope) {
      var newTask = {};
      $scope.tasks = tasks;
      $scope.newTask = newTask;
      $scope.addTask = function() {
        tasks.push({task: {freq: newTask.freq, 
                          duration: newTask.duration, 
                          interval: newTask.interval, 
                          level: newTask.level}, 
                    id: 1});
      };
      $scope.removeTask = function(tid) {};
    })
    .controller('playClient', function($scope) {
    })
    .filter('visualizeTask', taskFilter);

})();
