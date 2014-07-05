var http = require('http');
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});

  if (req.url === "/.well-known/openpeer-services-get") {
      var payload = JSON.stringify({
          "result": {
              "$domain": "hcs-stack-cust-oauth-ia10ccf8-1.vm.opp.me",
              "$appid": "com.hookflash.app-<expiry>-<token>-<hash>",
              "$id": "abc",
              "$handler": "bootstrapper",
              "$method": "services-get",
              "$timestamp": 1404525896.114,
              "$epoch": "1404525895",
              "error": {
                  "$id": 302,
                  "#text": "Found",
                  "location": "http://bootstrap.hcs-stack-v2-i7957106-7.hcs.io/services-get"
              }
          }
      }, null, 4);
      return res.end(payload);
  }
  
  res.end([
    '<h1>Hookflash Services Example Stack - Customer oAuth</h1>',
    '<p>This VM is created from <a href="https://github.com/hookflashco/hcs-stack-customer-oauth">github.com/hookflashco/hcs-stack-customer-oauth<a/></p>',
    '<h3>APIs</h3></p>',
    '<p><a target="_blank" href="http://hcs-stack-cust-oauth-ia10ccf8-0.vm.opp.me:81/authorize"><b>:81/authorize?response_type=code&redirect_uri=URL&client_id=CLIENT_ID</b></a></p>',
    '<p><a target="_blank" href="http://hcs-stack-cust-oauth-ia10ccf8-0.vm.opp.me:81/token"><b>:81/token</b></a> - with client credentials in the request body as dictated by OAuth 2.0 spec or using HTTP basic authentication.</p>',
    '<p><a target="_blank" href="http://hcs-stack-cust-oauth-ia10ccf8-0.vm.opp.me:81/profile"><b>:81/profile</b></a> - with a <a href="http://tools.ietf.org/html/rfc6750">bearer token</a></p>',
    '<p><a target="_blank" href="http://hcs-stack-cust-oauth-ia10ccf8-0.vm.opp.me:82/contacts"><b>:82/contacts?access_token=OAUTH_ACCESS_TOKEN</b></a></p>'
  ].join("\n"));

}).listen(process.env.PORT);
console.log('Server running at http://0.0.0.0:' + process.env.PORT + '/');
