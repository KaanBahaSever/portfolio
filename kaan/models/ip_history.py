from datetime import datetime
from kaan import db

class IpHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    ip = db.Column(db.String(64), unique=False, nullable=False)
    date = db.Column(db.DateTime, nullable=False,
                     default=datetime.utcnow)
