//
// Copyright 2008, 2009 Eric Wahlforss & Henrik Berggren
// 
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//

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
    return SC.utcDate(d);	  
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