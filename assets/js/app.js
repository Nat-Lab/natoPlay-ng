'use strict';
(function () {

  /* TODO: use natoDataProvider service instead of global var. */
  var tasks = [], pending = [], lastActive = 0, client = {}, server = {}, mode = "server", isPending = false;

  /* display Filters */
  var taskFilter = function() {
    return function (t) {
      return t.task.freq + "Hz@" + t.task.level + "db for " + t.task.duration + " ms, wait " + t.task.interval + " ms";
    };
  };

  var actionFilter = function() {
    return function (a) {
      return a.action == "add" ? "添加任務：" + taskFilter()(a) + "。"
                               : "移除任務 #" + a.id;
    };
  };

  /* tones controller */
  var tonesController = {
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

  /* Factories */

  /* RPC factory: build RPC object for a given server & control. */
  var natoPlayRpc = function (param) {

    var server = param.server,
        ctrl_id = param.control_id,
        reqFactory = param.reqFactory,
        errorHandler = param.onerr;

    var req = reqFactory(server + "/:path", {path: '@path', id: ctrl_id});

    var rpcObj = {
      get : function(path, callback) {
        req.get({path: path}, function(apiResult) {
          callback(apiResult);
      }).$promise.catch(errorHandler);
      },
      post : function(path, body) {
        req.save({path: path}, body).$promise.catch(errorHandler);
      }
    };

    return rpcObj;
  }

  /* tasksController factory */
  var tasksController = function (task_list) {

    this.init = function(report) {
      var last_tasks = report.tasks_list;
      last_tasks.forEach(function(task_element) {
        var id = tonesController.create(
          parseInt(task_element.task.freq),
          parseInt(task_element.task.level),
          parseInt(task_element.task.interval),
          parseInt(task_element.task.duration)
        );
        console.log("add task from last report", task_element.task);
        task_list.push({id: id, task: task_element.task});
      });
    };

    this.add = function(task_object) {
      var new_tasks = task_list.slice();
      tasksController.clear();
      new_tasks.forEach(function(task_element) {
        var id = tonesController.create(
          parseInt(task_element.task.freq),
          parseInt(task_element.task.level),
          parseInt(task_element.task.interval),
          parseInt(task_element.task.duration)
        );
        task_list.push({id: id, task: task_element.task});
      });
      var id = tonesController.create(
        parseInt(task_object.freq),
        parseInt(task_object.level),
        parseInt(task_object.interval),
        parseInt(task_object.duration)
      );
      task_list.push({id: id, task: task_object});
    },

    this.clear = function() {
      while(task_list.length > 0) {
        var tsk = task_list.pop();
        tonesController.destroy(tsk.id);
      }
    };

    this.remove = function(id) {
      var _new_tasks = [];
      tonesController.destroy(id);
      task_list.forEach(function(_task) {
        if(_task.id != id) _new_tasks.push(_task);
      });
      task_list = _new_tasks;
      console.log("remove tid", id);
      consloe.log("new tasks", task_list);
    };

    return this;

  };

  /* Server factory: build server object by given RPC object */
  var natoPlayServer = function(sys_info) {
    var rpc = sys_info.rpc,
        rpc_intv = sys_info.interval,
        updater = sys_info.updater;

    var server_tasker = 0,
        server_tasks = [],
        preview_enabled = false;

    var serverTaskController = new tasksController(server_tasks);

    var reportHandler = function(report) {
      updater(report);
    };

    var serverObj = {
      start: function() {
        server_tasker = window.setInterval(function() {
          rpc.get("get_report", reportHandler);
        }, rpc_intv);
      },
      stop: function () {
        serverTaskController.clear();
        window.clearInterval(server_tasker);
      },
      pushAction: function(action) {
        rpc.post("control", action);
      },
      preview : {
        isEnabled: function() { return preview_enabled; },
        start: function() {
          preview_enabled = true;
          serverTaskController.clear();
          serverTaskController.init({tasks_list: tasks});
        },
        stop: function() {
          preview_enabled = false;
          serverTaskController.clear();
        }
      }
    }

    return serverObj;
  }

  /* Client factory: build client object by given RPC object */
  var natoPlayClient = function(sys_info) {

    var rpc = sys_info.rpc,
        rpc_intv = sys_info.interval,
        updater = sys_info.updater;

    var client_tasker = 0;
    var client_tasks = [];

    var clientTaskController = new tasksController(client_tasks);

    var actionHandler = function(jsonObj) {
      if(jsonObj.action == "add") {
        clientTaskController.add(jsonObj.task);
      }
      if(jsonObj.action == "remove") {
        clientTaskController.remove(jsonObj.id);
      }
      rpc.post("report", client_tasks);
    };

    var clientCtrl = {
      start : function() {
        rpc.get('get_report', clientTaskController.init);
        client_tasker = window.setInterval(function() {
          rpc.get('get', actionHandler);
        }, rpc_intv);
      },
      stop : function() {
        window.clearInterval(client_tasker);
        clientTaskController.clear();
      }
    };

    return clientCtrl;
  }

  /* natoPlayService provider: provide natoPlaySever & natoPlayClient factory.*/
  var natoPlayService = function() {
    return {
      getServer: function (obj) {
        return new natoPlayServer(obj);
      },
      getClient: function (obj) {
        return new natoPlayClient(obj);
      }
    };
  }

  var toastService = function($mdToast) {
    return function(msg) {
      $mdToast.show($mdToast.simple()
        .textContent(msg)
        .position("bottom right")
        .hideDelay(2000)
      );
    };
  };

  angular.module('natoPlay', ['ngMaterial', 'ngResource'])
    /* Main App: Menu bar (settings, about, client_info) */
    .controller('mainController', function ($scope, $resource, $mdDialog, natoPlayProvider, toast) {

      var server_addr = localStorage["server_addr"] ? localStorage["server_addr"] : "http://nat.moe:9980",
          ctrl_id = localStorage["ctrl_id"] ? localStorage["ctrl_id"] : "",
          interval = localStorage["apiInterval"] ? localStorage["apiInterval"] : 1000;

      var clientInfoDialogController = function($scope, $mdDialog) {
        $scope.pending = pending;
        $scope.lastActive = parseInt(lastActive) == 0 ? "從來沒有。" : ((Date.now() / 1000 | 0) - lastActive) + " 秒之前。";
        $scope.hide = function() { $mdDialog.hide(); };
      };

      var dialogController = function($scope, $mdDialog, $resource, toast) {

        $scope.server_addr = server_addr;
        $scope.ctrl_id = ctrl_id;
        $scope.interval = interval;
        $scope.hide = function() {

          $mdDialog.hide();

          /* Why? Need help. */
          server_addr = $scope.server_addr;
          ctrl_id = $scope.ctrl_id;
          interval = $scope.interval;

          localStorage["server_addr"] = server_addr;
          localStorage["ctrl_id"] = ctrl_id;
          localStorage["apiInterval"] = interval;

          var natoPlayParam = {
            rpc: new natoPlayRpc({
              server: server_addr,
              control_id: ctrl_id,
              reqFactory: $resource,
              onerr: function(err) {
                toast("API 調用出錯。");
              }
            }),
            updater: function(new_tasks) {
              tasks = new_tasks.tasks_list;
              pending = new_tasks.pending_tasks;
              lastActive = new_tasks.last_active;
              isPending = pending.length > 0;
            },
            interval: interval
          };

          if(typeof client.stop == 'function') {
            client.stop();
            server.stop();
          }

          client = natoPlayProvider.getClient(natoPlayParam);
          server = natoPlayProvider.getServer(natoPlayParam);
          if(mode == "server") server.start();
          else client.start();

        };
        $scope.cancel = function() { $mdDialog.cancel(); };
      };

      var addTaskController = function($scope, $mdDialog, toast) {
        $scope.cancel = function() { $mdDialog.cancel(); };
        var disableAdd = (Date.now() / 1000 | 0) - lastActive > 60;
        $scope.disableAdd = disableAdd;
        $scope.addTask = function() {
          $mdDialog.cancel();
          if ((Date.now() / 1000 | 0) - lastActive < 10) toast('已請求任務，等待被控端接受。');
          else toast('已請求任務，但被控端可能不在線上。');
          isPending = true;
          server.pushAction({
            action: "add",
            task: {
              freq: parseInt($scope.freq),
              duration: parseInt($scope.duration),
              interval: parseInt($scope.interval),
              level: parseInt($scope.level)
            }
          });
        };
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


      $scope.showClientInfo = function(evnt) {
        $mdDialog.show({
          controller: clientInfoDialogController,
          templateUrl: "assets/tmpl/client_info.tmpl.html",
          parent: angular.element(document.body),
          targetEvent: evnt,
          clickOutsideToClose: true,
          fullscreen: false
        })
      };

      $scope.showAddTask = function(evnt) {
        $mdDialog.show({
          controller: addTaskController,
          templateUrl: "assets/tmpl/addtask.tmpl.html",
          parent: angular.element(document.body),
          targetEvent: evnt,
          clickOutsideToClose: true,
          fullscreen: false
        });
      };

      var showSettings = function(evnt) {
        $mdDialog.show({
          controller: dialogController,
          templateUrl: "assets/tmpl/settings.tmpl.html",
          parent: angular.element(document.body),
          targetEvent: evnt,
          clickOutsideToClose: client.start && server.start && localStorage["apiInterval"] && localStorage["ctrl_id"] && localStorage["server_addr"],
          fullscreen: false
        });
      };
      $scope.showSettings = showSettings;
      showSettings();

      $scope.doReset = function() {
        toast('重置任務緩存。');
        console.log("clear tasks cache.");
        if (mode == "client") {
          console.log("mode is client, restarting.");
          client.stop();
          client.start();
        }
        tasks = [];
        isPending = false;
      };

      $scope.startPreview = function () { server.preview.start(); };
      $scope.stopPreview = function () { server.preview.stop(); };

      var setMode = function(newMode) {
        if (newMode == "server") {
          toast('模式已更改為控制端。');
          if(typeof client.stop == 'function') {
            console.log('kill client, start server.');
            client.stop();
            server.start();
          }
          $scope.isClientMode = false;
        } else {
          toast('模式已更改為被控端。');
          if(typeof client.stop == 'function') {
            console.log('kill server, start client.');
            server.stop();
            client.start();
          }
          $scope.isClientMode = true;
        }
        console.log('set mode to: ', newMode);
        mode = newMode;
      }; //TODO

      $scope.setmode = setMode;

    })
    /* Server App */
    .controller('playServer', function($scope, toast) {
      var newTask = {}, lostClient = true;
      window.setInterval(function () {
        if((Date.now() / 1000 | 0) - lastActive < 10) {
          if(lostClient) toast('被控端已連接。');
          lostClient = false;
        }
        else if(!lostClient) {
          toast('失去與被控端的連接。');
          lostClient = true;
        }
        var old_tasks = $scope.tasks,
            old_pending = $scope.isPending;
        if(old_pending != isPending) {
          if(!isPending && server.start) toast('被控端已處理請求。');
        };
        if((function() {
          if (old_tasks.length != tasks.length || old_pending != isPending) return true;
          for (var i = 0; i < tasks.length; i++) {
            if (tasks[i].id != old_tasks[i].id) return true;
          }
          return false;
        })()) {
          if(server.start && server.preview.isEnabled()) server.preview.start();
          $scope.$apply(function() {
            $scope.tasks = tasks;
            $scope.isPending = isPending;
          });
        }
      }, 1000);
      $scope.tasks = tasks;
      $scope.isPending = true;
      $scope.newTask = newTask;
      $scope.addTask = function() {
        toast('已請求任務，等待被控端接受。');
        $scope.isPending = isPending = true;
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
        toast('已請求移除任務，等待被控端接受。');
        $scope.isPending = isPending = true;
        server.pushAction({
          action: "remove",
          id: parseInt(tid)
        });
      };
    })
    /* Client App, nothing, yet. */
    .controller('playClient', function($scope) {
    })
    .filter('visualizeTask', taskFilter)
    .filter('visualizeAction', actionFilter)
    .service('natoPlayProvider', natoPlayService)
    .service('toast', toastService);

})();
