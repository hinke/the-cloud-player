// todo: better internal data structure for playlists, know position in list, remove track etc
SC.Playlist = SC.Class();
SC.Playlist.prototype = {
  initialize: function(props,player) { //ugly constructor, refactor
    this.properties = props;
    if (player.playlists[props.playlist.id]) { return; } // if it already exists, bail out here
    var self = this;
    this.name = props.playlist.name;
    this.id = props.playlist.id;
    this.version = props.playlist.version;
    this.player = player; // ref to the player
    this.offset = 0; // the offset when getting more tracks through the rest interface
    this.endOfList = false; // this is false until server returns less than 50 hits
    this.loading = false; // cheap mans queueing
    this.currentPos = 0; // this is the current position in the list at which a track is playing, needed for continous play through playlists
    this.persisted = (props.playlist.dontPersist ? false : true);
    
    this.editable = (!self.properties.playlist.smart && (self.properties.playlist.collaborative || (self.properties.is_owner && !self.properties.playlist.collaborative)));
    
    $('#tracklist')
      .clone()
      .attr('id',"list-" + props.playlist.id)
      .appendTo("#lists")
      .hide();
      
    this.dom = $("#lists > div:last"); // a bit ugly

    this.list = $("tbody", this.dom);

    this.colWidths = new Array(20,250,130,50,250,50,100); // default col widths
    
    // load colWidths from cookies
    $.each(this.colWidths,function(i) {
      var c = parseInt($.cookie('playlist_col_width_' + i));
      if(c) {
        self.colWidths[i] = c;
      }
    });
    
    // header colWidths
    $("table.list-header th",this.dom).each(function(i) {
      $(this).width(self.colWidths[i]);
    });

    // header width
    $("table.list-header tr",this.dom).width(SC.arraySum(self.colWidths)+7*7);
    
    function withinHeaderDragArea(el,e) {
      var left = e.clientX-$(el).offset().left-($(el).width()+3);
      if(left > 0 && left < 4) {
        return true;
      } else {
        return false;
      }
    }

    $("table.list-header th",this.dom)
      .mousemove(function(e) {
        if(withinHeaderDragArea(this,e)) {
          $(this).css("cursor","col-resize");
        } else {
          $(this).css("cursor","default");
        }
      })
      .mousedown(function(e) {
        var $col = $(this);
        var oldColWidth = $col.width();
        var colIdx = $(this).parents("thead").find("th").index(this) + 1;
        var rowWidth = $(this).parents("tr").width();
        var $row = $(this).parents("tr");
        var $rows = $("tr",self.list);

        if(withinHeaderDragArea(this,e)) {
          $(document)
            .mouseup(function() {
              $(document).unbind("mousemove");
            })
            .mousemove(function(ev) {
              var colWidth = ev.clientX - $col.offset().left;
              $col.width(colWidth);
              // resize all the cells in the same col
              $("td:nth-child(" + colIdx + ")", self.list).width(colWidth);
              $row.width(rowWidth+(colWidth-oldColWidth));
              $rows.width(rowWidth+(colWidth-oldColWidth));
            });
        }
      })
      .mouseup(function(e) {
        var colIdx = $(this).parents("thead").find("th").index(this) + 1;
        $.cookie('playlist_col_width_' + (colIdx-1),$(this).width());
      });

    // add tab to list of playlists
    // but only do this if it's not simply an artist or genre playlist
    if(!this.properties.playlist.dontShowPlaylistItem) {
      this.addToPlaylistsList();      
    }
    
    this.load();

    $("> div",this.dom).scroll(function() {
      // start pre-loading more if reaching nearer than 400px to the bottom of list 
      if(this.scrollHeight-(this.scrollTop+this.clientHeight) < 400) {
        self.load();
      }
    });

  },
  generateTracksUrl : function() { // generates the API url based on properties of the playlist
    var tracksUrl = "http://api.soundcloud.com/";
    var pl = this.properties.playlist;
    if(pl.smart) { // check for all smart playlist params
      if(pl.smart_filter.user_favorites) { // user favs pl
        tracksUrl += "users/" + pl.smart_filter.user_favorites + "/favorites.js?filter=streamable"
      } else if(pl.smart_filter.artist) { // artist pl
        tracksUrl += "users/" + pl.smart_filter.artist + "/tracks.js?filter=streamable"
      } else { // dynamic smart pl
        tracksUrl += "tracks.js?filter=streamable";
      }

      if(pl.smart_filter.order == "hotness" && !pl.smart_filter.user_favorites) { // prevent favs hotness sorting API bug
        tracksUrl = tracksUrl + "&order=" + pl.smart_filter.order + "&from_date=" + SC.utcYesterday() + "&to_date=" + SC.utcNow();
      } else { // default to sort by created_at
        tracksUrl = tracksUrl + "&order=created_at";
      }
      if(pl.smart_filter.genres) {
        tracksUrl = tracksUrl + "&genres=" + pl.smart_filter.genres;
      }
      if(pl.smart_filter.search_term) {
        tracksUrl += "&q=" + pl.smart_filter.search_term;
      }
      if(pl.smart_filter.bpm_from && pl.smart_filter.bpm_from != 0) {
        tracksUrl += "&bpm[from]=" + pl.smart_filter.bpm_from;
      }
      if(pl.smart_filter.bpm_to && pl.smart_filter.bpm_to != 250) {
        tracksUrl += "&bpm[to]=" + pl.smart_filter.bpm_to;
      }
    } else { // this is normal playlist
      tracksUrl = "http://api.soundcloud.com/tracks.js?filter=streamable&ids=" + this.properties.playlist.tracks;
    }
    tracksUrl += "&callback=?"; // add JSONP callback param
    return tracksUrl;
  },
  load : function() {
    var self = this;
    var url = this.generateTracksUrl() + "&offset=" + this.offset;
    if(!this.endOfList && !this.loading) {
      $("<div><div style='position:relative'><div id='throbber'></div></div></div>").appendTo(self.list);
      self.loading = true;
      self.tracks = [];
      $.getJSON(url, function(data) {
        self.offset += 50;
        if(data.length < 50) {
          self.endOfList = true;
        }
        // if persisted playlist we must sort the tracks array here according to the ids-string sort order
        // kind of ugly but impossible to persist sort order since sql can't return ordered list based on id params in query
        if(self.persisted && !self.properties.playlist.smart) {
          var trackIds = self.generateTracksUrl().match(/ids=([^&]*)/)[1].split(",");
          trackIds.pop(); // remove last ","
          var newData = new Array();
          $.each(trackIds,function() {
            var id = this;
            $.each(data,function() {
              if(this.id == id) {
                newData.push(this);
                return;
              }
            });
          });
          data = newData; // replace data array with sorted array
        }
        
        self.tracks = data;
        $("> div:last",self.list).remove();

        if(self.editable) {
          $(self.list).sortable({
            appendTo: "#track-drag-holder",
            placeholder : "droppable-placeholder",
            tolerance : "pointer",
            _noFinalSort : true, // mod to support multi-sortable
            helper : function(e,el) {
              if(!el.hasClass("selected")) { // imitate itunes selection behavior, avoid sortable bug
                el.addClass("selected");
                el.siblings("tr.selected").removeClass("selected");
              }
              if(el.siblings(".selected").length > 0) { // dragging more than one track
                var els = el.parents("tbody").find(".selected").clone();
                return $("<div></div>").prepend(els); // wrap all selected elements in a div
              } else {
                return el.clone(); // ghosted drag helper              
              }
            },
            opacity: 0.7,
            delay: 30,
            start : function(e,ui) {
              ui.item.css("display","block"); //prevent dragged element from getting hidden
            },
            beforeStop : function(e,ui) {
              if(self.player.justDropped) { // disable sort behavior if dropping in another playlist. ugly, but I can't seem to find a proper callback;
                self.player.justDropped = false; // ugly, but I can't find a proper callback;
              } else {
                ui.placeholder.after(ui.item.parents("tbody").find("tr.selected")); // multi-select-hack, move all selected items to new location                            
              }
            },
            stop : function(e,ui) {
              self.save();
            }
          });
        } else {
          // for read-only playlists, FIXME: make more DRY by moving default options to separate hash
          $(self.list).sortable({
            appendTo: "#track-drag-holder",
            placeholder : "droppable-placeholder-invisible",
            tolerance : "pointer",
            _noFinalSort : true, // mod to support multi-sortable
            helper : function(e,el) {
              if(el.siblings(".selected").length > 0) { // dragging more than one track
                var els = el.parents("tbody").find(".selected").clone();
                return $("<div></div>").prepend(els); // wrap all selected elements in a div
              } else {
                return el.clone(); // ghosted drag helper              
              }
            },
            sort : function(e,ui) {
              ui.placeholder.remove();
            },
            opacity: 0.7,
            delay: 30,
            start : function(e,ui) {
              ui.item.css("display","block"); //prevent dragged element from getting hidden
            }
          });
        };

        $.each(self.tracks,function() {
          self.addTrack(this);
        });
        //show new tracks with fade fx
        self.loading = false;
      });
    }
  },
  save : function() {
    var self = this;
    var tracks = "";
    $("tr",this.list).each(function() {
      tracks += this.track.id + ",";
    });
    if($("tr",this.list).length == 0) {
      tracks = "0";
    }
    
    var pos = $("#playlists li").index($("#playlists li[listid=" + this.id + "]"));
    console.log(pos)
    
    $.post("/playlists/" + this.id ,{"_method":"PUT","tracks":tracks,"version":this.version,"position":pos},function(dataJS) {
      var data = eval('(' + dataJS + ')');
      if(data.response == 200) {
        self.version++;
        console.log('saved with '+ tracks);
      } else {
        self.player.flash("Failed when saving playlist. The playlist could have been edited by somebody else.");
        console.log('failed to save, playlist edited by somebody else');
      }
    });
  },
  saveName : function() {
    var self = this;
    $.post("/playlists/" + this.id ,{"_method":"PUT","name":this.name,"version":this.version},function(dataJS) {
      var data = eval('(' + dataJS + ')');
      if(data.response == 200) {
        self.version++;
        console.log('saved name');
      } else {
        self.player.flash("Failed when saving playlist. The playlist could have been edited by somebody else.");
        console.log('failed to save, playlist edited by somebody else');
      }
    });    
  },
  destroy : function() {
    if(this.persisted) {
      $.post("/playlists/" + this.id,{"_method":"DELETE"},function() {
        console.log('deleted from server...')
      });      
    }
    $("#playlists li[listid=" + this.id + "]").fadeOut('fast');
    $("#lists #list-"+this.id).remove();

    // select first playlist after delete, if exists
    if($("#playlists li:first").length > 0) {
      this.player.switchPlaylist($("#playlists li:first").attr("listid"));      
    }
  },
  length : function() {
    return $("tr",this.list).length;
  },
  next : function() {
    $("tr",this.list).removeClass("playing");
    if(this.player.randomPlaylist) { // random is on
      this.currentPos = Math.floor(Math.random()*$("tr",this.list).length); // refine random function later
      this.loadTrack(this.currentPos);
    } else {
      var nxt = $("tr:nth-child("+(this.currentPos+2)+")",this.list);
      if(nxt.length > 0) {
        this.currentPos++;
        this.loadTrack(this.currentPos);
      } else if (this.player.loopPlaylist) { // if loop playlist, then jump back to first track when reached end
        this.currentPos = 0;
        this.loadTrack(this.currentPos);
      }
    }
  },
  prev : function() {
    if (this.player.audio.position < 2000) {
      var prev = $("tr:nth-child("+(this.currentPos)+")",this.list);
      if(prev.length > 0) {
        $("tr",this.list).removeClass("playing");
        this.currentPos--;
        this.loadTrack(this.currentPos);
      }      
    }
    else {
      this.player.audio.setPosition(0);
    }
  },
  loadTrack : function(pos) {
    $("tr",this.list).removeClass("playing");
    var tr = $("tr",this.list).eq(pos);
    tr.addClass("playing");
    this.currentPos = pos;
    this.player.load(tr[0].track);
  },
  addTrack : function(track,single) {
    track.description = (track.description ? track.description.replace(/(<([^>]+)>)/ig,"") : "");

    if (track.bpm == null) {
      track.bpm = "";
    }

    var self = this;
    
    if(!track.genre) {
      track.genre = "";
    }
            
    //populate table
    $('#tracklist-row table tr')
      .clone()
      .css("width",SC.arraySum(self.colWidths)+7*7)
      .dblclick(function() {
        self.player.currentPlaylist = self;
        // find out at which position we are at in the playlist, and store that as the currentPos
        self.currentPos = $(this).parents("tbody").find("tr").index(this);
        $(this).addClass("selected");
        self.loadTrack(self.currentPos);
      })
      .click(function(e) {
        if(e.shiftKey) {
          if($(this).siblings(".selected").length > 0) {
            var list = self.list;
            var oldIdx = $("tr",list).index($(this).siblings(".selected")[0]);
            var newIdx = $("tr",list).index(this);
            var start = (oldIdx - newIdx < 0 ? oldIdx : newIdx);
            var stop = (oldIdx - newIdx < 0 ? newIdx : oldIdx);
            for(var i = start;i <= stop;i++) {
              $("tr",list).eq(i).addClass("selected");              
            }
          }
        } else if (e.metaKey) {
          $(this).toggleClass("selected");
        } else {
          $(this).siblings().removeClass("selected").end().toggleClass("selected");          
        }
      })
      .find("td:nth-child(1)").css("width",self.colWidths[0]).end()
      .find("td:nth-child(2)").css("width",self.colWidths[1]).text(track.title).end()
      .find("td:nth-child(3)").css("width",self.colWidths[2]).html("<a href='#'>" + track.user.username + "</a>")
        .find("a")
        .click(function(ev) {
          self.player.removePlaylist("artist");
          console.log('new artist pl')
          self.player.playlists["artist"] = new SC.Playlist({
            is_owner: true,
            playlist : {
              id : "artist",
              name : "Artist: " + track.user.username,
              smart: true,
              smart_filter: {
                artist : track.user.permalink,
                order: "hotness"                
              },
              dontPersist : true,
              dontShowPlaylistItem : true
            }
          },self.player);
          self.player.switchPlaylist("artist");
          self.player.loadArtistInfo(track.user.uri);
          ev.preventDefault();
        }).end()
      .end()
      .find("td:nth-child(4)").css("width",self.colWidths[3]).text(SC.formatMs(track.duration)).end()
      .find("td:nth-child(5)").css("width",self.colWidths[4]).html(track.description).attr("title",track.description).end()
      .find("td:nth-child(6)").css("width",self.colWidths[5]).text(track.bpm).end()
      .find("td:nth-child(7)").css("width",self.colWidths[6]).html("<a href='#'>" + track.genre + "</a>")
        .find("a")
        .click(function(ev) {
          var genre = this.innerHTML;
          self.player.removePlaylist("genre");
          self.player.playlists["genre"] = new SC.Playlist({
            is_owner: true,
            playlist : {
              id : "genre",
              smart: true,
              smart_filter: {
                genres : genre,
                order: "hotness"                
              },
              dontPersist : true,
              dontShowPlaylistItem : true
            }
          }, self.player);
          self.player.switchPlaylist("genre");
          ev.preventDefault();
        }).end()
      .end()
      .appendTo(this.list);
    $("tr:last",this.list)[0].track = track;
  },
  addToPlaylistsList: function() { // add the tab for the playlist
    var self = this;
    $("<li listId='" + this.id + "' class='" + (this.properties.is_owner ? "" : "shared") + " " + (this.properties.playlist.collaborative ? "collaborative" : "") + " " + (this.persisted ? "" : "dont-persist") + " " + (this.properties.playlist.smart ? "smart" : "") + " " + (this.properties.playlist.search ? "search" : "") + "'><span></span><a href='#'>" + this.name + (this.properties.is_owner ? "" : " <em>by " + this.properties.playlist.owner.nickname + "</em>") + "</a><a class='collaborative' title='Make Playlist Collaborative' href='/playlists/" + this.id + "'>&nbsp;</a><a class='share' title='Share Playlist' href='/share/" + this.properties.playlist.share_hash + "'>&nbsp;</a><a class='delete' title='Remove Playlist' href='/playlists/" + this.id + "'>&nbsp;</a></li>")
      .find('a:first').click(function(ev) {
        if($(this).parents("li").hasClass("active") && self.properties.is_owner && $("body").hasClass("logged-in")) {
          var that = this; // very strange that i can't use self here
          if(!window.editingText) {
            setTimeout(function() {
              var origValue = $(that).text();
              window.editingText = true;
              $(that).html("<input type='text' value='" + origValue + "'>");
              $("input", that).focus();
              $("input", that).select();

              // closes editInPlace and saves if save param is true
              var closeEdit = function(save) {
                if(save) {
                  self.name = $("input",that).val();
                  $(that).text(self.name);
                  self.saveName();
                } else {
                  $(that).text(origValue);                  
                }
                window.editingText = false;
                ev.stopPropagation();
                $(document).unbind("click",applyEditClick);
                $(window).unbind("keydown",editKey);                
              }

              var applyEditClick = function(ev) {
                if(!(ev.target == $("input",that)[0])) { // save if click anywhere but on the editing input
                  closeEdit(true);
                }
              };

              $(document).bind("click", applyEditClick);

              var editKey = function(ev) {
                if(ev.keyCode === 27) {
                  closeEdit();
                  return false;
                } else if (ev.keyCode === 13) { // start selected track
                  closeEdit(true);
                  return false;
                }
              }

              $(window).keydown(editKey);
            
            },500);
          }
        } else {
          self.player.switchPlaylist(self.id);          
        }
        ev.preventDefault();
      })
      .attr('pane',this.dom)
      .end()
      .find('a.delete').click(function() {
        if(confirm("Do you want to delete this playlist?")) {
          self.destroy();
        }        
        return false;
      }).end()
      .find('a.share').click(function() {
        prompt("Send this link to anyone who you want to share this playlist with:", this.href);
        return false;
      }).end()
      .find('a.collaborative').click(function() {
        if(!$(this).parents("li").hasClass("shared")) {
          $.post("/playlists/" + self.id ,{"_method":"PUT","collaborative":!self.properties.playlist.collaborative,"version":self.version},function() {
            self.properties.playlist.collaborative = !self.properties.playlist.collaborative;
            $("#playlists li[listid=" + self.id + "]").toggleClass("collaborative");
            if(self.properties.playlist.collaborative) {
              self.player.flash("This playlist is now collaborative and can be edited by others");
            } else {
              self.player.flash("This playlist is not collaborative anymore and cannot be edited by others");
            }
            console.log('saved with '+ self.properties.playlist.collaborative);
          });          
        }
        return false;
      }).end()
      .appendTo("#playlists")
      .hide()
      .fadeIn();
  	
  	if(this.editable) { // if playlists are smart, they are read-only
      $('#playlists li:last')
    		.droppable({
    			accept: function(draggable) {
    				return $(draggable).is('tr');
    			},
    			activeClass: 'droppable-active',
    			hoverClass: 'droppable-hover',
    			tolerance: 'pointer',
    			drop: function(ev, ui) {
    			  self.player.justDropped = true;  // ugly, but I can't find a proper callback;
    				var listId = $(this).attr('listId');
    			  if(ui.draggable.siblings(".selected").length > 0) { //multi-drag
      				var items = ui.draggable.parents("tbody").find("tr.selected");
      				$.each(items,function() {
        				self.addTrack(this.track,true);
      				});
              self.player.flash(items.length + " tracks were added to the playlist");
    			  } else {
      				self.addTrack($(ui.draggable)[0].track,true);
              self.player.flash("The track " + $(ui.draggable)[0].track.title + " was added to the playlist");  			    
    			  }
            self.save();
    			}
    		});  	  
  	}  		
  		
  }
}
