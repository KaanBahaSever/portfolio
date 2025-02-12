
import json
from flask import render_template, request, url_for, flash, redirect, jsonify, abort, Blueprint, session
from flask_login import current_user, login_user, logout_user
from kaan import app, bcrypt, db
from kaan.models.user import User
from datetime import datetime, timedelta
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
limiter = Limiter(get_remote_address, app=app)

auth_bp = Blueprint(
    'auth_bp', __name__,
    template_folder='desktop_templates',
    static_folder='static',
    url_prefix="/auth"
)

@auth_bp.route("/check_username", methods=["POST"])
@limiter.limit("1/second")
def is_username_exist():
    username = request.form['username']
    if User.get_by_username(username):
        return json.dumps({'exist':True}), 200, {'ContentType':'application/json'} 
    return json.dumps({'exist':False}), 200, {'ContentType':'application/json'}

@auth_bp.route("/check_email", methods=["POST"])
@limiter.limit("1/second")
def is_email_exist():
    print(request.form)
    email = request.form['email']
    if User.get_by_email(email):
        return json.dumps({'exist':True}), 200, {'ContentType':'application/json'} 
    return json.dumps({'exist':False}), 200, {'ContentType':'application/json'}

@auth_bp.route("/register", methods=["GET", "POST"])
@limiter.limit("3/second")
def register():
    email = request.form['email']
    username = request.form['username']
    password = request.form['password']
    password = bcrypt.generate_password_hash(password).decode('utf-8')

    if User.get_by_username(username):
         abort(404)

    if User.get_by_email(email):
        abort(404)

    user = User(email=email, username=username, password=password)
    db.session.add(user)
    db.session.commit()
    
    login_user(user, duration = timedelta(days=365))
    
    return json.dumps({'success':True,"user":user.get_json()}), 200, {'ContentType':'application/json'} 

@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    email_or_username = request.form['username']
    password = request.form['password']
    
    user = User.get_by_username_or_email(email_or_username)
    if user is None:
        return json.dumps({'success':False}), 200, {'ContentType':'application/json'} 

    if bcrypt.check_password_hash(user.password,password):
        login_user(user, duration = timedelta(days=365))
        return json.dumps({'success':True,"user":user.get_json()}), 200, {'ContentType':'application/json'} 
    else:
        return json.dumps({'success':False}), 200, {'ContentType':'application/json'} 

@auth_bp.route("/logout", methods=["GET", "POST"])
def logout():
    logout_user()
    return json.dumps({'success':True}), 200, {'ContentType':'application/json'}

@auth_bp.route("/current_user", methods=["GET", "POST"])
def get_current_user():
    if current_user.is_authenticated:
        return json.dumps({'user':current_user.get_json()}), 200, {'ContentType':'application/json'}
    return json.dumps({'success':False}), 200, {'ContentType':'application/json'} 