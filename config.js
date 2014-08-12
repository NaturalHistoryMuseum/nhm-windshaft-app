/*
 * This is the general configuration file
 * used to define postgres credentials
 * and the application port.
 *
 * Setup specific configuration (such as
 * mapnik version of redis host) are in
 * server.js ; the defaults provided there
 * are correct for the default setup.
 */
var config = {
    windshaft_port: 4000,
    postgres_host: '127.0.0.1',
    postgres_port: 5432,
    postgres_user: 'datastore_default',
    postgres_pass: '',
    geometry_field: '_the_geom_webmercator',
    geometry_4326_field: '_geom',
    id_field: '_id',
    resources_path: __dirname + '/resources',
    num_workers: 1, /* If CPU bound, then set this to the number of CPUs and no more */
    worker_max_requests: 1000 /* 0 to disable this feature */
};
/* Don't remove this */
module.exports = config;
