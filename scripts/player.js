SC.Player = SC.Class();
SC.Player.prototype = {
  isPlaying: false,
  initialize: function() {
    if($.browser.safari)
      this.track = new Audio("http://soundcloud.com/forss/soulhack.mp3");
    this.progress = $('#progress div:first');
    this.progressParent = $('#progress');
    this.timecodes = $('#timecodes');
    
    var self = this;
    this.playButton = $('#play');
    this.playButton.click(function() {
      self.togglePlay();
    });

    $('#next').click(function() {
      self.currentPlaylist.next();
    });

    $('#prev').click(function() {
      self.currentPlaylist.prev();
    });

    $('#tempo-up').click(function() {
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
    
    $(window).keydown(function(ev) {
      if(ev.keyCode === 32) {
        self.togglePlay();
      }
      else if (ev.keyCode === 39) {
        self.currentPlaylist.next();
      }
      else if (ev.keyCode === 37) {
        self.currentPlaylist.prev();        
      }
    });
        
    this.playlist = [];

    $("#progress").click(function(ev) {
      var percent = ev.layerX/($("#progress").width());
      self.track.currentTime = self.track.duration*percent;
    });

    $("#q")
      .focus(function() {
        $(this).val('');
      })
      .blur(function() {
        $(this).val('Search');
      })
      .keydown(function(ev) {
        if(ev.keyCode === 13) {
          self.removeTab("search1");
          var q = $("#q").val();
          self.trackLists['SearchResults'] = new SC.TrackList("Search for '" + q + "'",null,self,"http://api.soundcloud.com/tracks.js?q="+ q +"&callback=?",false,hex_md5(q));
          self.switchTab(hex_md5(q));
        }
      });
    
    $("#menu li:first a").click(function() { // ugly, playlists cant have spaces
      var name = prompt("Name your playlist", "MyPlaylist");
      if(name) {
        $.post("/playlists",{'name':name},function(playlist) {
          self.trackLists[name] = new SC.TrackList(name, null, self,null,false,playlist.id);
        });
      }
      return false;
    });

    $(window).keypress(function(ev) {
      $("#lists > div:visible tbody tr.marked").remove();
    });

    this.trackLists = {};

    // load playlists for user
    
    var myPlaylists = [{name:'my playlist 1', id: 'id1',tracks: '43118,24984,44276'},
    {name:'my playlist 2', id: 'id2',tracks: '44276,24984'},
    {name:'my playlist 3', id: 'id3',tracks: '43118,24984'}];

    $.each(myPlaylists,function() {
      self.trackLists[this.id] = new SC.TrackList(this.name,null,self,"http://api.soundcloud.com/tracks.js?ids=" + this.tracks + "&callback=?",false,this.id);
    });

    //self.trackLists['Dashboard'] = new SC.TrackList("Dashboard",null,self,"http://api.soundcloud.com/events.js?filter=tracks&callback=?", true);
    //self.trackLists['Favorites'] = new SC.TrackList("Favorites",null,self,"http://api.soundcloud.com/me/favorites.js?callback=?");
    //self.trackLists['MyTracks'] = new SC.TrackList("MyTracks",null,self,"http://api.soundcloud.com/me/tracks.js?callback=?");

    // hot tracks
    var now = new Date();
    var utcNow = SC.utcDate(now);

	  // yesterday
    now.setDate(now.getDate()-1);

    var utcYesterday = SC.utcDate(now);
    self.trackLists['Hot'] = new SC.TrackList("Hot Tracks",null,self,"http://api.soundcloud.com/tracks.js?&order=hotness&from_date=" + utcYesterday + "&to_date=" + utcNow + "&callback=?",false,'hot');

    self.switchTab("hot");

    // ugly hack until we figure out callbacks
    this.checkIfEnded();

  },
  checkIfEnded: function() {
    var self = this;
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
    console.log(track.stream_url + "?stream_token=84d939bca386ec6f54f1d68d8d9b9bf3")
    //console.log(track.user.username)
    $("#artist").hide().html(track.user.username + " - " + track.title).fadeIn();
    $("#timecodes").hide().fadeIn();
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
          description: "artist - " + track.title, 
          priority: 1, 
          sticky: false,
          identifier: "foo",
          onclick: function() {}
      })      
    }
    this.play();
    this.loadWaveform(track);
  },
  tempoUp: function() {
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
  flash: function(message) {
    $("#flash").find("div").text(message).end().addClass("on");
    setTimeout(function(){$("#flash").removeClass("on")},1500);
  },
  loadWaveform: function(track) {
    var self = this;
    $.getJSON("http://api.soundcloud.com/users/"+track.user_id+".js?callback=?",function(user) {
      self.progressParent.css("background-image","url("+track.waveform_url+")");
    });
  },
  switchTab : function(id) {
    $("#lists > div").hide();
    $("#lists > #list-"+id).show();
    $("#menu li").removeClass("active");
    $("#menu li[listId="+id+"]").addClass("active");
  },
  addTab : function(id, name, pane) {
    var self = this;
    $("<li listId='" + id + "'><a href='#'>"+name+"</a></li>")
      .find('a').click(function() {
        self.switchTab(id);
        return false;
      })
      .attr('pane',pane)
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
  			  console.log($(this)[0])
  				var listId = $(this).attr('listId');
  				self.trackLists[listId].addTrack($(ui.draggable)[0].track,true);
          self.flash("The track " + $(ui.draggable)[0].track.title + " was added to the playlist");
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
    var self = this;
    this.redrawTimer = setInterval(function(){
      self.progress.css('width',(self.track.currentTime/self.track.duration)*100+"%");
      $('span:first',self.timecodes).html(SC.formatMs(self.track.currentTime*1000));
      $('span:last',self.timecodes).html(SC.formatMs(self.track.duration*1000));
    },30);
  },
  stop: function() {
    this.track.pause();    
    this.isPlaying = false;
    this.playButton.html('➤');
    clearInterval(this.redrawTimer);
  }
};

