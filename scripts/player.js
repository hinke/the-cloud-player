SC.Player = SC.Class();
SC.Player.prototype = {
  isPlaying: false,
  initialize: function() {
    if($.browser.safari)
      this.track = new Audio("http://soundcloud.com/forss/soulhack.mp3");
    this.progress = $('#progress div:first');
    this.loading = $('#progress div.loading');
    this.progressParent = $('#progress');
    this.timecodes = $('#timecodes');
    
    var self = this;
    this.playButton = $('#play');
    this.playButton.click(function() {
      self.togglePlay();
    });

/*    // make all tables unselectable
    $("#lists,#menu,#header,#footer,#artwork,#artist-info")
      .attr('unselectable', 'on') // ie
      .css('MozUserSelect', 'none') // ff
      .css('-khtml-user-select', 'none'); // webkit
*/

    // resizable playlists pane
    function withinPlaylistPaneDragArea(el,e) {
      var left = e.clientX-$(el).offset().left-($(el).width()+5);
      if(left > 0 && left < 4) {
        return true;
      } else {
        return false;
      }
    }
    
    // init width from cookie
    var playlistPaneWidth = parseInt($.cookie('playlist_pane_width'));
    if(!playlistPaneWidth) {
      playlistPaneWidth = 250;
    }
    
    $("#menu").width(playlistPaneWidth);
    $("#lists, #artist-info").css("left",playlistPaneWidth+9);
    $("#artwork").width(playlistPaneWidth+9);
    $("#artwork").height(playlistPaneWidth+9);

    $("#menu")
      .mousemove(function(e) {
        if(withinPlaylistPaneDragArea(this,e)) {
          $(this).css("cursor","col-resize !important");
        } else {
          $(this).css("cursor","default");
        }
      })
      .mousedown(function(e) {
        var $pane = $(this);
        var $artwork = $("#artwork");
        var $lists = $("#lists, #artist-info");
        if(withinPlaylistPaneDragArea(this,e)) {
          $(document)
            .mouseup(function() {
              $(document).unbind("mousemove");
            })
            .mousemove(function(ev) {
              var colWidth = ev.clientX - ($pane.offset().left+8);
              $pane.width(colWidth);
              if(self.showingArtwork) {
                $pane.css("bottom",colWidth+59);
              }
              $artwork.width(colWidth+9);
              $artwork.height(colWidth+9);
              $lists.css("left",colWidth+9);                
            });
        }
      })
      .mouseup(function() {
        $.cookie('playlist_pane_width',$(this).width());
      });

    // volume
    $("#volume").slider({
      startValue : 100,
      min : 0,
      max : 100,
      slide : function(e, ui) {
        self.track.volume = ui.value / 100;
      }
    });

    $('#next').click(function() {
      self.currentPlaylist.next();
    });

    $('#prev').click(function() {
      self.currentPlaylist.prev();
    });

/*    $('#tempo-up').click(function() {
      self.tempoUp();
    });

    $('#tempo-down').click(function() {
      self.tempoDown();
    });

    $('#reverse').click(function() {
      self.tempoReverse();
    });

    $('#loop-in').click(function() {
      self.setLoopIn();
    });

    $('#loop-out').click(function() {
      self.setLoopOut();
    });

    $('#loop-toggle').click(function() {
      self.setLoopToggleX();
    });
*/            
    this.playlist = [];

    // artist info close btn
    $("#artist-info a.close").click(function() {
      self.hideArtistPane();
      return false;
    });

    // artwork loading callback
    $("#artwork img, #artist-info img").load(function() {
      $(this).addClass("loaded");
    });

    $("#progress").click(function(ev) {
      var percent = (ev.clientX-$(ev.target).offset().left)/($("#progress").width());
      self.track.currentTime = self.track.duration*percent;
    });

    $("#q")
      .focus(function() {
        this.focused = true;
        var self = this;
        $(this).val('');
        $(window).click(function(ev) {
          if(ev.target != self) {
            $("#q").blur();
            $(window).unbind("click");
          }
        });
      })
      .blur(function() {
        this.focused = false;
        $(this).val('Search');
      })
      .keydown(function(ev) {
        if(ev.keyCode === 13) {
          self.removeTab("search1");
          var q = $("#q").val();
          self.trackLists[hex_md5("s" + q)] = new SC.TrackList("Search for '" + q + "'",null,self,"http://api.soundcloud.com/tracks.js?filter=streamable&q="+ q +"&callback=?",false,hex_md5("s" + q));
          self.switchTab(hex_md5("s" + q));
        } else if (ev.keyCode === 27) {
          $("#q").blur();
        }
      });
    
    $("#menu li:first a").click(function() {
      var name = prompt("Please name your playlist", "My Playlist");
      if(name) {
        $.post("/playlists",{'name':name,'position': 0},function(data) {
          var playlist = eval('(' + data + ')');
          self.trackLists[playlist.id] = new SC.TrackList(name, null, self,null,false,playlist.id,true);
          self.switchTab(playlist.id);
        });
      }
      return false;
    });

    // quick hack to add genre playlists
    $("#menu li a.genre-playlist").click(function() {
      var name = prompt("Please pick a genre", "Ambient");
      if(name) {
        self.trackLists[hex_md5("gen" + name)] = new SC.TrackList("Genre '" + name + "'",null,self,"http://api.soundcloud.com/tracks.js?filter=streamable&order=hotness&from_date=" + SC.utcYesterday() + "&to_date=" + SC.utcNow() + "&genres=" + name +"&callback=?",false,hex_md5("gen" + name));
        self.switchTab(hex_md5("gen" + name));
      }
      return false;
    });

    // quick hack to add genre playlists
    $("#menu li a.favorites-playlist").click(function() {
      var name = prompt("Please enter a user url (e.g. 'forss')", "forss");
      if(name) {
        self.trackLists[hex_md5("fav"+name)] = new SC.TrackList("Favorites from '" + name + "'",null,self,"http://api.soundcloud.com/users/" + name + "/favorites.js?filter=streamable&callback=?",false,hex_md5("fav"+name));
        self.switchTab(hex_md5("fav" + name));
      }
      return false;
    });

    // remove playlist items on press delete
    $(window).keydown(function(ev) {
      if(!$("#q")[0].focused) { // don't listen to key events if search field is focused
        var currentTrackList = self.trackLists[$("#menu li.active:first").attr('listId')]; // optimize?
        if(ev.keyCode === 8) {
          if($("tr.selected",currentTrackList.list).length > 0) {
            $("tr.selected",currentTrackList.list).remove();
            currentTrackList.save();
            return false;          
          }
        } else if(ev.keyCode === 32) { // start/stop play
          self.togglePlay();
        } else if (ev.keyCode === 13) { // start selected track
          if($("tr.selected",currentTrackList.list).length > 0) {
            var idx = $("tr", currentTrackList.list).index($("tr.selected",currentTrackList.list));            
          } else {
            $("tr", currentTrackList.list).eq(0).addClass("selected");
            var idx = 0;
          }
          currentTrackList.loadTrack(idx);
        } else if (ev.keyCode === 40) { // arrow down, select next
          var sel = $("tr.selected:last",currentTrackList.list);
          if(sel.length > 0 && sel.next().length > 0) { // check so that el exists
            
            // a bit messy code that scrolls with the selected element
            if(sel.next().offset().top > (($("> div:last",currentTrackList.dom).height()+$("> div:last",currentTrackList.dom).offset().top) - 17) ) {
              $("> div:last",currentTrackList.dom)[0].scrollTop += 17;
            }
            
            if(ev.shiftKey) { // select next track
              $("tr.selected",currentTrackList.list).next().addClass("selected");
            } else {
              $("tr", currentTrackList.list).removeClass("selected");
              sel.next().addClass("selected");
            }
          }
          return false;
        } else if (ev.keyCode === 38) { // arrow up, select prev
          var sel = $("tr.selected:first",currentTrackList.list);
          if(sel.length > 0 && sel.prev().length > 0) { // check so that el exists

            // a bit messy code that scrolls with the selected element
            if(sel.prev().offset().top < ($("> div:last",currentTrackList.dom).offset().top) ) {
              $("> div:last",currentTrackList.dom)[0].scrollTop -= 17;
            }

            if(ev.shiftKey) { // select prev track
              $("tr.selected",currentTrackList.list).prev().addClass("selected");
            } else {
              $("tr", currentTrackList.list).removeClass("selected");
              sel.prev().addClass("selected");
            }
          }
          return false;
        } else if (ev.keyCode === 39 && self.isPlaying) { // arrow next, play next if playing
          currentTrackList.next();
        } else if (ev.keyCode === 37 && self.isPlaying) { // arrow prev, play prev if playing
          currentTrackList.prev();
        } else if (ev.keyCode === 70 && ev.metaKey) { // cmd-f for search
          $("#q").focus();
          return false;
        } else if (ev.keyCode === 65 && ev.metaKey) { // cmd-a for select all
          $("tr",currentTrackList.list).addClass("selected");
          return false;
        }
      } else {
        if (ev.keyCode === 70 && ev.metaKey) { // cancel normal browser behaviour for cmd-f
          return false;
        }
      }
    });

    this.trackLists = {};

    // load playlists for user
    $.getJSON("/playlists",function(playlists) {
      $.each(playlists,function() {
        self.trackLists[this.id] = new SC.TrackList(this.name,null,self,"http://api.soundcloud.com/tracks.js?filter=streamable&ids=" + this.tracks + "&callback=?",false,this.id,true);
      });
    });
    
    //self.trackLists['Dashboard'] = new SC.TrackList("Dashboard",null,self,"http://api.soundcloud.com/events.js?filter=tracks&callback=?", true);
    //self.trackLists['Favorites'] = new SC.TrackList("Favorites",null,self,"http://api.soundcloud.com/me/favorites.js?callback=?");
    //self.trackLists['MyTracks'] = new SC.TrackList("MyTracks",null,self,"http://api.soundcloud.com/me/tracks.js?callback=?");

    // hot tracks
    self.trackLists['hot'] = new SC.TrackList("Hot Tracks",null,self,"http://api.soundcloud.com/tracks.js?filter=streamable&order=hotness&from_date=" + SC.utcYesterday() + "&to_date=" + SC.utcNow() + "&callback=?",false,'hot');

    self.switchTab("hot");

    // ugly hack until we figure out callbacks
    this.checkIfEnded();
    
    $("#menu").sortable({
      placeholder : "droppable-placeholder",
      helper : function(e,el) {
        return el.clone(); // ghosted drag helper
      },
      opacity: 0.7,
      delay: 30,
      start : function(e,ui) {
        ui.item.css("display","block"); //prevent dragged element from getting hidden
      }
    });

  },
  checkIfEnded: function() {
    var self = this;
    // ugly, fix
    setInterval(function() {
      if (self.isPlaying && self.track.ended) {
        self.isPlaying = false;
        self.currentPlaylist.next();
      };
    },500);
  },
  load: function(track) {
    this.track.pause();
    this.track = null;
    this.track = new Audio(track.stream_url + "?stream_token=84d939bca386ec6f54f1d68d8d9b9bf3");
    var self = this;

    $("#progress").fadeIn("fast");
    $("#artist")
      .hide()
      .html("<a href='#' class='artist-link'>" + track.user.username + "</a><div>" + track.title + "</div>")
      .find("a")
        .click(function() { // ugly, this code is duplicated from artist playlist generator
          self.trackLists[hex_md5("user" + track.user.permalink)] = new SC.TrackList("Artist '" + track.user.username + "'",null,self, track.user.uri + "/tracks.js?filter=streamable&order=hotness&callback=?",false,hex_md5("user" + track.user.permalink),false);
          self.switchTab(hex_md5("user" + track.user.permalink));
          self.loadArtistInfo(track.user.uri);
          return false;
        }).end()
      .fadeIn();
    $("#timecodes").hide().fadeIn();
    $("#check-track-on-sc").hide().html("<a href='" + track.permalink_url + "' target='_blank'>Check this track on SoundCloud »</a>" + "&nbsp;&nbsp;&nbsp;<a href='" + track.permalink_url + "/stats' target='_blank'>Stats »</a>").fadeIn("slow");
    $("#progress span.marker").remove();
    $.getJSON("http://api.soundcloud.com/tracks/"+track.id+"/comments.js?callback=?",function(comments) {
      $.each(comments,function() {
        if(this.timestamp) {
          $("<span class='marker'></span>")
            .css("left",((this.timestamp/track.duration)*100)+"%")
            .appendTo("#progress");
        }
      });
    });
    // growl notification for fluid
    if(window.fluid) {
      window.fluid.showGrowlNotification({
          title: track.title, 
          description: track.user.username + " - " + track.title, 
          priority: 1, 
          sticky: false,
          identifier: "foo",
          onclick: function() {}
      })      
    }
    
    if(track.artwork_url && !track.artwork_url.match(/default/)) {
      this.loadArtwork(track);
    } else {
      this.hideArtworkPane();
    }
    
    this.play();
    this.loadWaveform(track);
  },
/*  tempoUp: function() {
    if(this.track.playbackRate >= -0.1 && this.track.playbackRate < 0) {
      this.track.playbackRate = 1;
    } else {
      this.track.playbackRate = this.track.playbackRate + 0.05;
    }
  },
  tempoDown: function() {
    if(this.track.playbackRate <= 0.1 && this.track.playbackRate > 0 ) {
      this.track.playbackRate = -1;
    } else {
      this.track.playbackRate = this.track.playbackRate - 0.05;
    }
  },
  tempoReverse: function() {
    this.track.playbackRate = this.track.playbackRate * -1;
  },
  setLoopIn: function() {
    this.track.loopStart = this.track.currentTime;
    $("#loop-in").fadeOut(5);
    $("#loop-in").html(this.track.loopStart).fadeIn();
  },
  setLoopOut: function() {
    this.track.loopEnd = this.track.currentTime;
    $("#loop-out").fadeOut(5);
    $("#loop-out").html(this.track.loopEnd).fadeIn();
  },
  setLoopToggleX: function() {
    if(this.track.currentLoop == 1) {
      this.track.playCount = 1;
      this.track.currentLoop = 0;
      $("#loop-toggle").fadeOut(5);;
      $("#loop-toggle").html("off").fadeIn();;

    } else {
      this.track.playCount = 999;
      this.track.currentLoop = 1;
      $("#loop-toggle").fadeOut(5);;
      $("#loop-toggle").html("on").fadeIn();;
    }
  },
*/  flash: function(message) {
    $("#flash").find("div").text(message).end().addClass("on");
    setTimeout(function(){$("#flash").removeClass("on")},1500);
  },
  loadWaveform: function(track) {
    var self = this;
    $.getJSON("http://api.soundcloud.com/users/"+track.user_id+".js?callback=?",function(user) {
      self.progressParent.css("background-image","url("+track.waveform_url+")");
    });
  },
  loadArtistInfo: function(uri) {
    var self = this;
    $.getJSON(uri + ".js?callback=?",function(user) {
      if(!user.city) {
        user.city = "";
      };
      if(!user.country) {
        user.country = "";
      };
      user.description = (user.description ? user.description : "");
      $("#artist-info")
        .find("h3").html(user.username + " <span>" + user.city + ", " + user.country + "</span>").end()
        .find("img").removeClass("loaded").attr("src",user.avatar_url).end()
        .find("p:first").html(user.description).end()
        .find("p:last").html("<a href='" + user.permalink_url + "' target='_blank'>Check this artist on SoundCloud »</a>").end()
      self.showArtistPane();
    });
  },
  showArtistPane: function() {
    $("#lists").animate({top:236});
    $("#artist-info").animate({height:"show"});
  },
  hideArtistPane: function() {
    $("#lists").animate({top:80});
    $("#artist-info").animate({height: "hide"});
  },
  loadArtwork: function(track) {
    $("#artwork img")
      .removeClass("loaded")
      .attr("src",track.artwork_url)
      .attr("title",track.description);
    this.showArtworkPane();
  },
  showArtworkPane: function() {
    $("#menu").animate({bottom:$("#artwork").width()+50});
    $("#artwork").animate({height:"show"});
    this.showingArtwork = true;
  },
  hideArtworkPane: function() {
    $("#menu").animate({bottom:50});
    $("#artwork").animate({height: 'hide'});
    this.showingArtwork = false;
  },
  switchTab: function(id) {
    $("#lists > div").hide();
    $("#lists > #list-"+id).show();
    $("#menu li").removeClass("active");
    $("#menu li[listId="+id+"]").addClass("active");
  },
  addTab: function(id, name, pane) {
    var self = this;
    $("<li listId='" + id + "'><a class='delete' href='/playlists/" + id + "'>x</a><a href='#'>"+name+"</a></li>")
      .find('a:last').click(function() {
        self.switchTab(id);
        return false;
      })
      .attr('pane',pane)
      .end()
      .find('a:first').click(function() {
        if(confirm("Do you want to delete this playlist?")) {
          self.trackLists[$(this).parents("li").attr("listId")].destroy();
        }        
        return false;
      })
      .end()
      .appendTo("#menu")
      .hide()
      .fadeIn();
  	
    $('#menu li:last')
  		.droppable({
  			accept: function(draggable) {
  				return $(draggable).is('tr');
  			},
  			activeClass: 'droppable-active',
  			hoverClass: 'droppable-hover',
  			tolerance: 'pointer',
  			drop: function(ev, ui) {
  				var listId = $(this).attr('listId');
  			  if(ui.draggable.siblings(".selected").length > 0) {
    				var items = ui.draggable.parents("tbody").find("tr.selected");
    				$.each(items,function() {
      				self.trackLists[listId].addTrack(this.track,true);
    				});
            self.flash(items.length + " tracks were added to the playlist");
  			  } else {
    				self.trackLists[listId].addTrack($(ui.draggable)[0].track,true);
            self.flash("The track " + $(ui.draggable)[0].track.title + " was added to the playlist");  			    
  			  }
          self.trackLists[listId].save();
  			}
  		});
  },
  removeTab : function(id) {
    if($("#menu li[listId="+id+"]").length > 0) {
      var pane = $("#menu li[listId="+id+"]").find('a').attr("pane");
      $("#lists #list-"+id).remove();
      $("#menu li[listId="+id+"]").remove();      
    }
  },
  togglePlay : function() {
    if(this.isPlaying) {
      this.stop();
    }
    else {
      this.play();      
    }
  },  
  play: function() {
    this.track.play();
    this.isPlaying = true;
    this.playButton.html('■');
    $("body").addClass("playing");
    var self = this;
    this.redrawTimer = setInterval(function(){
      self.progress.css('width',(self.track.currentTime/self.track.duration)*100+"%");
      //console.log(self.track.buffered.end(),self.track.duration)
      self.loading.css('width',(self.track.buffered.end()/self.track.duration)*100+"%");
      $('span:first',self.timecodes).html(SC.formatMs(self.track.currentTime*1000));
      $('span:last',self.timecodes).html(SC.formatMs(self.track.duration*1000));
    },200);
  },
  stop: function() {
    this.track.pause();    
    this.isPlaying = false;
    this.playButton.html('➤');
    $("body").removeClass("playing");
    clearInterval(this.redrawTimer);
  }
};

