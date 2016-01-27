/// <reference path="typings/tsd.d.ts" />
'use strict';

const path = require('path');
const phantomjs = require('phantomjs');
const phantom = require('phantom');

phantom.create({
	path: phantomjs.path.substr(0, phantomjs.path.length - 'panthomjs'.length),
	parameters: {
		'web-security': 'no'
	}
}, (ph) => {
	ph.createPage(function (page) {
		page.open("https://login.gatech.edu/cas/login?service=https%3A%2F%2Ft-square.gatech.edu%2Fsakai-login-tool%2Fcontainer", function (status) {
			console.log(status);
			ph.exit();
		});
	});
});