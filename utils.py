#!/usr/bin/env python

from google.appengine.api import users
from google.appengine.ext import db
import models
from datetime import datetime

def init_new_user():
  app_user = models.User(google_user=users.get_current_user())
  app_user.put()
  
  hot = models.Playlist(name = "Hot Tracks", smart = True, order = "hotness", share_hash = generate_share_hash())
  hot.put()
  
  library_item = models.Library(user=app_user, playlist=hot, is_owner=True, position = 1)
  library_item.put()
  
  return app_user

def get_current_user():
  return get_user(users.get_current_user())

def get_user(google_user):
  q = db.GqlQuery("SELECT * FROM User WHERE google_user = :google_user", google_user=google_user)  
  return q.get()

def utf8string(s):
  return unicode(s, 'utf-8')
  
def url_to_playlist_key(url):
  url_array = url.split("/")
  if len(url_array) > 4:
    return url_array[4]
  else:
    return ""
    
def serialize_library(library):
  s = "["
  
  try:
    item = library.next()    
    while 1:
      try:
        s += item.serialize()
        item = library.next()
      except StopIteration:
        break
    
      s += ","
  except StopIteration:
   return "[]"
    
    
  s += "]"

  return s

def generate_share_hash():
  return str(hex(abs(hash(str(datetime.now()))))).replace("0x","", 1)