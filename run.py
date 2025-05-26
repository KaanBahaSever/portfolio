from kaan import app
import os

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=app.config['PORT'], threaded=True, debug=app.config['DEBUG'], allow_unsafe_werkzeug=False)