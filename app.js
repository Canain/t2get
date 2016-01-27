/// <reference path="typings/tsd.d.ts" />
'use strict';

const path = require('path');
const phantomjs = require('phantomjs');
const phantom = require('phantom');
const prompt = require('prompt');
const async = require('async');

const phantomPath = phantomjs.path.substr(0, phantomjs.path.length - 'panthomjs'.length);

const loginUrl = 'https://login.gatech.edu/cas/login?service=https%3A%2F%2Ft-square.gatech.edu%2Fsakai-login-tool%2Fcontainer';

function getSites() { // Will not get all sites if is selecting something other than My Workspace
	var links = document.querySelectorAll('#siteLinkList a');
	var tabs = {};
	for (var i in links) {
		var link = links[i];
		var span = link.firstElementChild;
		if (span && span.textContent) {
			tabs[span.textContent] = link.href;
		}
	}
	return tabs;
}

function getSelectedSite(sites) {
	for (var i in sites) {
		if (sites[i].indexOf('#') > -1) {
			return i;
		}
	}
}

function getTools() { // Will not get all tools if is selecting something other than Home
	var links = document.querySelectorAll('#toolMenu a');
	var tools = {};
	for (var i in links) {
		var link = links[i];
		var span = link.firstElementChild;
		if (span && span.textContent) {
			tools[span.textContent] = link.href;
		}
	}
	return tools;
}

function getSelectedTool(tools) {
	for (var i in tools) {
		if (!tools[i]) {
			return i;
		}
	}
}

function getAssignmentIFrameSrc() {
	return document.querySelector('.portletMainWrap iframe').src;
}

function getAssignments() {
	var trs = document.querySelectorAll('.portletBody table tr');
	
	return trs ? true : false;
}

async.waterfall([
	(done) => {
		prompt.start();
		prompt.get({
			properties: {
				username: {
					required: true
				},
				password: {
					required: true,
					hidden: true
				}
			}
		}, done);
	},
	(result, done) => {
		phantom.create({
			path: phantomPath,
			parameters: {
				'web-security': 'no'
			}
		}, (ph) => {
			done(null, ph, result);
		})
	},
	(ph, auth, done) => {
		ph.createPage((page) => {
			done(null, ph, auth, page);
		});
	},
	(ph, auth, page, done) => {
		page.open(loginUrl, (status) => {
			done(status == 'success' ? null : status, ph, auth, page);
		});
	},
	(ph, auth, page, done) => {
		page.set('onLoadFinished', (success) => {
			done(success == 'success' ? null : success, ph, page);
		});
		page.evaluate(function (auth) {
			var form = document.querySelector('form');
			form.username.value = auth.username;
			form.password.value = auth.password;
			form.submit.click();
		}, () => {
		}, auth);
	},
	(ph, page, done) => {
		page.evaluate(getSites, (sites) => {
			let classes = [];
			for (let i in sites) {
				if (i != 'My Workspace') {
					classes.push(i);
				}
			}
			console.log(classes);
			async.eachSeries(classes, (site, next) => {
				async.waterfall([
					(step) => {
						page.open(sites[site], (status) => {
							step(status == 'success' ? null : status);
						});
					},
					(step) => {
						page.evaluate(getTools, (tools) => {
							step(null, tools);
						});
					},
					(tools, step) => {
						console.log(tools);
						step();
					}
				], (error) => {
					if (error) {
						done(error, ph);
					} else {
						next();
					}
				});
			}, () => {
				done(null, ph);
			});
		});
	}
], (error, ph) => {
	if (ph && ph.exit) {
		ph.exit();
	}
	if (error) {
		console.error(error);
	}
});