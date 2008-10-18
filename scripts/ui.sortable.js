;(function($) {

	if (window.Node && Node.prototype && !Node.prototype.contains) {
		Node.prototype.contains = function (arg) {
			return !!(this.compareDocumentPosition(arg) & 16);
		};
	}

	$.fn.extend({
		sortable: function(options) {
			
			var args = Array.prototype.slice.call(arguments, 1);
			
			if (options == "serialize" || options == "toArray")
				return $.data(this[0], "sortable")[options](arguments[1]);
			
			return this.each(function() {
				if (typeof options == "string") {
					var sort = $.data(this, "sortable");
					if (sort) sort[options].apply(sort, args);

				} else if(!$.data(this, "sortable"))
					new $.ui.sortable(this, options);
			});
		}
	});
	
	$.ui.sortable = function(element, options) {
		//Initialize needed constants
		var self = this;
		
		this.element = $(element);
		this.containerCache = {};
		
		$.data(element, "sortable", this);
		this.element.addClass("ui-sortable");

		//Prepare the passed options
		this.options = $.extend({}, options);
		var o = this.options;
		$.extend(o, {
			items: this.options.items || '> *',
			zIndex: this.options.zIndex || 1000,
			startCondition: function() {
				return !self.disabled;
			}
		});
		
		$(element).bind("setData.sortable", function(event, key, value){
			self.options[key] = value;
		}).bind("getData.sortable", function(event, key){
			return self.options[key];
		});
		
		//Get the items
		this.refresh();

		//Let's determine if the items are floating
		this.floating = this.items.length ? (/left|right/).test(this.items[0].item.css('float')) : false;
		
		//Let's determine the parent's offset
		if(!(/(relative|absolute|fixed)/).test(this.element.css('position'))) this.element.css('position', 'relative');
		this.offset = this.element.offset({ border: false });

		//Initialize mouse events for interaction
		this.element.mouseInteraction({
			executor: this,
			delay: o.delay,
			distance: o.distance || 0,
			dragPrevention: o.prevention ? o.prevention.toLowerCase().split(',') : ['input','textarea','button','select','option'],
			start: this.start,
			stop: this.stop,
			drag: this.drag,
			condition: function(e) {

				if(this.disabled || this.options.type == 'static') return false;

				//Find out if the clicked node (or one of its parents) is a actual item in this.items
				var currentItem = null, nodes = $(e.target).parents().andSelf().each(function() {
					if($.data(this, 'sortable-item')) currentItem = $(this);
				});
				if(currentItem && (!this.options.handle || $(e.target).parents().andSelf().is(this.options.handle))) {
					this.currentItem = currentItem;
					return true;
				} else return false;

			}
		});
		
		//Prepare cursorAt
		if(o.cursorAt && o.cursorAt.constructor == Array)
			o.cursorAt = { left: o.cursorAt[0], top: o.cursorAt[1] };
	};
	
	$.extend($.ui.sortable.prototype, {
		plugins: {},
		ui: function(inst) {
			return {
				helper: (inst || this)["helper"],
				placeholder: (inst || this)["placeholder"] || $([]),
				position: (inst || this)["position"],
				absolutePosition: (inst || this)["positionAbs"],
				instance: this,
				options: this.options,
				element: this.element,
				item: (inst || this)["currentItem"],
				sender: inst ? inst.element : null
			};		
		},
		propagate: function(n,e,inst) {
			$.ui.plugin.call(this, n, [e, this.ui(inst)]);
			this.element.triggerHandler(n == "sort" ? n : "sort"+n, [e, this.ui(inst)], this.options[n]);
		},
		serialize: function(o) {
			
			var items = $(this.options.items, this.element).not('.ui-sortable-helper'); //Only the items of the sortable itself
			var str = [];
			o = o || {};
			
			items.each(function() {
				var res = (this.getAttribute(o.attribute || 'id') || '').match(o.expression || (/(.+)[-=_](.+)/));
				if(res) str.push((o.key || res[1])+'[]='+(o.key ? res[1] : res[2]));
			});
			
			return str.join('&');
			
		},
		toArray: function(attr) {
			
			var items = $(this.options.items, this.element).not('.ui-sortable-helper'); //Only the items of the sortable itself
			var ret = [];
			
			items.each(function() {
				ret.push(this.getAttribute(attr || 'id'));
			});
			
			return ret;
			
		},
		intersectsWith: function(item) {
			
			var x1 = this.positionAbs.left, x2 = x1 + this.helperProportions.width,
			    y1 = this.positionAbs.top, y2 = y1 + this.helperProportions.height;
			var l = item.left, r = l + item.width, 
			    t = item.top,  b = t + item.height;
			
			return (   l < x1 + (this.helperProportions.width  / 2)    // Right Half
				&&     x2 - (this.helperProportions.width  / 2) < r    // Left Half
				&& t < y1 + (this.helperProportions.height / 2)        // Bottom Half
				&&     y2 - (this.helperProportions.height / 2) < b ); // Top Half
			
		},
		inEmptyZone: function(container) {

			if(!$(container.options.items, container.element).length) {
				return container.options.dropOnEmpty ? true : false;
			};

			var last = $(container.options.items, container.element).not('.ui-sortable-helper'); last = $(last[last.length-1]);
			var top = last.offset()[this.floating ? 'left' : 'top'] + last[0][this.floating ? 'offsetWidth' : 'offsetHeight'];
			return (this.positionAbs[this.floating ? 'left' : 'top'] > top);
		},
		refresh: function() {
			
			this.items = [];
			this.containers = [this];
			var items = this.items;
			var queries = [$(this.options.items, this.element)];
			
			if(this.options.connectWith) {
				for (var i = this.options.connectWith.length - 1; i >= 0; i--){
					
					var cur = $(this.options.connectWith[i]);
					for (var j = cur.length - 1; j >= 0; j--){
						var inst = $.data(cur[j], 'sortable');
						if(inst && !inst.disabled) {
							queries.push($(inst.options.items, inst.element));
							this.containers.push(inst);
						}
					};

				};
			}

			for (var i = queries.length - 1; i >= 0; i--){
				queries[i].each(function() {
					$.data(this, 'sortable-item', true); // Data for target checking (mouse manager)
					items.push({
						item: $(this),
						width: 0, height: 0,
						left: 0, top: 0
					});
				});
			};

		},
		refreshPositions: function(fast) {
			for (var i = this.items.length - 1; i >= 0; i--){
				if(!fast) this.items[i].width 			= this.items[i].item.outerWidth();
				if(!fast) this.items[i].height 			= this.items[i].item.outerHeight();
				var p = this.items[i].item.offset();
				this.items[i].left 						= p.left;
				this.items[i].top 						= p.top;
			};
			for (var i = this.containers.length - 1; i >= 0; i--){
				var p =this.containers[i].element.offset();
				this.containers[i].containerCache.left 	= p.left;
				this.containers[i].containerCache.top 	= p.top;
				this.containers[i].containerCache.width	= this.containers[i].element.outerWidth();
				this.containers[i].containerCache.height= this.containers[i].element.outerHeight();
			};
		},
		destroy: function() {
			this.element
				.removeClass("ui-sortable ui-sortable-disabled")
				.removeData("sortable")
				.unbind(".sortable")
				.removeMouseInteraction();
			
			for ( var i = this.items.length - 1; i >= 0; i-- )
				this.items[i].item.removeData("sortable-item");
		},
		enable: function() {
			this.element.removeClass("ui-sortable-disabled");
			this.disabled = false;
		},
		disable: function() {
			this.element.addClass("ui-sortable-disabled");
			this.disabled = true;
		},
		createPlaceholder: function(that) {
			(that || this).placeholderElement = this.options.placeholderElement ? $(this.options.placeholderElement, (that || this).currentItem) : (that || this).currentItem;
			(that || this).placeholder = $('<div></div>')
				.addClass(this.options.placeholder)
				.appendTo('body')
				.css({ position: 'absolute' })
				.css((that || this).placeholderElement.offset())
				.css({ width: (that || this).placeholderElement.outerWidth(), height: (that || this).placeholderElement.outerHeight() })
				;
		},
		recallOffset: function(e) {

			var elementPosition = { left: this.elementOffset.left - this.offsetParentOffset.left, top: this.elementOffset.top - this.offsetParentOffset.top };
			var r = this.helper.css('position') == 'relative';

			//Generate the original position
			this.originalPosition = {
				left: (r ? parseInt(this.helper.css('left'),10) || 0 : elementPosition.left + (this.offsetParent[0] == document.body ? 0 : this.offsetParent[0].scrollLeft)),
				top: (r ? parseInt(this.helper.css('top'),10) || 0 : elementPosition.top + (this.offsetParent[0] == document.body ? 0 : this.offsetParent[0].scrollTop))
			};
			
			//Generate a flexible offset that will later be subtracted from e.pageX/Y
			this.offset = {
				left: this._pageX - this.originalPosition.left + (parseInt(this.currentItem.css('marginLeft'),10) || 0),
				top: this._pageY - this.originalPosition.top + (parseInt(this.currentItem.css('marginTop'),10) || 0)
			};
			
		},
		start: function(e,el,helper) {
			
			var o = this.options;

			//Refresh the droppable items
			this.refresh(); this.refreshPositions();

			//Create and append the visible helper
			if(helper) {
				this.helper = helper.addClass('ui-sortable-helper');
			} else {
				this.helper = typeof o.helper == 'function' ? $(o.helper.apply(this.element[0], [e, this.currentItem])) : this.currentItem.clone();
				this.helper.appendTo(o.appendTo || this.currentItem[0].parentNode).css({ position: 'absolute', clear: 'both' }).addClass('ui-sortable-helper');
			}

			//Find out the next positioned parent
			this.offsetParent = (function(cp) {
				while(cp) {
					if(cp.style && (/(absolute|relative|fixed)/).test($.css(cp,'position'))) return $(cp);
					cp = cp.parentNode ? cp.parentNode : null;
				}; return $("body");		
			})(this.helper[0].parentNode);
			
			//Prepare variables for position generation
			this.elementOffset = this.currentItem.offset();
			this.offsetParentOffset = this.offsetParent.offset();
			var elementPosition = { left: this.elementOffset.left - this.offsetParentOffset.left, top: this.elementOffset.top - this.offsetParentOffset.top };
			this._pageX = e.pageX; this._pageY = e.pageY;
			this.clickOffset = { left: e.pageX - this.elementOffset.left, top: e.pageY - this.elementOffset.top };
			var r = this.helper.css('position') == 'relative';
			
			//Generate the original position
			this.originalPosition = {
				left: (r ? parseInt(this.helper.css('left'),10) || 0 : elementPosition.left + (this.offsetParent[0] == document.body ? 0 : this.offsetParent[0].scrollLeft)),
				top: (r ? parseInt(this.helper.css('top'),10) || 0 : elementPosition.top + (this.offsetParent[0] == document.body ? 0 : this.offsetParent[0].scrollTop))
			};
			
			//Generate a flexible offset that will later be subtracted from e.pageX/Y
			//I hate margins - they need to be removed before positioning the element absolutely..
			this.offset = {
				left: e.pageX - this.originalPosition.left + (parseInt(this.currentItem.css('marginLeft'),10) || 0),
				top: e.pageY - this.originalPosition.top + (parseInt(this.currentItem.css('marginTop'),10) || 0)
			};

			//Save the first time position
			this.position = { top: e.pageY - this.offset.top, left: e.pageX - this.offset.left };
			this.positionAbs = { left: e.pageX - this.clickOffset.left, top: e.pageY - this.clickOffset.top };
			this.positionDOM = this.currentItem.prev()[0];

			//If o.placeholder is used, create a new element at the given position with the class
			if(o.placeholder) this.createPlaceholder();

			//Call plugins and callbacks
			this.propagate("start", e);

			//Save and store the helper proportions
			this.helperProportions = { width: this.helper.outerWidth(), height: this.helper.outerHeight() };
			
			//If we have something in cursorAt, we'll use it
			if(o.cursorAt) {
				if(o.cursorAt.top != undefined || o.cursorAt.bottom != undefined) {
					this.offset.top -= this.clickOffset.top - (o.cursorAt.top != undefined ? o.cursorAt.top : (this.helperProportions.height - o.cursorAt.bottom));
					this.clickOffset.top = (o.cursorAt.top != undefined ? o.cursorAt.top : (this.helperProportions.height - o.cursorAt.bottom));
				}
				if(o.cursorAt.left != undefined || o.cursorAt.right != undefined) {
					this.offset.left -= this.clickOffset.left - (o.cursorAt.left != undefined ? o.cursorAt.left : (this.helperProportions.width - o.cursorAt.right));
					this.clickOffset.left = (o.cursorAt.left != undefined ? o.cursorAt.left : (this.helperProportions.width - o.cursorAt.right));
				}
			}
			
			//Set the original element visibility to hidden to still fill out the white space
			if(this.options.placeholder != 'clone') $(this.currentItem).css('visibility', 'hidden');

			//Post events to possible containers
			for (var i = this.containers.length - 1; i >= 0; i--) {
				this.containers[i].propagate("activate", e, this);
			}
			
			//Prepare possible droppables
			if($.ui.ddmanager) $.ui.ddmanager.current = this;
			if ($.ui.ddmanager && !o.dropBehaviour) $.ui.ddmanager.prepareOffsets(this, e);

			this.dragging = true;
			return false;
			
		},
		stop: function(e) {

			this.propagate("stop", e); //Call plugins and trigger callbacks
			if(this.positionDOM != this.currentItem.prev()[0]) this.propagate("update", e);
			if(!this.element[0].contains(this.currentItem[0])) { //Node was moved out of the current element
				this.propagate("remove", e);
				for (var i = this.containers.length - 1; i >= 0; i--){
					if(this.containers[i].element[0].contains(this.currentItem[0])) {
						this.containers[i].propagate("update", e, this);
						this.containers[i].propagate("receive", e, this);
					}
				};
			};
			
			//Post events to containers
			for (var i = this.containers.length - 1; i >= 0; i--){
				this.containers[i].propagate("deactivate", e, this);
				if(this.containers[i].containerCache.over) {
					this.containers[i].propagate("out", e, this);
					this.containers[i].containerCache.over = 0;
				}
			}
			
			//If we are using droppables, inform the manager about the drop
			if ($.ui.ddmanager && !this.options.dropBehaviour)
				$.ui.ddmanager.drop(this, e);
			
			this.dragging = false;
			if(this.cancelHelperRemoval) return false;
			$(this.currentItem).css('visibility', '');
			if(this.placeholder) this.placeholder.remove();
			this.helper.remove();

			return false;
			
		},
		drag: function(e) {

			//Compute the helpers position
			this.direction = (this.floating && this.positionAbs.left > e.pageX - this.clickOffset.left) || (this.positionAbs.top > e.pageY - this.clickOffset.top) ? 'down' : 'up';
			this.position = { top: e.pageY - this.offset.top, left: e.pageX - this.offset.left };
			this.positionAbs = { left: e.pageX - this.clickOffset.left, top: e.pageY - this.clickOffset.top };

			//Rearrange
			for (var i = this.items.length - 1; i >= 0; i--) {
				if(
						this.intersectsWith(this.items[i]) //items must intersect
					&& 	this.items[i].item[0] != this.currentItem[0] //cannot intersect with itself
					&&	this.items[i].item[this.direction == 'down' ? 'prev' : 'next']()[0] != this.currentItem[0] //no useless actions that have been done before
					&&	!this.currentItem[0].contains(this.items[i].item[0]) //no action if the item moved is the parent of the item checked
					&& (this.options.type == 'semi-dynamic' ? !this.element[0].contains(this.items[i].item[0]) : true)
				) {
					
					this.rearrange(e, this.items[i]);
					this.propagate("change", e); //Call plugins and callbacks
					break;
				}
			}
			
			//Post events to containers
			for (var i = this.containers.length - 1; i >= 0; i--){

				if(this.intersectsWith(this.containers[i].containerCache)) {
					if(!this.containers[i].containerCache.over) {
						

						if(!this.containers[i].element[0].contains(this.currentItem[0])) {
							
							//When entering a new container, we will find the item with the least distance and append our item near it
							var dist = 10000; var itemWithLeastDistance = null; var base = this.positionAbs[this.containers[i].floating ? 'left' : 'top'];
							for (var j = this.items.length - 1; j >= 0; j--) {
								if(!this.containers[i].element[0].contains(this.items[j].item[0])) continue;
								var cur = this.items[j][this.containers[i].floating ? 'left' : 'top'];
								if(Math.abs(cur - base) < dist) {
									dist = Math.abs(cur - base); itemWithLeastDistance = this.items[j];
								}
							}
							
							//We also need to exchange the placeholder
							if(this.placeholder) this.placeholder.remove();
							if(this.containers[i].options.placeholder) {
								this.containers[i].createPlaceholder(this);
							} else {
								this.placeholder = null;
								this.placeholderElement = null;
							}
							
							
							itemWithLeastDistance ? this.rearrange(e, itemWithLeastDistance) : this.rearrange(e, null, this.containers[i].element);
							this.propagate("change", e); //Call plugins and callbacks
							this.containers[i].propagate("change", e, this); //Call plugins and callbacks
						}
						
						this.containers[i].propagate("over", e, this);
						this.containers[i].containerCache.over = 1;
					}
				} else {
					if(this.containers[i].containerCache.over) {
						this.containers[i].propagate("out", e, this);
						this.containers[i].containerCache.over = 0;
					}
				}
				
			};
			
			//Interconnect with droppables
			if($.ui.ddmanager) $.ui.ddmanager.drag(this, e);

			this.propagate("sort", e); //Call plugins and callbacks
			this.helper.css({ left: this.position.left+'px', top: this.position.top+'px' }); // Stick the helper to the cursor
			return false;
			
		},
		rearrange: function(e, i, a) {
			a ? a.append(this.currentItem) : i.item[this.direction == 'down' ? 'before' : 'after'](this.currentItem);
			this.refreshPositions(true); //Precompute after each DOM insertion, NOT on mousemove
			if(this.placeholderElement) this.placeholder.css(this.placeholderElement.offset());
		}
	});

})(jQuery);