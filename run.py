from kaan import app
import os

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=os.getenv("PORT"), threaded=True, debug=os.getenv("DEBUG"))