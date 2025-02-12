
import json, os, uuid
from PIL import Image
from flask import render_template, request, url_for, flash, redirect, jsonify, abort, Blueprint, session
from flask_login import current_user
from kaan import app, db
from kaan.models.user import User
from kaan.models.post import Post

from flask_limiter import Limiter

api_bp = Blueprint(
    'api_bp', __name__,
    url_prefix="/api"
)

@api_bp.route("/", methods=["GET", "POST"])
def test():
    return json.dumps({'success':True}), 200, {'ContentType':'application/json'} 

@api_bp.route("/get_posts", methods=["GET", "POST"])
def get_posts():
    posts = Post.query.all()
    send_json = {'success':True, "posts":[]}
    for post in reversed(posts):
        send_json["posts"].append(post.get_json())
    return json.dumps(send_json), 200, {'ContentType':'application/json'}

@api_bp.route("/get_user_posts/<int:id>", methods=["GET", "POST"])
def get_user_posts(id):
    user = User.query.get_or_404(id)
    posts = Post.query.filter_by(user_id=id).all()
    send_json = {'success':True, "posts":[], "user":user.get_json()}
    for post in reversed(posts):
        send_json["posts"].append(post.get_json())
    return json.dumps(send_json), 200, {'ContentType':'application/json'}

@api_bp.route("/publish_post", methods=["GET", "POST"])
def publish_post():
    if not current_user.is_authenticated:
        abort(401)

    content = request.json
    body = content['body']
    
    if len(body) < 3:
        abort(400)
        
    post = Post(body=body, poster=current_user)
    db.session.add(post)
    db.session.commit()
    
    return json.dumps({'success':True}), 200, {'ContentType':'application/json'} 

def random_filename(old_filename):
    ext = os.path.splitext(old_filename)[1]
    new_filename = uuid.uuid4().hex + ext
    return new_filename +".png"

@api_bp.route("/change_avatar", methods=["GET", "POST"])
def change_avatar():
    if not current_user.is_authenticated:
        abort(401)
        
    avatar = request.files.get('avatar')
    file_name = random_filename(avatar.filename)
    file_path = os.path.join(app.root_path, 'static/profile_pics', file_name)
    thumb_path = os.path.join(app.root_path, 'static/porfile_pics_thumb', file_name)
    #resize
    image = Image.open(file_path)
    image = image.resize((400,400),Image.ANTIALIAS)
    image.save(thumb_path, optimize=True, quality=90)

    avatar.save(file_path)

    current_user.image_file = file_name
    db.session.commit()
    return json.dumps({'success':True}), 200, {'ContentType':'application/json'} 