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

import wsgiref.handlers

import random
import logging
import urllib

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
    
    sc_api_url = "http://api.soundcloud.com"
    callback = self.request.get('callback')
    api_parameters = utils.extract_parameters(self.request.uri)
    if api_parameters:
      self.response.headers["Content-Type"] = "text/javascript; charset=utf-8"
      self.response.headers["Cache-Control"] = "max-age=10800, must-revalidate" # testing force client caching, works in ff3 at least
      parameters_hash = str(hash(api_parameters))    
      hit = memcache.get(parameters_hash)
      if hit is None:
        try:
          response = urlfetch.fetch(url = sc_api_url + urllib.quote_plus(api_parameters),method=urlfetch.GET, headers={'Content-Type': 'text/javascript; charset=utf-8'})
          memcache.set(parameters_hash, response.content, 10800)
          utils.print_with_callback(callback, response.content, self.response)
        except:
          utils.print_with_callback(callback, utils.status_code_json(408), self.response)
      else:
        utils.print_with_callback(callback, hit, self.response)        
      
class PlayerPage(webapp.RequestHandler):
  def get(self):
    google_user = users.get_current_user()
    app_user = utils.get_user(google_user)
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
        
      share_hash = utils.url_to_share_key(self.request.uri)
      q = db.GqlQuery("SELECT * FROM Playlist WHERE share_hash = :share_hash", share_hash=share_hash)  
      playlist = q.get()

      if playlist:
        if not app_user.has_playlist(playlist):
          last_position = app_user.last_lib_position()  
          
          library_item = models.Library(user=app_user, position=last_position+1  , playlist=playlist, is_owner=False)
          library_item.put()
          flash = "add_shared_playlist"
        else:
          flash = "playlist_already_in_lib"          
      else:
        flash = "playlist_not_found"
      
      self.redirect("/?flash="+flash)
        
class Playlist(webapp.RequestHandler):  
  def get(self):
    key = utils.url_to_entity_key(self.request.uri)
    if key:
      playlist = db.get(db.Key(key))
      if playlist:
        library_item = playlist.library_item_for_current_user()
        self.response.out.write(library_item.serialize())

  def post(self):
    method = self.request.get("_method")
    key = utils.url_to_entity_key(self.request.uri)
    if key:
      playlist = db.get(db.Key(key))
      if playlist:
        current_user = utils.get_current_user()
    
        #Get corresponding link
        library_item = playlist.library_item_for_user(current_user)
    
        if method == "PUT":
          need_version_control = False
          playlist_changed = False
      
          if(self.request.get('position')): #Rights: Can always update this
            current_user.re_sort_playlists(library_item, int(self.request.get('position')))        

          if (playlist.collaborative or library_item.is_owner): #Rights: Owner or collaborators can update this
            if playlist.smart:
              utils.parse_smart_filters(playlist, self.request)
              playlist_changed = True
            if self.request.get('tracks'):
              playlist.tracks = self.request.get('tracks')
              playlist_changed = True

            need_version_control = playlist.collaborative

          if library_item.is_owner: #Rights: Only owner can update this
            if(self.request.get('name') and len(self.request.get('name')) > 0):
              playlist.name = utils.strip_html(self.request.get('name'))
              playlist_changed = True
            if(self.request.get('collaborative')):
              playlist.collaborative = utils.convert_javascript_bool_to_python(self.request.get('collaborative'))
              playlist_changed = True
      
          if playlist_changed:
            if need_version_control: 
              if self.request.get('version') and not int(self.request.get('version')) < playlist.version:
                playlist.version += 1
                playlist.put()
                self.response.out.write(utils.status_code_json(200))
              else:
                self.response.out.write(library_item.serialize())
            else:
              playlist.put()
              self.response.out.write(utils.status_code_json(200))
          else:
            self.response.out.write(utils.status_code_json(200))
            
        elif method == "DELETE":
          library_item.delete()
          current_user.re_index_playlists()
          if not playlist.has_user():
            playlist.delete()
          self.response.out.write(utils.status_code_json(200))
      
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

class Flush(webapp.RequestHandler):
  def get(self):
    memcache.flush_all()

def main():
  application = webapp.WSGIApplication([
                                      ('/playlists', Playlists), 
                                      ('/playlists/', Playlists), 
                                      ('/playlists/.*', Playlist),
                                      ('/pages/flush[/]*', Flush),
                                      ('/api/.*', API), 
                                      ('/user', User), 
                                      ('/share/.*', SharePlaylist), 
                                      ('/', PlayerPage)
                                      ], debug=utils.in_development_enviroment())
  run_wsgi_app(application)

if __name__ == '__main__':
  main()