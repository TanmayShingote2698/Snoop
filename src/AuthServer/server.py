from flask import Flask, request,jsonify,redirect, url_for,  make_response
from flask_restful import Resource, Api, reqparse
import os
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
from auth_functions import authFunctions

# Load environment variables from project root
load_dotenv('../../.env')

app = Flask(__name__)
api= Api(app)
authFunc = authFunctions()
authFunc.connect2DB()

# Health Check Endpoint
@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'AuthServer',
        'port': int(os.getenv('AUTH_SERVER_PORT', 300))
    })


class AddStudent(Resource):
    def __init__(self):
        self.parser = reqparse.RequestParser()
        self.parser.add_argument('name',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('email',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('student_id',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('password',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('photo_url',type=str,required=True,help="This field cannot be left blank.")

    def post(self):
        # print("Adding User Called")
        headers: {"Accept": "application/json","Content-type": "application/json",}
        response = self.parser.parse_args()
        print(response)
        result = authFunc.addStudent(0,response['name'],
                            response['email'],
                            response['student_id'],
                            response['photo_url'],
                            response['password'])

        if result:
            return jsonify({'userAdded':'Success'})
        else:
            return jsonify({'userAdded':'Fail', 'message': 'Database Error or Duplicate User'}), 400

class AddAdmin(Resource):
    def __init__(self):
        self.parser = reqparse.RequestParser()
        self.parser.add_argument('name',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('email',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('password',type=str,required=True,help="This field cannot be left blank.")

    def post(self):
        print("Adding Admin Called")
        headers: {"Accept": "application/json","Content-type": "application/json",}
        response = self.parser.parse_args()
        print(response)
        result = authFunc.addAdmin(0,response['name'],
                            response['email'],
                            response['password'])

        if result:
            return jsonify({'adminAdd':'Success'})
        else:
            return jsonify({'adminAdd':'Fail', 'message': 'Database Error or Duplicate Admin'}), 400

class verifyStudent(Resource):
    def __init__(self):
        self.parser = reqparse.RequestParser()
        self.parser.add_argument('email',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('password',type=str,required=True,help="This field cannot be left blank.")

    def post(self):
        print("Verify Student Called")
        headers: {"Accept": "application/json","Content-type": "application/json",}
        response = self.parser.parse_args()
        print("Request Received !")
        print(response)
        result = authFunc.verifyStudent(response['email'], response['password'])

        if result and isinstance(result, dict) and result.get('status'):
            return jsonify({
                'verify':'Success', 
                'name': result.get('name'),
                'photo_url': result.get('photo_url')
            })    

        return jsonify({'verify':'Fail'})

class verifyAdmin(Resource):
    def __init__(self):
        self.parser = reqparse.RequestParser()
        self.parser.add_argument('email',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('password',type=str,required=True,help="This field cannot be left blank.")

    def post(self):
        print("Verify Admin Called")
        headers: {"Accept": "application/json","Content-type": "application/json",}
        response = self.parser.parse_args()
        print(response)
        
        result = authFunc.verifyAdmin(response['email'], response['password'])

        if result and isinstance(result, dict) and result.get('status'):
            return jsonify({'verify':'Success', 'name': result.get('name')})    

        return jsonify({'verify':'Fail'})


class validateStudent(Resource):
    def __init__(self):
        self.parser = reqparse.RequestParser()
        self.parser.add_argument('studentID',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('imageURL',type=str,required=True,help="This field cannot be left blank.")

    def post(self):
        print("Validate Student Called")
        headers: {"Accept": "application/json","Content-type": "application/json",}
        response = self.parser.parse_args()
        print(response)
        validStudent = authFunc.validateStudent(response['studentID'],
                            response['imageURL'])
        if validStudent:
            return jsonify({'validation':'Success'})

        return jsonify({'validation':'Fail'})





api.add_resource(AddStudent, '/addStudent')
api.add_resource(AddAdmin, '/addAdmin')
api.add_resource(verifyStudent, '/verifyStudent')
api.add_resource(verifyAdmin, '/verifyAdmin')
api.add_resource(validateStudent, '/validateStudent')

class UpdatePassword(Resource):
    def __init__(self):
        self.parser = reqparse.RequestParser()
        self.parser.add_argument('email', type=str, required=True, help="Email is required")
        self.parser.add_argument('password', type=str, required=True, help="New password is required")

    def post(self):
        print("Update Password Called")
        args = self.parser.parse_args()
        success = authFunc.updatePassword(args['email'], args['password'])
        
        if success:
            return jsonify({'status': 'success', 'message': 'Password updated successfully'})
        else:
            return jsonify({'status': 'fail', 'message': 'User not found or database error'}), 400

api.add_resource(UpdatePassword, '/updatePassword')



if __name__ == "__main__":
    port = int(os.getenv('AUTH_SERVER_PORT', 300))
    print(f"Starting Auth Server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)


