from kaan import app
from flask import render_template

@app.errorhandler(429)
def too_many_requests(e):
    header = '429'
    sub_header = 'TOO MANY REQUESTS'
    p = 'You have sent too many requests in a given amount of time'
    return  '', 429

@app.errorhandler(400)
def too_many_requests(e):
    header = '400'
    sub_header = 'BAD REQUEST'
    p = 'Your client has issued a malformed or illegal request'
    return  '', 400

@app.errorhandler(404)
def too_many_requests(e):
    header = '404'
    sub_header = 'PAGE NOT FOUND'
    p = 'The requested URL was not found on this server'
    return  '', 404

@app.errorhandler(403)
def too_many_requests(e):
    header = '403'
    sub_header = 'Forbidden'
    p = 'You do not have permission to access / on this server'
    return  '', 403

@app.errorhandler(405)
def too_many_requests(e):
    header = '405'
    sub_header = 'Method Not Allowed'
    p = 'The requested method is not allowed for the URL'
    return '', 405