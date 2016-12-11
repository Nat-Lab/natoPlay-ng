var UI = (function () {

update = function (jsonObj, last_active, pending) {
    var list = document.getElementById('tasklist'),
        plist = document.getElementById('tasklist_pending'),
        la = document.getElementById('last_active');
    list.innerHTML = "";
    plist.innerHTML = "";
    jsonObj.forEach(function(task_element) {
      var id  = task_element.id,
          tsk = task_element.task,
          p = document.createElement('p'),
          rmbtn = " <button onclick='natoPlay.task.remove(" + id + ")'>X</button>";
      p.innerHTML = "task " + id + ", f: " + tsk.freq + ", l: " + tsk.level + ", i: " + tsk.interval + ", d: " + tsk.duration + rmbtn + "<br>";
      list.appendChild(p);
      la.innerHTML = parseInt(last_active) == 0 ? "Never" : ((Date.now() / 1000 | 0) - last_active) + " second(s) ago.";
    });
    pending.forEach(function(task) {
      var p = document.createElement('p');
      if(task.action == "add") {
        var tsk = task.task;
        p.innerHTML = "addtask: f: " + tsk.freq + ", l: " + tsk.level + ", i: " + tsk.interval + ", d: " + tsk.duration + "<br>";
      }
      if(task.action == "remove") {
        p.innerHTML = "remove id " + task.id;
      }
      plist.appendChild(p);
    });
  };


  return {
    update: update
  };

})();
