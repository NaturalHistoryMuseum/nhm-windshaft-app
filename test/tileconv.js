var tileconv = require("../lib/tileconv");
var assert = require("assert");

describe('tile_to_latlng', function() {
  it('Should return the correct bounding box for the given tile', function(){
    var v = tileconv.tile_to_latlng_bbox(16366, 10897, 15);
    assert(v.min.lat > 51.4 && v.min.lat < 51.6);
    assert(v.min.lng > -0.2 && v.min.lng < -0.18);
    assert(v.max.lat > 51.3 && v.max.lat < 51.5);
    assert(v.max.lng > -0.19 && v.max.lng < -0.17);
  });
});
