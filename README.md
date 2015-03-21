# Bhiv.js

Bhiv is a utility module which provide a complete syntax to build an asynchronous workflow.

It provides also some basic features like EventEmitter, Object manipulation, or basic functions patterns.
It works on any side

## Dependency Injection (Development Only):

`javascript:(function(s){document.head.append(s);e.src='https://rawgit.com/bhiv/bhiv/master/Bhiv.js';})(document.createElement('script'));`

```html
<script src="https://rawgit.com/bhiv/bhiv/master/Bhiv.js"></script>

```sh
npm install --save bhiv

## Browser Multi Fetching Exemple
```javascript
// Assaming jQuery & Bhiv loaded

var fetchAllJsonpUrl = (function () {
  var priv = { jQuery: {}, console: {} };
  var bhiv = new Bhiv(priv);

  priv.console.log = function (data) { console.log('Requesting:', data.name, data.url); };

  priv.jQuery.request = function (data, callback) {
    var success = function (data) { return callback(null, data); };
    jQuery.ajax({ url: data.url, dataType: 'jsonp', success: success, error: callback });
  };

  return new bhiv.Bee()

    // iterating on the direct flow, key is named index, value named url
    .Map('.', 'name', 'url')

    // the following is synchronous, that's why '=' character
    .  then('= console.log')

    // requesting and storing the result into the content field
    .  then('jQuery.request', null, { 'content': '${.}' })

    // closing the loop (created by the Map keyword
    .close({ max: 3 })

    // finishing the workflow build
    .end();

})();

fetchJsonpUrl({ github: 'https://api.github.com', ip: 'http://jsonip.com' }, function (err, data) {
  console.log(err, data);
});
```

## Node Module Example

```javascript

var Bhiv = require('Bhiv');

module.exports = new function () {
  var priv = {};
  var bhiv = new Bhiv(priv, this);

  this.sayHello = new bhiv.Bee()
    .pipe('= getData', null, { words: '${.}' })
    .Map('words', null, 'word')
    .pipe('= uppercase', '${word}')
    .close()
    .pipe('= join', '${words}')
    .end();

  (function () {

    this.getData = function () {
      return ['hello', 'world'];
    };

    this.uppercase = function (word, callback) {
      return word.toUpperCase();
    };

    this.join = function (array) {
      return array.join(' ');
    };

  }).call(priv);

};

## See full syntax documentation into source code at Bee Builder Syntax
