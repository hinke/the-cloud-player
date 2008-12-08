from google.appengine.ext import db
import logging
import utils
from django.utils import simplejson

class User(db.Model):
  google_user = db.UserProperty(required=True)
  date_created = db.DateTimeProperty(auto_now_add=True)
  nickname = db.TextProperty(required=True)
  
  def playlists(self):
    return (x for x in self.library_set.order("position"))
  
  def has_playlist(self, playlist):
    for p in self.playlists():
        if p.playlist and p.playlist is playlist:
          return True
    return False
  
  def re_index_playlists(self):
    i = 0
    entities_to_update = []
    for p in self.playlists():
      p.position = i
      entities_to_update.append(p)
      i+=1
    db.put(entities_to_update)
    
  def last_lib_position(self):
    q = db.GqlQuery("SELECT * FROM Library WHERE user = :user ORDER BY position DESC", user=self)
    p = q.get()
    if p:
      return p.position
    else:
      return -1
  
  def re_sort_playlists(self, library_item, new_position):
    playlists = self.playlists()
    if library_item.position < new_position: #Moved down
      entities_to_update = []
      for p in playlists:
        if (p.position > library_item.position and (p.position < new_position or p.position == new_position)):
          p.position -= 1
          entities_to_update.append(p)
      library_item.position = new_position
      entities_to_update.append(library_item)
      db.put(entities_to_update)
      
    elif library_item.position > new_position: #Moved up
      entities_to_update = []
      for p in playlists:
        if (p.position < library_item.position and (p.position > new_position or p.position == new_position)):
          p.position += 1
          entities_to_update.append(p)
      library_item.position = new_position
      entities_to_update.append(library_item)
      db.put(entities_to_update)

class Playlist(db.Model):
  name = db.TextProperty(required=True, default='Playlist')
  date_created = db.DateTimeProperty(auto_now_add=True)
  collaborative = db.BooleanProperty(default=False)  
  tracks = db.TextProperty(default="0")
  smart = db.BooleanProperty(default=False)
  share_hash = db.StringProperty(required=True)
  version = db.IntegerProperty(default=0)
  owner = db.ReferenceProperty(User)
  
  #Smart playlist criteria
  genres = db.StringProperty(default="")
  artist = db.StringProperty(default="")
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
    return simplejson.dumps(self.to_dict())
    
  def to_dict(self):
    d = {
      'id': str(self.key()),
      'name': self.name,
      'date_created': str(self.date_created),
      'collaborative': self.collaborative,
      'tracks': self.tracks,
      'version': self.version,
      'share_hash': self.share_hash,
      'smart': self.smart
    }
    
    if self.smart:
      smart_filter = {
        'artist': self.artist,
        'genres': self.genres,
        'tags': self.tags,
        'uploaded_from': str(self.uploaded_from),
        'uploaded_to': str(self.uploaded_to),
        'bpm_from': self.bpm_from,
        'bpm_to': self.bpm_to,
        'search_term': self.search_term,
        'user_favorites': self.user_favorites,
        'order': self.order,
        'duration_from': self.duration_from,
        'duration_to': self.duration_to
      }
      
      s = {'smart_filter':smart_filter}
      d.update(s)
    
    if self.owner:
      owner = {
        'nickname': self.owner.nickname
      } 
      s = {'owner':owner}
      d.update(s)
    
    return d
    
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
    return simplejson.dumps(self.to_dict())
  
  def to_dict(self):
    d = {
      'is_owner': self.is_owner,
      'position': self.position,
      'playlist': self.playlist.to_dict()
    }
    
    return d
  