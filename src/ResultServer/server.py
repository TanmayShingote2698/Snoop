from flask import Flask, request,jsonify,redirect, url_for,  make_response
from flask_restful import Resource, Api, reqparse
import os
from dotenv import load_dotenv
from dbManager import dbManager
import random

# Load environment variables from project root
load_dotenv('../../.env')

app = Flask(__name__)
api= Api(app)
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET', 'mysecretkey')

# Initialize DB globally
db = dbManager()
db.connect()

# Health Check Endpoint
@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'ResultServer',
        'port': int(os.getenv('RESULT_SERVER_PORT', 200))
    })


class getStudentResult(Resource):
    parser = reqparse.RequestParser()
    parser.add_argument('studentEmail', type=str, required=True, help="This field cannot be left blank.")
    def __init__(self):
        pass
  
    def post(self):
        print("getStudentResult was called")
        found =getStudentResult.parser.parse_args()["studentEmail"]
        query = f"SELECT * FROM result where email='{found}'"
        result = db.runQuery(str(query))
        bigjson = []
        for r in result :
            jsondata = {
                'student_id': r["student_id"], 
                'email': r["email"],
                'test_id': r["test_id"],
                'mcq_score':r['mcq_score'],
                'final_score':r['final_score'],
                'generated':r['generated'],
                'answers':r['answers'],
                'integrity':r['integrity'],
                'subjective_score':r['subjective_score']
            }
            bigjson.append(jsondata)
        
        data = {"result": bigjson}
        return jsonify(data)

class getTestResult(Resource):
    parser = reqparse.RequestParser()
    parser.add_argument('test_id', type=str, required=True, help="This field cannot be left blank.")
    def __init__(self):
        pass
    
    def post(self):
        print("getTestResult was called")
        found =getTestResult.parser.parse_args()["test_id"]
        # Fix: Quote test_id for alphanumeric support
        query = f"SELECT * FROM result where test_id='{found}'"
        result = db.runQuery(str(query))
        bigjson = []
        for r in result :
            jsondata = {
                'student_id': r["student_id"], 
                'email':r["email"],
                'test_id': r["test_id"],
                'mcq_score':r['mcq_score'],
                'final_score':r['final_score'],
                'generated':r['generated'],
                'answers':r['answers'],
                'integrity':r['integrity'],
                'subjective_score':r['subjective_score']
            }
            bigjson.append(jsondata)
        
    
        data = {"result": bigjson}
        return jsonify(data)

class getStudentResponse(Resource):
    parser = reqparse.RequestParser()
    parser.add_argument('studentEmail', type=str, required=True, help="This field cannot be left blank.")
    parser.add_argument('test_id', type=str, required=True, help="This field cannot be left blank.")
    def __init__(self):
        pass
    
    def post(self):
        print("getStudentResponse was called")
        s_email = getStudentResponse.parser.parse_args()["studentEmail"]
        t_id = getStudentResponse.parser.parse_args()["test_id"]
        # Fix: Quote test_id and email
        query = f"SELECT * FROM result where test_id='{t_id}' and email='{s_email}'"
        result = db.runQuery(str(query))
        bigjson = []
        for r in result :
            jsondata = {
                'student_id': r["student_id"], 
                'email': r["email"],
                'test_id': r["test_id"],
                'mcq_score':r['mcq_score'],
                'final_score':r['final_score'],
                'generated':r['generated'],
                'answers':r['answers'],
                'integrity':r['integrity'],
                'subjective_score':r['subjective_score']
            }
            bigjson.append(jsondata)
    
        data = {"result": bigjson}
        return jsonify(data)

