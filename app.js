#!/usr/bin/env node

/// <reference path="typings/main.d.ts" />
'use strict';

const path = require('path');
const phantomjs = require('phantomjs-prebuilt');
const phantom = require('phantom');
const prompt = require('prompt');
const async = require('async');
const minimist = require('minimist');

const phantomPathSlashes = phantomjs.path.split(/\/|\\/);
const phantomPath = phantomjs.path.substr(0, phantomjs.path.length - phantomPathSlashes[phantomPathSlashes.length - 1].length);

const loginUrl = 'https://login.gatech.edu/cas/login?service=https%3A%2F%2Ft-square.gatech.edu%2Fsakai-login-tool%2Fcontainer';

const argv = minimist(process.argv.slice(2));

function getSelectedSite(sites) {
	for (var i in sites) {
		if (sites[i].indexOf('#') > -1) {
			return i;
		}
	}
}

function getSelectedTool(tools) {
	for (var i in tools) {
		if (!tools[i]) {
			return i;
		}
	}
}

let phan = null;

async.waterfall([
	(done) => {
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
			done(null);
		});
	},
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
		}, (error, result) => {
			done(error, result);
		});
	},
	(auth, done) => {
		phan.createPage((page) => {
			done(null, auth, page);
		});
	},
	(auth, page, done) => {
		console.log('Logging in...');
		page.open(loginUrl, (status) => {
			done(status == 'success' ? null : status, auth, page);
		});
	},
	(auth, page, done) => {
		page.set('onLoadFinished', (success) => {
			done(success == 'success' ? null : success, page);
		});
		page.evaluate(function (auth) {
			var form = document.querySelector('form');
			form.username.value = auth.username;
			form.password.value = auth.password;
			form.submit.click();
		}, () => {
		}, auth);
	},
	(page, done) => {
		console.log('Logged in');
		page.set('onLoadFinished', null);
		page.evaluate(function () {
			// Will not get all sites if is selecting something other than My Workspace
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
		}, (sites) => {
			const classes = [];
			for (const i in sites) {
				if (i != 'My Workspace') {
					classes.push(i);
				}
			}
			const all = {};
			async.eachSeries(classes, (site, next) => {
				if (argv.v) {
					console.log(`\n#${site}`);
				}
				const siteUrl = sites[site];
				async.waterfall([
					(step) => {
						page.open(siteUrl, (status) => {
							step(status == 'success' ? null : status);
						});
					},
					(step) => {
						page.evaluate(function () {
							// Will not get all tools if is selecting something other than Home
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
						}, (tools) => {
							step(null, tools);
						});
					},
					(tools, step) => {
						const assignment = tools['Assignments'];
						if (assignment) {
							async.waterfall([
								(forward) => {
									page.open(assignment, (status) => {
										forward(status == 'success' ? null : status);
									});
								},
								(forward) => {
									page.evaluate(function () {
										return document.querySelector('.portletMainWrap iframe').src;
									}, (iframe) => {
										forward(null, iframe);
									});
								},
								(iframe, forward) => {
									page.open(iframe, (status) => {
										forward(status == 'success' ? null : status);
									});
								},
								(forward) => {
									page.evaluate(function () {
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
									}, (assignments) => {
										let first = !argv.v;
										const now = Date.now();
										assignments.forEach((assignment) => {
											const diff = Date.parse(assignment.dueDate) - now;
											if (diff > 0) {
												if (first) {
													console.log(`\n#${site}`);
													first = false;
												}
												if (argv.d) {
													console.log(`${assignment.title} - ${assignment.dueDate}`);
												} else {
													const days = Math.floor(diff / (60 * 60 * 1000 * 24));
													const hours = Math.floor((diff / (60 * 60 * 1000)) % 24);
													console.log(`${assignment.title} due in ${days} ${days == 1 ? 'day' : 'days'} and ${hours} ${hours == 1 ? 'hour' : 'hours'}`);
												}
											}
										});
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
});
