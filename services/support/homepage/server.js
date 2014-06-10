var http = require('http');
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  
  res.end([
    '<h1>Hookflash Services Example Stack - Customer oAuth</h1>',
    '<p>This VM is created from <a href="https://github.com/hookflashco/hcs-stack-customer-oauth">github.com/hookflashco/hcs-stack-customer-oauth<a/></p>',
    '<h3>APIs</h3></p>',
    '<p><a target="_blank" href="http://hcs-stack-cust-oauth-ia10ccf8-0.vm.opp.me:81/authorize"><b>:81/authorize?response_type=code&redirect_uri=URL&client_id=CLIENT_ID</b></a></p>',
    '<p><a target="_blank" href="http://hcs-stack-cust-oauth-ia10ccf8-0.vm.opp.me:81/token"><b>:81/token</b></a> - with client credentials in the request body as dictated by OAuth 2.0 spec or using HTTP basic authentication.</p>',
    '<p><a target="_blank" href="http://hcs-stack-cust-oauth-ia10ccf8-0.vm.opp.me:81/profile"><b>:81/profile</b></a> - with a <a href="http://tools.ietf.org/html/rfc6750">bearer token</a></p>',
    '<p><a target="_blank" href="http://hcs-stack-cust-oauth-ia10ccf8-0.vm.opp.me:82/contacts"><b>:82/contacts?access_token=OAUTH_ACCESS_TOKEN</b></a></p>',
    '<h3>Test</h3></p>',
    '<p><a target="_blank" href="http://hcs-stack-int-i69c2e3e-4.vm.opp.me:5000/"><b>//hcs-stack-int-i69c2e3e-4.vm.opp.me:5000</b> - Trigger Login</a></p>',
    '<p><a target="_blank" href="http://hcs-stack-int-iee41217-0.vm.opp.me/op-identity-provider-server-php/get/social/customerLogin.php"><b>//hcs-stack-int-iee41217-0.vm.opp.me/op-identity-provider-server-php/get/social/customerLogin.php</b> - Trigger Login</a></p>'
  ].join("\n"));

}).listen(process.env.PORT);
console.log('Server running at http://127.0.0.1:' + process.env.PORT + '/');
