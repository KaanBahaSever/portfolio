from flask import Blueprint, render_template
from kaan import app
import os

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
limiter = Limiter(get_remote_address, app=app)

main_bp = Blueprint('main_bp', __name__,template_folder='/Users/kaani/Desktop/portfolio/templates',
                    static_folder="/Users/kaani/Desktop/portfolio/static")
#/home/kaanbahasever/htdocs/kaanbahasever.com/templates

@main_bp.route('/social')
@main_bp.route('/social/<path:path>')
def serve_social(path=None):
    return render_template("index.html")

@main_bp.route('/')
def welcome():
    print("-----------------")
    print(main_bp.static_folder)
    print("-----------------")
    return render_template("welcome.html")
