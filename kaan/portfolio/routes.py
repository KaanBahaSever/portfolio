from flask import Blueprint, render_template
from kaan import app

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
limiter = Limiter(get_remote_address, app=app)

portfolio_bp = Blueprint('portfolio_bp', __name__)

@portfolio_bp.route('/')
def hello_world():
    return render_template('welcome.html')