from kaan import db, login_manager, app
from datetime import datetime, timedelta
from flask_login import current_user
from flask_user import UserMixin
from flask import abort
import secrets
import hashlib
from flask_user import UserManager
from kaan.models.reset_token import ResetToken

def get_reset_token():
        reset_token = secrets.token_urlsafe(64) + (ResetToken.get_last_row_id() + 1)
        reset_token = hashlib.sha256(reset_token.encode()).hexdigest()
        return reset_token

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # public_id = db.Column(db.Uuid(native_uuid=True, as_uuid=False), default=uuid.uuid4())
    username = db.Column(db.String(20), unique=False, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    image_file = db.Column(
        db.String(200), nullable=False, default='default.jpg')
    password = db.Column(db.String(60), nullable=False)
    last_active = db.Column(db.DateTime, nullable=False,default=datetime.utcnow)
    google_auth = db.Column(db.Boolean, default=False)
    deleted_at = db.Column(db.DateTime)
    email_confirmed_at = db.Column(db.DateTime)
    member_since = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    login_count = db.Column(db.Integer, default=0)
    is_banned = db.Column(db.Boolean, default=False)

    sub_updates = db.Column(db.Boolean, default=True)
    sub_newsletter = db.Column(db.Boolean, default=True)
    
    posts = db.relationship('Post', backref='poster', lazy=True)

    @staticmethod
    def get_by_id(id):
        user = User.query.filter(User.id == id).first()
        if user:
            return user
        abort(404)
    
    @staticmethod
    def get_by_username_404(username):
        user = User.query.filter(User.username == username).first()
        if user:
            return user
        abort(404)

    @staticmethod
    def get_by_username(username):
        user = User.query.filter(User.username == username).first()
        return user
    
    @staticmethod
    def get_by_email(email):
        user = User.query.filter(User.email == email).first()
        return user

    @staticmethod
    def get_by_username_or_email_404(username_or_email):
        user = User.query.filter(User.username == username_or_email).first()
        if user is None:
            user = User.query.filter(User.email == username_or_email).first()

        if user is None or user.deleted_account:
            abort(404)

        return user

    @staticmethod
    def get_by_username_or_email(username_or_email):
        user = User.query.filter(User.username == username_or_email).first()
        if user is None:
            user = User.query.filter(User.email == username_or_email).first()

        return user

    @staticmethod
    def exist_by_email(email):
        user = User.query.filter(User.email == email).first()
        if user:
            return True

        return False

    @staticmethod
    def get_by_id_or_404(id):
        user = User.query.filter(User.id == id).first()
        if user:
            return user
        abort(404)
    
    def is_admin(self):
        return self.has_roles('Admin')
    
    def get_json(self):
        return {"id":self.id,"username":self.username,"avatar":("/static/profile_picsx/"+self.image_file)}

user_manager = UserManager(app, db, User)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get_by_id(int(user_id))