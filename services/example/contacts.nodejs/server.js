
const PATH = require("path");
const FS = require("fs-extra");
const URL = require("url");
const EXPRESS = require("express");
const MORGAN = require("morgan");
const PASSPORT = require("passport");
const PASSPORT_BEARER = require("passport-http-bearer");
const MYSQL = require("mysql");
const REQUEST = require("request");


const PORT = process.env.PORT;


var CONFIG = {
    "mysql": {
        "database": "customers"
    }
};


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

        passport.use(new PASSPORT_BEARER.Strategy(function(accessToken, done) {
			var url = "http://127.0.0.1:81/profile?access_token=" + accessToken;
			console.log("Calling url:", url);
			return REQUEST.get(url, function(err, response, body) {
				if (err) {
					console.error("Error calling '" + url + "':", err.stack)
					return done(err);
				}
				if (response.statusCode !== 200) {
		            return done(null, false);
				}
                return done(null, JSON.parse(body), {
                    scope: '*'
                });
			});
            return done(null, false);
        }));

        var app = EXPRESS();

        app.use(MORGAN());
        app.use(passport.initialize());

        app.get('/contacts', passport.authenticate('bearer', {
            session: false
        }), function(req, res, next) {
			return mysql.query([
				"SELECT users.id AS id, users.username FROM users",
				"INNER JOIN contacts ON contacts.contact_id = users.id",
				"WHERE contacts.user_id = " + req.user.id
			].join(" "), function(err, rows, fields) {
        	    if (err) return next(err);
				return res.end(JSON.stringify({
					"contacts": rows
				}, null, 4));
			});
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
}

if (require.main === module) {
    exports.main(function(err) {
        if (err) {
            console.error(err.stack);
            process.exit(1);
        }
    });
}
