var Select = require('./sqlgenerator.js');
var tileconv = require('./tileconv.js');
var mu = require('mu2');

/**
 * Class used to construct the SQL for querying tiles
 *
 * @constructor
 * @param resource_id: Resource id
 * @param z: Z coordinate of the tile
 * @param x: X coordinate of the tile
 * @param y: Y coordinate of the tile
 * @param query: Request query parameters
 * @param config: The application configuration. Required items are :
 *                resources_path, geometry_field, geometry_4326_field, id_field
 */
function TileQuery(resource_id, z, x, y, query, config){
  this._resource_id = resource_id;
  this._x = parseFloat(x);
  this._y = parseFloat(y);
  this._z = parseFloat(z);
  this._params = {};
  for (var field in query){
    this._params[field] = decodeURIComponent(query[field]);
  }
  this._config = config;
  this._query_options = this._config['query_options'] || {};
  this._style = {
    'plot': {
      'resource_id': resource_id,
      'fill_color': this._params.fill_color || '#EE0000',
      'line_color': this._params.line_color || '#FFFFFF',
      'marker_size': 8,
      // Ideally half the marker size
      'grid_resolution': 4
    },
    'gridded': {
      'resource_id': resource_id,
      'base_color': this._params.base_color || '#F02323',
      'marker_size': 8,
      // Should really be the same as marker size!
      'grid_resolution': 8
    },
    'heatmap': {
      'resource_id': resource_id,
      'intensity': this._params.intensity || 0.1,
      'gradient': '#0000FF, #00FFFF, #00FF00, #FFFF00, #FFA500, #FF0000',
      'marker_url': this._config.resources_path + '/markers/alpharadiantdeg20px.png',
      'marker_size': 20
    }
  };
}

/**
 * Create the base query shared  by both tiles and grids
 * @private
 * @param marker_size: Size of the market (in pixels);
 * @param grid_size: Resolution of the grid (in pixels)
 * @return: Select - a Select statement pre-populated with filters and bounding box.
 */
TileQuery.prototype._base_query = function(marker_size, grid_size){
  if (typeof grid_size === 'undefined') {
    grid_size = 4;
  }

  var query = new Select({'compact': true}, {
    resource: this._resource_id,
    geom_field: [this._resource_id, this._config.geometry_field],
    geom_field_label: this._config.geometry_field,
    geom_field_4326: [this._resource_id, this._config.geometry_4326_field],
    geom_field_4326_label: this._config.geometry_4326_field,
    unique_id_field: [this._resource_id, this._config.id_field],
    unique_id_field_label: this._config.id_field
  }, {
    grid_size: grid_size,
    marker_size: marker_size
  });
  query.from('{resource}');

  // Apply filers
  if (this._params.filters){
    var filter_items = this._params.filters.split('|');
    for (var f in filter_items){
      var n_v = filter_items[f].split(':');
      if (n_v.length != 2){
        continue;
      }
      var name = n_v[0];
      var value = n_v[1];
      if (typeof(this._query_options[name]) !== 'undefined'){
        query.where(this._query_options[name], null, {
          'option_value': value
        });
      } else {
        query.where("{field} = {value}", {
          field: [this._resource_id, name]
        }, {
          value: value
        });
      }
    }
  }

  // Full text query
  if (this._params.q){
    query.where('_full_text @@ plainto_tsquery({search})', null, {
      language: 'english',
      search: this._params.q
    });
  }

  // Fine bounding box based on tile X,Y,Z
  var bbox = tileconv.tile_to_latlng_bbox(this._x, this._y, this._z);
  query.where([
    "ST_Intersects({geom_field}, ST_Expand(",
      "ST_Transform(",
        "ST_SetSrid(",
          "ST_MakeBox2D(",
            "ST_Makepoint({lng0}, {lat0}),",
            "ST_Makepoint({lng1}, {lat1})",
          "),",
        "4326),",
      "3857), !pixel_width! * {marker_radius}))"
  ].join(''), null, {
    lng0: bbox.min.lng,
    lat0: bbox.min.lat,
    lng1: bbox.max.lng,
    lat1: bbox.max.lat,
    'marker_radius': marker_size/2.0
  });

  return query;
};

/**
 * Return the SQL and MSS for the given tile
 *
 * @param callback: Function to callback on completion. The callback is passed two parameters: err and a
 *        dictionary defining 'sql' (the SQL string) and 'mss' (the style string).
 */
