#!/usr/bin/env python

from google.appengine.api import users
from google.appengine.ext import db
import models
from datetime import datetime
import os

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

def convert_javascript_bool_to_python(s):
  if s.lower() == "true":
    return True
  else:
    return False
    
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
  return str(hex(abs(hash(str(datetime.now())))))[2:7]
  
def status_code_json(code):
  return "{'response':"+ str(code) +"}"
  
def in_development_enviroment():
  return os.environ["SERVER_SOFTWARE"] != "Google Apphosting/1.0"

def parse_smart_filters(playlist, request):
  if(request.get('genres')):
    playlist.genres = request.get('genres')
  if(request.get('artist')):
    playlist.artist = request.get('artist')
  if(request.get('tags')):
    playlist.tags = request.get('tags')
  if(request.get('uploaded_from')):
    playlist.uploaded_from = request.get('uploaded_from')
  if(request.get('uploaded_to')):
    playlist.uploaded_to = request.get('uploaded_to')
  if(request.get('bpm_from')):
    playlist.bpm_from = int(request.get('bpm_from'))
  if(request.get('bpm_to')):
    playlist.bpm_to = int(request.get('bpm_to'))
  if(request.get('search_term')):
    playlist.search_term = request.get('search_term')
  if(request.get('user_favorites')):
    playlist.user_favorites = request.get('user_favorites')
  if(request.get('order')):
    playlist.order = request.get('order')
  if(request.get('duration_from')):
    playlist.duration_from = int(request.get('duration_from'))
  if(request.get('duration_to')):
    playlist.duration_to = int(request.get('duration_to'))
  return playlist