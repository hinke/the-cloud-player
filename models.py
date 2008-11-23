from google.appengine.ext import db
import logging


class User(db.Model):
  google_user = db.UserProperty(required=True)
  date_created = db.DateTimeProperty(auto_now_add=True)
  
  def playlists(self):
    return (x for x in self.library_set.order("-position"))
  
  def has_playlist(self, playlist):
    for p in self.playlists():
      if p.playlist.key().id() == playlist.key().id():
        return True
    return False
    

class Playlist(db.Model):
  name = db.StringProperty(required=True, default='Playlist')
  date_created = db.DateTimeProperty(auto_now_add=True)
  collaborative = db.BooleanProperty(default=False)  
  tracks = db.TextProperty(default="0")
  smart = db.BooleanProperty(default=False)
  smart_filter = db.StringProperty()
  
  def serialize(self):
    s = "{"
    s += "'id':'" + str(self.key()) + "',"
    s += "'name':'" + self.name + "',"
    s += "'date_created':'" + str(self.date_created) + "',"
    s += "'collaborative':'" + str(self.collaborative) + "',"
    s += "'tracks':'" + self.tracks + "'" 
    s += "}"
    return s
    
  def library_item_for_current_user():
    q = db.GqlQuery("SELECT * FROM Library WHERE user = :user AND playlist = :playlist", user=utils.get_current_user(), playlist=self)  
    return q.get()

  def users(self):
    return (x for x in self.library_set)

class Library(db.Model):
  user = db.ReferenceProperty(User)
  playlist = db.ReferenceProperty(Playlist)
  is_owner = db.BooleanProperty(default=False)
  position = db.IntegerProperty(default=0)
  
  def serialize(self):
    s = "{"
    s += "'is_owner':'" + str(self.is_owner) + "',"
    s += "'position':'" + str(self.position) + "',"
    s += "'playlist':" + self.playlist.serialize() 
    s += "}"
    return s
  