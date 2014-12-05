var fs = require('fs');
var colors = require('colors');
var async = require('async');
var xpath = require('xpath');
var dom = require('xmldom').DOMParser;
var exec = require('child_process').exec;
var yaml = require('js-yaml');
var spawn = require('child_process').spawn

exports.flowutils = new function() {

	var _log = new function() {
		this.log = function(message) {
			process.stdout.write(message);
		}
		this.logError = function(message) {
			process.stderr.write(message);
		}
		this.info = function(message) {
			console.log("[INFO] " + message);
		}
		this.error = function(error) {
			var message = "[ERROR] " + error;
			console.error(message.red);
		}
	}

	this._log = _log;

	var execute = function(cmd, callback) {
		exec(cmd, function(err, stdout, stderr) {
			_log.log(stdout);
			_log.logError(stderr);
			callback(err);
		});
	}

	this.execute = execute;

	this.createReleaseBranch = function(releaseName, options, callback) {
		var gitUrl = options.url;
		var branch = options.branch || "master";
		var f = function(url, callback) {
			_log.info("Git URL: " + url);
			_log.info("Branch: " + branch);
			_log.info("Creating release branch")
			process.chdir("..");
			var cmd = spawn("git", ["clone", "-b", branch, gitUrl, releaseName], {
				stdio: 'inherit'
			});
			cmd.on('close', function(code) {
				if (code > 0) {
					callback("Cloning the git repository failed");
				} else {
					process.chdir(releaseName);
					execute("git checkout -b " + releaseName, callback);
				}
			});
		}
		if (!gitUrl) {
			exec("git config --get remote.origin.url", function(err, stdout, stderr) {
				_log.logError(stderr);
				if (err) {
					callback(err);
				} else {
					gitUrl = stdout.replace("\n", "").replace("\r", "");
					f(gitUrl, callback);
				}
			})
		} else {
			f(gitUrl, callback);
		}
	}

	this.checkTravisConfig = function(callback) {
		var doc = yaml.safeLoad(fs.readFileSync('.travis.yml', 'utf8'));
		if (doc.branches && doc.branches.except && doc.branches.except.indexOf("/^v[0-9]/") > -1) {
			callback();
		} else {
			callback("Tags must be excluded from the Travis build");
		}
	}

	this.commit = function(version) {
		_log.info("Committing release " + version);
		var releaseName = "release-" + version;
		process.chdir("../" + releaseName);
		async.series([
				function(callback) {
					_log.info("Committing to git");
					execute("git commit -a -m 'Created " + releaseName + " from master'", callback);
				},
				function(callback) {
					_log.info("Pushing to git");
					var cmd = spawn("git", ["push", "origin", releaseName], {
						stdio: 'inherit'
					});
					cmd.on('close', function(code) {
						if (code > 0) {
							callback("Pushing the release branch to git failed");
						} else {
							callback();
						}
					});
				},
				function(callback) {
					_log.info("Creating tag v" + version);
					execute("git tag v" + version, callback);
				},
				function(callback) {
					_log.info("Pushing tag to git");
					cmd = spawn("git", ["push", "origin", "v" + version], {
						stdio: 'inherit'
					});
					cmd.on('close', function(code) {
						if (code > 0) {
							callback("Pushing the tag to git failed");
						} else {
							callback();
						}
					});
				}
			],
			function(err) {
				if (err) {
					_log.error(err);
				}
			}
		);
	}

};