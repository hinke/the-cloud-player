#!/usr/bin/env python

import wsgiref.handlers

import random

from google.appengine.ext import db

from google.appengine.ext import webapp
from google.appengine.ext.webapp \
  import template
  
from google.appengine.api import users
from google.appengine.ext.webapp.util import run_wsgi_app

class StartPage(webapp.RequestHandler):
  def get(self):
    self.response.out.write(template.render('index.html', {}))
    
class PlayerPage(webapp.RequestHandler):
  def get(self):
    self.response.out.write(template.render('player.html', {'rando': random.random()}))


def main():
  application = webapp.WSGIApplication([('/', StartPage), ('/app', PlayerPage)],
                                       debug=True)
  run_wsgi_app(application)

def get_user(google_user):
  q = db.GqlQuery("SELECT * FROM User WHERE google_user = :google_user", google_user=google_user)  
  return q.get()

def utf8string(s):
  return unicode(s, 'utf-8') 

if __name__ == '__main__':
  main()