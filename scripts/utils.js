/*Copyright (c) 2008 Henrik Berggren & Eric Wahlforss

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/* prototype class create */
var SC = SC || {};
$.extend(SC, {
  Class: function() {
    return function() {
      this.initialize.apply(this, arguments);
    };
  },

  bind: function(scope, fn) {
    return function() {
      fn.apply(scope, arguments);
    };
  },

  formatMs: function(ms) {
    var s = Math.floor((ms/1000) % 60);
    if (s < 10) { s = "0"+s; }
    return Math.floor(ms/60000) + "." + s;
  },

  format: function(str, props) {
    for (var i in props) {
      str = str.replace(new RegExp('#{'+i+'}'), props[i]);
    }
    return str;
  },
  json: function(jsonData) {
		try {
    	return eval("(" + jsonData + ")");
		} catch (err) {
			return null;
		}
	},
	utcDate: function(date) {
	  return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
	},
	date: function(date) {
	  return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
	},
	utcNow : function() {
    return this.utcDate(new Date());
	},
	utcLastWeek : function () {
    var d = new Date();
    d.setDate(d.getDate()-7);
    return SC.utcDate(d);	  
	},
	dateLastMonth : function () {
    var d = new Date();
    d.setDate(d.getDate()-30);
    return SC.date(d);	  
	},
	utcLastMonth : function () {
    var d = new Date();
    d.setDate(d.getDate()-30);
    return SC.utcDate(d);	  
	},
	utcYesterday : function () {
    var d = new Date();
    d.setDate(d.getDate()-1);
    return SC.utcDate(d);	  
	},
  arraySum : function(a) {
    var sum = 0
    $.each(a,function(i) {
      sum += a[i];
    });
    return sum;
  },
  throttle: function(delay, fn) {
    var last = null,
        partial = fn;

    if (delay > 0) {
      partial = function() {
        var now = new Date(),
            scope = this,
            args = arguments;

        // We are the last call made, so cancel the previous last call
        clearTimeout(partial.futureTimeout);

        if (last === null || now - last > delay) { 
          fn.apply(scope, args);
          last = now;
        } else {
          // guarentee that the method will be called after the right delay
          partial.futureTimeout = setTimeout(function() { fn.apply(scope, args); }, delay);
        }
      };
    }
    return partial;
  },
  stop: function(e) { e.preventDefault && e.preventDefault(); return false; },
  noop: function() { return this; } // identity func and terminator for our namespace
});