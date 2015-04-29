/*!
 *  Name: Bhiv
 *  Version: 3.1.22
 *  Date: 2015-04-29T16:00:00+01:00
 *  Description: Extended asynchronous execution controller with composer syntax
 *  Author: Nicolas Pelletier
 *  Maintainer: Nicolas Pelletier (nicolas [dot] pelletier [at] wivora [dot] fr)
 *  License: Released under the MIT license
 *  Flags: @preserve
 */
/**
 *  Pronounced: /bi hajv/ "Bee Hive"
 *
 *  Hello world:
 *    1. var bhiv = new Bhiv();
 *    2. var func = new bhiv.Bee().then(function (d, c) { return c(null, 'hello '+d) }).end();
 *    3. func('world', console.log.bind(console));
 *
 *  Lexique:
 *    - dsn: Data Source Name (e.g. my.data.is.located.into.several.sub.objects)
 *    - fsn: Function Source Name (e.g. My.Function.Name.Is.that)
 *    - type: Type to check validity and reformat data
 *      - intype: before executing a before
 *      - outtype: on function output
 *    - glue: Pattern defining how data have to be inserted into another one
 *      - inglue: before executing a before
 *      - outglue: on function output
 *
 *  Bhiv Constructor Arguments:
 *    - require(<fsn>, <callback>): facultative, a async function to require module
 *      object: it can be an object of functions
 *    - locals: facultative, a object populating locals
 *    - typer: facultative, a typer object
 *
 *  Bee Builder Syntax:
 *    Note:
 *      - keyword with first letter uppercased must be closed with .close()
 *      - for parallel tasks, you can limit execution by closing with object e.g. .close({ max: 2 })
 *    Behaviour settings keywords:
 *      - set(<key>, <data>): put <data> into locals (at compose time)
 *      - on(<event>, <listener>): add a listener to a event
 *      - wait(<slot>): define this bee can't start before a listener gift to <slot> has been called
 *    Workflow constructor keywords:
 *      - Trap(<pattern>, <work>, <inglue>, <outglue>): do <work> if an error match <pattern>
 *      - Map(<path>, <key>, <value>): iter on <path> and do work for each elements
 *        -> replace the old list value by result
 *      - Go(<work>, <inglue>, <outglue>): create a une parallel waterfall
 *      - close(<properties>): close task, and set properties
 *      - emit(<event>, <data>): to emit an event (maybe catched by a bucket)
 *      - add(<glue>): allow you to add some thing in the flow
 *      - pipe(<work>, <inglue>, <outglue>): execute a task after the previous one if any
 *        -> replace the result
 *      - then(<work>, <inglue>, <outglue>): execute a task after the previous one if any
 *        -> merge the result
 *      - waterfall(<tasks>): do all tasks sequencially, with data replacing the previous one
 *      - bucket(<event>, <outglue>, <end>): retrieve data for an <event> even until the <end> event
 *      - extract(<glue>): extract <glue> pattern from data and keep only it
 *      - keep(<fields>): keep only field list
 *      - end(<data>, <callback>): execute the bee or wrap either the <data> or the <callback>
 *
 *  Bee Context Methods:
 *    - abort(): to stop the execution (terminate after all pending asynchronous call)
 *    - get(<key>): to retrieve a value stored in the locals
 *    - emit(<event>, <data>): to emit a event (may be catched by on or bucket keywork)
 *    - bee(): to create a sub workflow conserving events and locals
 *
 *  Bee Glue Pattern Syntax:
 *    Note:
 *      - Only serializable json is allowed
 *      - To inject data use "${" as opener and "}" as closer
 *    Examples:
 *      - { some: { my_key: 'text', '${key}': 42, from: '${path.to.my.variable}' } }
 *      - ['${a}', 'toto-${b}']
 *      - 'some text'
 *
 *  Bee Match Pattern Syntax:
 *    - TODO
 *
 *  Module Properties:
 *    - method(<input>, <callback>): a asynchronous function to execute
 *    - intype: facultative, the type which be used to format input
 *    - outtype: the type which be used to format the output
 *
 *  Typer Properties:
 *    - process(<type>, <data>, <callback>): The only method to format data
 *
 *  Roadmap v3.2:
 *    - timeout for bee
 *    - stacktrace
 *    - integrate the typer
 *    - renew the stack to avoid stack overflow
 *    - split Map Task in two object (Map / Each)
 *
 *  Roadmap v3.3:
 *    - add unabortable sequence (for transactions)
 *    - add suspend() and resume() method to the context
 *
 *  TODO:
 *    - codify errors
 *    - fix callback missing error when an error is throwed inside a parallel
 *    - use event emitter instead of the lite one
 *
 */

var globalize = function (alpha) {
  if (typeof module != 'undefined') module.exports = alpha;
  else if (typeof window != 'undefined') window[alpha.name] = alpha;
  else if (typeof global != 'undefined') global[alpha.name] = alpha;
  return alpha;
};

