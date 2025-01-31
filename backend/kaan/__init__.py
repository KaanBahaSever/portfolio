import os
from flask import Flask
from flask_session import Session
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import LoginManager
from flask_mail import Mail
from itsdangerous import URLSafeTimedSerializer
from flask_migrate import Migrate
from flask_executor import Executor
from sqlalchemy import create_engine

#basedir = os.path.abspath(os.path.dirname(__file__))
app = Flask(__name__)

app.config['SERVER_NAME'] = 'kaanbahasever.com:5001'
app.config['MAIL_SERVER']='mail.privateemail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USERNAME'] = ''
app.config['MAIL_PASSWORD'] = ''
app.config['MAIL_USE_TLS'] = False
app.config['MAIL_USE_SSL'] = True
app.config["TEMPLATES_AUTO_RELOAD"] = True

#app.config['RECAPTCHA_SITE_KEY'] = ''
#app.config['RECAPTCHA_SECRET_KEY'] = ''
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"  #this is to set our environment to https because OAuth 2.0 only supports https environments

app.config['SECRET_KEY'] = '6E$?£13t?Q4Eh~aQ@tE2l9GkwnSb6"a`'

app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = False
app.config['SQLALCHEMY_DATABASE_URI'] = "sqlite:///social.db"
app.config['USER_EMAIL_SENDER_EMAIL'] = "email@gmail.com"
app.config['USER_ENABLE_EMAIL'] = False

executor = Executor(app)
db = SQLAlchemy(app) # Create a ReCaptcha object by passing in 'app' as parameter
Session(app)
migrate = Migrate(app, db)
_mail = Mail()
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)

ts = URLSafeTimedSerializer('{&Bjw6uNVl_gR71^uF(,v<Yg]f}ZoDt(v+STtfC3Tr*PRD(SF-*OMzjN1m>wU$MG')

engine = create_engine('sqlite:///social.db', echo=True)
conn = engine.connect()

from .api import routes
from .auth import routes
from .main import routes
from .profile import routes
from kaan import error_handle

from kaan.main.routes import main_bp
from kaan.auth.routes import auth_bp
from kaan.api.routes import api_bp
from kaan.profile.routes import profile_bp

app.register_blueprint(main_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(api_bp)
app.register_blueprint(profile_bp)