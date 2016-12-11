var tasks = [];
var offset = 0;
var polling_intv = 1000;
var server, ctrl_id;

var natoPlayServer = (function () {

  var rpc = {

    send : function (task) {
      var http = new XMLHttpRequest(),
          url = server + "/control?id=" + ctrl_id;
      http.open("POST", url);
      http.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
      http.send(JSON.stringify(task));
    },

    get : function (callback) {
      var http = new XMLHttpRequest(),
          url = server + "/get_report?id=" + ctrl_id;
      http.open("GET", url);
      http.send();
      http.onreadystatechange = function() {
        if(http.readyState == 4 && http.status == 200) {
          var respondJson = JSON.parse(http.responseText);
          callback(respondJson.tasks_list, respondJson.last_active, respondJson.pending_tasks);
        }
      };
    }

  },

  task = {
    add : function(freq, level, intv, dur) {
      rpc.send({
        action: "add",
        task: {
          freq: freq,
          level: level,
          interval: intv,
          duration: dur
        }
      });
    },

    remove : function(id) {
      rpc.send({
        action: "remove",
        id: id
      });
    }
  },

  preview = {

    play : function(tasks_lst) {
      preview.stop();
      tasks_lst.forEach(function(task_element) {
        tasks.push(toneControl.create(
          task_element.task.freq,
          task_element.task.level,
          task_element.task.interval,
          task_element.task.duration
        ));
      });
    },

    stop : function() {
      while(tasks.length > 0) {
        toneControl.destroy(tasks.pop());
      }
    }

  };

  start = function (url, id) {
    server = url;
    ctrl_id = id;
    window.setInterval(function() {
      rpc.get(UI.update);
    }, polling_intv);
  };

  return {
    task: task,
    rpc: rpc,
    preview: preview,
    start: start
  };

})();
