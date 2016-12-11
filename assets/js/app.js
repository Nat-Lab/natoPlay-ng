(function () {

  var tasks = [], client = {}, server = {}, rpc = {};

  var taskFilter = function() {
    return function (t) {
      return "每 " + t.task.interval + " 毫秒，發生 " + t.task.freq + " 赫茲的方波 " + t.task.duration + " 毫秒，音量 " + t.task.level + " 杜比。"; 
    };
  };

  function natoPlayRpc(param) {
    var server = param.server,
        ctrl_id = param.ctrl_id;
  }

  function natoPlayServer(sys_info) {
    var rpc = sys_info.rpc,
        rpc_intv = sys_info.interval,
        updater = sys_info.updater;
  }

  function natoPlayClient(sys_info) {

    var rpc = sys_info.rpc,
        rpc_intv = sys_info.interval,
        updater = sys_info.updater;

    var client_tasker = 0;

    var tonesControler = {
      destroy : function (tid) {
        window.clearInterval(tid);
      },
      create : function(freq, lvl, intv, dur) {
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
      }
    };

    var tasksController = {
    } 

    var clientCtrl = {
      start : function() {
        client_tasker = window.setInterval(function() { 
          rpc.get('get', actionHandler);
        }, rpc_intv);
      }, 
      stop : function() { 
        window.clearInterval(client_tasker);
        //TODO: clear tasks
      }
    };

    return clientCtrl;
  }

  angular.module('natoPlay', ['ngMaterial'])
    .controller('mainController', function ($scope) {

      var server_addr = "", ctrl_id = "", interval = 1000;
      $scope.server_addr = server_addr;
      $scope.ctrl_id = ctrl_id;
      $scope.interval = interval;
      $scope.setmode = function(mode) { console.log('set mode to:', mode); } //TODO

      var natoPlayParam = {
        rpc: new natoPlayRpc({
          server: server_addr,
          control_id: ctrl_id
        }),
        updater: function(new_tasks) {
          $scope.$apply(function() { tasks = new_tasks; });
        },
        interval: interval
      };

      client = new natoPlayClient(natoPlayParam);
      server = new natoPlayServer(natoPlayParam);

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
      $scope.removeTask = function(tid) {
        var index = (function() {
          for(var i = 0; i < tasks.length; i++) {
            if (tasks[i].id == tid) return i;
          }
          return -1;
        })();
        if (index > -1) { tasks.splice(index, 1); }
      };
    })
    .controller('playClient', function($scope) {
    })
    .filter('visualizeTask', taskFilter);

})();
