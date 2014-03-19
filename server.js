#!/usr/bin/env node

// Note, currently to run this server your table must have a column called the_geom_webmercator with SRID of 3857
// to view the tiles, open ./viewer/index.html and set the fields
//
// If you want to get something running quickly, follow the instructions for a seed DB in test/windshaft.test.sql

var Windshaft = require('windshaft');
var _         = require('underscore');

var config = {
    base_url: '/database/:dbname/table/:table',
    base_url_notable: '/database/:dbname',
    grainstore: {
                 datasource: {
                   user: 'datastore_default',
                   password: 'asdf',
                   host: '127.0.0.1',
                   port: 5432,
                 },
                 mapnik_version: '2.2.0',
                 default_style_version: '2.2.0'
    }, //see grainstore npm for other options
    redis: {host: '127.0.0.1', port: 6379},
    enable_cors: true,
    req2params: function(req, callback){

        // no default interactivity. to enable specify the database column you'd like to interact with
        req.params.interactivity = "_id,scientific_name,species,count";

        // this is in case you want to test sql parameters eg ...png?sql=select * from my_table limit 10
        req.params =  _.extend({}, req.params);
        _.extend(req.params, req.query);
        // If there is no SQL set, create it here as otherwise the table name doesn't get escaped
        if (typeof req.params.sql === 'undefined' && typeof req.params.table !== 'undefined'){
          var tbes = '"' + req.params.table.replace('"', '""').replace("\x00", '') + '"'
          req.params.sql = '(SELECT the_geom_webmercator FROM ' + tbes + ') as cdbq';
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
        }
        // send the finished req object on
        callback(null,req);
    }
};

// Initialize tile server on port 4000
var ws = new Windshaft.Server(config);
ws.listen(4000);

console.log("map tiles are now being served out of: http://localhost:4000" + config.base_url + '/:z/:x/:y');
