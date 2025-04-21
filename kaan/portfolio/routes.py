from flask import Blueprint, render_template
from kaan import app

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
limiter = Limiter(get_remote_address, app=app)

portfolio_bp = Blueprint('portfolio_bp', __name__)

@portfolio_bp.route('/')
def home():
    return render_template('welcome.html')

@portfolio_bp.route('/portfolio')
def about():
    return 'about me'

@portfolio_bp.route('/projects')
def projects():
    return 'projects'

@portfolio_bp.route('/blog')
def blog():
    return 'blog'