// todo: better internal data structure for playlists, know position in list, remove track etc
SC.TrackList = SC.Class();
SC.TrackList.prototype = {
  initialize: function(name,tracks,player,tracksUrl,events,id,persisted) { //ugly constructor, refactor
    console.log(player)
    if (player.trackLists[id]) { return; }
    var self = this;
    this.name = name;
    this.id = id;
    this.player = player; // ref to the player
    this.offset = 0; // the offset when getting more tracks through the rest interface
    this.endOfList = false; // this is false until server returns less than 50 hits
    this.loading = false; // cheap mans queueing
    this.events = events; // if mode is events, then event entries will be parsed for tracks
    this.currentPos = 0; // this is the current position in the list at which a track is playing, needed for continous play through playlists
    this.persisted = persisted;

    $('#tracklist')
      .clone()
      .attr('id',"list-" + id)
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

    // add tab
    this.player.addTab(id,name,this.dom);

    if(tracksUrl) { // a bit messy
      this.tracksUrl = tracksUrl
      this.load();
    } else {
      this.tracks = tracks || [];      
      $.each(this.tracks,function() {
        self.addTrack(this);
      });
      $("tr.track-hidden",self.list).removeClass('track-hidden');
    }

    $("> div",this.dom).scroll(function() {
      // start pre-loading more if reaching nearer than 400px to the bottom of list 
      if(this.scrollHeight-(this.scrollTop+this.clientHeight) < 400) {
        self.load();
      }
    });

  },
  load : function(tracksUrl,callback) {
    var self = this;
    var url = this.tracksUrl + "&offset=" + this.offset;
    if(!this.endOfList && !this.loading) {
      $("<div><div><div>Loading</div><marquee direction='right'>...<marquee></div></div>").appendTo(self.list);
      self.loading = true;
      self.tracks = [];
      $.getJSON(url, function(data) {
        self.offset += 50;
        if(data.length < 50) {
          self.endOfList = true;
        }
        // if persisted playlist we must sort the tracks array here according to the ids-string sort order
        // kind of ugly but impossible to persist sort order since sql can't return ordered list based on id params in query
        if(self.persisted) {
          var trackIds = self.tracksUrl.match(/ids=([^&]*)/)[1].split(",");
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
        
        // if events mode, then parse out the tracks first
        if(self.events) {
          $.each(data,function() {
            if(this.type === 'Track') {
              self.tracks.push(this.track);
            }
          });
        } else {
          self.tracks = data;
        }
        $("> div:last",self.list).remove();
        
        $(self.list).sortable({
          appendTo: "#track-drag-holder",
          placeholder : "droppable-placeholder",
          tolerance : "pointer",
          helper : function(e,el) {
            if(el.siblings(".selected").length > 0) { // dragging more than one track
              var els = el.parents("tbody").find(".selected").clone();
              return $("<div></div>").prepend(els);
              //return $("<tr><td style='padding-left:5px'>" + (el.siblings(".selected").length + 1) + " tracks selected</td></tr>");
            } else {
              return el.clone(); // ghosted drag helper              
            }
          },
          opacity: 0.7,
          delay: 30,
          start : function(e,ui) {
            ui.item.css("display","block"); //prevent dragged element from getting hidden
          },
          stop : function(e,ui) {
            if(ui.item.siblings(".selected").length > 0) {
              console.log('foo')
            }
            self.save();
          }
        });

        $.each(self.tracks,function() {
          self.addTrack(this);
        });
        //show new tracks with fade fx
        $("tr.track-hidden",self.list).removeClass('track-hidden');
        self.loading = false;
      });
    }
  },
  save : function() {
    var tracks = "";
    $("tr",this.list).each(function() {
      tracks += this.track.id + ",";
    });
    if($("tr",this.list).length == 0) {
      tracks = "0";
    }
    $.post("/playlists/" + this.id ,{"_method":"PUT","tracks":tracks},function() {
      console.log('i has saved!!!11!! with '+ tracks)
    });
  },
  destroy : function() {
    console.log("deleting...")
    if(this.persisted) {
      $.post("/playlists/" + this.id,{"_method":"DELETE"},function() {
        console.log('deleted from server...')
      });      
    }
    $("#menu li[listid=" + this.id + "]").fadeOut('fast');
  },
  length : function() {
    return $("tr",this.list).length;
  },
  next : function() {
    $("tr",this.list).removeClass("playing");
    var nxt = $("tr:nth-child("+(this.currentPos+2)+")",this.list);
    if(nxt.length > 0) {
      this.currentPos++;
      this.loadTrack(this.currentPos);
    }
  },
  prev : function() {
    if (this.player.track.currentTime < 2) {
      var prev = $("tr:nth-child("+(this.currentPos)+")",this.list);
      if(prev.length > 0) {
        $("tr",this.list).removeClass("playing");
        this.currentPos--;
        this.loadTrack(this.currentPos);
      }      
    }
    else {
      this.player.track.currentTime = 0;
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
        $(this).toggleClass("selected");
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
        .click(function() {
          self.player.trackLists[hex_md5("user" + track.user.permalink)] = new SC.TrackList("Artist '" + track.user.username + "'",null,self.player, track.user.uri + "/tracks.js?filter=streamable&order=hotness&callback=?",false,hex_md5("user" + track.user.permalink),false);
          self.player.switchTab(hex_md5("user" + track.user.permalink));
          self.player.loadArtistInfo(track.user.uri);
          return false;
        }).end()
      .end()
      .find("td:nth-child(4)").css("width",self.colWidths[3]).text(SC.formatMs(track.duration)).end()
      .find("td:nth-child(5)").css("width",self.colWidths[4]).html(track.description).attr("title",track.description).end()
      .find("td:nth-child(6)").css("width",self.colWidths[5]).text(track.bpm).end()
      .find("td:nth-child(7)").css("width",self.colWidths[6]).html("<a href='#'>" + track.genre + "</a>")
        .find("a")
        .click(function() {
          var name = this.innerHTML
          self.player.trackLists[hex_md5("gen" + name)] = new SC.TrackList("Genre '" + name + "'",null,self.player,"http://api.soundcloud.com/tracks.js?filter=streamable&order=hotness&from_date=" + SC.utcYesterday() + "&to_date=" + SC.utcNow() + "&genres=" + name +"&callback=?",false,hex_md5("gen" + name));
          self.player.switchTab(hex_md5("gen" + name));
          return false;
        }).end()
      .end()
      .addClass("track-hidden")
      .appendTo(this.list);
    $("tr:last",this.list)[0].track = track;
    if(single) {
      $("tr:last",this.list).removeClass("track-hidden");
    }
  }
}

$(function() {
  p = new SC.Player();
});