var Bhiv = globalize(function Bhiv(require, locals, typer) {
  'use strict';

  /***************/
  var parseTask = function (work, inglue, outglue) {
    if (work == null) work = function (data, callback) { return callback(); };
    if (typeof work.type === 'function' && work instanceof work.type) return work;

    var task = null;

    if (typeof work === 'string') {
      var isSync = /^\s*=\s*/.exec(work);
      if (isSync) {
        task = new Task.Synchronous();
        work = work.substr(isSync[0].length);
      } else {
        task = new Task.Asynchronous();
      }
      task.fsn = work;
      var module = Bhiv.getIn(options.module, work);
      if (module) {
        task.method = module.method;
        if (module.scope) task.scope = module.scope;
        if (module.input) task.input = module.input;
      }
    } else if (typeof work === 'function') {
      var task = new Task.Asynchronous();
      task.method = work;
      task.fsn = work.name || Bhiv.generateId('Function.Anonymous');
    } else if (typeof work === 'object') {
      var task = new Task.Merge();
      task.glue = work;
    } else {
      throw Bhiv.Error('Unable to produce a valide Asynchronous Task');
    }

    if (inglue) task.inglue = inglue;
    if (outglue) task.outglue = outglue;

    return task;
  };

  var parseTaskPipe = function (then) {
    return Bhiv.pipe.call(this, parseTask, then);
  };

  var functionFinalized = function () {
    throw Bhiv.Error('This function is disbaled because the bee has been finalized');
  };

  var beeNotRunning = function () {
    throw Bhiv.Error('This function can be run only when running a bee');
  };

  /***************/

  var bhiv = this;

  var options = new (function BhivOption(require, locals, typer) {
    this.modules = {};
    switch (typeof require) {
    case 'object':
      this.require = Bhiv.serve(require);
      break ;
    case 'function':
      this.require = Bhiv.throttleCache(require, this.modules);
      break ;
    }
    this.typer   = typer;
    this.locals  = locals || {};
  })(require, locals, typer);

  /***************/

  /* Bhiv Tasks Declation */

  var Task = new function () {
    var Task = this;

    /* Simple */

    this.Simple = function SimpleTask() { this.type = SimpleTask; };

    this.Simple.prototype.execute = function (runtime) {
      return runtime.callback.pop()(null, runtime);
    };

    this.Simple.prototype.clone = function () {
      var task = new this.type();
      for (var i in this)
        if (this.hasOwnProperty(i)) {
          if (i === 'type') continue ;
          switch (Object.prototype.toString.call(this[i])) {
          case '[object Array]':
            task[i] = this[i].slice();
            break ;
          case '[object Object]':
            task[i] = {};
            for (var j in this[i])
              task[i][j] = this[i][j];
            break ;
          default:
            task[i] = this[i];
            break ;
          }
        }
      return task;
    };

    /* Closable */
    this.Closable = function ClosableTask() { this.type = ClosableTask; };

    this.Closable.prototype = new this.Simple();

    this.Closable.prototype.end = function () {};

    /* Concurent */

    this.Concurent = function ConcurentTask() { this.type = ConcurentTask; };

    this.Concurent.prototype = new this.Closable();

    /* Asynchronous */

    this.Asynchronous = function AsynchronousTask() {
      this.type    = AsynchronousTask;
      this.fsn     = null;
      this.method  = null;
      this.intype  = null;
      this.outtype = null;
      this.scope   = null;
      this.inglue  = null;
      this.outglue = null;
      this.replace = false;
    };

    this.Asynchronous.prototype = new this.Simple();

    this.Asynchronous.prototype.execute = function (runtime) {
      var async = this;
      if (runtime.status.aborted)
        return runtime.callback.pop()(Bhiv.Error('Aborted at: ' + runtime.id), runtime);
      this.lookup(runtime, function (error) {
        if (error) return (runtime.callback.pop() || Bhiv.noop)(error, runtime);
        var data = async.prepare(runtime);
        return async.method.call(data.context, data.input, Bhiv.callTimes(function (error, output) {
          if (error) return (runtime.callback.pop() || Bhiv.noop)(Bhiv.Error(error), runtime);
          if (arguments.length === 2) async.insertOutput(runtime, output);
          return runtime.callback.pop()(null, runtime);
        }));
      });
    };

    this.Asynchronous.prototype.lookup = function (runtime, callback) {
      var async = this;
      if (typeof this.method !== 'function') {
        if (typeof this.fsn === 'string')
          return this.invokeMethod(callback);
        else
          return callback(Bhiv.Error('Not enough element to execute this task'));
      } else {
        return callback();
      }
    };

    this.Asynchronous.prototype.prepare = function (runtime) {
      this.populate();
      var input = this.extractInput(runtime);
      var context = new Context(runtime);
      return { context: context, input: input };
    };

    this.Asynchronous.prototype.invokeMethod = function (callback) {
      var async = this;
      options.require(this.fsn, function (err, module) {
        if (err) return callback(err);
        if (module == null) {
          debugger;
          return callback(Bhiv.Error('method not found: ' + async.fsn, 'ERRFNNOTFOUND'));
        }
        if (typeof module === 'function') {
          async.method = module;
        } else if (typeof module.method === 'function') {
          async.method = module.method
        } else {
          return callback(Bhiv.Error('Unable to define a method: ' + async.fsn));
        }
        return callback();
      });
    };

    this.Asynchronous.prototype.populate = function () {
      if (!this.fsn) return ;
      var module = options.modules[this.fsn];
      if (!module) return ;
      if (!this.intype && module.intype) module.intype = this.intype;
      if (!this.outtype && module.outtype) module.outtype = this.outtype;
      if (!this.scope && module.scope) module.scope = this.scope;
    };

    this.Asynchronous.prototype.extractInput = function (runtime) {
      if (this.inglue == null) {
        return runtime.data;
      } else {
        return Bhiv.extract(this.inglue, runtime.data);
      }
    };

    this.Asynchronous.prototype.insertOutput = function (runtime, output) {
      var alpha = this.outglue == null ? output : Bhiv.extract(this.outglue, output);
      if (this.replace) {
        runtime.data = alpha;
      } else {
        runtime.data = Bhiv.ingest(runtime.data, alpha);
      }
    };

    /* Synchronous */

    this.Synchronous = function SynchronousTask() {
      this.type  = SynchronousTask;
      this.fsn     = null;
      this.method  = null;
      this.intype  = null;
      this.outtype = null;
      this.scope   = null;
      this.inglue  = null;
      this.outglue = null;
      this.replace = false;
    };

    this.Synchronous.prototype = new this.Asynchronous();

    this.Synchronous.prototype.execute = function (runtime) {
      var sync = this;
      if (runtime.status.aborted)
        return runtime.callback.pop()(Bhiv.Error('Aborted at: ' + runtime.id), runtime);
      this.lookup(runtime, function (error) {
        if (error) return (runtime.callback.pop() || Bhiv.noop)(error, runtime);
        var data = sync.prepare(runtime);
        try {
          var output = sync.method.call(data.context, data.input);
        } catch (error) {
          return runtime.callback.pop()(error, runtime);
        }
        if (output != null) sync.insertOutput(runtime, output);
        return runtime.callback.pop()(null, runtime);
      });
    };

    /* Waterfall */

    this.Waterfall = function WaterfallTask() {
      this.type  = WaterfallTask;
      this.tasks = [];
    };

    this.Waterfall.prototype = new this.Simple();

    this.Waterfall.prototype.execute = function (runtime) {
      return (function loop(waterfall, index, runtime) {
        if (waterfall.tasks.length === index) {
          return runtime.callback.pop()(null, runtime);
        } else {
          runtime.callback.push(function WaterfallCallback(error, runtime) {
            if (error) return (runtime.callback.pop() || Bhiv.noop)(error, runtime);
            return loop(waterfall, index + 1, runtime);
          });
          return waterfall.tasks[index].execute(runtime);
        }
      })(this, 0, runtime);
    };

    /* Parallel */
    this.Parallel = function ParallelTask(max) {
      this.type    = ParallelTask;
      this.tasks   = [];
      this.max     = max || Infinity;
      this.replace = false;
    };

    this.Parallel.prototype = new this.Concurent();

    this.Parallel.prototype.execute = function (initialRuntime) {
      var failure = null;
      var result = null;
      var space = { done: 0, running: 0 };
      return (function loop(parallel, space, runtime) {
        if (failure) {
          return ; // kill the loop
        } else if (space.done === parallel.tasks.length) {
          if (parallel.replace) {
            initialRuntime.data = result;
          } else {
            initialRuntime.data = Bhiv.ingest(initialRuntime.data, result);
          }
          return initialRuntime.callback.pop()(null, initialRuntime);
        } else {
          while (space.running < parallel.max && space.done + space.running < parallel.tasks.length)
            (function (task) {
              space.running += 1;
              var newRuntime = runtime.fork();
              newRuntime.callback.push(function ParallelCallback(error, runtime) {
                space.running -= 1;
                space.done += 1;
                if (error) {
                  failure = error;
                  return (initialRuntime.callback.pop() || Bhiv.noop)(error, initialRuntime);
                }
                if (parallel.fromMap) {
                  initialRuntime.data = runtime.data;
                  return loop(parallel, space, initialRuntime);
                } else {
                  result = Bhiv.merge(result, runtime.data);
                  return loop(parallel, space, initialRuntime);
                }
              });
              return task.execute(newRuntime);
            })(parallel.tasks[space.done + space.running]);
        }
      })(this, space, initialRuntime);
    };

    /* Map */
    this.Map = function MapTask() {
      this.type     = MapTask;
      this.source   = null;
      this.key      = null;
      this.value    = null;
      this.task     = new Task.Waterfall();
      this.max      = Infinity;
    };

    this.Map.prototype = new this.Concurent();

    this.Map.prototype.execute = function (runtime) {
      if (!runtime.data || typeof runtime.data !== 'object')
        if (error) return runtime.callback.pop()(null, runtime);
      var map    = this;
      var space  = { done: 0, running: 0, tasks: [], failure: null, result: null };
      var source = Bhiv.getIn(runtime.data, map.source);
      if (source instanceof Array) {
        space.result = new Array(source.length);
        for (var i = 0; i < source.length; i++)
          space.tasks.push({ key: i, value: source[i] });
      } else if (source && typeof source === 'object') {
        space.result = {};
        for (var i in source)
          space.tasks.push({ key: i, value: source[i] });
      } else {
        return runtime.callback.pop()(null, runtime);
      }
      return this.loop(runtime, space);
    };

    this.Map.prototype.loop = function (runtime, space) {
      var map = this;
      if (space.running < 1 && space.tasks.length < 1)
        return this.returns(runtime, space);
      if (space.running >= map.max || space.tasks.length < 1) return ;
      space.running += 1;
      var task = space.tasks.shift();
      var newRuntime = runtime.fork(false);
      var iterator = Object.create(runtime.data);
      if (typeof map.key === 'string') iterator[map.key] = task.key;
      if (typeof map.value === 'string') iterator[map.value] = task.value;
      newRuntime.data = Object.create(iterator);
      newRuntime.callback.push(function (error, newRuntime) {
        space.running -= 1;
        space.done += 1;
        if (space.failure) return ;
        if (error) {
          task.error = error;
          space.failure = task;
          return runtime.callback.pop()(task, runtime);
        }
        map.processResult(runtime, space, task, newRuntime.data);
        return map.loop(runtime, space);
      });
      map.task.execute(newRuntime);
      return space.tasks.length <= 0 ? Bhiv.noop() : this.loop(runtime, space);
    };

    this.Map.prototype.returns = function (runtime, space) {
      if (!this.source || this.source === '.')
        runtime.data = space.result;
      else
        Bhiv.setIn(runtime.data, this.source, space.result);
      return runtime.callback.pop()(null, runtime);
    };

    this.Map.prototype.processResult = function (runtime, space, task, data) {
      if (data && typeof data === 'object') {
        if (data.contructor === Array) {
          return space.result[task.key] = data.slice();
        } else {
          var record = task.value  && typeof task.value === 'object' ? Object.create(task.value) : {};
          var altered = false;
          for (var key in data) {
            if (data.hasOwnProperty(key)) {
              record[key] = data[key];
              altered = true;
            }
          }
          if (!altered) return space.result[task.key] = task.value;
          return space.result[task.key] = record;
        }
      }
      return space.result[task.key] = data;
    };

    /* Each */
    this.Each = function EachTask() {
      this.type = EachTask;
      this.task = new Task.Waterfall();
    };

    this.Each.prototype = new this.Map();

    this.Each.prototype.processResult = function (runtime, space, task, data) {
      runtime.data = Bhiv.merge(runtime.data, data);
    };

    this.Each.prototype.returns = function (runtime, space) {
      return runtime.callback.pop()(null, runtime);
    };

    /* Trap */
    this.Trap = function TrapTask(pattern, task) {
      this.type    = TrapTask;
      this.pattern = pattern || {};
      this.task    = task || null;
    };

    this.Trap.prototype = new this.Closable();

    this.Trap.prototype.execute = function (runtime) {
      if (runtime.callback.length > 1) {
        var trap = this;
        var parentIndex = runtime.callback.length - 2;
        var parentCallback = runtime.callback[parentIndex];
        runtime.callback[parentIndex] = function TrapCallback(error, runtime) {
          if (!error) return parentCallback(null, runtime);
          if (!Bhiv.match(trap.pattern, error)) return parentCallback(error, runtime);
          runtime.callback.push(parentCallback);
          runtime.data = Bhiv.ingest(runtime.data, { error: error });
          return trap.task.execute(runtime);
        };
      }
      return runtime.callback.pop()(null, runtime);
    };

    /* Merge */
    this.Merge = function MergeTask(glue) {
      this.type    = MergeTask;
      this.glue    = glue || null;
      this.replace = false;
    };

    this.Merge.prototype = new this.Simple();

    this.Merge.prototype.execute = function (runtime) {
      var alpha = Bhiv.extract(this.glue, runtime.data);
      runtime.data = this.replace ? alpha : Bhiv.merge(runtime.data, alpha);
      return runtime.callback.pop()(null, runtime);
    };

    /* Bucket */
    this.Bucket = function TaskBucket(event, outglue) {
      this.type      = TaskBucket;
      this.id        = Bhiv.generateId('Bhiv.Task.Bucket');
      this.event     = event;
      this.outglue   = outglue || null;
      this.customEnd = null;
    };

    this.Bucket.prototype = new this.Simple();

    this.Bucket.prototype.execute = function (runtime) {
      var bucket = this;
      var space = runtime.temp[this.id];
      if (bucket.customEnd === null) space.terminated = true;
      if (space.terminated)
        return this.next(runtime, space.chunks);
      else
        space.callback = function (chunks) { bucket.next(runtime, chunks); };
    };

    this.Bucket.prototype.receive = function (runtime, chunk) {
      runtime.temp[this.id].chunks.push(chunk);
    };

    this.Bucket.prototype.terminate = function (runtime) {
      var space = runtime.temp[this.id];
      space.terminated = true;
      if (typeof space.callback)
        return setImmediate(space.callback, space.chunks);
    };

    this.Bucket.prototype.next = function (runtime, chunks) {
      if (this.outglue == null) {
        runtime.data = chunks;
      } else {
        var data = {};
        data[this.event] = chunks;
        var alpha = Bhiv.extract(this.outglue, data);
        alpha = Bhiv.extract(alpha, runtime.data);
        runtime.data = Bhiv.merge(runtime.data, alpha);
      }
      return runtime.callback.pop()(null, runtime);
    };

    /***************/
    for (var constructor in this) {
      if (typeof this[constructor] !== 'function') continue ;
      this[constructor].valueOf = (function (name) {
        var constructorName = '[BhivTask ' + name + ']';
        return function () { return constructorName; };
      })(constructor);
    }

  };

  /***************/
  /* Bee Construction Breadcrumb */
  var Breadcrumb = function () {
    this._path = [];
  };

  Breadcrumb.prototype.add = function (/* task, ... */) {
    for (var i = 0; i < arguments.length; i++)
      this._path.unshift(arguments[i]);
    return i;
  };

  Breadcrumb.prototype.count = function () {
    return this._path.length;
  };

  Breadcrumb.prototype.has = function (type) {
    if (!(type instanceof Array)) type = [type];
    for (var i = 0; i < this._path.length; i++) {
      var current = this._path[i];
      if (~type.indexOf(current.type))
        return true;
      else if (current instanceof Task.Closable)
        return false;
    }
    return false;
  };

  Breadcrumb.prototype.hasClosable = function () {
    for (var i = 0; i < this._path.length; i++) {
      if (this._path[i] instanceof Task.Closable)
        return true;
    }
    return false;
  };

  Breadcrumb.prototype.get = function (type) {
    if (!type) return this._path[0] || null;
    if (!(type instanceof Array)) type = [type];
    for (var i = 0; i < this._path.length; i++)
      if (~type.indexOf(this._path[i].type)) return this._path[i];
    return null;
  };

  Breadcrumb.prototype.getClosable = function () {
    for (var i = 0; i < this._path.length; i++)
      if (this._path[i] instanceof Task.Closable)
        return this._path[i];
    return null;
  };

  Breadcrumb.prototype.remove = function (type, included) {
    if (!type) return this._path.splice(0, Infinity);
    if (!(type instanceof Array)) type = [type];
    for (var i = 0; i < this._path.length; i++) {
      var currentType = this._path[i].type;
      if (~type.indexOf(currentType)) break ;
    }
    if (included && ~type.indexOf(currentType)) i++;
    return this._path.splice(0, i);
  };

  /***************/

  /* Bee Runtime */
  var Runtime = function BeeRuntime(id, callback) {
    this.id = Bhiv.generateId(id);
    this.callback = [];
    if (!callback) this.callback.push(Bhiv.noop);
    else this.callback.push(function FinalCallback(err, runtime) {
      if (err) return callback(err);
      return callback(null, runtime.data);
    });
  };

  Runtime.prototype.fork = function (keepCallbacks) {
    var runtime = new Runtime(this.id);
    for (var key in this) {
      if (!this.hasOwnProperty(key)) continue ;
      if (key in runtime) continue ;
      runtime[key] = this[key];
    }
    if (runtime.data instanceof Object)
      runtime.data = Object.create(runtime.data);
    runtime.callback = keepCallbacks ? this.callback : [];
    return runtime;
  };

  /* Bee Runtime Context */
  var Context = function BeeRuntimeContext(runtime) {
    this.bee = function () {
      return new bhiv.Bee(runtime);
    };

    this.pipe = function () {
      if (arguments.length === 0) return new bhiv.Bee(runtime);
      var bee = new bhiv.Bee(runtime);
      return bee.pipe.apply(bee, arguments);
    };

    this.then = function () {
      if (arguments.length === 0) return new bhiv.Bee(runtime);
      var bee = new bhiv.Bee(runtime);
      return bee.then.apply(bee, arguments);
    };

    this.get = function (key) {
      return Bhiv.getIn(runtime.locals, key);
    };

    this.emit = function (event, data) {
      var emitter = runtime.events[event];
      if (typeof emitter === 'function') emitter(runtime, data);
      return this;
    };

    this.abort = function () {
      runtime.status.aborted = true;
      return this;
    };
  };

  /***************/

  /* set */
  this.set = function (key, value) {
    Bhiv.setIn(options.locals, key, value);
    return this;
  };

  this.execute = function (fsn, data, callback) {
    return new bhiv.Bee().pipe(fsn).end(data, callback || Bhiv.noop);
  };

  /* Bee */
  this.Bee = function Bee(_runtime) {
    if (!_runtime) _runtime = {};

    var bee     = this;
    var ready   = true;
    var onReady = [];

    this._workflow   = null;
    this._breadcrumb = new Breadcrumb();

    this._id     = _runtime.id || Bhiv.generateId('Bhiv.Bee.id');
    this._temp   = {};
    this._locals = Object.create(_runtime.locals ? _runtime.locals : options.locals);
    this._events = _runtime.events ? Object.create(_runtime.events) : {};

    this._createRuntime = function (data, callback) {
      var runtime = new Runtime(this._id, callback);
      runtime.status   = _runtime.status || { aborted: false };
      runtime.data     = data;
      runtime.locals   = Object.create(this._locals);
      runtime.events   = Object.create(this._events);
      runtime.temp     = Bhiv.extract(this._temp);
      runtime.context  = new Context(runtime);
      return runtime;
    };

    this._finalize = function () {
      delete this._breadcrumb;
      for (var keyword in Bee.prototype)
        bee[keyword] = functionFinalized;
    };

    this._ready = function (status) {
      ready = !!status;
      if (ready)
        while (onReady.length > 0)
          onReady.shift()();
    };

    this._execute = function (data, callback) {
      if (this._breadcrumb) throw Bhiv.Error('This bee is not finalized');
      var workflow = this._workflow;
      if (workflow == null) return callback(null, data);
      var runtime = this._createRuntime(data, callback);
      if (!ready) {
        onReady.push(function () { workflow.execute(runtime); });
      } else {
        workflow.execute(runtime);
      }
      return runtime.context;
    };

  };

  /* Compile Time Method */

  /* .on */
  this.Bee.prototype.on = function (event, listener) {
    if (this._events.hasOwnProperty(event))
      throw Bhiv.Error('can not bind "'+event+'" because it is already used');
    this._events[event] = listener;
    return this;
  };

  /* .set */
  this.Bee.prototype.set = function (dsn, value) {
    Bhiv.setIn(this._locals, dsn, value);
    return this;
  };

  /* .get */
  this.Bee.prototype.get = function (dsn) {
    return Bhiv.getIn(this._locals, dsn);
  };

  /* .wait */
  this.Bee.prototype.wait = function (slot) {
    var bee = this;
    if (this._workflow) throw new Bhiv.Error('Usage of "wait" have to be first');
    bee._ready(false);
    slot(function () { bee._ready(true); });
    return this;
  };

  /* Contruction Methods */

  /* .end */
  this.Bee.prototype.end = function end(data, callback) {
    var bee = this;
    this._finalize();
    switch (arguments.length) {
    case 0:
      return function (data, callback) { return bee._execute(data, callback); };
    case 1:
      if (typeof arguments[0] == 'function')
        return function (data) { return bee._execute(data, callback); };
      else
        return function (callback) { return bee._execute(data, callback); };
    case 2: default:
      if (typeof callback == 'function')
        return bee._execute(data, callback);
      else
        return function (callback) { return bee._execute(data, callback); };
    }
  };

  /* .then */
  this.Bee.prototype.then = parseTaskPipe(function (task) {
    if (this._breadcrumb.has(Task.Waterfall)) {
      // is in waterfall
      var waterfall = this._breadcrumb.get(Task.Waterfall);
      waterfall.tasks.push(task);
      this._breadcrumb.remove(Task.Waterfall);
      this._breadcrumb.add(task);

    } else if (this._breadcrumb.hasClosable()) {
      // is in closable without waterfall
      var chainedTask = this._breadcrumb.getClosable();
      var waterfall = new Task.Waterfall();
      if (chainedTask.tasks instanceof Array) {
        var key = chainedTask.tasks.length - 1;
        var last = chainedTask.tasks[key];
        waterfall.tasks.push(last, task);
        chainedTask.tasks[key] = waterfall;
      } else if (chainedTask.task) {
        waterfall.tasks.push(chainedTask.task, task);
        chainedTask.task = waterfall;
      } else {
        throw Bhiv.Error('Unknow where to add this task');
      }
      this._breadcrumb.remove(chainedTask.type);
      this._breadcrumb.add(waterfall, task);

    } else if (this._workflow == null) {
      // is the first task
      this._workflow = task;
      this._breadcrumb.add(task);

    } else if (this._breadcrumb.count() <= 1) {
      // is the second task then wrapped into a waterfall
      var last = this._workflow;
      var waterfall = new Task.Waterfall();
      if (last != null) waterfall.tasks.push(last)
      waterfall.tasks.push(task);
      this._workflow = waterfall;
      this._breadcrumb.remove();
      this._breadcrumb.add(waterfall, task);

    } else {
      debugger;
      throw Bhiv.Error('usage of "then" in unknown situation');
    }
    return this;
  });

  /* .pipe */
  this.Bee.prototype.pipe = parseTaskPipe(function (task) {
    task.replace = true;
    return this.then(task);
  });

  /* .Map */
  this.Bee.prototype.Map = function (source, key, value) {
    var map    = new Task.Map();
    map.source = source;
    map.key    = key || null;
    map.value  = value || null;

    if (this._breadcrumb.has(Task.Concurent))
      map.max = 1;

    this.then(map);
    this._breadcrumb.add(map.task);
    return this;
  };

  /* .Each */
  this.Bee.prototype.Each = function (source, key, value) {
    var each    = new Task.Each();
    each.source = source;
    each.key    = key || null;
    each.value  = value || null;

    if (this._breadcrumb.has(Task.Concurent))
      each.max = 1;

    this.then(each);
    this._breadcrumb.add(each.task);
    return this;
  };

  /* .Go */
  this.Bee.prototype.Go = parseTaskPipe(function (task) {
    if (this._breadcrumb.has(Task.Parallel)) {
      // is in parallel
      var parallel = this._breadcrumb.get(Task.Parallel);
      parallel.tasks.push(task);
      this._breadcrumb.remove(Task.Parallel);
      this._breadcrumb.add(task);

    } else {
      // create a new parallel
      var parallel = new Task.Parallel();
      parallel.tasks.push(task);

      if (this._breadcrumb.has(Task.Waterfall, [Task.Parallel])) {
        // is in waterfall
        var waterfall = this._breadcrumb.get(Task.Waterfall);
        waterfall.tasks.push(parallel);
        this._breadcrumb.remove(Task.Waterfall);
        this._breadcrumb.add(parallel, task);

      } else if (this._workflow == null) {
        // is the first task
        this._workflow = parallel;
        this._breadcrumb.add(parallel, task);

      } else if (this._breadcrumb.count() <= 1) {
        // is the second task then wrapped into a waterfall
        var last = this._workflow;
        var waterfall = new Task.Waterfall();
        if (last != null) waterfall.tasks.push(last)
        waterfall.tasks.push(task);
        this._workflow = waterfall;
        this._breadcrumb.remove();
        this._breadcrumb.add(waterfall, parallel, task);

      } else {
        debugger;
        throw Bhiv.Error('usage of "go" in unknown situation');
      }
    }
    return this;
  });

  /* .Trap */
  this.Bee.prototype.Trap = function (pattern, work, inglue, outglue) {
    var task = parseTask(work, inglue, outglue);
    var trap = new Task.Trap(pattern, task);
    return this.then(trap);
  };

  /* .close */
  this.Bee.prototype.close = function (properties) {
    if (this._breadcrumb.hasClosable()) {
      // is in closable
      var task = this._breadcrumb.getClosable();
      task.end();
      for (var key in properties) task[key] = properties[key];
      this._breadcrumb.remove(task.type, true);
    } else {
      debugger;
      throw Bhiv.Error('usage of "close" in unknown situation');
    }
    return this;
  };

  /* .trap */
  this.Bee.prototype.trap = function () {
    return this.Trap.apply(this, arguments).close();
  };

  /* .emit */
  this.Bee.prototype.emit = function (event, value) {
    var task = new Task.Synchronous();
    task.method = function (data) { this.emit(event, Bhiv.extract(value, data)); };
    return this.then(task);
  };

  /* .extract */
  this.Bee.prototype.extract = function (glue, outpath) {
    var task = new Task.Synchronous();
    task.replace = true;
    task.method = function (data) {
      var extract = Bhiv.extract(glue, data);
      if (!outpath) return extract;
      Bhiv.setIn(data, outpath, extract);
      return data;
    };
    return this.then(task);
  };

  /* .keep */
  this.Bee.prototype.keep = function (fields) {
    if (arguments.length === 0) fields = [];
    else if (!(fields instanceof Array)) fields = [fields];
    var task = new Task.Synchronous();
    task.replace = true;
    task.method = function (data) {
      var newData = {};
      for (var i = 0; i < fields.length; i++) {
        var value = Bhiv.getIn(data, fields[i]);
        if (value != null) Bhiv.setIn(newData, fields[i], value);
      }
      return newData;
    };
    return this.then(task);
  };

  /* .waterfall */
  this.Bee.prototype.waterfall = function (tasks) {
    for (var i = 0; i < tasks.length; i++) this.pipe(tasks[i]);
    return this;
  };

  /* .bucket */
  this.Bee.prototype.bucket = function (dataEvent, outglue, endEvent) {
    var bee = this;
    var bucket = new Task.Bucket(dataEvent, outglue);
    this._temp[bucket.id] = { chunks: [], terminated: false, callback: null };
    this.on(dataEvent, function (runtime, chunk) { return bucket.receive(runtime, chunk); })
    if (typeof endEvent == 'string') {
      bucket.customEnd = endEvent;
      this.on(endEvent, function (runtime) { return bucket.terminate(runtime); });
    }
    return this.then(bucket);
  };

  /* .add */
  this.Bee.prototype.add = function (glue) {
    return this.then(new Task.Merge(glue));
  };

  /* .flatten */
  this.Bee.prototype.flatten = function () {
    var task = parseTask(function (data, callback) {
      return callback(null, Bhiv.flatten(data));
    });
    return this.then(task);
  };

  /* .dump */
  this.Bee.prototype.dump = function (glue) {
    var task = new Task.Synchronous();
    task.inglue = glue || null;
    task.method = function (data) { console.log(data); };
    return this.then(task);
  };

  /* .debug */
  this.Bee.prototype.debug = function () {
    var task = new Task.Synchronous();
    task.method = function (data) { debugger; };
    return this.then(task);
  };


});

