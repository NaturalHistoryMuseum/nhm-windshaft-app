var http = require('http');
var httpProxy = require('http-proxy');

var _queue_request_id_sec = 0;

/**
 * The QueueingProxy provides an HTTP proxy which can limit the number of requests sent to the proxy at one time,
 * and prioritize incoming requests per type.
 *
 * @param port: Port to listen on;
 * @param target: URL to proxy to;
 * @param requests_per_client: Number of requests that can be pushed at one time for a single client;
 * @param request_types: Array defining the request types, starting with the highest priority requests;
 * @param get_request_type: Function that returns the request type of a request
 * @constructor
 */
function QueueingProxy(port, target, requests_per_client, request_types, get_request_type){
  var self = this;
  // General setup
  this._target = target;
  this._requests_per_client = requests_per_client;
  this._request_types = request_types;
  this._get_request_type = get_request_type;
  this._requests = {};
  this._processing = {};
  // Start the proxy
  this._proxy = httpProxy.createProxyServer({});
  this._proxy.on('proxyRes', function(res, req){
    self._request_finished(req);
  });
  this._proxy.on('error', function(err, req, res){
    self._deal_with_error(req, err.code.toString() + ": ");
  });
  // And start listening
  this._http = http.createServer(function(req, res){
    self._new_request(req, res);
  }).listen(port);
}

QueueingProxy.prototype._new_request = function(req, res){
  var self = this;
  var id = this._get_client_id(req);
  var request_id = this._get_request_id(req);
  var type = this._get_request_type(req);
  console.log("INCOMING: " + request_id); // + " from " + id);
  /* Queue the request */
  if (!(id in this._requests)){
    this._requests[id] = {};
    for (var i in this._request_types){
      this._requests[id][this._request_types[i]] = [];
    }
    this._processing[id] = 0;
  }

  this._requests[id][type].push({
    'req': req,
    'res': res
  });
  /* Ensure request is removed from list on premature termination */
  req.on('close', function(){
    self._deal_with_error(req, 'DROPPED: ');
  });
  /* Kickstart the consumer */
  this._process_next_requests(id);
};

/**
 * For a given http request return a string identifying the client.
 *
 * This will cache the client id on the request object.
 *
 * @param req: HTTP request object
 * @return: String - The client id
 */
QueueingProxy.prototype._get_client_id = function(req){
  if (typeof req._queue_client_id !== 'undefined'){
    return req._queue_client_id;
  }
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  var id = ip + "-" + req['headers']['user-agent'] + "-" + req['headers']['cookie'];
  req._queue_client_id = id;
  return id;
};

/**
 * Return the request id for the given request.
 *
 * The request id is cached on the object, and generated sequentially
 *
 * @param req: HTTP request object
 * @return: String - the request id
 */
QueueingProxy.prototype._get_request_id = function(req){
  if (typeof req._queue_request_id !== 'undefined'){
    return req._queue_request_id;
  }

  req._queue_request_id = "r" + _queue_request_id_sec.toString();
  _queue_request_id_sec += 1;
  return req._queue_request_id;
};

/**
 * Process next requests for the given client id
 *
 * @param id: Client id
 * @param type: If defined, the type of request to process. If not defined, process the first available request
 *              with the highest priority type
 */
QueueingProxy.prototype._process_next_requests = function(id, type){
  if (this._processing[id] >= this._requests_per_client){
    return;
  }
  if (typeof type == 'undefined'){
    for (var i in this._request_types){
      var r_type = this._request_types[i];
      if (this._requests[id][r_type].length > 0){
        return this._process_next_requests(id, r_type);
      }
    }
    return;
  }
  var request = this._requests[id][type].pop();
  this._processing[id] += 1;
  console.log("FORWARDING " + request['req']._queue_request_id + " (" + type + ")"); // + " from " + id + " sent to target server.");
  this._proxy.web(request['req'], request['res'], {target: this._target});
  this._process_next_requests(id);
};

/**
 * Handle finished requests
 * @param req: HTTP request object
 */
QueueingProxy.prototype._request_finished = function(req){
  var id = this._get_client_id(req);
  console.log("FINISHED: " + req._queue_request_id); // + " from " + id);
  if (this._request_continuation(req)) {
    this._processing[id] -= 1;
    this._process_next_requests(id);
  }
};

/**
 * Handle error for the given request
 */
QueueingProxy.prototype._deal_with_error = function(req, msg_prefix){
  var id = this._get_client_id(req);
  var request_id = this._get_request_id(req);
  console.log(msg_prefix + request_id); // + " for client " + id);
  var pos = -1;
  var type = '';
  for (var t in this._requests[id]){
    for (var i in this._requests[id][t]){
      if (this._get_request_id(this._requests[id][t][i].req) == request_id){
        type = t;
        pos = i;
        break;
      }
    }
    if (pos >= 0){
      break;
    }
  }
  if (pos >= 0){
    console.log(request_id + ' still in the queue - removing.');
    this._requests[id][type].splice(pos, 1);
  }
  if (this._request_continuation(req)) {
    this._processing[id] -= 1;
    this._process_next_requests(id);
  }
};

/**
 * Retruns true if this request's continuation has not yet been processed. Calling this marks the requests continuation
 * has having been processed.
 */
QueueingProxy.prototype._request_continuation = function(req){
  if (!req._queue_request_continuation) {
    req._queue_request_continuation = true;
    return true;
  }
  return false;
};

module.exports = QueueingProxy;