import json
from flask import render_template, request, url_for, flash, redirect, jsonify, abort, Blueprint, session
from flask_login import current_user
from kaan import app
from kaan.models.user import User

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
limiter = Limiter(get_remote_address, app=app)

profile_bp = Blueprint(
    'profile_bp', __name__,
    template_folder='desktop_templates',
    static_folder='static'
)