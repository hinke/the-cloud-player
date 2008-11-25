#!/usr/bin/env python

import wsgiref.handlers

import random
import logging

from google.appengine.ext import db

from google.appengine.ext import webapp
from google.appengine.ext.webapp \
  import template
  
from google.appengine.api import users
from google.appengine.ext.webapp.util import run_wsgi_app

import models
import utils

import os
      
class StartPage(webapp.RequestHandler):
  def get(self):
    self.response.out.write(template.render('index.html', {}))

    
class PlayerPage(webapp.RequestHandler):
  def get(self):
    app_user = utils.get_current_user()
    if users.get_current_user() and not app_user:
      app_user = utils.init_new_user()
    
    self.response.out.write(template.render('player.html', {'user':app_user,'rando': random.random(), 'login_url': users.create_login_url("/"), 'logout_url':users.create_logout_url("/"), 'in_development_enviroment':utils.in_development_enviroment()}))

class SharePlaylist(webapp.RequestHandler):
  def get(self):
    if not users.get_current_user():
      self.redirect(users.create_login_url(self.request.uri)) 
    else:      
      app_user = utils.get_current_user()
      if users.get_current_user() and not app_user:
        app_user = utils.init_new_user()
        
      share_hash = utils.url_to_playlist_key(self.request.uri)
      q = db.GqlQuery("SELECT * FROM Playlist WHERE share_hash = :share_hash", share_hash=share_hash)  
      playlist = q.get()
      
      if not app_user.has_playlist(playlist):
        library_item = models.Library(user=app_user, playlist=playlist, is_owner=False)
        library_item.put()
  
      self.redirect("/?flash=add_shared_playlist")

class Playlist(webapp.RequestHandler):  
  def get(self):
    key = utils.url_to_playlist_key(self.request.uri)
    playlist = db.get(db.Key(key))
    library_item = playlist.library_item_for_current_user()
    self.response.out.write(library_item.serialize())

  def post(self):
    method = self.request.get("_method")
    key = utils.url_to_playlist_key(self.request.uri)
    playlist = db.get(db.Key(key))
    current_user = utils.get_current_user()
    
    #Get corresponding link or create it
    library_item = playlist.library_item_for_current_user()
    
    if method == "PUT":
      
      #if not library_item: don't really want this check
      #  library_item = models.Library(user=current_user, playlist=playlist, is_owner=False)
      #  library_item.put()
      
      if(int(self.request.get('version')) == playlist.version):
        if(self.request.get('name')):
          playlist.name = self.request.get('name')
        if(self.request.get('tracks')):
          playlist.tracks = self.request.get('tracks')
        if(self.request.get('position')):
          library_item.position = int(self.request.get('position'))
        if(self.request.get('collaborative')):
          playlist.collaborative = utils.convert_javascript_bool_to_python(self.request.get('collaborative'))
        
        if playlist.smart:
          utils.parse_smart_filters(playlist, self.request)
        
        if (playlist.collaborative or library_item.is_owner): #Check rights, should also be fixed on client
          playlist.version += 1
          playlist.put()
          library_item.put()
        
        self.response.out.write(utils.status_code_json(200))
      else:
        self.response.out.write(library_item.serialize())
        
    elif method == "DELETE":
      if library_item.is_owner and not playlist.collaborative:
        users_connected_to_playlist = playlist.users()
        for item in users_connected_to_playlist:
          item.delete()
          
        playlist.delete()
        
      elif playlist.collaborative:
        library_item.delete()
        if not playlist.has_user():
          playlist.delete()
          
      elif not library_item.is_owner:
        library_item.delete()
      
class Playlists(webapp.RequestHandler):
  def get(self):
    self.response.out.write(utils.serialize_library(utils.get_current_user().playlists()))

  def post(self):  #Create new playlist
    playlist = models.Playlist(name = self.request.get("name"), smart = utils.convert_javascript_bool_to_python(self.request.get("smart")), share_hash = utils.generate_share_hash())
    
    if playlist.smart:
      utils.parse_smart_filters(playlist, self.request)
    
    playlist.put()
    library_item = models.Library(user=utils.get_current_user(), playlist=playlist, is_owner=True, position = int(self.request.get("position")))
    library_item.put()
    
    self.response.out.write(library_item.serialize())

def main():
  application = webapp.WSGIApplication([
                                      ('/playlists', Playlists), 
                                      ('/playlists/', Playlists), 
                                      ('/playlists/.*', Playlist), 
                                      ('/share/.*', SharePlaylist), 
                                      ('/', PlayerPage)
                                      ], debug=True)
  run_wsgi_app(application)

if __name__ == '__main__':
  main()