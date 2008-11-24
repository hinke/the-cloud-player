from google.appengine.ext import db
import logging
import utils


class User(db.Model):
  google_user = db.UserProperty(required=True)
  date_created = db.DateTimeProperty(auto_now_add=True)
  
  def playlists(self):
    return (x for x in self.library_set.order("-position"))
  
  def has_playlist(self, playlist):
    for p in self.playlists():
        if p.playlist and p.playlist.key().id() == playlist.key().id():
          return True
    return False
    

class Playlist(db.Model):
  name = db.StringProperty(required=True, default='Playlist')
  date_created = db.DateTimeProperty(auto_now_add=True)
  collaborative = db.BooleanProperty(default=False)  
  tracks = db.TextProperty(default="0")
  smart = db.BooleanProperty(default=False)
  share_hash = db.StringProperty(required=True)

  version = db.IntegerProperty(default=0)
  
  #Smart playlist criteria
  genre = db.StringProperty(default="")
  tags = db.StringProperty(default="")
  uploaded_from = db.DateTimeProperty()
  uploaded_to = db.DateTimeProperty()
  bpm_from = db.IntegerProperty(default=0)
  bpm_to = db.IntegerProperty(default=0)
  search_term = db.StringProperty(default="")
  user_favorites = db.StringProperty(default="")
  order = db.StringProperty(default="")
  duration_from = db.IntegerProperty(default=0)
  duration_to = db.IntegerProperty(default=0)
  
  def serialize(self):
    s = "{"
    s += "'id':'" + str(self.key()) + "',"
    s += "'name':'" + self.name + "',"
    s += "'date_created':'" + str(self.date_created) + "',"
    s += "'collaborative':" + str(self.collaborative).lower() + ","
    s += "'tracks':'" + self.tracks + "'," 
    s += "'version':" + str(self.version) + "," 
    s += "'share_hash':'" + self.share_hash + "'," 
    s += "'smart':" + str(self.smart).lower()
    if self.smart:
      s += ",'smart_filter':{"
      s += "'genre':'" + self.genre + "',"
      s += "'tags':'" + self.tags + "',"
      s += "'uploaded_from':'" + str(self.uploaded_from) + "',"
      s += "'uploaded_to':'" + str(self.uploaded_to) + "',"
      s += "'bpm_from':" + str(self.bpm_from) + ","
      s += "'bpm_to':" + str(self.bpm_from) + ","
      s += "'search_term':'" + self.search_term + "',"
      s += "'user_favorites':'" + self.user_favorites + "',"
      s += "'order':'" + self.order + "',"
      s += "'duration_from':" + str(self.duration_from) + ","
      s += "'duration_to':" + str(self.duration_to) + ""
      s += "}"
    s += "}"
    return s
    
  def library_item_for_current_user(self):
    q = db.GqlQuery("SELECT * FROM Library WHERE user = :user AND playlist = :playlist", user=utils.get_current_user(), playlist=self)  
    return q.get()
  
  def has_user(self):
    for u in self.users():
        return True
    return False  
    
  def users(self):
    return (x for x in self.library_set)

class Library(db.Model):
  user = db.ReferenceProperty(User)
  playlist = db.ReferenceProperty(Playlist)
  is_owner = db.BooleanProperty(default=False)
  position = db.IntegerProperty(default=0)
  
  def serialize(self):
    s = "{"
    s += "'is_owner':" + str(self.is_owner).lower() + ","
    s += "'position':" + str(self.position) + ","
    s += "'playlist':" + self.playlist.serialize() 
    s += "}"
    return s
  