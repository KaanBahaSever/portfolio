import os
from flask import Flask
from flask_session import Session
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import LoginManager
from itsdangerous import URLSafeTimedSerializer
from flask_migrate import Migrate
from flask_executor import Executor
from sqlalchemy import create_engine

app = Flask(__name__)

app.config['SECRET_KEY'] = ''
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = False
app.config['SQLALCHEMY_DATABASE_URI'] = "sqlite:///social.db"

#email config
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USE_SSL'] = True
app.config['MAIL_USERNAME'] = ''
app.config['MAIL_PASSWORD'] = ''
app.config['MAIL_DEFAULT_SENDER'] = ''
app.config['USER_EMAIL_SENDER_EMAIL'] = 'dummy@gmail.com'

executor = Executor(app)
db = SQLAlchemy(app) # Create a ReCaptcha object by passing in 'app' as parameter
Session(app)
migrate = Migrate(app, db)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)

ts = URLSafeTimedSerializer('')

engine = create_engine('sqlite:///social.db', echo=True)
conn = engine.connect()

from kaan.portfolio.routes import portfolio_bp

from kaan.bumerang.main.routes import main_bp
from kaan.bumerang.auth.routes import auth_bp
from kaan.bumerang.api.routes import api_bp
from kaan.bumerang.profile.routes import profile_bp

app.register_blueprint(main_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(api_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(portfolio_bp)