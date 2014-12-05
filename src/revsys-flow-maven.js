var path = require('path');
var fs = require('fs');
var colors = require('colors');
var async = require('async');
var xpath = require('xpath');
var dom = require('xmldom').DOMParser;
var exec = require('child_process').exec;
var yaml = require('js-yaml');
var spawn = require('child_process').spawn;

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
					flowutils.createReleaseBranch(releaseName, options, callback);
				},
				function(callback) {
					fs.readFile("pom.xml", "UTF-8", function(err, content) {
						if (err) {
							callback(err);
						} else {
							var doc = new dom().parseFromString(content);
							var select = xpath.useNamespaces({
								"pom": "http://maven.apache.org/POM/4.0.0"
							});
							var nodes = select("//pom:build//pom:plugin[pom:artifactId='maven-enforcer-plugin']", doc);
							if (nodes.length == 0) {
								callback("You must have the Maven Enforcer Plugin enabled")
							} else {
								callback();
							}
						}
					});
				},
				function(callback) {
					flowutils.checkTravisConfig(callback);
				},
				function(callback) {
					_log.info("Setting version to " + version);
					execute("mvn versions:set -DnewVersion=" + version, callback);
				},
				function(callback) {
					execute("mvn versions:commit", callback);
				},
				function(callback) {
					_log.info("Running test build")
					execute("mvn clean install", callback);
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