/***********************************/

Bhiv.Error = function (msg, code) {
  var error = null;
  if (msg instanceof Error)
    error = msg;
  else if (msg instanceof Object && typeof msg.message === 'string')
    error = new Error(msg.message);
  else if (typeof msg === 'string')
    error = new Error(msg);
  var BhivError = function BhivError(code) {
    if (code) this.code = code;
  };
  BhivError.prototype = error;
  return new BhivError(code);
};

Bhiv.toString = function () { return '[Contructor Bhiv]'; };

Bhiv.noop = function () {};
Bhiv.identity = function (data, callback) { return callback(null, data); };

Bhiv.pipe = function (f1, f2) {
  return function () { return f2.call(this, f1.apply(this, arguments)); };
};

Bhiv.dotSplit = /\s*\.\s*/;

Bhiv.getIn = function (source, path, alternative) {
  if (path === '.') return source;
  if (source instanceof Object) {
    if (typeof path === 'string') {
      var chain = path.split(Bhiv.dotSplit);
      for (var i = 0, l = chain.length, node = source; i < l; ++i) {
        if (node == null) break ;
        node = node[chain[i]];
      }
      if (i == l && node != null) return node;
    } else if (path in source) {
      return source[path];
    }
  }
  if (alternative != null) {
    Bhiv.setIn(source, path, alternative);
    return alternative;
  }
  return null;
};

