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

from django.utils import simplejson
from google.appengine.api import memcache
from google.appengine.api import urlfetch

class User(webapp.RequestHandler):
  def post(self):
    app_user = utils.get_current_user()
    
    if(self.request.get('nickname')):
      app_user.nickname = self.request.get('nickname')
    
    app_user.put()
    
    self.response.out.write(utils.status_code_json(200))


class API(webapp.RequestHandler):
  def get(self):
    sc_api_url = "http://api.soundcloud.com/"
    callback = self.request.get('callback')
    api_parameters = utils.extract_parameters(self.request.uri)
    if api_parameters:
      self.response.headers["Content-Type"] = "text/javascript; charset=utf-8"
      self.response.headers["Cache-Control"] = "max-age=3600, must-revalidate" # testing force client caching, works in ff3 at least
      parameters_hash = str(hash(api_parameters))    
      hit = memcache.get(parameters_hash)
      if hit is None:
        try:
          response = urlfetch.fetch(url = sc_api_url + api_parameters,method=urlfetch.GET, headers={'Content-Type': 'text/javascript; charset=utf-8'})
          memcache.set(parameters_hash, response.content, 3600)
          utils.print_with_callback(callback, response.content. self.response)
        except:
          utils.print_with_callback(callback, utils.status_code_json(408), self.response)
      else:
        utils.print_with_callback(callback, hit, self.response)
        
      
class PlayerPage(webapp.RequestHandler):
  def get(self):
    google_user = users.get_current_user()
    app_user = utils.get_current_user()
    if google_user and not app_user:
      app_user = utils.init_new_user(google_user)
    
    self.response.out.write(template.render('player.html', {'user':app_user,'rando': random.random(), 'login_url': users.create_login_url("/"), 'logout_url':users.create_logout_url("/"), 'in_development_enviroment':utils.in_development_enviroment()}))

class SharePlaylist(webapp.RequestHandler):
  def get(self):
    google_user = users.get_current_user()
    if not google_user:
      self.redirect(users.create_login_url(self.request.uri)) 
    else:      
      app_user = utils.get_current_user()
      if google_user and not app_user:
        app_user = utils.init_new_user(google_user)
        
      share_hash = utils.url_to_entity_key(self.request.uri)
      q = db.GqlQuery("SELECT * FROM Playlist WHERE share_hash = :share_hash", share_hash=share_hash)  
      playlist = q.get()

      if playlist:
        if not app_user.has_playlist(playlist):
          last_position = app_user.last_lib_position()  
          
          library_item = models.Library(user=app_user, position=last_position+1  , playlist=playlist, is_owner=False)
          library_item.put()
        flash = "add_shared_playlist"
      else:
        flash = "playlist_not_found"
      
      self.redirect("/?flash="+flash)
        
class Playlist(webapp.RequestHandler):  
  def get(self):
    key = utils.url_to_entity_key(self.request.uri)
    playlist = db.get(db.Key(key))
    library_item = playlist.library_item_for_current_user()
    self.response.out.write(library_item.serialize())

  def post(self):
    method = self.request.get("_method")
    key = utils.url_to_entity_key(self.request.uri)
    playlist = db.get(db.Key(key))
    current_user = utils.get_current_user()
    
    #Get corresponding link or create it
    library_item = playlist.library_item_for_current_user()
    
    if method == "PUT":
      need_version_control = False
      
      if(self.request.get('position')): #Rights: Can always update this
        current_user.re_sort_playlists(library_item, int(self.request.get('position')))        

      if (playlist.collaborative or library_item.is_owner): #Rights: Owner or collaborators can update this
        if playlist.smart:
          utils.parse_smart_filters(playlist, self.request)
        if self.request.get('tracks'):
          playlist.tracks = self.request.get('tracks')

        need_version_control = playlist.collaborative

      if library_item.is_owner: #Rights: Only owner can update this
        if(self.request.get('name') and len(self.request.get('name')) > 0):
          playlist.name = utils.strip_html(self.request.get('name'))
        if(self.request.get('collaborative')):
          playlist.collaborative = utils.convert_javascript_bool_to_python(self.request.get('collaborative'))
      
      if need_version_control: 
        if int(self.request.get('version')) < playlist.version:
          self.response.out.write(library_item.serialize())            
        else:
          playlist.version += 1
          playlist.put()
          self.response.out.write(utils.status_code_json(200))
      else:
        playlist.put()
        self.response.out.write(utils.status_code_json(200))
        
    elif method == "DELETE":
      if library_item.is_owner and not playlist.collaborative:
        users_connected_to_playlist = playlist.users()
        for item in users_connected_to_playlist:
          item.delete()
          item.user.re_index_playlists()
          
        playlist.delete()
        current_user.re_index_playlists()
      elif playlist.collaborative:
        library_item.delete()
        current_user.re_index_playlists()
        if not playlist.has_user():
          playlist.delete()
          
      elif not library_item.is_owner:
        library_item.delete()
        current_user.re_index_playlists()
      
class Playlists(webapp.RequestHandler):
  def get(self):
    app_user = utils.get_current_user()
    if app_user:
      self.response.out.write(utils.serialize_library(app_user.playlists()))

  def post(self):  #Create new playlist
    current_user = utils.get_current_user()
    playlist = models.Playlist(name = self.request.get("name"),owner=current_user, smart = utils.convert_javascript_bool_to_python(self.request.get("smart")), share_hash = utils.generate_share_hash())
    
    if playlist.smart:
      utils.parse_smart_filters(playlist, self.request)
    
    playlist.put()
    
    library_item = models.Library(user=current_user, playlist=playlist, is_owner=True, position = int(self.request.get("position")))
    library_item.put()
    
    self.response.out.write(library_item.serialize())

def main():
  application = webapp.WSGIApplication([
                                      ('/playlists', Playlists), 
                                      ('/playlists/', Playlists), 
                                      ('/playlists/.*', Playlist), 
                                      ('/api/.*', API), 
                                      ('/user', User), 
                                      ('/share/.*', SharePlaylist), 
                                      ('/', PlayerPage)
                                      ], debug=utils.in_development_enviroment())
  run_wsgi_app(application)

if __name__ == '__main__':
  main()