from kaan import app
import os

if __name__ == '__main__':
    app.run(host="0.0.0.0",port=5001, threaded=True,debug=True)

#ssh $DEPLOY_USER@$DEPLOY_SERVER 'bash /path/to/deploy/deploy_script.sh'