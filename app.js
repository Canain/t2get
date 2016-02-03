#!/usr/bin/env node

/// <reference path="typings/tsd.d.ts" />
'use strict';

const path = require('path');
const phantomjs = require('phantomjs-prebuilt');
const phantom = require('phantom');
const prompt = require('prompt');
const async = require('async');

const phantomPathSlashes = phantomjs.path.split(/\/|\\/);
const phantomPath = phantomjs.path.substr(0, phantomjs.path.length - phantomPathSlashes[phantomPathSlashes.length - 1].length);

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
	
	var assignments = [];
	
	if (trs.length < 2) {
		return assignments;
	}
	
	for (var i = 1; i < trs.length; i++) {
		var tr = trs[i];
		var children = tr.children;
		var assignment = {};
		for (var j = 0; j < children.length; j++) {
			var td = children[j];
			if (td.headers) {
				assignment[td.headers] = td.textContent.trim();
			}
		}
		assignments.push(assignment);
	}
	return assignments;
}

let phan = null;

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
			},
			dnodeOpts: {
				weak: false
			}
		}, (ph) => {
			phan = ph;
			done(null, ph, result);
		})
	},
	(ph, auth, done) => {
		ph.createPage((page) => {
			done(null, ph, auth, page);
		});
	},
	(ph, auth, page, done) => {
		console.log('Logging in...');
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
		console.log('Logged in');
		page.set('onLoadFinished', null);
		page.evaluate(getSites, (sites) => {
			let classes = [];
			for (let i in sites) {
				if (i != 'My Workspace') {
					classes.push(i);
				}
			}
			// console.log(classes);
			let all = {};
			async.eachSeries(classes, (site, next) => {
				console.log(`Parsing assignments for ${site}`);
				let siteUrl = sites[site];
				// console.log(siteUrl);
				async.waterfall([
					(step) => {
						page.open(siteUrl, (status) => {
							step(status == 'success' ? null : status);
						});
					},
					(step) => {
						page.evaluate(getTools, (tools) => {
							step(null, tools);
						});
					},
					(tools, step) => {
						// console.log(tools);
						let assignment = tools['Assignments'];
						if (assignment) {
							async.waterfall([
								(forward) => {
									page.open(assignment, (status) => {
										forward(status == 'success' ? null : status);
									});
								},
								(forward) => {
									page.evaluate(getAssignmentIFrameSrc, (iframe) => {
										forward(null, iframe);
									});
								},
								(iframe, forward) => {
									page.open(iframe, (status) => {
										forward(status == 'success' ? null : status);
									});
								},
								(forward) => {
									page.evaluate(getAssignments, (assignments) => {
										// console.log(assignments);
										all[site] = assignments;
										forward();
									});
								}
							], (error) => {
								step(error);
							});
						} else {
							step();
						}
					}
				], (error) => {
					next(error);
				});
			}, (error) => {
				done(error, all);
			});
		});
	}
], (error, all) => {
	if (phan) {
		phan.exit();
	}
	if (error) {
		return console.error(error);
	}
	
	const now = Date.now();
	
	console.log('Printing assignments...');
	
	for (let site in all) {
		const assignments = all[site];
		assignments.forEach((assignment) => {
			const diff = Date.parse(assignment.dueDate) - now;
			if (diff > 0) {
				const days = Math.floor(diff / (60 * 60 * 1000 * 24));
				const hours = Math.floor((diff / (60 * 60 * 1000)) % 24);
				console.log(`${site} ${assignment.title} due in ${days} ${days == 1 ? 'day' : 'days'} and ${hours} ${hours == 1 ? 'hour' : 'hours'}`);
			}
		});
	}
});
