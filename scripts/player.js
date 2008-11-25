SC.Player = SC.Class();
SC.Player.prototype = {
  isPlaying: false,
  initialize: function() {
    if($.browser.safari) {
      this.track = new Audio("null.mp3");
    } else {
      this.flash("Sorry, this player only works in Safari for now!");
    }
    
    this.progress = $('#progress div:first');
    this.loading = $('#progress div.loading');
    this.progressParent = $('#progress');
    this.timecodes = $('#timecodes');
    
    var self = this;
    this.playButton = $('#play');
    this.playButton.click(function() {
      self.togglePlay();
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

    // show flash message if received a shared playlist
    if(location.search.search(/add_shared_playlist/) != -1) {
      self.flash("The playlist has been added to your library");      
    }

    // create smart playlist, bpm slider
    $("#pl-bpm-range-slider").slider({
      startValue : 120,
      min : 50,
      max : 250,
      slide : function(e, ui) {
        console.log(ui.value);
        //ui.value;
      },
      change : function(e, ui) {
        $("#pl-bpm-range").val(ui.value);
      }
    });

    // create smart playlist form
    $("#pl-create-form").submit(function() {
      var name = "smart pl" + Math.random(); // tmp should be replaced by naming box
      
      var base = "http://api.soundcloud.com/tracks.js?callback=?&filter=streamable";
      
      var q = "";
      
      if($("#pl-genre").val() != "") {
        q += ("&genres=" + $("#pl-genre").val());
      }

      if($("#pl-search-term").val() != "") {
        q += ("&q=" + $("#pl-search-term").val());
      }
      
      // add bpm range here
      
      var props = {
        playlist : {
          genres : "ambient",
          id : hex_md5("s" + q), // will not work
          name : "New Smart Playlist",
          version : 0,
        }
      }
      
      // missing persistence in backend, so can't finish this
      self.trackLists[hex_md5("gen" + name)] = new SC.Playlist(props,self);
      self.switchPlaylist(hex_md5("gen" + name));
      
      $("#lists").animate({top:0});
      $("#create-smart-playlist").animate({height: "hide"});
      return false;
    });
    
    $("#pl-cancel").click(function() {
      $("#lists").animate({top:0});
      $("#create-smart-playlist").animate({height: "hide"});
      return false;
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
      sidebarWidth = 200;
    }
    
    $("#sidebar").width(sidebarWidth);
    $("#main-container").css("left",sidebarWidth);
    $("#artwork").width(sidebarWidth);
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
        if(withinPlaylistPaneDragArea(this,e)) {
          $(document)
            .mouseup(function() {
              $(document).unbind("mousemove");
            })
            .mousemove(function(ev) {
              var colWidth = ev.clientX - ($pane.offset().left);
              $pane.width(colWidth);
              if(self.showingArtwork) {
                $pane.css("bottom",colWidth+59);
              }
              $artwork.width(colWidth+9);
              $artwork.height(colWidth+9);
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
      this.volume = 1;
    }

    // volume
    $("#volume").slider({
      startValue : this.volume*100,
      min : 0,
      max : 100,
      slide : function(e, ui) {
        self.track.volume = self.volume = ui.value / 100;
      },
      change : function(e, ui) {
        $.cookie('volume',ui.value / 100); // save the volume in a cookie
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
          self.removePlaylist("search1");
          var q = $("#q").val();
          var props = {
            playlist: {
              id : "search1",
              name : "Search for '" + q + "'",
              version : 0,
              dontPersist : true,
              search : true,
              smart : true,
              search_term : q
            }
          }

          self.trackLists["search1"] = new SC.Playlist(props ,self);
          self.switchPlaylist("search1");
        } else if (ev.keyCode === 27) {
          $("#q").blur();
        }
      });
    
    // add playlist button
    $("#add-playlist").click(function() {
      if($("body").hasClass("logged-in")) {
        var name = prompt("Please name your playlist", "My Playlist");
        if(name) {
          $.post("/playlists",{'name':name,'position': 0},function(data) {
            var item = eval('(' + data + ')');
            self.trackLists[item.playlist.id] = new SC.Playlist(item, self);
            self.switchPlaylist(item.playlist.id);
          });
        }
        return false;
      }
    });

    // smart playlists button
    $("#add-smart-playlist").click(function() {
      if($("body").hasClass("logged-in")) {
        $("#lists").animate({top:140});
        $("#artist-info").animate({height:"hide"});
        $("#create-smart-playlist").animate({height:"show"},function() {
          $("#pl-genre").val("Ambient").select().focus();
        });
        return false;
      }
    });

    // remove playlist items on press delete
    $(window).keydown(function(ev) {
      if(!$("#q")[0].focused) { // don't listen to key events if search field is focused
        var currentTrackList = self.trackLists[$("#playlists li.active:first").attr('listId')]; // optimize?
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
    
    // click behaviour for transport buttons
    $("#play,#prev,#next,#rand,#loop,#add-playlist,#add-smart-playlist").mousedown(function() {
      $(this).addClass("click");
    }).mouseup(function() {
      $(this).removeClass("click");
    });
    
    this.trackLists = {};

    // load hot tracks if not logged in user
    if($("body").hasClass("logged-in")) {

      // load playlists for user
      $.getJSON("/playlists",function(playlists) {
        $.each(playlists,function() {
          self.trackLists[this.playlist.id] = new SC.Playlist(this, self);
        });

        if(playlists.length > 0) {
          self.switchPlaylist(playlists[0].playlist.id);
        }
      });      
    } else { // not logged in, then load a few standard playlists without persisting
      var props = {
        playlist: {
          id : "hot",
          name : "Hot Tracks",
          smart : true,
          version : 0,
          search_term : "",
          order : "hotness"
          //dontPersist : true
        }
      }
      
      self.trackLists['hot'] = new SC.Playlist(props,self);
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
        self.trackLists[ui.item.attr('listid')].save();
      }
    });

  },
  load: function(track) {
    this.track.pause();
    this.track = null;
    this.track = new Audio(track.stream_url + "?stream_token=84d939bca386ec6f54f1d68d8d9b9bf3");
    this.track.volume = this.volume;
    var self = this;

    this.track.addEventListener("ended", function() {
      self.isPlaying = false;
      self.currentPlaylist.next();
    });

    //$("#progress").fadeIn("fast");
    $("#artist")
      .hide()
      .html("<a href='#' class='artist-link'>" + track.user.username + "</a><div>" + track.title + "</div>")
      .find("a")
        .click(function() { // ugly, this code is duplicated from artist playlist generator
          self.trackLists[hex_md5("user" + track.user.permalink)] = new SC.Playlist("Artist '" + track.user.username + "'",self, track.user.uri + "/tracks.js?filter=streamable&order=hotness&callback=?",false,hex_md5("user" + track.user.permalink),false);
          self.switchPlaylist(hex_md5("user" + track.user.permalink));
          self.loadArtistInfo(track.user.uri);
          return false;
        }).end()
      .fadeIn();
    $("#timecodes").hide().fadeIn();
    $("#check-track-on-sc").hide().html("<a href='" + track.permalink_url + "' target='_blank'>Check this track on SoundCloud »</a>" + "&nbsp;&nbsp;&nbsp;<a href='" + track.permalink_url + "/stats' target='_blank'>Stats »</a>").fadeIn("slow");
    
    if(track.purchase_url) {
      $("#check-track-on-sc").append("&nbsp;&nbsp;&nbsp;<a href='" + track.purchase_url + "' target='_blank'>Buy Track »</a>");
    }
    
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
    $("#progress").fadeOut("slow",function() {
      self.loadWaveform(track);
    });
  },
  flash: function(message) {
    $("#flash").find("div").text(message).end().addClass("on");
    setTimeout(function(){$("#flash").removeClass("on")},2000);
  },
  loadWaveform: function(track) {
    var self = this;
    self.progressParent.css("background-image","url("+track.waveform_url+")");
    $("#progress").fadeIn("slow");
    $.getJSON("http://api.soundcloud.com/users/"+track.user_id+".js?callback=?",function(user) {
      //self.progressParent.css("background-image","url("+track.waveform_url+")");
      $("#progress").fadeIn("slow");
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
    $("#playlists").animate({bottom:$("#artwork").width()+50});
    $("#artwork").animate({height:"show"});
    this.showingArtwork = true;
  },
  hideArtworkPane: function() {
    $("#playlists").animate({bottom:50});
    $("#artwork").animate({height: 'hide'});
    this.showingArtwork = false;
  },
  switchPlaylist: function(id) {
    $("#lists > div").hide();
    $("#lists > #list-"+id).show();
    $("#playlists li").removeClass("active");
    $("#playlists li[listId="+id+"]").addClass("active");
  },
  removePlaylist : function(id) {
    if($("#playlists li[listId="+id+"]").length > 0) {
      this.trackLists[id] = null;
      $("#lists #list-"+id).remove();
      $("#playlists li[listId="+id+"]").remove();      
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
    $("body").addClass("playing");
    var self = this;
    this.redrawTimer = setInterval(function(){
      self.progress.css('width',(self.track.currentTime/self.track.duration)*100+"%");
      self.loading.css('width',(self.track.buffered.end()/self.track.duration)*100+"%");
      $('span:first',self.timecodes).html(SC.formatMs(self.track.currentTime*1000));
      $('span:last',self.timecodes).html(SC.formatMs(self.track.duration*1000));
    },200);
  },
  stop: function() {
    this.track.pause();    
    this.isPlaying = false;
    $("body").removeClass("playing");
    clearInterval(this.redrawTimer);
  }
};

// init the app
$(function() {
  p = new SC.Player();
});