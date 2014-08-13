#!/usr/bin/env node

var config  = require('./config');
var Worker = require('./lib/worker');
var TileServer = require('./tile_server');
var QueueingProxy = require('./lib/queueing_proxy');

Worker.spawn_servers(config.windshaft_port, config.num_workers, config.worker_max_requests, function(){
  var proxy = new QueueingProxy(
    config.port,
    'http://127.0.0.1:' + config.windshaft_port,
    config.requests_per_client,
    ['tile', 'grid', 'other'],
    function (req) {
      if (req.url.match(/\d+\/\d+\/\d+\.png/)) {
        return 'tile';
      } else if (req.url.match(/\d+\/\d+\/\d+\.grid\.json/)) {
        return 'grid';
      } else {
        return 'other';
      }
    }
  );
}, TileServer.new_tile_server);
