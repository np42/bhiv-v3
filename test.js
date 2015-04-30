var Bhiv = require('./Bhiv.js');

var helpers = { youpi: function () { console.log('youpi'); } };

var bhiv = new Bhiv(function (a, b) {
  if (helpers[a]) return b(null, helpers[a]);
  if (this.locals.bhiv_2) return b(null, this.locals.bhiv_2(a));
  return b();
});

var fn = new bhiv.Bee()
  .then('= youpi')
  .then('= toto')
  .end();

(function () {

  var execute = function (f) {
    if ('toto' == f) {
      return function () { console.log('toto'); }
    } else {
      return null;
    }
  };

  fn.call({ locals: { bhiv_2: execute } });

  console.log
  ( Bhiv.extract({ '${a}': { b: '${a}', c: '${b}', d: '${a} ${b}' } }, { a: 'hello' }, { b: 'world' })
  );

})();
