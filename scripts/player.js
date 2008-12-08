SC.Player = SC.Class();
SC.Player.prototype = {
  isPlaying: false,
  initialize: function() {

    this.audioTracks = {}; // has for all sounds
    this.progress = $('#progress div:first');
    this.loading = $('#progress div.loading');
    this.progressParent = $('#progress');
    
    var self = this;
    this.playButton = $('#play');
    this.playButton.click(function() {
      self.togglePlay();
    });

    $("#about-box a.close").click(function(ev) {
      $("#about-box").fadeOut();
      ev.preventDefault();
    });
    
    $("a#about").click(function(ev) {
      $("#about-box").fadeIn();
      ev.preventDefault();
    });

    // read rand mode from cookie
    this.randomPlaylist = parseInt($.cookie('random_playlist'));
    if(!this.randomPlaylist) {
      this.randomPlaylist = 0;
    }
    if(self.randomPlaylist) {
      $("#rand").addClass("on");
    }
    $("#rand").click(function() {
      $(this).toggleClass("on");
      self.randomPlaylist = ($(this).hasClass("on") ? 1 : 0);
      $.cookie('random_playlist', self.randomPlaylist);
    });

    // read loop mode from cookie
    this.loopPlaylist = parseInt($.cookie('loop_playlist'));
    if(!this.loopPlaylist) {
      this.loopPlaylist = 0;
    }
    if(self.loopPlaylist) {
      $("#loop").addClass("on");
    }
    $("#loop").click(function() {
      $(this).toggleClass("on");
      self.loopPlaylist = ($(this).hasClass("on") ? 1 : 0);
      $.cookie('loop_playlist', self.loopPlaylist);
    });

    // create smart playlist, bpm slider
    $("#pl-bpm-range-slider").slider({
      min : 0,
      max : 250,
      range: true,
      slide : function(e, ui) {
        $("#bpm-range-start").text($("#pl-bpm-range-slider").slider("value",0));
        $("#bpm-range-stop").text(Math.floor($("#pl-bpm-range-slider").slider("value",0) + ui.range));
      },
      change : function(e, ui) {
        $("#pl-bpm-range-start").val($("#pl-bpm-range-slider").slider("value",0));
        $("#pl-bpm-range-stop").val($("#pl-bpm-range-slider").slider("value",0) + ui.range);
      }
    });
    
    // code to prevent keypress event from triggering when creating smart playlist
    this.smartPlaylistFormFocus = false;
    $("#pl-search-term, #pl-genre, #pl-favorite, #pl-artist").focus(function() {
      self.smartPlaylistFormFocus = true;
    }).blur(function() {
      self.smartPlaylistFormFocus = false;
    });
    
    // create smart playlist form
    $("#pl-create-form").submit(function(ev) {
      $("input,select",this).blur();
      
      var name = "smartpl" + Math.random(); // tmp should be replaced by naming box
      
      var pos = $("#playlists li:not(.dont-persist)").index($("#playlists li:not(.dont-persist):last"))+1; //FIX ME don't duplicate this code, break out to function
      var props = {
        position: pos,
        smart : true,
        name : "New Smart Playlist",
        version : 0,
        genres : $("#pl-genre").val(),
        bpm_from : Math.floor($("#pl-bpm-range-start").val()),
        bpm_to : Math.floor($("#pl-bpm-range-stop").val()),
        user_favorites : $("#pl-favorite").val().toLowerCase().replace(/\s/,"-"),  // FIXME: cheap username->permalink algoritm
        order : $("#pl-order").val(),
        search_term : $("#pl-search-term").val(),
        artist : $("#pl-artist").val().toLowerCase().replace(/\s/,"-") // FIXME: cheap username->permalink algoritm
      }

      $.post("/playlists",props,function(data) {
        var pl = eval('(' + data + ')');
        self.playlists[pl.playlist.id] = new SC.Playlist(pl,self);
        self.switchPlaylist(pl.playlist.id);
        $("#playlists li:last a:first").click();
      });

      
      $("#lists").animate({top:0});
      $("#create-smart-playlist").animate({height: "hide"});

      ev.stopPropagation();
      return false;
    });
    
    $("#pl-cancel").click(function(ev) {
      $("#lists").animate({top:0});
      $("#create-smart-playlist").animate({height: "hide"});
      ev.preventDefault();
    });

    // change nickname
    $("a.nickname:first").click(function(ev) {
      var nick = prompt("Change your nickname:", this.innerHTML);
      var self = this;
      if(nick) {
        $.post("/user",{nickname:nick},function() {
          self.innerHTML = nick;
        });
      }
      ev.preventDefault();
    });

    // resizable playlists pane
    function withinPlaylistPaneDragArea(el,e) {
      var left = e.clientX-$(el).offset().left-($(el).width()-5);
      if(left > 0 && left < 4) {
        return true;
      } else {
        return false;
      }
    }
    
    // init width from cookie
    var sidebarWidth = parseInt($.cookie('playlist_pane_width'));
    if(!sidebarWidth) {
      sidebarWidth = 220;
    }
    
    $("#sidebar").width(sidebarWidth);
    $("#main-container").css("left",sidebarWidth);
    $("#artwork").height(sidebarWidth);

    $("#sidebar")
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
        var $cont = $("#main-container");
        var $playlists = $("#playlists");
        var $createPlaylists = $("#create-playlists");
        if(withinPlaylistPaneDragArea(this,e)) {
          $(document)
            .mouseup(function() {
              $(document).unbind("mousemove");
            })
            .mousemove(function(ev) {
              var colWidth = ev.clientX - ($pane.offset().left);
              $pane.width(colWidth);
              if(self.showingArtwork) {
                $playlists.css("bottom",colWidth+25);
                $createPlaylists.css("bottom",colWidth+0);
              }
              $artwork.height(colWidth);
              $cont.css("left",colWidth);
            });
        }
      })
      .mouseup(function() {
        $.cookie('playlist_pane_width',$(this).width());
      });

    // set volume from cookie
    this.volume = parseFloat($.cookie('volume'));
    if(!this.volume) {
      this.volume = 100; // default to max
    }

    // volume
    $("#volume").slider({
      startValue : this.volume,
      min : 0,
      max : 100,
      slide : function(e, ui) {
        if(self.audio) {
          self.volume = ui.value;
          self.audio.setVolume(self.volume);
        }
      },
      change : function(e, ui) {
        $.cookie('volume',ui.value); // save the volume in a cookie
      }
    });

    $('#next').click(function() {
      self.currentPlaylist.next();
    });

    $('#prev').click(function() {
      self.currentPlaylist.prev();
    });
         
    this.playlist = [];

    // artist info close btn
    $("#artist-info a.close").click(function(ev) {
      self.hideArtistPane();
      ev.preventDefault();
    });

    // artwork loading callback
    $("#artwork img, #artist-info img").load(function() {
      $(this).addClass("loaded");
    });

    $("#progress").click(function(ev) {
      var percent = (ev.clientX-$("#progress").offset().left)/($("#progress").width());
      if(self.audio.durationEstimate*percent < self.audio.duration) {
        self.audio.setPosition(self.audio.durationEstimate*percent);        
      }
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
        $(this).val('Search Artists & Tracks');
      })
      .keydown(function(ev) {
        if(ev.keyCode === 13) {
          self.removePlaylist("search1");
          var q = $("#q").val();

          self.playlists["search1"] = new SC.Playlist({
            is_owner: true,
            playlist: {
              id : "search1",
              name : "Search for '" + q + "'",
              version : 0,
              dontPersist : true,
              search : true,
              smart : true,
              smart_filter : {
                search_term : q,
                order: "hotness"
              }
            }
          },self);
          self.switchPlaylist("search1");
        } else if (ev.keyCode === 27) {
          $("#q").blur();
        }
      });
    
    // add playlist button
    $("#add-playlist").click(function(ev) {
      if($("body").hasClass("logged-in")) {
        var pos = $("#playlists li:not(.dont-persist)").index($("#playlists li:not(.dont-persist):last"))+1; //FIXME respect non-persisted playlists, and first
        $.post("/playlists",{'name':"Untitled playlist",'position': pos},function(data) {
          var item = eval('(' + data + ')');
          self.playlists[item.playlist.id] = new SC.Playlist(item, self);
          self.switchPlaylist(item.playlist.id);
          $("#playlists li:last a:first").click();
        });
        ev.preventDefault();
      }
    });

    // smart playlists button
    $("#add-smart-playlist").click(function(ev) {
      if($("body").hasClass("logged-in")) {
        $("#lists").animate({top:135});
        $("#artist-info").animate({height:"hide"});
        $("#create-smart-playlist").animate({height:"show"},function() {
          setTimeout(function() { // ui.slider bug so have to delay execution here 1ms
            $("#pl-bpm-range-slider").slider("moveTo",250,1);
            $("#pl-bpm-range-slider").slider("moveTo",0,0);
          },10);
          $("#pl-genre,#pl-artist,#pl-favorite,#pl-search-term").val("")
          $("#pl-genre").focus();
        });
        ev.preventDefault();
      }
    });
    
    // main keyboard listener
    $(window).keydown(function(ev) {
      if(!$("#q")[0].focused && !window.editingText) { // don't listen to key events if search field is focused or if editing text
        if(ev.keyCode === 8 && !self.smartPlaylistFormFocus) { // delete selected tracks
          if($("tr.selected",self.selectedPlaylist.list).length > 0) {
            if(self.selectedPlaylist.editable) {
              $("tr.selected",self.selectedPlaylist.list).remove();
              self.selectedPlaylist.save();              
            }
            return false;
          }
        } else if(ev.keyCode === 32) { // start/stop play
          self.togglePlay();
        } else if (ev.keyCode === 13 && !self.smartPlaylistFormFocus) { // start selected track, don't trigger if focus on smart playlist create form
          if($("tr.selected",self.selectedPlaylist.list).length > 0) {
            var idx = $("tr", self.selectedPlaylist.list).index($("tr.selected",self.selectedPlaylist.list));            
            self.selectedPlaylist.loadTrack(idx);
          } else if ($("tr",self.selectedPlaylist.list).length > 0) {
            $("tr", self.selectedPlaylist.list).eq(0).addClass("selected");
            var idx = 0;
            self.selectedPlaylist.loadTrack(idx);
          }
        } else if (ev.keyCode === 40) { // arrow down, select next
          var sel = $("tr.selected:last",self.selectedPlaylist.list);
          if(sel.length > 0 && sel.next().length > 0) { // check so that el exists
            
            // a bit messy code that scrolls with the selected element
            if(sel.next().offset().top > (($("> div:last",self.selectedPlaylist.dom).height()+$("> div:last",self.selectedPlaylist.dom).offset().top) - 19) ) {
              $("> div:last",self.selectedPlaylist.dom)[0].scrollTop += 19;
            }
            
            if(ev.shiftKey) { // select next track
              $("tr.selected",self.selectedPlaylist.list).next().addClass("selected");
            } else {
              $("tr", self.selectedPlaylist.list).removeClass("selected");
              sel.next().addClass("selected");
            }
          }
          return false;
        } else if (ev.keyCode === 38) { // arrow up, select prev
          var sel = $("tr.selected:first",self.selectedPlaylist.list);
          if(sel.length > 0 && sel.prev().length > 0) { // check so that el exists

            // a bit messy code that scrolls with the selected element
            if(sel.prev().offset().top < ($("> div:last",self.selectedPlaylist.dom).offset().top) ) {
              $("> div:last",self.selectedPlaylist.dom)[0].scrollTop -= 19;
            }

            if(ev.shiftKey) { // select prev track
              $("tr.selected",self.selectedPlaylist.list).prev().addClass("selected");
            } else {
              $("tr", self.selectedPlaylist.list).removeClass("selected");
              sel.prev().addClass("selected");
            }
          }
          return false;
        } else if (ev.keyCode === 39 && self.isPlaying) { // arrow next, play next if playing
          self.selectedPlaylist.next();
        } else if (ev.keyCode === 37 && self.isPlaying) { // arrow prev, play prev if playing
          self.selectedPlaylist.prev();
        } else if (ev.keyCode === 70 && ev.metaKey) { // cmd-f for search
          $("#q").focus();
          return false;
        } else if (ev.keyCode === 65 && ev.metaKey) { // cmd-a for select all
          $("tr",self.selectedPlaylist.list).addClass("selected");
          return false;
        }
      } else {
        if (ev.keyCode === 70 && ev.metaKey) { // cancel normal browser behaviour for cmd-f
          return false;
        }
      }
    });
    
    // click behaviour for transport buttons
    $("#play,#prev,#next,#rand,#loop,#add-playlist,#add-smart-playlist").mousedown(function() {
      $(this).addClass("click");
    }).mouseup(function() {
      $(this).removeClass("click");
    });
    
    this.playlists = {};

    // load hot tracks if not logged in user
    if($("body").hasClass("logged-in")) {

      // load playlists for user
      $.getJSON("/playlists",function(playlists) {
        $.each(playlists,function() {
          self.playlists[this.playlist.id] = new SC.Playlist(this, self);
        });
        
        // show flash message if received a shared playlist
        if(location.search.search(/add_shared_playlist/) != -1) {
          self.switchPlaylist($("#playlists li:last").attr("listId")); // select shared playlist
          self.flash("The playlist has been added to your library");
        } else if (location.search.search(/playlist_not_found/) != -1) {
          self.flash("The playlist was not found");
        } else {
          if(playlists.length > 0) { // switch to first playlist
            self.switchPlaylist(playlists[0].playlist.id);
          }          
        }
        
      });
    } else { // not logged in, then load a few standard playlists without persisting
      self.playlists['hot'] = new SC.Playlist({
        is_owner: true,
        playlist: {
          id : "hot",
          name : "Hot Tracks",
          smart : true,
          version : 0,
          smart_filter : {
            order : "hotness"
          }
        }
      },self);

      self.playlists['indie'] = new SC.Playlist({
        is_owner: true,
        playlist: {
          id : "indie",
          name : "Indie",
          smart : true,
          version : 0,
          smart_filter : {
            order : "latest",
            genres : "indie"
          }
        }
      },self);

      self.playlists['deephouse'] = new SC.Playlist({
        is_owner: true,
        playlist: {
          id : "deephouse",
          name : "Deep House",
          smart : true,
          version : 0,
          smart_filter : {
            order : "latest",
            genres : "deep house"
          }
        }
      },self);

      self.playlists['rock'] = new SC.Playlist({
        is_owner: true,
        playlist: {
          id : "rock",
          name : "Rock",
          smart : true,
          version : 0,
          smart_filter : {
            order : "latest",
            genres : "rock"
          }
        }
      },self);

      self.playlists['techno'] = new SC.Playlist({
        is_owner: true,
        playlist: {
          id : "techno",
          name : "Techno",
          smart : true,
          version : 0,
          smart_filter : {
            order : "latest",
            genres : "techno"
          }
        }
      },self);

      self.playlists['spokenword'] = new SC.Playlist({
        is_owner: true,
        playlist: {
          id : "spokenword",
          name : "Spoken Word",
          smart : true,
          version : 0,
          smart_filter : {
            order : "latest",
            genres : "spoken+word,spokenword"
          }
        }
      },self);

      self.playlists['dubstep'] = new SC.Playlist({
        is_owner: true,
        playlist: {
          id : "dubstep",
          name : "Dubstep",
          smart : true,
          version : 0,
          smart_filter : {
            order : "latest",
            genres : "dubstep, dub+step"
          }
        }
      },self);
      
      // show about box
      $("#about-box").fadeIn();
      
      self.switchPlaylist("hot");
    }
    
    $("#playlists").sortable({
      placeholder : "droppable-placeholder",
      helper : function(e,el) {
        return el.clone(); // ghosted drag helper
      },
      opacity: 0.7,
      delay: 30,
      start : function(e,ui) {
        ui.item.css("display","block"); //prevent dragged element from getting hidden
      },
      stop : function(e,ui) {
        if(!ui.item.hasClass("dont-persist")) { // save if playlist is persisted
          self.playlists[ui.item.attr('listid')].save();          
        }
      }
    });

  },
  load: function(track) {
    var id = track.stream_url.substring(track.stream_url.lastIndexOf("/")+1);
    this.loading.css('width',"0%");
    this.progress.css('width',"0%");
    $("#player-display img.logo").fadeOut('slow');
    $("#progress").fadeIn('slow');
    
    var self = this;
    this.audioTracks[id] = soundManager.createSound({
      id: id,
      url: track.stream_url + "?stream_token=player",
      volume : this.volume,
      whileloading : SC.throttle(200,function() {
          self.loading.css('width',(self.audio.bytesLoaded/self.audio.bytesTotal)*100+"%");
      }),
      whileplaying : SC.throttle(200,function() {
        self.progress.css('width',(self.audio.position/self.audio.durationEstimate)*100+"%");
        $('#position').html(SC.formatMs(self.audio.position));
        $('#duration').html(SC.formatMs(self.audio.durationEstimate));
      }),
      onfinish : function() {
        self.isPlaying = false;
        self.currentPlaylist.next();        
      },
      onload : function () {
        self.loading.css('width',"100%");
      }
    });

    if(this.audio) {
      this.audio.stop();
    }
    this.audio = null;
    this.audio = this.audioTracks[id]; // set current audio to the audio in the audioTracks hash
    if(this.audio.loaded) {
      this.loading.css('width',"100%");
    }

    this.audio.setVolume(this.volume); // set vol again in case vol changed and going back to same track again

    $("#artist")
      .hide()
      .html("<a href='#' class='artist-link'>" + track.user.username + "</a> · <span>" + track.title + "</span>" + " <a href='" + track.permalink_url + "' target='_blank'>»</a>" + (track.purchase_url ? " <a href='" + track.purchase_url + "' target='_blank'>Buy »</a>" : ""))
      .find("a.artist-link")
        .click(function(ev) {
          self.removePlaylist("artist");
          self.playlists["artist"] = new SC.Playlist({
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
          },self);
          self.switchPlaylist("artist");
          self.loadArtistInfo(track.user.uri);
          ev.preventDefault();
        }).end()
      .fadeIn();
    
    /* commented out timed comment implementation for now */
/*    $("#progress span.marker").remove();
    $.getJSON("http://api.soundcloud.com/tracks/"+track.id+"/comments.js?callback=?",function(comments) {
      $.each(comments,function() {
        if(this.timestamp) {
          $("<span class='marker'></span>")
            .css("left",((this.timestamp/track.duration)*100)+"%")
            .appendTo("#progress");
        }
      });
    });*/
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
    $("#progress img").fadeOut("slow",function() {
      var self = this;
      $("#progress img").attr("src",track.waveform_url);
      $("#progress img").load(function() {
        $("#progress img").fadeIn("slow");
      });
/*      $.getJSON("http://api.soundcloud.com/users/"+track.user_id+".js?callback=?",function(user) {
        $("#progress").fadeIn("slow");
      });*/
    });
  },
  flash: function(message) {
    $("#flash").find("div").text(message).end().fadeIn();
    setTimeout(function(){$("#flash").fadeOut();},1500);
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
    $("#create-smart-playlist").animate({height: "hide"});
    $("#lists").animate({top:156});
    $("#artist-info").animate({height:"show"});
  },
  hideArtistPane: function() {
    $("#lists").animate({top:0});
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
    $("#playlists").animate({bottom:$("#artwork").width()+25});
    $("#create-playlists").animate({bottom:$("#artwork").width()});
    $("#artwork").animate({height:"show"});
    this.showingArtwork = true;
  },
  hideArtworkPane: function() {
    $("#playlists").animate({bottom:25});
    $("#create-playlists").animate({bottom:0});
    $("#artwork").animate({height: 'hide'});
    this.showingArtwork = false;
  },
  switchPlaylist: function(id) {
    $("#lists > div").hide();
    $("#lists > #list-"+id).show();
    $("#playlists li").removeClass("active");
    $("#playlists li[listId="+id+"]").addClass("active");
    this.selectedPlaylist = this.playlists[id];
  },
  removePlaylist : function(id) {
    if($("#playlists li[listId="+id+"]").length > 0) {
      this.playlists[id] = null;
      $("#lists #list-"+id).remove();
      $("#playlists li[listId="+id+"]").remove();      
    } else if (this.playlists[id]) { // for hidden playlists, like artist/genre playlists
      this.playlists[id] = null;
      $("#lists #list-"+id).remove();      
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
    if(this.audio) {
      if(this.audio.paused) {
        this.audio.resume();
      } else {
        this.audio.play();
      }
      this.isPlaying = true;
      $("body").addClass("playing");
    }
  },
  stop: function() {
    if(this.audio) {
      this.audio.pause();      
      this.isPlaying = false;
      $("body").removeClass("playing");
    }
  }
};

soundManager.flashVersion = 9;
soundManager.url = '/scripts/.';
soundManager.useConsole = true;
soundManager.consoleOnly = true;
soundManager.debugMode = false; // disable debug mode
soundManager.defaultOptions.multiShot = false;
soundManager.useHighPerformance = false;

soundManager.onload = function() {
  // soundManager is ready to use (create sounds and so on)
  // init the player app
  p = new SC.Player();
}