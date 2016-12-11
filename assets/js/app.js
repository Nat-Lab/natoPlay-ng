'use stric';
(function () {

  var tasks = [], client = {}, server = {}, mode = "server";

  var taskFilter = function() {
    return function (t) {
      return "每 " + t.task.interval + " 毫秒，發生 " + t.task.freq + " 赫茲的方波 " + t.task.duration + " 毫秒，音量 " + t.task.level + " 杜比。"; 
    };
  };

  function natoPlayRpc(param) {

    var server = param.server,
        ctrl_id = param.control_id,
        reqFactory = param.reqFactory;

    var req = reqFactory(server + "/:path", {path: '@path', id: ctrl_id});

    var rpcObj = {
      get : function(path, callback) {
        req.get({path: path}, function(apiResult) {
          callback(apiResult);
      });
      },
      post : function(path, body) {
        req.save({path: path}, body);
      }
    };

    return rpcObj;
  }

  function natoPlayServer(sys_info) {
    var rpc = sys_info.rpc,
        rpc_intv = sys_info.interval,
        updater = sys_info.updater;

    var server_tasker = 0;

    var reportHandler = function(report) {
      updater(report.tasks_list);
    };

    var serverObj = {
      start: function() {
        server_tasker = window.setInterval(function() {
          rpc.get("get_report", reportHandler);
        }, rpc_intv);
      },
      stop: function () {
        window.clearInterval(server_tasker);
      },
      pushAction: function(action) {
        rpc.post("control", action);
      }
    }

    return serverObj;
  }

  function natoPlayClient(sys_info) {

    var rpc = sys_info.rpc,
        rpc_intv = sys_info.interval,
        updater = sys_info.updater;

    var client_tasker = 0;
    var client_tasks = [];

    var tonesControler = {
      destroy : function (tid) {
        window.clearInterval(tid);
      },
      create : function(freq, lvl, intv, dur) {
        console.log("create task: ", {f: freq, l: lvl, i: intv, d: dur});
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

    var actionHandler = function(jsonObj) {
      if(jsonObj.action == "add") {
        tasksController.add(jsonObj.task);
      }
      if(jsonObj.action == "remove") {
        tasksController.remove(jsonObj.id);
      }
      rpc.post("report", client_tasks);
    };

    var tasksController = {

      add : function(task_object) {
        var new_tasks = client_tasks.slice();
        tasksController.clear();
        new_tasks.forEach(function(task_element) {
          var id = tonesControler.create(
            parseInt(task_element.task.freq),
            parseInt(task_element.task.level),
            parseInt(task_element.task.interval),
            parseInt(task_element.task.duration)
          );
          client_tasks.push({id: id, task: task_element.task});
        });
        var id = tonesControler.create(
          parseInt(task_object.freq), 
          parseInt(task_object.level), 
          parseInt(task_object.interval), 
          parseInt(task_object.duration)
        );
        client_tasks.push({id: id, task: task_object});
        console.log(client_tasks);
      },

      clear : function() {
        while(client_tasks.length > 0) {
          var tsk = client_tasks.pop();
          tonesControler.destroy(tsk.id);
        }
      },

      remove : function(id) {
        var _new_tasks = [];
        tonesControler.destroy(id);
        client_tasks.forEach(function(_task) {
          if(_task.id != id) _new_tasks.push(_task);
        }); 
        client_tasks = _new_tasks;
        console.log("remove tid", id);
        consloe.log("new tasks", client_tasks);
      }

    };

    var clientCtrl = {
      start : function() {
        client_tasker = window.setInterval(function() { 
          rpc.get('get', actionHandler);
        }, rpc_intv);
      }, 
      stop : function() { 
        window.clearInterval(client_tasker);
        tasksController.clear();
      }
    };

    return clientCtrl;
  }

  angular.module('natoPlay', ['ngMaterial', 'ngResource'])
    .controller('mainController', function ($scope, $resource, $mdDialog) {

      var server_addr = "http://nat.moe:9980", ctrl_id = "", interval = 1000;

      var dialogController = function($scope, $mdDialog, $resource) {
        $scope.server_addr = server_addr;
        $scope.ctrl_id = ctrl_id;
        $scope.interval = interval;
        $scope.hide = function() { 

          $mdDialog.hide(); 

          /* Why? Need help. */
          server_addr = $scope.server_addr;
          ctrl_id = $scope.ctrl_id;
          interval = $scope.interval;

          var natoPlayParam = {
            rpc: new natoPlayRpc({
              server: server_addr,
              control_id: ctrl_id,
              reqFactory: $resource
            }),
            updater: function(new_tasks) {
              tasks = new_tasks;
            },
            interval: $scope.interval
          };

          if(typeof client.stop == 'function') {
            client.stop();
            server.stop();
          }

          client = new natoPlayClient(natoPlayParam);
          server = new natoPlayServer(natoPlayParam);
          console.log(client, server);
          if(mode == "server") server.start();
          else client.start();
  
        }; 
        $scope.cancel = function() { $mdDialog.cancel(); }; 
      };

      $scope.openMenu = function($mdOpenMenu, ev) { $mdOpenMenu(ev); };

      $scope.showAbout = function(evnt) {
        $mdDialog.show({
          controller: dialogController,
          templateUrl: "assets/tmpl/about.tmpl.html",
          parent: angular.element(document.body),
          targetEvent: evnt,
          clickOutsideToClose: true,
          fullscreen: false
        })
      };

      var showSettings = function(evnt) {
        $mdDialog.show({
          controller: dialogController,
          templateUrl: "assets/tmpl/settings.tmpl.html",
          parent: angular.element(document.body),
          targetEvent: evnt,
          clickOutsideToClose: false,
          fullscreen: false
        });
      };
      $scope.showSettings = showSettings;
      showSettings();

      $scope.doReset = function() {
        console.log("clear tasks cache.");
        if (mode == "client") {
          console.log("mode is client, restarting.");
          client.stop();
          client.start();
        }
        tasks = [];
      };

      var setMode = function(newMode) { 
        if (mode == "client") {
          if(typeof client.stop == 'function') {
            console.log('kill client, start server.');
            client.stop();
            server.start();
          }
        } else {
          if(typeof client.stop == 'function') {
            console.log('kill server, start client.');
            server.stop();
            client.start();
          }
        }
        console.log('set mode to: ', newMode); 
        mode = newMode;
      }; //TODO

      $scope.setmode = setMode;

    })
    .controller('playServer', function($scope) {
      var newTask = {};
      window.setInterval(function () {
        var old_tasks = $scope.tasks;
        if((function() {
          if (old_tasks.length != tasks.length) return true;
          for (var i = 0; i < tasks.length; i++) {
            if (tasks[i].id != old_tasks[i].id) return true;
          }
          return false;
        })()) {
          $scope.$apply(function() {
            $scope.tasks = tasks;
          });
        }
      }, 1000);
      $scope.tasks = tasks;
      $scope.newTask = newTask;
      $scope.addTask = function() {
        server.pushAction({
          action: "add", 
          task: {
            freq: parseInt(newTask.freq),
            duration: parseInt(newTask.duration),
            interval: parseInt(newTask.interval),
            level: parseInt(newTask.level)
          }
        });
      };
      $scope.removeTask = function(tid) {
        server.pushAction({
          action: "remove",
          id: parseInt(tid)
        });
      };
    })
    .controller('playClient', function($scope) {
    })
    .filter('visualizeTask', taskFilter);

})();
