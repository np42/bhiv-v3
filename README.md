# Bhiv.js

Bhiv is a utility module which provide a complete syntax to build an asynchronous workflow.

It provides also some basic features like EventEmitter, Object manipulation, or basic functions patterns.

It works on any side

## Test:

`javascript:(function(s){document.head.appendChild(s);s.src='https://rawgit.com/np42/bhiv/master/Bhiv.js';})(document.createElement('script'));`

## Install:

```html
<!-- This is not a CDN so don't use it in production -->
<script src="https://rawgit.com/np42/bhiv/master/Bhiv.js"></script>
```

```sh
npm install --save bhiv
```

## Browser Multi Fetching Exemple
```javascript
// Assuming jQuery & Bhiv loaded

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
    .  then('jQuery.request', null, { url: '${url}', content: '${.}' })

    // closing the loop (created by the Map keyword, limit parallel execute to 3 tasks)
    .close({ max: 3 })

    // finishing the workflow build
    .end();

})();

fetchAllJsonpUrl
( { github: 'https://api.github.com', ip: 'http://jsonip.com' }
, function (err, data) { console.log(err, data); }
);
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
    .  pipe('= uppercase', '${word}')
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
```

## See full syntax documentation into source code at Bee Builder Syntax

Some methods:
```
 * Trap(<pattern>, <work>, <inglue>, <outglue>): do <work> if an error match <pattern>
 * Map(<path>, <key>, <value>): iter on <path> and do work for each elements
 *  -> replace the old list value by result
 * Go(<work>, <inglue>, <outglue>): create a une parallel waterfall
 * close(<properties>): close task, and set properties
 * emit(<event>, <data>): to emit an event (maybe catched by a bucket)
 * add(<glue>): allow you to add some thing in the flow
 * flatten(): flatten an inherited data structure
 * pipe(<work>, <inglue>, <outglue>): execute a task after the previous one if any
 *  -> replace the result
 * then(<work>, <inglue>, <outglue>): execute a task after the previous one if any
 *  -> merge the result
 * waterfall(<tasks>): do all tasks sequencially, with data replacing the previous one
 * bucket(<event>, <outglue>, <end>): retrieve data for an <event> even until the <end> event
 * extract(<glue>): extract <glue> pattern from data and keep only it
 * keep(<fields>): keep only field list
 * end(<data>, <callback>): execute the bee or wrap either the <data> or the <callback>
```