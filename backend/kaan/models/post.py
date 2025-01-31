from datetime import datetime
from .utilities import get_elapsed_time
from kaan import db

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    body = db.Column(db.String(401), nullable=False)
    like_count = db.Column(db.Integer, default=0)
    comment_count = db.Column(db.Integer, default=0)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), default=None)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    deleted_at = db.Column(db.DateTime)

    def get_json(self):
        return {
            'user': self.poster.get_json(),
            'body': self.body,
            'like_count': self.like_count,
            'comment_count': self.comment_count,
            'elapsed': get_elapsed_time(self.created_at),
        }