/**
* Hyperbolic sin
*/
function sinh(x){
  return (Math.exp(x) - Math.exp(-x))/2;
}

/**
* Radiants to degrees
*/
function degrees(x){
  return x * (180 / Math.PI);
}

/**
* Return the lat/lng of a map tile
* @param x: X coordinate of the tile
* @param y: Y coordinate of the tile
* @param z: Z coordinate of the tile
* @return: Object defining lat and lng of the corresponding top left corner of the tile
*/
function tile_to_latlng(x, y, z){
  var n =  Math.pow(2, z);
  var lng_deg = x / n * 360.0 - 180.0;
  var lat_rad = Math.atan(sinh(Math.PI * (1 - 2 * y / n)));
  var lat_deg = degrees(lat_rad);
  return {
    lat: lat_deg,
    lng: lng_deg
  };
}

/**
 * Return the bounding box (in lat/lng) of a map tile
 *
 * @param x: X coordinate of the tile
 * @param y: Y coordinate of the tile
 * @param z: Z coordinate of the tile
 * @return: Object with min and max both being objects defining lat and lng.
 */
function tile_to_latlng_bbox(x, y, z){
  var top_left = tile_to_latlng(x, y, z);
  var bottom_right = tile_to_latlng(x+1, y+1, z);
  return {
    min: top_left,
    max: bottom_right
  };
}


module.exports = {
  tile_to_latlng_bbox: tile_to_latlng_bbox
};