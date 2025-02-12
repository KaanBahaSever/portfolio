from datetime import datetime
from kaan import db
from sqlalchemy import func

class ResetToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    token = db.Column(db.String(128), unique=True, nullable=False)
    is_used_at = db.Column(db.DateTime)
    is_deleted = db.Column(db.Boolean, default=False)
    expiration_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    @staticmethod
    def get_last_row_id():
        return db.session.query(func.count(ResetToken.id)).scalar()