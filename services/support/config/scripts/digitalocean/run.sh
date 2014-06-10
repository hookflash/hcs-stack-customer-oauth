#!/bin/bash -e

if ! hash mysqld 2>/dev/null; then
	echo "Installing MySQL ..."
	echo mysql-server mysql-server/root_password password dbpassword | sudo debconf-set-selections
	echo mysql-server mysql-server/root_password_again password dbpassword | sudo debconf-set-selections
	sudo apt-get -y install mysql-server mysql-client
fi

node mysql.schema.js
