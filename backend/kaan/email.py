import os
from threading import Thread
from kaan import app, _mail
from flask import url_for, render_template
from flask_mail import Message
from flask import render_template

MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')

def threading(f):
    def wrapper(*args, **kwargs):
        thr = Thread(target=f, args=args, kwargs=kwargs)
        thr.start()
    return wrapper

@threading
def send_mail(to, subject, **kwargs):
    with app.app_context(), app.test_request_context():
        kwargs.get('notification_json')['href'] = 'https://domain.inc'+ kwargs.get('notification_json')['href']

        msg = Message(subject=subject, sender='', recipients=to)
        msg.html = render_template('email/email.html', **kwargs)
        _mail.send(msg)

@threading
def send_feedback_mail(to, subject, text):

    with app.app_context(), app.test_request_context():
        msg = Message(subject=subject, sender='info@kaan.inc', recipients=to)
        msg.html = text
        _mail.send(msg)

@threading
def send_confirmation_mail(user_email, token):
    subject = "kaan | Please verify your email adress" #email_reset.html

    with app.app_context(), app.test_request_context():
        msg = Message(subject=subject, sender='', recipients=[user_email])
        confirm_url = f'https://domain/auth/confirm/{token}'
        confirm_url = f'http://127.0.0.1:5000/auth/confirm/{token}'
        msg.html = msg.html = render_template('email/email_confirmation.html', confirm_url=confirm_url)
        _mail.send(msg)

