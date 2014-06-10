
const FS = require("fs");
const MYSQL = require("mysql");
const WAITFOR = require("waitfor");


const DATABASE_NAME = "customers";
const DATABASE_TABLES = {
	"users": {
		"columns": {
			"username": "varchar(64) UNIQUE NOT NULL",
			"password": "varchar(64) NOT NULL"
		},
		"rows": {
			"1": "(id, username, password) VALUES(1, 'user1', 'password')",
			"2": "(id, username, password) VALUES(2, 'user2', 'password')",
			"3": "(id, username, password) VALUES(3, 'user3', 'password')",
			"4": "(id, username, password) VALUES(4, 'user4', 'password')"
//		},
//		"indexes": {
//			"username_index": "CREATE INDEX username_index ON users (username(10))"
		}
	},
	"contacts": {
		"columns": {
			"user_id": "int(11) NOT NULL",
			"contact_id": "int(11) NOT NULL"
		},
		"rows": {
			"1": "(id, user_id, contact_id) VALUES(1, 1, 2)",
			"2": "(id, user_id, contact_id) VALUES(2, 1, 3)",
			"3": "(id, user_id, contact_id) VALUES(3, 1, 4)",
			"4": "(id, user_id, contact_id) VALUES(4, 2, 1)",
			"5": "(id, user_id, contact_id) VALUES(5, 2, 4)",
			"6": "(id, user_id, contact_id) VALUES(6, 3, 2)",
			"7": "(id, user_id, contact_id) VALUES(7, 4, 1)"
//		},
//		"indexes": {
//			"user_index": "CREATE INDEX user_index ON contacts (user_id)"
		}
	}
}


function parseConfig(callback) {
	var mysqlConfig = FS.readFileSync("/etc/mysql/debian.cnf", "utf8");
	var config = {};
	var activeSection = null;
	mysqlConfig.split("\n").forEach(function(line) {
		var m = line.match(/^\[([^\]]+)\]$/);
		if (m) {
			activeSection = m[1];
			if (!config[activeSection]) config[activeSection] = {};
		} else {
			var m = line.match(/^(\S+)\s*=\s*(.+)$/);
			if (m) {
				config[activeSection][m[1]] = m[2];
			}
		}
	});
	return callback(null, config);
}

