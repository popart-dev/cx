var hbs = require('handlebars'),
	fs = require('fs');

exports.debug = function() {
  console.log("Current Context");
  console.log("====================");
  console.log(this);
}