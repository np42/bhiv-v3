var Bhiv = require('../Bhiv.js');
var assert = require('assert');

var Bee = new Bhiv().Bee;

describe('Testing verbs', function () {

  describe('map', function () {

    it('test 1', function (cb) {
      new Bee()
        .map('!toto', function (a) { return a + 1 })
        .end({ toto: 41 }, function (err, result) {
          assert.ifError(err);
          assert.deepEqual(result, { toto: 42 });
          return cb();
        });
    });

    it('test 2', function (cb) {
      new Bee()
        .map('toto', function (a) { return a + 1 })
        .end({ toto: [41, 83] }, function (err, result) {
          assert.ifError(err);
          assert.deepEqual(result, { toto: [42, 84] });
          return cb();
        });
    });

    it('test 3', function (cb) {
      new Bee()
        .map('!toto', function (a) { return a.join('') })
        .end({ toto: [4, 2] }, function (err, result) {
          assert.ifError(err);
          assert.deepEqual(result, { toto: '42' });
          return cb();
        });
    });

    it('test 4', function (cb) {
      new Bee()
        .map('.', function (a) { return a * 2 })
        .end({ a: 2, b: 1 }, function (err, result) {
          assert.ifError(err);
          assert.deepEqual(result, { a: 4, b: 2 });
          return cb();
        });
    });

    it('test 5', function (cb) {
      new Bee()
        .map('!', function (a) { return [a.a, a.b].join('') })
        .end({ a: 4, b: 2 }, function (err, result) {
          assert.ifError(err);
          assert.deepEqual(result, '42');
          return cb();
        });
    });

    it('test 6', function (cb) {
      new Bee()
        .map('!n', function (a) { return { a: 42 } })
        .end({ n: { b: 'bad value' } }, function (err, result) {
          assert.ifError(err);
          assert.deepEqual(result, { n: { a: 42 } });
          return cb();
        });
    });

  });

  describe('breakIf', function () {

    it('test 1', function (cb) {
      new Bee().then({ a: 42 }).breakIf(true).then({ a: 12 })
        .end({}, function (err, result) {
          assert.ifError(err);
          assert.deepEqual(result, { a: 42 });
          return cb();
        });
    });

    it('test 2', function (cb) {
      new Bee().then({ a: 12 }).breakIf(false).then({ a: 42 })
        .end({}, function (err, result) {
          assert.ifError(err);
          assert.deepEqual(result, { a: 42 });
          return cb();
        });
    });

    it('test 3', function (cb) {
      new Bee()
        .Map('r', null, 'e')
        .  breakIf('${e.b}', { a: '${e.a}' })
        .  then(function (d) { return { a: d.e.a + 1 }; })
        .close({ max: 1 })
        .extract('${r}')
        .end({ r: [{ a: 1 }, { a: 2, b: true }, { a: 3 }] }, function (err, result) {
          assert.ifError(err);
          assert.deepEqual(result, [{ a: 2 }, { a: 2 }, { a: 4 }]);
          return cb();
        });
    });

  });

});