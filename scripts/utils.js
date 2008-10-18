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
  stop: function(e) { e.preventDefault && e.preventDefault(); return false; },
  noop: function() { return this; } // identity func and terminator for our namespace
});