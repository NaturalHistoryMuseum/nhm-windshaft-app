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
    postgres_pass: ''
}
/* Don't remove this */
module.exports = config;