Bhiv.setIn = function (target, path, value) {
  var chain = ('' + path).split(Bhiv.dotSplit);
  while (chain.length > 0) {
    if (chain.length == 1) {
      target[chain.shift()] = value;
    } else if (target.hasOwnProperty(chain[0]) && target[chain[0]] instanceof Object) {
      target = target[chain.shift()];
    } else {
      target = target[chain[0]] = target[chain[0]] ? Object.create(target[chain[0]]) : {};
      chain.shift();
    }
  }
  return value;
};

Bhiv.match = function match(pattern, alpha) {
  switch (Object.prototype.toString.call(pattern)) {
  case '[object Array]': case '[Object arguments]':
    if (pattern.length === 0 && alpha instanceof Array) return true;
    if (!(alpha instanceof Array)) return false;
    for (var i = 0; i < alpha.length; i++)
      if (!match(pattern[0], alpha[i]))
        return false;
    return true;
  case '[object Object]':
    if (!(alpha instanceof Object)) return false;
    for (var i in pattern)
      if (!alpha)
        return false;
    else if (!match(pattern[i], alpha[i]))
      return false;
    return true;
  case '[object Function]':
    switch (pattern) {
    case Boolean:  return '[object Boolean]' === Object.prototype.toString.call(alpha);
    case Number:   return '[object Number]' === Object.prototype.toString.call(alpha);
    case String:   return '[object String]' === Object.prototype.toString.call(alpha);
    case Object:   return '[object Object]' === Object.prototype.toString.call(alpha);
    case Array:    return '[object Array]' === Object.prototype.toString.call(alpha);
    case Function: return '[object Function]' === Object.prototype.toString.call(alpha);
    case Date:     return '[object Date]' === Object.prototype.toString.call(alpha);
    case RegExp:   return '[object RegExp]' === Object.prototype.toString.call(alpha);
    default:       return !!pattern(alpha);
    }
  case '[object RegExp]':
    return pattern.test(alpha);
  default:
    return pattern == alpha;
  }
};

