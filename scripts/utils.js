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
	utcNow : function() {
    return this.utcDate(new Date());
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