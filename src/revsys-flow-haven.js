var path = require('path');
var fs = require('fs');
var colors = require('colors');
var async = require('async');
var xpath = require('xpath');
var dom = require('xmldom').DOMParser;
var exec = require('child_process').exec;
var yaml = require('js-yaml');
var spawn = require('child_process').spawn;
var haven = require('haven').haven;

var src = path.join(path.dirname(fs.realpathSync(__filename)), '.');
var flowutils = require(src + '/revsys-flow-utils').flowutils;

exports.flow = new function() {

	var _log = flowutils._log;

	var execute = flowutils.execute;

	this.run = function(method, args, options, flags, callback) {
		if (callback == null) {
			callback = function(err) {
				if (err != null) {
					_log.error(err.message);
				}
			};
		}
		if (method === "prepare") {
			this.prepare(args[0], options);
		} else if (method === "commit") {
			this.commit(args[0]);
		} else {
			console.error("Command not found: " + method);
		}
	};

	this.prepare = function(version, options) {
		_log.info("Preparing release " + version);
		var releaseName = "release-" + version;
		async.series([
				function(callback) {
					flowutils.createReleaseBranch(options.url, releaseName, callback);
				},
				function(callback) {
					try {
						haven.checkConfig();
						callback();
					} catch (err) {
						callback(e);
					}
				},
				function(callback) {
					_log.info("Setting version to " + version);
					try {
						haven.setVersion(version);
						callback();
					} catch (err) {
						callback(e);
					}
				},
				function(callback) {
					_log.info("Installing node packages");
					execute("npm install", callback);
				},
				function(callback) {
					_log.info("Running test build")
					execute("grunt dist", callback);
				},
			],
			function(err) {
				if (err) {
					_log.error(err);
				}
			}
		);
	}

	this.commit = flowutils.commit;

};