function ensureProvisioned(config, callback) {


    var mysql = null;
	function connect() {
	    mysql = MYSQL.createConnection({
			host: "127.0.0.1",
			user: config.client.user,
			password: config.client.password
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


	function ensureDatabase(callback) {
		console.log("Ensure databases ...");
		function switchToDatabase(callback) {
			return mysql.changeUser({
				database: DATABASE_NAME
			}, callback);
		}
	    return mysql.query("SHOW DATABASES", function(err, rows, fields) {
	        if (err) return callback(err);
	        var databases = [];
	        rows.forEach(function(row) {
	            databases.push(row.Database);
	        });
			console.log("Ensure database '" + DATABASE_NAME + "' ...");
	        if (databases.indexOf(DATABASE_NAME) !== -1) {
	        	return switchToDatabase(callback);
	        }
		    return mysql.query("CREATE DATABASE " + DATABASE_NAME, function(err, result) {
		        if (err) return callback(err);
		        if (result.affectedRows !== 1) {
		        	return callback(new Error("Error creating database!"));
		        }
				return switchToDatabase(callback);
		    });
	    });
	}

	function ensureColumns(tableName, callback) {
		console.log("Ensure columns for table '" + tableName + "' ...");
		function createColumn(columnName, columnInfo, callback) {
			if (typeof columnInfo === "string") {
				columnInfo = {
					create: columnInfo
				};
			}
			var command = 'ALTER TABLE `' + tableName + '` ADD `' + columnName + '` ' + columnInfo.create;
			console.log("Creating column: " + columnName);
		    return mysql.query(command, function(err, rows, fields) {
		        if (err) return callback(err);
		        return callback(null);
	       });
		}
	    return mysql.query("SHOW COLUMNS FROM " + tableName, function(err, rows, fields) {
	        if (err) return callback(err);
	        var columns = [];
	        rows.forEach(function(row) {
	            columns.push(row.Field);
	        });
	        var waitfor = WAITFOR.serial(callback);
	        for (var name in DATABASE_TABLES[tableName].columns) {
				console.log("Ensure column '" + name + "' ...");
	        	waitfor(name, function(name, callback) {
			        if (columns.indexOf(name) !== -1) {
			        	return callback(null);
			        }
			        return createColumn(name, DATABASE_TABLES[tableName].columns[name], callback);
	        	});
	        }
	        return waitfor();
       });
	}

	function ensureRows(tableName, callback) {
		console.log("Ensure rows for table '" + tableName + "' ...");
		function createRow(rowId, rowInfo, callback) {
			if (typeof rowInfo === "string") {
				rowInfo = {
					create: rowInfo
				};
			}
			var command = 'INSERT INTO `' + tableName + '` ' + rowInfo.create;
			console.log("Creating row: " + rowId);
		    return mysql.query(command, function(err, result) {
		        if (err) return callback(err);
		        if (result.affectedRows !== 1) {
		        	return callback(new Error("Error inserting row!"));
		        }
		        return callback(null);
	       });
		}
        var waitfor = WAITFOR.serial(callback);
        for (var id in DATABASE_TABLES[tableName].rows) {
			console.log("Ensure row '" + id + "' ...");
        	waitfor(id, function(id, callback) {
			    return mysql.query("SELECT id FROM " + tableName + " WHERE id = " + id, function(err, rows, fields) {
			        if (err) return callback(err);
					if (rows.length === 1) {
			        	return callback(null);
					}
			        return createRow(id, DATABASE_TABLES[tableName].rows[id], callback);
			    });
        	});
        }
        return waitfor();
	}

	function ensureTables(callback) {
		console.log("Ensure tables ...");
		function createTable(name, callback) {
			var command = [
				'CREATE TABLE `' + name + '` (',
					'`id` int(11) NOT NULL AUTO_INCREMENT,',
					'PRIMARY KEY (`id`)',
				') ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;'
			];
			console.log("Creating table: " + name);
		    return mysql.query(command.join(""), function(err, rows, fields) {
		        if (err) return callback(err);
		        return callback(null);
	       });
		}
		function ensureTableProvisioned(name, callback) {
			return ensureColumns(name, function(err) {
				if (err) return callback(err);
				return ensureRows(name, function(err) {
					if (err) return callback(err);
					return callback(null);
				});
			});
		}
	    return mysql.query("SHOW TABLES", function(err, rows, fields) {
	        if (err) return callback(err);
	        var tables = [];
	        rows.forEach(function(row) {
	            tables.push(row.Tables_in_customers);
	        });
	        var waitfor = WAITFOR.serial(callback);
	        for (var name in DATABASE_TABLES) {
				console.log("Ensure table '" + name + "' ...");
	        	waitfor(name, function(name, callback) {
			        if (tables.indexOf(name) !== -1) {
			        	return ensureTableProvisioned(name, callback);
			        }
			        return createTable(name, function(err) {
			        	if (err) return callback(err);
			        	return ensureTableProvisioned(name, callback);
			        });
	        	});
	        }
	        return waitfor();
       });
	}

	console.log("Provisioning MySQL tables ...");

	return ensureDatabase(function(err) {
		if (err) return callback(err);
		return ensureTables(function(err) {
			if (err) return callback(err);

			console.log("MySQL tables provisioned!");
			return callback(null);
		});
	});
}

function main(callback) {
	return parseConfig(function(err, config) {
		if (err) return callback(err);
		if (!FS.existsSync("/opt/data/config")) {
			FS.mkdirSync("/opt/data/config");
		}
		FS.writeFileSync("/opt/data/config/mysql.json", JSON.stringify(config.client));
		return ensureProvisioned(config, callback);
	});
}

main(function(err) {
	if (err) {
		console.error(err.stack);
		process.exit(1);
	}
	process.exit(0);
});
