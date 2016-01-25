/// <reference path="typings/tsd.d.ts" />
'use strict';

var Casper = require('casper');

var casper = Casper.create();

var args = casper.cli.args;

var username = args[0];
var password = args[1];

console.log('Using username: ' + username);

casper.start('https://login.gatech.edu/cas/login?service=https%3A%2F%2Ft-square.gatech.edu%2Fsakai-login-tool%2Fcontainer', function () {
	this.fill('form', {
		'username': username,
		'password': password
	}, true);
});

casper.then(function () {
	this.echo(this.getTitle());
});

casper.run();