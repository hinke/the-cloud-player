from google.appengine.ext import db
import models

class User(db.Model):
  google_user = db.UserProperty(required=True)
  date_created = db.DateTimeProperty(auto_now_add=True)

class Playlist(db.Model):
  name = db.StringProperty(required=True, default='Playlist')
  date_created = db.DateTimeProperty(auto_now_add=True)
  public = db.BooleanProperty(default=False)
  belongs_to = db.ReferenceProperty(User)
  tracks = db.TextProperty()
  position = db.IntegerProperty(required=True)