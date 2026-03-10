from flask import Flask, request,jsonify,redirect, url_for,  make_response
from flask_restful import Resource, Api, reqparse
import os
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
import time
from test_functions import testFunction

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
load_dotenv(dotenv_path=env_path)

app = Flask(__name__)
api= Api(app)
testFunc = testFunction()
testFunc.connect2DB()

# Health Check Endpoint
@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'TestServer',
        'port': int(os.getenv('TEST_SERVER_PORT', 100))
    })


class CreateTest(Resource):
    def __init__(self):
        self.parser = reqparse.RequestParser()
        self.parser.add_argument('test_id',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('test_details',type=dict,required=True,help="This field cannot be left blank.")

        
    def post(self):
        print("Creating Test Called")
        headers: {"Accept": "application/json","Content-type": "application/json",}
        response = self.parser.parse_args()
        print(response)
        result = testFunc.createTest(response['test_id'],
                            response['test_details'])

        return jsonify({'testCreation':'Success'})

class GetTest(Resource):
    def __init__(self):
        self.parser = reqparse.RequestParser()
        self.parser.add_argument('test_id',type=str,required=True,help="This field cannot be left blank.")

    def post(self):
        print("get Test Called")
        headers: {"Accept": "application/json","Content-type": "application/json",}
        response = self.parser.parse_args()
        print(response)
        result = testFunc.getTest(response['test_id'])

        return result

class GetAllTest(Resource):
    def __init__(self):
        self.parser = reqparse.RequestParser()
        pass

    def post(self):
        print("get Test Called")
        headers: {"Accept": "application/json","Content-type": "application/json",}
        result = testFunc.getAllTest()

        return result

class DeleteTest(Resource):
    def __init__(self):
        self.parser = reqparse.RequestParser()
        self.parser.add_argument('test_id',type=str,required=True,help="This field cannot be left blank.")

    def post(self):
        print("Delete Test Called")
        headers: {"Accept": "application/json","Content-type": "application/json",}
        response = self.parser.parse_args()
        print(f"Delete request with test_id: {response['test_id']}")
        result = testFunc.deleteTest(response['test_id'])
        
        print(f"Delete operation result: {result}")
        if result:
            print(f"Successfully deleted test: {response['test_id']}")
            return jsonify({'testDeletion':'Success', 'test_id': response['test_id']})
        else:
            print(f"Failed to delete test: {response['test_id']}")
            return jsonify({'testDeletion':'Failed', 'test_id': response['test_id']}), 500

api.add_resource(CreateTest, '/createTest')
api.add_resource(GetTest, '/getTest')
api.add_resource(GetAllTest, '/getAllTest')
api.add_resource(DeleteTest, '/deleteTest')


if __name__ == "__main__":
    port = int(os.getenv('TEST_SERVER_PORT', 100))
    print(f"Starting Test Server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)