TileQuery.prototype.tile_query = function(callback){
  var style = this._params.style;
  if (['plot', 'gridded', 'heatmap'].indexOf(style) < 0){
    style = 'plot';
  }

  var query = this._base_query(this._style[style]['marker_size']);

  /* If we're drawing dots, then we can ignore the ones with identical positions by
   selecting DISTINCT ON (_the_geom_webmercator), but we need keep them for heatmaps
   to get the right effect.
   This provides a performance improvement for datasets with many points that share identical
   positions. Note that there's an overhead to doing so for small datasets, and also that
   it only has an effect for records with *identical* geometries.
   */
  var sql = '';
  if (style == 'heatmap') {
    query.select('{geom_field}');
    // no need to shuffle (see below), so use the subquery directly
    sql = query.to_sql()
  } else if (style == 'gridded'){
    query.select("ST_SnapToGrid({geom_field}, !pixel_width! * {marker_size}, !pixel_height! * {marker_size}) AS {geom_field_label}");
    query.select("COUNT({geom_field}) AS count");
    // The group by needs to match the column chosen above, including by the size of the grid
    query.group_by('ST_SnapToGrid({geom_field}, !pixel_width! * {marker_size}, !pixel_height! * {marker_size})');
    query.order_by('count DESC');

    var outer_q = new Select({'compact': true}, {
      geom_field_label: this._config.geometry_field
    });
    outer_q.from('({query}) AS _tiledmap_sub', null, {query: query});
    outer_q.select('count');
    outer_q.select('{geom_field_label}');
    outer_q.order_by('random()');
    sql = outer_q.to_sql()
  }  else {
    query.select('{geom_field}');
    query.distinct_on('{geom_field}');
    // The SELECT ... DISTINCT ON query silently orders the results by lat and lon which leads to a nasty
    // overlapping effect when rendered. To avoid this, we shuffle the points in an outer
    // query.
    var outer_q = new Select({'compact': true}, {
        'geom_field_label': this._config.geometry_field
    });
    outer_q.from('({query}) AS _tiledmap_sub', null, {query: query});
    outer_q.select('{geom_field_label}');
    outer_q.order_by('random()');
    sql = outer_q.to_sql()
  }

  mu.root = this._config.resources_path + '/mss';
  var mss = '';
  mu.compileAndRender(style + '.mss', this._style[style]).on('data', function(data) {
    mss = mss + data;
  }).on('end', function(){
    callback(null, {sql: sql, mss:mss});
  });
};

/**
 * Return the SQL for the given grid
 *
 * @param callback: Function to callback on completion. The callback is passed two parameters: err and a
 *        dictionary defining 'sql' (the SQL string) and 'mss' (the style string).
 */
TileQuery.prototype.grid_query = function(callback){
  var style = this._params.style;

  if (['plot', 'gridded', 'heatmap'].indexOf(style) < 0){
    style = 'plot';
  }

  var query = this._base_query(this._style[style]['marker_size'], this._style[style]['grid_resolution']);

  // To calculate the number of overlapping points, we first snap them to a grid roughly four pixels wide, and then
  // group them by that grid. This allows us to count the records, but we need to aggregate the unique id field
  // in order to later return the "top" record from the stack of overlapping records
  query.select('array_agg({unique_id_field}) AS {unique_id_field_label}');
  query.select('COUNT({geom_field}) AS _tiledmap_count');
  query.select('ST_SnapToGrid({geom_field}, !pixel_width! * {grid_size}, !pixel_height! * {grid_size}) AS _tiledmap_center');

  // The group by needs to match the column chosen above, including by the size of the grid
  query.group_by('ST_SnapToGrid({geom_field}, !pixel_width! * {grid_size}, !pixel_height! * {grid_size})');

  // In the outer query we can use the overlapping records count and the location, but we also need to pop the
  // first record off of the array. If we were to return e.g. all the overlapping names, the json grids would
  // unbounded in size.
  var outer_query = new Select({'compact': true}, {
    'resource': this._resource_id,
    'geom_field_label': this._config.geometry_field,
    'geom_field_4326': [this._resource_id, this._config.geometry_4326_field],
    'unique_id_field': [this._resource_id,  this._config.id_field],
    'subquery': '_tiledmap_sub',
    'unique_id_field_sub': ['_tiledmap_sub', this._config.id_field],
    'count_sub': ['_tiledmap_sub', '_tiledmap_count']
  }, {
    'query': query,
    'grid_size': this._style[style]['grid_resolution']
  });

  outer_query.from("{resource}");
  outer_query.inner_join('({query}) AS {subquery} ON {unique_id_field_sub}[1] = {unique_id_field}');
  if (this._params.interactivity) {
    var int_fields = this._params.interactivity.split(',');
    for (var col in int_fields) {
      outer_query.select('{col}', {
        'col': [this._resource_id, int_fields[col]]
      });
    }
  }
  outer_query.select('{count_sub} AS _tiledmap_count');
  outer_query.select('st_y({geom_field_4326}) AS _tiledmap_lat');
  outer_query.select('st_x({geom_field_4326}) AS _tiledmap_lng');
  outer_query.select('_tiledmap_center AS {geom_field_label}');
  outer_query.select([
      "ST_AsText(ST_Transform(ST_SetSRID(ST_MakeBox2D(",
          "ST_Translate(_tiledmap_center,",
                       "!pixel_width! * {grid_size} / -2,",
                       "!pixel_height! * {grid_size} / -2),",
          "ST_Translate(_tiledmap_center,",
                       "!pixel_width! * {grid_size} / 2,",
                       "!pixel_height! * {grid_size} / 2)",
      "), 3857), 4326)) as _tiledmap_grid_bbox"
  ].join(''));
  var sql = outer_query.to_sql();
  var interactivity = ['_tiledmap_count', '_tiledmap_lat', '_tiledmap_lng', '_tiledmap_grid_bbox'];
  if (this._params.interactivity){
    interactivity = interactivity.concat(this._params.interactivity.split(','));
    interactivity = interactivity.filter(function(e, i, arr){
      return arr.lastIndexOf(e) === i;
    });
  }
  callback(null, {sql:sql, interactivity: interactivity});
};

module.exports = TileQuery;