// todo: better internal data structure for playlists, know position in list, remove track etc
SC.TrackList = SC.Class();
SC.TrackList.prototype = {
  initialize: function(name,tracks,player,tracksUrl,events,id) {
    var self = this;
    this.name = name;
    this.id = id;
    this.player = player; // ref to the player
    this.offset = 0; // the offset when getting more tracks through the rest interface
    this.endOfList = false; // this is false until server returns less than 50 hits
    this.loading = false; // cheap mans queueing
    this.events = events; // if mode is events, then event entries will be parsed for tracks
    this.currentPos = 0; // this is the current position in the list at which a track is playing, needed for continous play through playlists

    $('#tracklist')
      .clone()
      .attr('id',"list-" + id)
      .appendTo("#lists")
      .hide();
      
    this.dom = $("#lists > div:last"); // a bit ugly

    this.list = $("tbody",this.dom);

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
        // if events mode, then parse out the tracks first
        if(self.events) {
          $.each(data,function() {
            if(this.type === 'Track') {
              self.tracks.push(this.track);
            }
          });          
        }
        else {
          self.tracks = data;
        }
        $("> div:last",self.list).remove();

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
    // $.post("/playlist/" + this.id ,{"_method":"PUT","tracks":tracks},function() {
    //   // commence ajax put
    // });
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
    $("tr:nth-child("+(this.currentPos+1)+")",this.list).addClass("playing");
    var track = $("tr:nth-child("+(this.currentPos+1)+")",this.list)[0].track;
    this.player.load(track);
  },
  addTrack : function(track,single) {
    track.description = (track.description != null ? track.description.substr(0,50) + "..." : "");

    if (track.bpm == null) {
      track.bpm = "";
    }

    var self = this;
    
    //populate table
    $('#tracklist-row table tr')
      .clone()
      .dblclick(function() {
        self.player.currentPlaylist = self;
        // find out at which position we are at in the playlist, and store that as the currentPos
        var trs = $(this).parents("tbody").find("tr");
        var e = 0;
        var that = this;
        $.each(trs,function(i) {
          if(this === that) {
            self.currentPos = i;
            return;
          }
        });
        self.loadTrack(self.currentPos);
      })
      .click(function() {
        $(this).toggleClass("marked");
      })
      .find("td:nth-child(1)").text(track.title).end()
      .find("td:nth-child(2)").text(track.user.username).end() // fix this with new field in tracks API
      .find("td:nth-child(3)").text(SC.formatMs(track.duration)).end()
      .find("td:nth-child(4)").text(track.description).end()
      .find("td:nth-child(5)").text(track.bpm).end()
      .find("td:nth-child(6)").text(track.sharing).end()
      .addClass("track-hidden")
      .appendTo(this.list)
      .draggable({
        helper: 'clone',
        scroll: true,
        opacity: 0.6,
        appendTo: "#menu"
      });
    $("tr:last",this.list)[0].track = track;
    if(single) {
      $("tr:last",this.list).removeClass("track-hidden");
    }
  }
}

$(function() {
  p = new SC.Player();
});