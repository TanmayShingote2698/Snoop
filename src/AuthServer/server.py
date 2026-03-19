from flask import Flask, request,jsonify,redirect, url_for,  make_response
from flask_restful import Resource, Api, reqparse
import os
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
from auth_functions import authFunctions

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
load_dotenv(dotenv_path=env_path)

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
        self.parser.add_argument('student_id',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('name',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('email',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('password',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('photo_url',type=str,required=True,help="This field cannot be left blank.")

    def post(self):
        # print("Adding User Called")
        headers: {"Accept": "application/json","Content-type": "application/json",}
        response = self.parser.parse_args()
        print(response)
        result = authFunc.addStudent(response['student_id'],response['name'],
                            response['email'],
                            response['photo_url'],
                            response['password'])

        if result:
            return {'userAdded':'Success'}
        else:
            return {'userAdded':'Fail', 'message': 'Database Error or Duplicate User'}, 400

class AddAdmin(Resource):
    def __init__(self):
        self.parser = reqparse.RequestParser()
        self.parser.add_argument('admin_id',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('name',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('email',type=str,required=True,help="This field cannot be left blank.")
        self.parser.add_argument('password',type=str,required=True,help="This field cannot be left blank.")

    def post(self):
        print("Adding Admin Called")
        headers: {"Accept": "application/json","Content-type": "application/json",}
        response = self.parser.parse_args()
        print(response)
        result = authFunc.addAdmin(response['admin_id'],response['name'],
                            response['email'],
                            response['password'])

        if result:
            return {'adminAdd':'Success'}
        else:
            return {'adminAdd':'Fail', 'message': 'Database Error or Duplicate Admin'}, 400

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
            return {
                'verify':'Success', 
                'name': result.get('name'),
                'photo_url': result.get('photo_url')
            }    

        return {'verify':'Fail'}

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
            return {
                'verify':'Success', 
                'name': result.get('name'),
                'photo_url': result.get('photo_url')
            }    

        return {'verify':'Fail'}


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
            return {'validation':'Success'}

        return {'validation':'Fail'}





api.add_resource(AddStudent, '/addStudent')
api.add_resource(AddAdmin, '/addAdmin')
api.add_resource(verifyStudent, '/verifyStudent')
api.add_resource(verifyAdmin, '/verifyAdmin')
api.add_resource(validateStudent, '/validateStudent')

class UpdateProfile(Resource):
    def __init__(self):
        self.parser = reqparse.RequestParser()
        self.parser.add_argument('email', type=str, required=True, help="Email is required")
        self.parser.add_argument('role', type=str, required=True, help="Role is required")
        self.parser.add_argument('name', type=str, required=True, help="Name is required")
        self.parser.add_argument('photo_url', type=str, required=False)

    def post(self):
        print("Update Profile Called")
        args = self.parser.parse_args()
        
        table = "admin" if args['role'] == "teacher" else "student"
        update_data = {"name": args['name']}
        
        if args['photo_url']:
            update_data["photo_url"] = args['photo_url']
            
        success = authFunc.db.updateEntry(table, {"email": args['email'].lower()}, update_data)
        
        if success:
            return {'status': True, 'message': 'Profile updated'}
        return {'status': False, 'message': 'Failed to update profile'}, 400

class ChangePasswordSecure(Resource):
    def __init__(self):
        self.parser = reqparse.RequestParser()
        self.parser.add_argument('email', type=str, required=True, help="Email is required")
        self.parser.add_argument('role', type=str, required=True, help="Role is required")
        self.parser.add_argument('currentPassword', type=str, required=True, help="Current password is required")
        self.parser.add_argument('newPassword', type=str, required=True, help="New password is required")

    def post(self):
        print("Secure Change Password Called")
        args = self.parser.parse_args()
        email = args['email'].lower()
        
        # Verify current password first
        if args['role'] == 'teacher':
            verify_result = authFunc.verifyAdmin(email, args['currentPassword'])
        else:
            verify_result = authFunc.verifyStudent(email, args['currentPassword'])
            
        if not verify_result or not isinstance(verify_result, dict) or not verify_result.get('status'):
            return {'status': False, 'message': 'Incorrect current password'}, 400
            
        # If valid, update to new password
        success = authFunc.updatePassword(email, args['newPassword'])
        
        if success:
            return {'status': True, 'message': 'Password changed successfully'}
        return {'status': False, 'message': 'Failed to update password in database'}, 500

api.add_resource(UpdateProfile, '/updateProfile')
api.add_resource(ChangePasswordSecure, '/changePassword')

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
            return {'status': 'success', 'message': 'Password updated successfully'}
        else:
            return {'status': 'fail', 'message': 'User not found or database error'}, 400

api.add_resource(UpdatePassword, '/updatePassword')



if __name__ == "__main__":
    port = int(os.getenv('AUTH_SERVER_PORT', 300))
    print(f"Starting Auth Server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)


