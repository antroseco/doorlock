"use strict";

const colors = require("colors");

function Timestamp() {
	return ('[' +  new Date().toUTCString() + ']').green;
};

module.exports.Log = function(User, Message, Details) {
	console.log(Timestamp(), User.white.bold, Message.white, Details.white.bold);
};

module.exports.Info = function(User, Message, Details) {
	console.info(Timestamp(), User.gray.bold, Message.gray, Details.gray.bold);
};

module.exports.Warn = function(User, Message, Details) {
	console.warn(Timestamp(), User.yellow.bold, Message.yellow, Details.yellow.bold);
};
