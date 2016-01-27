/// <reference path="typings/tsd.d.ts" />
'use strict';

var Casper = require('casper');

var casper = Casper.create();

var args = casper.cli.args;

var username = args[0];
var password = args[1];

var mode = args[2];

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
}

console.log('Using username: ' + username);

casper.start('https://login.gatech.edu/cas/login?service=https%3A%2F%2Ft-square.gatech.edu%2Fsakai-login-tool%2Fcontainer', function () {
	this.fill('form', {
		'username': username,
		'password': password
	}, true);
}).then(function () {
	var sites = this.evaluate(getSites);
	var out = '';
	var sitesArray = [];
	for (var i in sites) {
		out += i + ' ';
		if (i != 'My Workspace') {
			sitesArray.push(i);
		}
	}
	this.echo(out);
	
	var site = sitesArray[0];
	
	this.echo('Selecting ' + site);
	
	casper.open(sites[site]).then(function () {
		var tools = this.evaluate(getTools);
		var out = '';
		for (var i in tools) {
			out += i + ' ';
		}
		this.echo(out);
		
		casper.open(tools['Assignments']).then(function () {
			var iframe = this.evaluate(getAssignmentIFrameSrc);
			
			this.echo(iframe);
			
			casper.open(iframe).then(function () {
				
				
				this.exit();
			});
			
		});
	});
});

casper.run();