Bhiv.extract = function extract(glue, alpha) {
  switch (Object.prototype.toString.call(glue)) {
  case '[object Array]':
    if (alpha != null) {
      if (!(alpha instanceof Array)) alpha = [alpha];
      if (glue.length == 1 && glue[0] instanceof Object) {
        var result = [];
        glue = glue[0];
        for (var i = 0; i < alpha.length; i++)
          result.push(extract(glue, alpha[i]));
        return result;
      }
    }
    var result = new Array(glue.length);
    for (var i = 0; i < glue.length; i++)
      result[i] = extract(glue[i], alpha);
    return result;
  case '[object Object]':
    var result = {};
    for (var i in glue) {
      if (/\$\{[^\}]+\}/.test(i)) {
        if (alpha instanceof Array) {
          for (var j = 0; j < alpha.length; j++) {
            var key = extract(i, alpha[j]);
            var value = extract(glue[i], alpha[j]);
            debugger;
            result[key] = Bhiv.merge(result[key], value);
          }
        } else {
          var key = extract(i, alpha);
          result[key] = extract(glue[i], alpha);
        }
      } else {
        var key = i;
        var value = extract(glue[i], alpha);
        if (key in result) {
          if (result[key] instanceof Array) {
            result[key].push(value);
          } else {
            result[key] = Bhiv.ingest(result[key], value);
          }
        } else {
          result[key] = value;
        }
      }
    }
    return result;
  case '[object String]':
    if (alpha == null) return glue;
    var replacement = null;
    var result = glue.replace(/(^\$\{[^\}]+\}$)|(\$\{[^\}]+\})/g, function (_, full, partial) {
      if (full) {
        replacement = Bhiv.getIn(alpha, full.substring(2, full.length - 1));
        return '';
      } else {
        var result = Bhiv.getIn(alpha, partial.substring(2, partial.length - 1));
        if (typeof result === 'string') return result;
        return JSON.stringify(result);
      }
    });
    if (result !== '') return result;
    if (replacement != null) return replacement;
    return glue;
  case '[object Date]':
    return new Date(glue.toISOSTring());
  case '[object RegExp]':
    var gim = (glue.global ? 'g' : '') + (glue.ignoreCase ? 'i' : '') + (glue.multiline ? 'm' : '');
    return new RegExp(glue.source, gim);
  default:
    return glue;
  }
};

