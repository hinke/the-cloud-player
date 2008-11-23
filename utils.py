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
