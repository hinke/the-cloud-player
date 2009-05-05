#!/usr/bin/env python

# Copyright (c) 2008 Henrik Berggren & Eric Wahlforss
# 
# Permission is hereby granted, free of charge, to any person obtaining
# a copy of this software and associated documentation files (the
# "Software"), to deal in the Software without restriction, including
# without limitation the rights to use, copy, modify, merge, publish,
# distribute, sublicense, and/or sell copies of the Software, and to
# permit persons to whom the Software is furnished to do so, subject to
# the following conditions:
# 
# The above copyright notice and this permission notice shall be
# included in all copies or substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
# EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
# MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
# NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
# LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
# OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
# WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

from google.appengine.api import users
from google.appengine.ext import db
import models
from datetime import datetime
import os
import re
from django.utils import simplejson

def init_new_user(google_user):
  nickname = make_pretty_nickname_from_email(google_user.email())
  app_user = models.User(google_user=google_user, nickname=nickname)
  app_user.put()
  
  default_playlists = []
  
  p = models.Playlist(name = "Hot Tracks", smart = True, owner=app_user, order = "hotness", share_hash = generate_share_hash())
  default_playlists.append(p)
  p = models.Playlist(name = "Indie", smart = True, owner=app_user, genres="indie", order = "latest", share_hash = generate_share_hash())
  default_playlists.append(p)
  p = models.Playlist(name = "Deep House", smart = True, owner=app_user, genres="deep house", order = "latest", share_hash = generate_share_hash())
  default_playlists.append(p)
  p = models.Playlist(name = "Rock", smart = True, owner=app_user, genres="rock", order = "latest", share_hash = generate_share_hash())
  default_playlists.append(p)
  p = models.Playlist(name = "Techno", smart = True, owner=app_user, genres="techno", order = "latest", share_hash = generate_share_hash())
  default_playlists.append(p)
  p = models.Playlist(name = "Spoken Word", smart = True, owner=app_user, genres="spoken+word, spokenword", order = "latest", share_hash = generate_share_hash())
  default_playlists.append(p)
  p = models.Playlist(name = "Dubstep", smart = True, owner=app_user, genres="dubstep, dub+step", order = "latest", share_hash = generate_share_hash())
  default_playlists.append(p)
  
  db.put(default_playlists)

  library = []
  i = 0
  for p in default_playlists:
     library.append(models.Library(user=app_user, playlist=p, is_owner=True, position = i))
     i +=1
    
  db.put(library)
    
  return app_user

def make_pretty_nickname_from_email(email):
  parts = email.split("@")
  if len(parts) > 1:
    nickname = parts[0]
    nickname = nickname.replace(".", " ").replace("-", " ").replace("_", " ")
    nickname = nickname.title()
    return nickname
  else:
    return email
def get_current_user():
  return get_user(users.get_current_user())

def get_user(google_user):
  q = db.GqlQuery("SELECT * FROM User WHERE google_user = :google_user", google_user=google_user)  
  return q.get()

def utf8string(s):
  return unicode(s, 'utf-8')
  
def url_to_entity_key(url):
  url_array = url.split("/")
  if len(url_array) > 4 and len(url_array[4]) > 30:
    return url_array[4]
  else:
    return False

def url_to_share_key(url):
  url_array = url.split("/")
  if len(url_array) > 4:
    return url_array[4]
  else:
    return False

def convert_javascript_bool_to_python(s):
  if s.lower() == "true":
    return True
  else:
    return False
    
def serialize_library(library):
  d = []  
  for item in library:
    d.append(item.to_dict())
    
  return simplejson.dumps(d) 
    
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

def strip_html(s):
  return re.sub('<.*?>', '', s)    
  
def extract_parameters(url):
  url_array = url.split("/api")
  if len(url_array) > 1:
    ret = strip_named_parameter("callback", url_array[1])
    ret = strip_named_parameter("_", ret)
    return ret
  else:
    return None

def print_with_callback(callback, content, response):
  if len(str(callback)) > 0:
    response.out.write(callback)
    response.out.write("(")
    response.out.write(content)
    response.out.write(")")
  else:
    response.out.write(content)

def strip_named_parameter(parameter_to_remove, url):
  p = re.compile('&'+parameter_to_remove+'[^&]*')
  return p.sub('', url)