Bhiv.ingest = function ingest(holder, alpha) {
  switch (Object.prototype.toString.call(alpha)) {
  case '[object Array]': case '[object Arguments]':
    if (holder instanceof Array) {
      var result = new Array(alpha.length);
      for (var i = 0; i < alpha.length; i++)
        result[i] = ingest(holder[i], alpha[i]);
      return result;
    }
    return alpha;
  case '[object Object]':
    if (alpha.constructor !== Object) return alpha;
    if (!(holder instanceof Object)) return alpha;
    var result = Object.create(holder.__proto__ || holder);
    for (var i in alpha) {
      if (i in holder) result[i] = ingest(holder[i], alpha[i]);
      else result[i] = alpha[i];
    }
    if (holder.constructor !== Object) return result;
    for (var i in holder) {
      if (!holder.hasOwnProperty(i)) continue ;
      if (!result.hasOwnProperty(i)) result[i] = holder[i];
    }
    return result;
  case '[object Undefined]':
    return holder;
  default:
    return alpha;
  }
};

Bhiv.merge = function merge(holder, alpha) {
  switch (Object.prototype.toString.call(alpha)) {
  case '[object Array]': case '[object Arguments]':
    var result = holder instanceof Array ? holder.slice() : [];
    return result.concat(alpha);
  case '[object Object]':
    if (alpha.constructor !== Object) {
      return alpha;
    } else {
      var isObject = holder && holder.constructor === Object;
      var result = isObject ? holder : {};
      for (var i in alpha)
        if (alpha.hasOwnProperty(i)) {
          result[i] = (holder && holder[i] != null)
            ? merge(holder[i], alpha[i])
            : alpha[i];
        }
      return result;
    }
  case '[object Undefined]':
    return holder;
  default:
    return alpha;
  }
};

