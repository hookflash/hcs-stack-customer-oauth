
const PATH = require("path");
const URL = require("url");
const EXPRESS = require("express");
const HBS = require("hbs");
const FS = require("fs-extra");
const MARKED = require("marked");
const PASSPORT = require("passport");
const PASSPORT_BASIC = require("passport-http");
const PASSPORT_CLIENT_PASSWORD = require("passport-oauth2-client-password");
const PASSPORT_BEARER = require("passport-http-bearer");
const REQUEST = require("request");
const OAUTH_SERVER = require("oauth2orize");
const OAUTH_SERVER_TRANSACTION_LOADER = require("oauth2orize/lib/middleware/transactionLoader");


const PORT = process.env.PORT;


var CONFIG = {
    "apps": {
        "hcs-idprovider": {
            "secret": "hcs-idprovider-secret",
            "callbackURL": "http://hcs-stack-int-iee41217-0.vm.opp.me/op-identity-provider-server-php/get/social/customerLogin.php"
        },
        "test.oauth.client": {
            "secret": "test.oauth.client-secret",
            "callbackURL": "http://hcs-stack-int-i69c2e3e-4.vm.opp.me:5000/oauth/callback"
        }
    }
};



var oauthUsers = {};
var authorizationCodes = {};
var accessTokens = {};

