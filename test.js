var Bhiv = require('./Bhiv.js');


var async = function (a, c) {
  setTimeout(function () {
    if (a.url === 'url - 30') {
      debugger;
      return c('error');
    } else {
      return c(null, a.url);
    }
  }, (Math.random() * 150) | 0);
};

var bhiv = new Bhiv({ async: async });

var fn = new bhiv.Bee()
  .pipe({ list: '${.}' })
  .Map('list', null, 'pli')
  .  Trap().pipe({ error: true }).close()
  .  Map('pli', null, 'muk')
  .    then('async', { url: '${muk}', data: { 'content-type-request': 'json'} }, { body: '${.}' })
  .  close()
  .close({ max: 8 })
  .end();

var list = [];
for (var i = 0; i < 63; i++)
  list.push([{ value: 42 }, { value: 'url - ' + i }]);

fn(list, function (err, res) {
  for (var i = 0; i < 63; i++)
    console.log(res.list[i].pli);
});
