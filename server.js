#!/usr/bin/env node

// Note, currently to run this server your table must have a column called the_geom_webmercator with SRID of 3857
// to view the tiles, open ./viewer/index.html and set the fields
//
// If you want to get something running quickly, follow the instructions for a seed DB in test/windshaft.test.sql

var Windshaft = require('windshaft');
var _         = require('underscore');
var cluster   = require('cluster');
var appconfig = require('./config');

var config = {
    base_url: '/database/:dbname/table/:table',
    base_url_notable: '/database/:dbname',
    grainstore: {
                 datasource: {
                   user: appconfig.postgres_user,
                   password: appconfig.postgres_pass,
                   host: appconfig.postgres_host,
                   port: appconfig.postgres_port,
                   geometry_field: appconfig.geometry_field
                 },
                 mapnik_version: 'latest',
                 default_style_version: 'latest'
    }, //see grainstore npm for other options
    redis: {host: '127.0.0.1', port: 6379},
    enable_cors: true,
    req2params: function(req, callback){
        req.params =  _.extend({}, req.params);
        _.extend(req.params, req.query);
        // If there is no SQL set, create it here as otherwise the table name doesn't get escaped
        if (typeof req.params.sql === 'undefined' && typeof req.params.table !== 'undefined'){
          var tbes = '"' + req.params.table.replace('"', '""').replace("\x00", '') + '"'
          req.params.sql = '(SELECT "' + appconfig.geometry_field + '" FROM ' + tbes + ') as cdbq';
        }
        if (typeof req.params.style === 'undefined' && typeof req.params.table !== 'undefined'){
          req.params.style = "#" + req.params.table + " {"+
            "marker-fill: #ee0000;" +
            "marker-opacity: 1;" +
            "marker-width: 8;" +
            "marker-line-color: white;" +
            "marker-line-width: 1;" +
            "marker-line-opacity: 0.9;" +
            "marker-placement: point;" +
            "marker-type: ellipse;" +
            "marker-allow-overlap: true;"+
          "}";
        } else {
          // Replace placeholders in the style
          req.params.style = req.params.style.replace('!markers!', __dirname + '/resources/markers');
        }
        // send the finished req object on
        callback(null,req);
    }
};

/**
 * Setup management of workers
 */
var worker_stop_timeout = 2000;
var timeout_safe_delay = 1000;
if (cluster.isMaster){
  var shutting_down = false;
  var shutdown_count = 0;
  var shutdown_timeout;
  console.log('Map tile server; setting up workers...');
  /* Spawn the intial workers */
  for (var i = 0; i < appconfig.num_workers; i++){
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
  }
  process.on('SIGHUP', function(){
    console.log('Got SIGHUP, respawing workers with a delay of ' + (worker_stop_timeout + timeout_safe_delay) + ' between each');
    var tm = 0;
    for (var i in cluster.workers){
      setTimeout(respawn(cluster.workers[i]), tm);
      tm = tm + worker_stop_timeout + timeout_safe_delay;
    }
  });
} else {
  /* Create the tile server */
  var ws = new Windshaft.Server(config);
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
  var connections = appconfig.worker_max_requests;
  if (connections > 0){
    ws.on('request', function(request, response){
       response.on('finish', function(){
         if (--connections == 0){
           console.log("Worker " + cluster.worker.process.pid + " has served " + appconfig.worker_max_requests + " requests, closing down.");
           shutdown(worker_stop_timeout);
         }
       });
    });
  }
  /* Start listening */
  ws.listen(appconfig.windshaft_port);
  console.log("Worker " + cluster.worker.process.pid + " now serving tiles on : http://localhost:" + appconfig.windshaft_port + config.base_url + '/:z/:x/:y');
}