exports.main = function(callback) {
    try {

        var passport = new PASSPORT.Passport();

        passport.serializeUser(function(user, done) {
            return done(null, user);
        });

        passport.deserializeUser(function(obj, done) {
            return done(null, obj);
        });

        passport.use(new PASSPORT_BASIC.BasicStrategy(function (username, password, done) {
            if (
                CONFIG.apps[username] &&
                CONFIG.apps[username].secret === password
            ) {
                return done(null, CONFIG.services.hcsauth.clients[username]);
            }
            return done(null, false);
        }));

        passport.use(new PASSPORT_CLIENT_PASSWORD.Strategy(function (clientId, clientSecret, done) {
            if (
                CONFIG.apps[clientId] &&
                CONFIG.apps[clientId].secret === clientSecret
            ) {
                return done(null, CONFIG.apps[clientId]);
            }
            return done(null, false);
        }));

        passport.use(new PASSPORT_BEARER.Strategy(function(accessToken, done) {
            if (accessTokens[accessToken]) {
                return done(null, oauthUsers[accessTokens[accessToken]], {
                    scope: '*'
                });
            }
            return done(null, false);
        }));

        // @see https://github.com/jaredhanson/oauth2orize
        var oauthServer = OAUTH_SERVER.createServer();

        oauthServer.serializeClient(function(client, done) {
            oauthUsers[client.id] = client;
            return done(null, client.id);
        });

        oauthServer.deserializeClient(function(id, done) {
            if (!oauthUsers[id]) return done(new Error("Not found!"));
            return done(null, oauthUsers[id]);
        });

        oauthServer.grant(OAUTH_SERVER.grant.code(function(client, redirectURI, user, ares, done) {
            if (
                oauthUsers[client.id].redirectURI === redirectURI
            ) {
                var code = uid(16);
                authorizationCodes[code] = client.id;
                return done(null, code);
            }
            return done(null, false);
        }));

        oauthServer.exchange(OAUTH_SERVER.exchange.code(function(client, code, redirectURI, done) {
            if (
                authorizationCodes[code] &&
                oauthUsers[authorizationCodes[code]].redirectURI === redirectURI
            ) {
                var token = uid(16);
                accessTokens[token] = oauthUsers[authorizationCodes[code]].id;
                return done(null, token);
            }
            return done(null, false);
        }));

        var app = EXPRESS();

        app.configure(function() {

            app.use(EXPRESS.logger());
            app.use(EXPRESS.bodyParser());
            app.use(EXPRESS.methodOverride());
            app.use(EXPRESS.cookieParser('secret'));
            app.use(EXPRESS.cookieSession({
                key: "sid-auth"
            }));

            app.use(passport.initialize());
            app.use(passport.session());

        });

        function isLoggedIn(req) {
            if (
                req.session &&
                req.session.user &&
                req.session.authorized
            ) {
                return true;
            }
            return false;
        }

        function ensureAuthenticated(req, res, next) {
            if (isLoggedIn(req)) return next();
            if (req._parsedUrl.path === "/login") return next();
            req.session = {};
            if (!req.session.returnTo) {
                req.session.returnTo = req.originalUrl || req.url;
            }
            return res.redirect("/login");
        }

        function renderView(req, res, name, extraData) {
            var data = {};
            data.loggedin = isLoggedIn(req);
            data.user = (data.loggedin) ? req.session.user : null;
            extraData = extraData || {};
            for (var key in extraData) {
                data[key] = extraData[key];
            }
            return res.render(name, data);
        }

        // @see https://github.com/jaredhanson/oauth2orize
        var lastReq = null;
        app.get('/authorize', ensureAuthenticated, function(req, res, next) {
            lastReq = req;
            return next();
        }, oauthServer.authorize(function(clientId, redirectURI, done) {
            if (CONFIG.apps[clientId]) {
                var parsedRedirectURL = URL.parse(redirectURI);
                if (CONFIG.apps[clientId].callbackURL === redirectURI) {
                    return done(null, {
                        id: lastReq.session.user.username,
                        redirectURI: redirectURI,
                        clientHostname: parsedRedirectURL.hostname
                    }, redirectURI);
                }
            }
            return done(new Error("Callback url provided differes from one configured!"));
        }), function(req, res, next) {

            // Bypass grant as we are authorizing our own app only.
            req.oauth2.res = {
                allow: true
            };
            return oauthServer._respond(req.oauth2, res, function(err) {
                if (err) { return next(err); }
                return next(new Error('Unsupported response type: ' + req.oauth2.req.type, 'unsupported_response_type'));
            });
            /*
            return renderView(req, res, 'grant', {
                oauth: req.oauth2
            });
            */
        });
        app.post('/authorize/decision', ensureAuthenticated, oauthServer.decision());

        app.post('/token', passport.authenticate([
            'basic',
            'oauth2-client-password'
        ], {
            session: false
        }), oauthServer.token(), function (err, req, res, next) {
            console.log("TOKEN ERROR", err.stack);
            return oauthServer.errorHandler()(err, req, res, next);
        });

        app.get('/profile', passport.authenticate('bearer', {
            session: false
        }), function(req, res) {
            return res.end(JSON.stringify({
                id: req.user.id
            }));
        });

        app.get('/logout', function(req, res, next) {
            if (req.user && req.user.id) {
                delete oauthUsers[req.user.id];
                for (var id in authorizationCodes) {
                    if (authorizationCodes[id] === req.user.id) {
                        delete authorizationCodes[id];
                    }
                }
                for (var id in accessTokens) {
                    if (accessTokens[id] === req.user.id) {
                        delete accessTokens[id];
                    }
                }            }
            req.session = {};
            return res.redirect("/");
        });
        app.post('/login', function(req, res, next) {

        	// TODO: Hookup to database.

        	if (
        		(
	        		req.body.username === "user1" ||
	        		req.body.username === "user2" ||
	        		req.body.username === "user3"
	        	) &&
	        	req.body.password === "password"
    		) {
	            req.session.user = req.body;
                req.session.authorized = true;

                console.log("Authorizing user:", req.session.user);

                var returnTo = null;
                if (req.session.returnTo) {
                    returnTo = req.session.returnTo;
                    delete req.session.returnTo;
                }
                console.log("Redirect to:", returnTo);
                return res.redirect(returnTo || '/');
	        }

            return renderView(req, res, 'login', {
            	username: req.body.username || "",
            	password: req.body.password || "",
            	error: "No such account. Please try again."
            });
        });



        var hbs = HBS.create();
        
        app.set("view engine", "hbs");
        app.engine("hbs", hbs.__express);
        app.set("views", PATH.join(__dirname, "views"));

        app.get(/^\/favicon.ico$/, function(req, res, next) {
            return res.end();
        });

        mountStaticDir(app, /^\/ui\/(.*)$/, PATH.join(__dirname, "ui"));
        mountStaticDir(app, /^\/lib\/bootstrap\/(.*)$/, PATH.join(__dirname, "lib/bootstrap"));

        app.get(/^\/($|.*$)/, ensureAuthenticated, function(req, res, next) {
            return renderView(req, res, req.params[0] || "index");
        });

        
        var server = app.listen(PORT);

        console.log("open http://localhost:" + PORT + "/");

        return callback(null, {
            server: server,
            port: PORT
        });

    } catch(err) {
        return callback(err);
    }

    function mountStaticDir(app, route, path) {
        app.get(route, function(req, res, next) {
            var originalUrl = req.url;
            req.url = req.params[0];
            EXPRESS.static(path)(req, res, function() {
                req.url = originalUrl;
                return next.apply(null, arguments);
            });
        });
    };
}

function uid(len) {
  var buf = []
    , chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    , charlen = chars.length;

  for (var i = 0; i < len; ++i) {
    buf.push(chars[getRandomInt(0, charlen - 1)]);
  }

  return buf.join('');
};

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

if (require.main === module) {
    exports.main(function(err) {
        if (err) {
            console.error(err.stack);
            process.exit(1);
        }
    });
}