Bhiv.flatten = function flatten(data) {
  switch (Object.prototype.toString.call(data)) {
  case '[object Object]':
    var result = {};
    for (var i in data)
      result[i] = flatten(data[i]);
    return result;
  case '[object Array]':
    var result = new Array(data.length);
    for (var i = 0; i < data.length; i++)
      result[i] = flatten(data[i]);
    return result;
  default:
    return data;
  }
};

Bhiv.throttleCache = function (method, cache) {
  var throttled = Bhiv.throttle(method);
  return function (data, callback) {
    if (typeof data !== 'string') throw Bhiv.Error('unable to cache this call');
    if (data in cache) return callback(null, cache[data]);
    return throttled(data, function (err, result) {
      if (err) return callback(err);
      if (!(data in cache)) cache[data] = result;
      return callback(null, result);
    });
  };
};

Bhiv.throttle = function (method) {
  var pending = {};
  return function (data, callback) {
    if (typeof data !== 'string') throw Bhiv.Error('unable to throttle this call');
    if (pending[data]) return pending[data].push(callback);
    pending[data] = [callback];
    return method(data, function (err, value) {
      var listeners = pending[data];
      delete pending[data];
      for (var i = 0; i < listeners.length; i++)
        listeners[i].apply(this, arguments);
    });
  };
};

