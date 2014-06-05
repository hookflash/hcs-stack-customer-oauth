var http = require('http');
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  
  res.end([
    '<h1>Hookflash Services Example Stack - Customer oAuth</h1>',
    '<p>This VM is created from <a href="https://github.com/hookflashco/hcs-stack-customer-oauth">github.com/hookflashco/hcs-stack-customer-oauth<a/></p>',
    '<h3>APIs</h3></p>',
    '<p><a href="http://hcs-stack-cust-oauth-ia10ccf8-0.vm.opp.me:81/"><b>:81/auth</b> - OAuth Provider</a></p>',
    '<p><a href="http://hcs-stack-cust-oauth-ia10ccf8-0.vm.opp.me:82/"><b>:82/contacts</b> - Contacts API</a></p>'
  ].join("\n"));

}).listen(process.env.PORT);
console.log('Server running at http://127.0.0.1:' + process.env.PORT + '/');