class scoreAndStore(Resource):
    parser = reqparse.RequestParser()
    parser.add_argument('response', type=dict, required=True, help="This field cannot be left blank.")
    
    def __init__(self):
        pass
    
    def post(self):
        print("score and store was called")
        response = scoreAndStore.parser.parse_args()["response"]
        print(type(response))
        t_id = str(response["testID"])
        email = str(response["studentEmail"])
        print(f"Response:{response}")
        
        # Fetch actual student_id from database
        # Fix: Quote email
        student_query = f"SELECT student_id FROM student WHERE email='{email}'"
        student_data = db.runQuery(student_query)
        if student_data and len(student_data) > 0:
            s_id = student_data[0].get('student_id')
        else:
            s_id = 0 # Fallback
            
        mcq_score = 0 # Initialize to 0, will be incremented
        final_score=mcq_score+random.randint(1,5)
        generated=False
        answers=[]
        integrity = response.get("integrity", random.randint(1, 100))
        tab_switch_data = response.get("tabSwitchData", []) # Extract tab switch logs
        subjective_score=random.randint(1,20)
        qna = response["qna"]
        print("=======================================")
        for q in qna:
            student_ans = q.get('studentAnswer')
            actual_ans = q.get('actualAnswer')
            
            print(f"q:{q}")
            print(f"qActual:{actual_ans}")
            print(f"qStudent:{student_ans}")

            if actual_ans and actual_ans != "This is a sbjective question":
                if actual_ans == student_ans:
                    mcq_score = mcq_score + 1
            
            answers.append(student_ans if student_ans is not None else "")
        print("================================================")
        # print(qna)
        # print(type(qna))
        # print(mcq_score)
        # print(answers)
        
        jsondata = {
                'student_id': s_id,
                'email':email,
                'test_id': t_id,
                'mcq_score':mcq_score,
                'final_score':final_score,
                'generated':generated,
                'answers':answers,
                'integrity':integrity,
                'tab_switch_data': tab_switch_data, # Store in DB
                'subjective_score':subjective_score
            }

        

        result = db.insertEntry("result",jsondata)
        print(result)

        if not result:
            return jsonify({"result": "fail", "message": "Database insertion failed. Please ensure 'tab_switch_data' column (JSONB) exists in 'result' table."}), 500

        # Update student's tests_given count
        try:
            # Fix: Quote email
            student_data_query = f"SELECT tests_given FROM student WHERE email='{email}'"
            student_profile = db.runQuery(student_data_query)
            if student_profile:
                current_tests = student_profile[0].get('tests_given', {"TestAmt": 0})
                if isinstance(current_tests, str):
                    import json
                    current_tests = json.loads(current_tests)
                
                new_count = current_tests.get('TestAmt', 0) + 1
                db.updateEntry("student", {"email": email}, {"tests_given": {"TestAmt": new_count}})
                print(f"Updated test count for {email} to {new_count}")
        except Exception as e:
            print(f"Error updating student test count: {e}")
        
        data = {"result": "success"}
        return jsonify(data)


api.add_resource(getStudentResult, '/getStudentResult')
api.add_resource(getTestResult, '/getTestResult')
api.add_resource(getStudentResponse, '/getStudentResponse')
api.add_resource(scoreAndStore, '/scoreAndStore')

if __name__ == "__main__":
    port = int(os.getenv('RESULT_SERVER_PORT', 200))
    print(f"Starting Result Server on port {port}...")
    # Disable reloader to prevent MemoryError on Windows with large directory structures
    app.run(host='0.0.0.0', port=port, debug=True, use_reloader=False)









'''

Response of Student
{
  testID: '69',
  studentEmail: 'HelloWorld@google.com',
  qna: [
    { ind: 1, studentAnswer: '4', actualAnswer: '4' },
    {
      ind: 2,
      studentAnswer: 'jaf;ioejosdc ijdo oajsodjao',
      actualAnswer: 'This is a sbjective question'
    }
  ]
}
{
  id: '69',
  questions: [
    {
      answer: '4',
      ind: 1,
      op1: 'sky',
      op2: 'cloud',
      op3: 'ceiling',
      op4: 'Oracle cloud',
      question: 'What is up'
    },
    { ind: 2, question: 'What is the best' }
  ],
  testDuration: '69',
  warningThreshold: '6'
}
#####

{
    "response" : {
        "testID" : 2,
        "studentEmail" : "hdg@oracle.com",
        "student_id": 100,
        "qna" : [
            {
                "ind": 1,
                "studentAnswer": "parht wafdgfgcfbjbocnbkcjnbgk",
                "actualAnswer": "This is a sbjective question"
            },
            { 
                "ind": 2, 
                "studentAnswer": "4", 
                "actualAnswer": "4" 
            },
            { 
                "ind": 2, 
                "studentAnswer": "4", 
                "actualAnswer": "4" 
            },
            { 
                "ind": 2, 
                "studentAnswer": "hekko", 
                "actualAnswer": "hekko" 
            }
        ]
        
    }
}
'''


