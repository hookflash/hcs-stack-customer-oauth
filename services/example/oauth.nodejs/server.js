
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
const MYSQL = require("mysql");


const PORT = process.env.PORT;


var CONFIG = {
    "apps": {
        "hcs-stack-int~test.oauth.client": {
            "secret": "hcs-stack-int~test.oauth.client~secret",
            "callbackURL": "/^http:\\/\\/(hcs-stack-int-[^-]+-[^\\.]+|identity)\\.((vm\\.)?opp\\.me|hcs\\.io):\\d+\\/oauth\\/callback$/"
        }
    },
    "mysql": {
        "database": "customers"
    }
};

var accessTokensBasePath = "/opt/data/access-tokens";
if (!FS.existsSync(accessTokensBasePath)) {
    FS.mkdirsSync(accessTokensBasePath);
}


var oauthUsers = {};
var authorizationCodes = {};


function compareCallbackURIs(configured, provided) {
    if (/^\/.+\/$/.test(configured)) {
        var re = new RegExp(configured.replace(/(^\/|\/$)/g, ""));
        return !!re.exec(provided);
    } else
    if (provided) {
        var configuredParts = URL.parse(configured);
        var providedParts = URL.parse(provided);

        // Ignore `?....`
        configuredParts.search = "";
        providedParts.search = "";

        return (URL.format(configuredParts) === URL.format(providedParts));
    }
    return false;
}

var mysql = null;
var mysqlConfig = FS.readJsonSync("/opt/data/config/mysql.json");
function connect() {
    mysql = MYSQL.createConnection({
        host: "127.0.0.1",
        user: mysqlConfig.user,
        password: mysqlConfig.password,
        database: CONFIG.mysql.database
    });
    mysql.on('error', function(err) {
        console.log('db error', err.stack);
        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
            // Connection to the MySQL server is usually lost due to either server restart,
            // or a connnection idle timeout (the wait_timeout server variable configures this)
            connect();
        } else {
            throw err;
        }
    });
    mysql.connect(function(err) {
        if(err) {
            // The server is either down or restarting (takes a while sometimes).
            console.log('error when connecting to db:', err.stack);
            // We introduce a delay before attempting to reconnect,
            // to avoid a hot loop, and to allow our node script to
            // process asynchronous requests in the meantime.
            setTimeout(connect, 2000);
        }
    });
}
connect();

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
                return done(null, CONFIG.apps[username]);
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
            return FS.exists(PATH.join(accessTokensBasePath, accessToken), function(exists) {
                if (!exists) {
                    return done(null, false);
                }
                return FS.readJson(PATH.join(accessTokensBasePath, accessToken), function(err, client) {
                    if (err) return done(err);
                    return done(null, client, {
                        scope: '*'
                    });
                });
            });
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
            if (compareCallbackURIs(oauthUsers[client.id].redirectURI, redirectURI)) {
                var code = uid(16);
                authorizationCodes[code] = client.id;
                return done(null, code);
            }
            return done(null, false);
        }));

        oauthServer.exchange(OAUTH_SERVER.exchange.code(function(client, code, redirectURI, done) {
            if (
                authorizationCodes[code] &&
                compareCallbackURIs(oauthUsers[authorizationCodes[code]].redirectURI, redirectURI)
            ) {
                var token = uid(16);
                return FS.writeFile(PATH.join(accessTokensBasePath, token), JSON.stringify({
                    client: oauthUsers[authorizationCodes[code]]
                }, null, 4), function(err) {
                    if (err) return done(err);
                    return done(null, token);
                });
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
            if (isLoggedIn(req)) {
                if (req._parsedUrl.path === "/login") {
                    return res.redirect("/");
                }
                return next();
            }
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

            function loadPageVars(callback) {
                if (req.url === "/login") {
                    return mysql.query("SELECT * FROM users LIMIT 3", function(err, rows, fields) {
                        if (err) return callback(err);
                        return callback(null, {
                            testlogins: rows
                        });
                    });
                }
                return callback(null, {});
            }
            return loadPageVars(function(err, pageVars) {
                if (err) return next(err);
                for (var key in pageVars) {
                    data[key] = pageVars[key];
                }
                extraData = extraData || {};
                for (var key in extraData) {
                    data[key] = extraData[key];
                }
                return res.render(name, data);
            });
        }

        // @see https://github.com/jaredhanson/oauth2orize
        var lastReq = null;
        app.get('/authorize', ensureAuthenticated, function(req, res, next) {
            lastReq = req;
            return next();
        }, oauthServer.authorize(function(clientId, redirectURI, done) {
            if (CONFIG.apps[clientId]) {
                var parsedRedirectURL = URL.parse(redirectURI);
                if (compareCallbackURIs(CONFIG.apps[clientId].callbackURL, redirectURI)) {
                    return done(null, {
                        id: lastReq.session.user.id,
                        redirectURI: redirectURI,
                        clientHostname: parsedRedirectURL.hostname
                    }, redirectURI);
                }
                return done(new Error("Callback url provided '" + redirectURI + "' differes from one configured '" + CONFIG.apps[clientId].callbackURL + "'!"));
            }
            return done(new Error("No app configured for client '" + clientId + "'!"));
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
        }), function(req, res, next) {
            return mysql.query("SELECT * FROM users WHERE id = " + req.user.client.id, function(err, rows, fields) {
                if (err) return next(err);
                return res.end(JSON.stringify({
                    id: rows[0].id,
                    username: rows[0].username
                }));
            });
        });

        app.get('/logout', function(req, res, next) {
            if (req.user && req.user.id) {
                delete oauthUsers[req.user.id];
                for (var id in authorizationCodes) {
                    if (authorizationCodes[id] === req.user.id) {
                        delete authorizationCodes[id];
                    }
                }
            }
            req.session = {};
            return res.redirect("/");
        });
        app.post('/login', function(req, res, next) {
            return mysql.query("SELECT id, username FROM users WHERE username = '" + req.body.username + "' and password = '" + req.body.password + "'", function(err, rows, fields) {
                if (err) return next(err);
                if (rows.length === 1) {
                    req.session.user = {
                        id: rows[0].id,
                        username: rows[0].username
                    };
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
                    username: req.body.username || "user1",
                    password: req.body.password || "password",
                    error: "No such account. Please try again."
                });
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
            if (res.session) {
                res.session.authorize = {};
            }
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
