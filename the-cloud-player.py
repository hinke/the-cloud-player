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

class StartPage(webapp.RequestHandler):
  def get(self):
    self.response.out.write(template.render('index.html', {}))
    
class PlayerPage(webapp.RequestHandler):
  def get(self):
    app_user = utils.get_current_user()
    if users.get_current_user() and not app_user:
      app_user = models.User(google_user=users.get_current_user())
      app_user.put()
    
    self.response.out.write(template.render('player.html', {'user':users.get_current_user(),'rando': random.random(), 'login_url': users.create_login_url("/app"), 'logout_url':users.create_logout_url("/")}))

class SharePlaylist(webapp.RequestHandler):
  def get(self):
    if not users.get_current_user():
      self.redirect(users.create_login_url(self.request.uri)) 
          
    app_user = utils.get_current_user()
    if users.get_current_user() and not app_user:
      app_user = models.User(google_user=users.get_current_user())
      app_user.put()
          
    key = utils.url_to_playlist_key(self.request.uri)
    playlist = db.get(db.Key(key))
    
    if not app_user.has_playlist(playlist):
      library_item = models.Library(user=app_user, playlist=playlist, is_owner=False)
      library_item.put()
    
    self.redirect("/app")  


class Playlist(webapp.RequestHandler):  
  def get(self):
    key = utils.url_to_playlist_key(self.request.uri)
    playlist = db.get(db.Key(key))
    library_item = playlist.library_item_for_current_user()
    self.response.out.write(library_item.serialize())

  def post(self):
    try:
      method = self.request.get("_method")
      key = utils.url_to_playlist_key(self.request.uri)
      playlist = db.get(db.Key(key))
      current_user = utils.get_current_user()
      
      #Get corresponding link or create it
      library_item = playlist.library_item_for_current_user()
      
      if method == "PUT":
        if not library_item:
          library_item = models.Library(user=current_user, playlist=playlist, is_owner=False)
          library_item.put()

        if(self.request.get('name')):
          playlist.name = self.request.get('name')
        if(self.request.get('tracks')):
          playlist.tracks = self.request.get('tracks')
        if(self.request.get('position')):
          library_item.position = self.request.get('position')
      
        playlist.put()        
    
      elif method == "DELETE":
        if library_item.is_owner and not playlist.collaborative:
          users_connected_to_playlist = playlist.users()
          for item in users_connected_to_playlist:
            item.delete()
            
          playlist.delete()
          
        elif playlist.collaborative:
          library_item.delete()
          if len(playlist.users()) == 0:
            playlist.delete()
            
        elif not library_item.is_owner:
          library_item.delete()

      self.response.set_status(200)
    except Error:
      self.error(500)      
      
class Playlists(webapp.RequestHandler):
  def get(self):
    self.response.out.write(utils.serialize_library(utils.get_current_user().playlists()))

  def post(self):  #Create new playlist
    playlist = models.Playlist(name = self.request.get("name"))
        
    playlist.put()
    library_item = models.Library(user=utils.get_current_user(), playlist=playlist, is_owner=True)
    library_item.put()
    
    self.response.out.write(playlist.serialize())



def main():
  application = webapp.WSGIApplication([
                                      ('/playlists', Playlists), 
                                      ('/playlists/', Playlists), 
                                      ('/playlists/.*', Playlist), 
                                      ('/share/.*', SharePlaylist), 
                                      ('/', StartPage), 
                                      ('/app', PlayerPage)
                                      ], debug=True)
  run_wsgi_app(application)

if __name__ == '__main__':
  main()