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

class UserHandler(webapp.RequestHandler):
  def get(self):
    user = utils.get_current_user()
    if not user:
      user = models.User(google_user=users.get_current_user())
      user.put()
    
class StartPage(webapp.RequestHandler):
  def get(self):
    self.response.out.write(template.render('index.html', {}))
    
class PlayerPage(webapp.RequestHandler):
  def get(self):
    self.response.out.write(template.render('player.html', {'user':users.get_current_user(),'rando': random.random(), 'login_url': users.create_login_url("/app"), 'logout_url':users.create_logout_url("/")}))

class Playlist(webapp.RequestHandler):
  def get(self):
    key = utils.url_to_playlist_key(self.request.uri)
    playlist = db.get(db.Key(key))
    self.response.out.write(utils.serialize_playlist(playlist))
  
  def post(self):
    method = self.request.get("_method")
    key = utils.url_to_playlist_key(self.request.uri)
    logging.info(key)
    playlist = db.get(db.Key(key))
    
    if method == "PUT":
      if(self.request.get('name')):
        playlist.name = self.request.get('name')
      if(self.request.get('position')):
        playlist.position = self.request.get('position')
      if(self.request.get('tracks')):
        playlist.tracks = self.request.get('tracks')
      playlist.put()
      
    elif method == "DELETE":
      playlist.delete()
    
    
class Playlists(webapp.RequestHandler):
  def get(self):
    self.response.out.write(utils.serialize_playlists(utils.get_playlists()))

  def post(self):  #Create new playlist
    playlist = models.Playlist(name = self.request.get("name"), 
      belongs_to = utils.get_current_user())
    
    playlist.put()
    self.response.out.write(utils.serialize_playlist(playlist))
    

def main():
  application = webapp.WSGIApplication([
                                      ('/playlists', Playlists), 
                                      ('/playlists/', Playlists), 
                                      ('/playlists/.*', Playlist), 
                                      ('/user', UserHandler), 
                                      ('/', StartPage), 
                                      ('/app', PlayerPage)
                                      ],
                                       debug=True)
  run_wsgi_app(application)

if __name__ == '__main__':
  main()