Bhiv.generateId = (function () {
  var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return function (prefix, separator) {
    var id = prefix ? prefix + (separator || ':') : '';
    for (var i = 0; i < 4; i++) id += chars[Math.random() * chars.length | 0];
    return id;
  };
})();

Bhiv.serve = function (object) {
  return function (key, callback) {
    var value = Bhiv.getIn(object, key);
    return callback(null, value);
  };
};

Bhiv.wrap = function (alpha) {
  return function (_, callback) {
    return callback(null, alpha);
  };
};

Bhiv.waiter = function () {
  var pool = [];
  var ready = false;
  var waiter = function () {
    if (ready) throw new Error('Do not wait anymore');
    pool.push({ context: this, args: arguments });
  };
  waiter.ready = function (method) {
    if (ready) return ;
    ready = true;
    while (pool.length > 0) {
      var task = pool.shift();
      method.apply(task.context, task.args);
    }
  };
  return waiter;
};

Bhiv.EventEmitter = function () {
  var ee = this;
  var handles = {};
  var parent = null;

  this.id = Bhiv.generateId();

  this.on = function (event, listener) {
    if (!handles[event]) handles[event] = [];
    handles[event].push(listener);
    return this;
  };

  this.emit = function (event, data, context) {
    var count = this.dispatch(event, data, context);
    if (parent) count += parent.emit(event, data, context);
    return count;
  };

  this.dispatch = function (event, data, context) {
    var listeners = handles[event] || [];
    var callback = data && data.callback || Bhiv.noop;
    for (var i = 0; i < listeners.length; i++)
      listeners[i].call(context || null, data, callback);
    return i;
  };

  this.off = function (event, listener) {
    var listenersPosition = [];
    var listeners = handles[event] || [];
    for (var i = 0; i < listeners.length; i++)
      if (listeners[i] === listener)
        listenersPosition.push(i);
    for (var i = 0; i < listenersPosition.length; i++)
      listeners.splice(listenersPosition[i] - i, 1);
    return this;
  };

  this.one = function (event, listener) {
    return this.on(event, function one(data) {
      ee.off(event, one);
      return listener(data);
    });
  };

  this.setParent = function (ev) {
    if (ev && typeof ev.emit === 'function') parent = ev;
    else throw Bhiv.Error('this is not a valide parent', 'ERRBADPARENT');
    return this;
  };

  this.getParent = function () { return parent; };
};

Bhiv.makeListener = function (pool) {
  if (pool == null) pool = [];
  if (!(pool instanceof Array)) throw Bhiv.Error('Array require');

  var listener = function (handle) {
    if (typeof handle !== 'function') throw Bhiv.Error('Function require');
    if (~pool.indexOf(handle)) return ;
    pool.push(handle);
  };

  listener.execute = function () {
    for (var i = 0; i < pool.length; i++)
      pool[i].apply(this, arguments);
  };

  return listener;
};

Bhiv.callTimes = function (fn, times) {
  if (!(times > 0)) times = 1;
  return function () {
    if (times <= 0) throw Bhiv.Error('This function has already called max times');
    times -= 1;
    return fn.apply(this, arguments);
  };
};
