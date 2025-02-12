from flask import Blueprint, render_template
from kaan import app

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
limiter = Limiter(get_remote_address, app=app)

main_bp = Blueprint('main_bp', __name__)

@main_bp.route('/social')
@main_bp.route('/social/<path:path>')
def serve_social(path=None):
    return 'Kısa bir süre kapalıyız. En yakın zamanda çok büyük döneceğiz. -kaan'
