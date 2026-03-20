from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/hello', methods=['GET'])
def hello():
    return jsonify({"message": "The backend is working :)"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)