#!/usr/bin/env python

from google.appengine.api import users
from google.appengine.ext import db
import models

def get_current_user():
  return get_user(users.get_current_user())

def get_user(google_user):
  q = db.GqlQuery("SELECT * FROM User WHERE google_user = :google_user", google_user=google_user)  
  return q.get()

def utf8string(s):
  return unicode(s, 'utf-8')
  
def get_playlists_for_user(user):
  playlists = models.Playlist.all()
  playlists.filter('belongs_to =', user)
  playlists.order('-position')  
  return playlists
  
def get_playlists():
  return get_playlists_for_user(get_current_user())

def url_to_playlist_key(url):
  url_array = url.split("/")
  if len(url_array) > 4:
    return url_array[4]
  else:
    return ""
    
def serialize_playlists(playlists):
  cnt = playlists.count()
  idx = 1
  s = "["
  for playlist in playlists:
    s += serialize_playlist(playlist)
    if idx != cnt:
      s += ","
    idx += 1
    
  s += "]"
  
  return s      
    
def serialize_playlist(playlist):
  s = "{"
  s += "'id':'" + str(playlist.key()) + "',"
  s += "'name':'" + playlist.name + "',"
  s += "'date_created':'" + str(playlist.date_created) + "',"
  s += "'public':'" + str(playlist.public) + "',"
  s += "'tracks':'" + playlist.tracks + "',"
  s += "'position':" + str(playlist.position)
  s += "}"
  
  return s