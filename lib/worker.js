var cluster = require('cluster');

var worker_stop_timeout = 2000;
var timeout_safe_delay = 1000;

/**
 * Setup the server and spawn a number of workers.
 *
 * Note that this will call 'fork', which will re-run the application. Any code that should only be run
 * once must be in the 'setup' function. Any code that should be run for each worker (but not for the master)
 * should be in the new_server function. Ideally there should be only the call to spawn_workers in your
 * main application.
 *
 * @param port: Port for workers to listen on
 * @param num_workers: Number of workers to spwan
 * @param worker_max_requests: Maximum numer of requests before restarting workers.
 * @param setup: Function to be called during the initial setup
 * @param new_server: Function that will return a configured HTTP server
 */
function spawn_servers(port, num_workers, worker_max_requests, setup, new_server){
  if (cluster.isMaster){
    if (typeof setup === 'function'){
      setup();
    }
    setup_master(num_workers);
  } else {
    setup_worker(port, worker_max_requests, new_server);
  }
}

/**
 * Setup the master process
 * @param num_workers: Number of workers to spawn
 */
function setup_master(num_workers){
  var shutting_down = false;
  var shutdown_count = 0;
  var shutdown_timeout;
  console.log('Setting up workers...');
  /* Spawn the initial workers */
  for (var i = 0; i < num_workers; i++){
    cluster.fork();
  }
  /* Re-spawn workers when they terminate (unless we are shutting down) */
  cluster.on('exit', function(worker, code, signal) {
    if (!shutting_down){
      console.log('worker ' + worker.process.pid +  ' terminated. Spawning new worker.');
      cluster.fork();
    } else {
      console.log('worker ' + worker.process.pid + ' exited as part of shutdown.');
    }
  });
  /* Terminate all workers cleanly on SIGINT */
  process.on('SIGINT', function(){
    console.log('got SIGINT, shutting down workers...');
    shutting_down = true;
    shutdown_count = 0;
    for (var i in cluster.workers){
      cluster.workers[i].send({cmd: 'stop'});
    }
    shutdown_timeout = setTimeout(function(){
      console.log('Goodbye.');
      process.exit();
    }, worker_stop_timeout + timeout_safe_delay);
  });
  /* Respawn workers on SIGHUP */
  var respawn = function(worker){
    return function(){
        worker.send({cmd: 'stop'});
    }
  };
  process.on('SIGHUP', function(){
    console.log('Got SIGHUP, respawing workers with a delay of ' + (worker_stop_timeout + timeout_safe_delay) + ' between each');
    var tm = 0;
    for (var i in cluster.workers){
      setTimeout(respawn(cluster.workers[i]), tm);
      tm = tm + worker_stop_timeout + timeout_safe_delay;
    }
  });
}

/**
 * Setup the worker process
 * @param port: Port to listen on
 * @param worker_max_requests: Maximum number of requests before restarting
 * @param new_server: Function that should return a new configured HTTP server
 */
function setup_worker(port, worker_max_requests, new_server){
  var ws = new_server();
  /* Shutdown function */
  var shutdown = function(tm){
    var timeout;
    ws.close(function(){
      clearTimeout(timeout);
      process.exit();
    });
    setTimeout(function(){
      process.exit();
    }, tm);
  };
  /* Listen to stop message from parent */
  process.on('message', function(msg){
    if (msg.cmd && msg.cmd == 'stop'){
      shutdown(worker_stop_timeout);
    }
  });
  /* Limit the number of requests served by this worker */
  var connections = worker_max_requests;
  if (connections > 0){
    ws.on('request', function(request, response){
       response.on('finish', function(){
         if (--connections == 0){
           console.log("Worker " + cluster.worker.process.pid + " has served " + worker_max_requests + " requests, closing down.");
           shutdown(worker_stop_timeout);
         }
       });
    });
  }

  /* Start listening */
  ws.listen(port);
  console.log("Worker " + cluster.worker.process.pid + " started.");
}

module.exports = {
  spawn_servers: spawn_servers
};
