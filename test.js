var Bhiv = require('./Bhiv.js');

var bhiv = new Bhiv(function (a, b) {
  debugger;
});

var fn = new bhiv.Bee()
  .then('youpi')
  .end();

fn();