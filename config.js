var config = {
    port: 4000, /* Port to the application. This is not directly Windshaft, but a proxy to queue and prioritize requests */
    postgres_host: '127.0.0.1',
    postgres_port: 5432,
    postgres_user: 'datastore_default',
    postgres_pass: '',
    geometry_field: '_the_geom_webmercator',
    geometry_4326_field: '_geom',
    id_field: '_id',
    resources_path: __dirname + '/resources',
    num_workers: 1, /* If CPU bound, then set this to the number of CPUs and no more */
    worker_max_requests: 1000, /* 0 to disable this feature */
    requests_per_client: 4, /* Internally, number of requests for the proxy to send to windshaft per client at once */
    windshaft_port: 4001 /* Internally, Windshaft runs on this port */
};
/* Don't remove this */
module.exports = config;
