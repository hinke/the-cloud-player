///////////////////////////////////////////////////////////////////////////////
//	Programador: Enrique Meléndez Estrada
//	Fecha: 02 - Noviembre - 2006
//	Version: 1.02
///////////////////////////////////////////////////////////////////////////////

jQuery.fn.columnSizing = function(o) {
		
	// default parameters, properties or settings
	o = jQuery.extend({
		selectCells : "tr:first>*",
		minWidth : 8,	//pixels minimum width;
		viewResize : true,
		viewGhost : true,
		tableWidthFixed : false,
		fadeOut : true,
		opacity : 0.5,
		classTable :	"jquery_columnSizing",
		classHandler :	"jquery_columnSizing_handler",
		classDragLine :	"jquery_columnSizing_dragLine",
		classDragArea :	"jquery_columnSizing_dragArea",
		cssHandler : {
			position: "relative",
			/*top:"2px",*/
			right:"-3px",
			float:"right",
			/*width:"0px",*/
			borderRight:"2px solid #fff",
			borderLeft:"2px solid #555",
			height:"20px",
			cursor:"col-resize"
			},
		cssDragLine : {
			borderRight:"4px solid #777",
			cursor:"col-resize"
			},
		cssDragArea : {
			border:"2px solid #777",
			backgroundColor:"#eee",
			cursor:"col-resize"
			},
		title : 'Expand/Collapse this column',
		speed : true, /* loading fast or compatibility... */
		cookies : false,
		dtop: -2,
		dleft: -4,
		loadingTime : 0,
		onLoad : null
	}, o || {});
	
	o.cookies = o.cookies && !!jQuery.cookie; /** if exists plugin 'jquery.cookies.js' **/

	if (o.viewGhost){
		var $Div = $('<div style="display:none;position:absolute;top:0;left:0;height:0;width:0;"></div>')
				.appendTo('body')
				.css(o.cssDragArea)
				.addClass(o.classDragArea)
				.css('opacity',o.opacity);
		var sDiv = $Div.get(0).style;
	}
			
	return this.each(function(index){
		o.loadingTime = new Date().getTime();
		
		/* load table cookie and init its width */
		if (o.cookies) {
			var cookieTableName = document.location.href+"_"+index;
			var cookieTableValue= $.cookie(cookieTableName);
			if (cookieTableValue != null)
				this.style.width = cookieTableValue+"px";
			}
		/** CSS SPECIAL FOR TABLES**/
		$(this)
			.addClass(o.classTable)
			//.find('td').css({ overflow : 'hidden' })
			;	 
		
		/* variables globales */
		var oTable = this;
		var wTable = (o.speed) ? oTable.clientWidth : $(this).width();
		var hTable = (o.speed) ? oTable.clientHeight : $(this).height();

		$(o.selectCells,this)
			.each(function(index){
				$('<div class="'+o.classHandler+'" title="'+ o.title+'"></div>')
					.css(o.cssHandler)
					/*.css('left',this.offsetLeft+this.offsetWidth+"px")*/
					.prependTo(this)
					.each(function(){
						this.dx = 0;
						this.ancho = 0;
						this.umbral = false;
						this.$td = $(this).parents('td').eq(0);
						this.otd = this.$td.get(0);
						this.sDragHelper = null;
						
						/* loading fast or compatibility... */
						this.wtd = (o.speed) ? null : this.$td.width(); 
						this.wtd0 = this.wtd;
						
						/* load column cookie and init its width */
						if (o.cookies){
							this.cookieColName = cookieTableName+'_'+index;
							this.cookieColName0 = this.cookieColName+'0';
							this.cookieColValue = $.cookie(this.cookieColName);
							this.cookieColValue0 = $.cookie(this.cookieColName0);
							if (this.cookieColValue != null){
								this.otd.style.width = this.cookieColValue+"px";
								this.wtd = this.cookieColValue;
								this.wtd0= this.cookieColValue0;
								}
							}
						})
					.dblclick( function() { 
						/* if loading fast, only once... */
						if (this.wtd == null){		
								this.wtd =		this.otd.offsetWidth; 
								this.wtd0=		this.wtd;
								}
						
						/* change column width */
						var minimized = this.wtd == o.minWidth;
						this.wtd = (minimized) ? this.wtd0 : o.minWidth;
						this.otd.style.width = this.wtd + "px";

						/* change table width (if not fixed) */
						if(!o.tableWidthFixed){
							var d = this.wtd0-o.minWidth;
							wTable = wTable+((minimized)?d:-d);
							oTable.style.width = wTable+"px";
							}
						
						/* save column and table cookie */
						if (o.cookies){
							$.cookie(this.cookieColName, this.wtd);
							$.cookie(this.cookieColName0, this.wtd0);
							$.cookie(cookieTableName, wTable);
							}
						})
					.Draggable({
						axis:	'horizontally',
						containment: 'document',
						frameClass: o.classDragLine,
						ghosting:	true,
						opacity: 	o.opacity,
						revert:		true,
						onStart: function(e){
							
							/* if loading fast, only once... */
							if (this.wtd == null){	
								this.wtd =		this.otd.offsetWidth; //this.$td.width();
								this.wtd0=		this.wtd;
								}
							hTable = oTable.clientHeight;
							if (o.viewGhost){
								sDiv.top =		this.dragCfg.oC.y+o.dtop+"px";
								sDiv.left=		this.dragCfg.currentPointer.x+o.dleft-this.wtd+"px";
								sDiv.height =	hTable+"px";
								sDiv.width =	this.wtd+"px";
								sDiv.display = "block";
								}
							else{
								if (!this.sDragHelper)
									this.sDragHelper = $('#dragHelper').css(o.cssDragLine).get(0).style;
								this.sDragHelper.height = hTable+"px";
								};
							},
						onDrag: (o.viewResize || o.viewGhost)? function(e){
							this.dx = this.dragCfg.currentPointer.x-this.dragCfg.pointer.x;
							this.ancho = this.wtd+this.dx;
							this.umbral = (o.minWidth-this.ancho > 0);
							this.jarrr = (this.umbral)? o.minWidth: this.ancho;
							if (o.viewGhost) {
								sDiv.width = this.jarrr+"px";
								if (!o.viewResize) return;
								};
							this.otd.style.width = this.jarrr + "px";
							
							/* change table width (if not fixed) */
							if(!o.tableWidthFixed){
								oTable.style.width = (this.umbral)?wTable+o.minWidth-this.wtd+"px":wTable+this.dx+"px";
								};
							}: null,
						onStop: function(e){
							if (!o.viewResize || o.viewGhost){
								this.dx = this.dragCfg.currentPointer.x-this.dragCfg.pointer.x;
								this.ancho = this.wtd+this.dx;
								this.umbral = (o.minWidth-this.ancho > 0);
								this.jarrr = (this.umbral) ? o.minWidth : this.ancho;
								this.otd.style.width = this.jarrr + "px";
								if (o.viewGhost)
									if (o.fadeOut)	$Div.fadeOut('slow');
									else			sDiv.display = "none";
								};
							
							/* change table width (if not fixed) */
							if(!o.tableWidthFixed){
								wTable = (this.umbral)?wTable+o.minWidth-this.wtd:wTable+this.dx;
								oTable.style.width = wTable+"px";
								};
							this.wtd0 = this.wtd;
							this.wtd = parseInt(this.otd.style.width);
							this.wtd0 = (this.wtd == o.minWidth) ? this.wtd0 : this.wtd;
							
							/* save column and table cookie */
							if (o.cookies){
								$.cookie(this.cookieColName, this.wtd);
								$.cookie(this.cookieColName0, this.wtd0);
								$.cookie(cookieTableName, wTable);
								}
						}
					})
				});
			o.loadingTime = new Date().getTime() - o.loadingTime;
			if (typeof(o.onLoad) == "function")
				o.onLoad();
			})
	
};