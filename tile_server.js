var config = require('./config');
var TileQuery = require('./lib/tilequery');
var Windshaft = require('windshaft');

function new_tile_server(){
  return new Windshaft.Server({
    base_url: '/database/:dbname/table/:table',
    base_url_notable: '/database/:dbname',
    grainstore: {
       datasource: {
         user: config.postgres_user,
         password: config.postgres_pass,
         host: config.postgres_host,
         port: config.postgres_port,
         geometry_field: config.geometry_field
       },
       mapnik_version: 'latest',
       default_style_version: 'latest'
    }, //see grainstore npm for other options
    redis: {host: '127.0.0.1', port: 6379},
    enable_cors: true,
    req2params: function(req, callback){
      var tq = new TileQuery(
        req.params.table,
        req.params.z,
        req.params.x,
        req.params.y,
        req.query,
        config
      );
      if (req.params.format == 'png') {
        tq.tile_query(function (err, data) {
          if (err) {
            callback(err);
          } else {
            req.params.style = data.mss;
            req.params.sql = "(" + data.sql + ") AS _windshaft_server_sub";
            callback(null, req);
          }
        });
      } else if (req.params.format == 'grid.json'){
        tq.grid_query(function (err, data){
          if (err){
            callback(err);
          } else {
            req.params.sql = "(" + data.sql + ") AS _windshaft_server_sub";
            req.params.interactivity = data.interactivity.join(",");
          }
          callback(null, req);
        });
      } else {
        callback(new Error("Unknown tile format"));
      }
    }
  });
}

module.exports = {
  new_tile_server: new_tile_server
};