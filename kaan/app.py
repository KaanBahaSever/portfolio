from flask import Flask, render_template, url_for
import datetime

app = Flask(__name__)

@app.route('/')
def welcome():
    timestamp = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
    return render_template('welcome.html', timestamp=timestamp)

# ...existing code...