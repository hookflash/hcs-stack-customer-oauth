var http = require('http');
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  
  res.end([
    'Hello contacts API!'
  ].join("\n"));

}).listen(process.env.PORT);
console.log('Server running at http://127.0.0.1:' + process.env.PORT + '/');
