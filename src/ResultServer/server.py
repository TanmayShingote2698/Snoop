from flask import Flask, request, jsonify, make_response
from flask_restful import Resource, Api, reqparse
import os
from dotenv import load_dotenv
import json

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
load_dotenv(dotenv_path=env_path)
from dbManager import dbManager
import random

def calculate_risk_level(cheat_score):
    """Convert cheat score to risk level"""
    if cheat_score < 20:
        return "LOW"
    elif cheat_score < 40:
        return "MODERATE"
    elif cheat_score < 60:
        return "MEDIUM"
    elif cheat_score < 80:
        return "HIGH"
    else:
        return "CRITICAL"

app = Flask(__name__)
api= Api(app)
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET', 'mysecretkey')

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
        db.connect()
  
    def post(self):
        print("post was called")
        found =getStudentResult.parser.parse_args()["studentEmail"]
        query = "SELECT * FROM result where email='" + found+"'"
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
                'subjective_score':r['subjective_score'],
                'tab_switch_data': r.get('tab_switch_data', []),
                'monitoring_enabled': r.get('monitoring_enabled', False),
                'cheat_score': r.get('cheat_score', 0),
                'combined_score': r.get('combined_score', 0),
                'risk_level': r.get('risk_level', 'LOW'),
                'anomaly_data': r.get('anomaly_data', []),
                'created_at': r.get('created_at', None)
            }
            bigjson.append(jsondata)
        
        data = {"result": bigjson}
        return jsonify(data)

class getTestResult(Resource):
    parser = reqparse.RequestParser()
    parser.add_argument('test_id', type=str, required=True, help="This field cannot be left blank.")
    def __init__(self):
        db.connect()
    
    def post(self):
        print("post test was called")
        found =getTestResult.parser.parse_args()["test_id"]
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
                'subjective_score':r['subjective_score'],
                'tab_switch_data': r.get('tab_switch_data', []),
                'monitoring_enabled': r.get('monitoring_enabled', False),
                'cheat_score': r.get('cheat_score', 0),
                'combined_score': r.get('combined_score', 0),
                'risk_level': r.get('risk_level', 'LOW'),
                'anomaly_data': r.get('anomaly_data', [])
            }
            bigjson.append(jsondata)
        
    
        data = {"result": bigjson}
        return data

class getStudentResponse(Resource):
    parser = reqparse.RequestParser()
    parser.add_argument('studentEmail', type=str, required=True, help="This field cannot be left blank.")
    parser.add_argument('test_id', type=str, required=True, help="This field cannot be left blank.")
    def __init__(self):
        db.connect()
    
    def post(self):
        print("post student response was called")
        s_email = getStudentResponse.parser.parse_args()["studentEmail"]
        t_id = getStudentResponse.parser.parse_args()["test_id"]
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
                'subjective_score':r['subjective_score'],
                'tab_switch_data': r.get('tab_switch_data', []),
                'monitoring_enabled': r.get('monitoring_enabled', False),
                'cheat_score': r.get('cheat_score', 0),
                'combined_score': r.get('combined_score', 0),
                'risk_level': r.get('risk_level', 'LOW'),
                'anomaly_data': r.get('anomaly_data', [])
            }
            bigjson.append(jsondata)
    
        data = {"result": bigjson}
        return jsonify(data)

class scoreAndStore(Resource):
    parser = reqparse.RequestParser()
    parser.add_argument('response', type=dict, required=True, help="This field cannot be left blank.")
    
    def __init__(self):
        db.connect()
    
    def post(self):
        print("score and store was called")
        response = scoreAndStore.parser.parse_args()["response"]
        print(type(response))
        # Ensure test_id is properly treated as TEXT/string, not converted to number
        t_id = str(response["testID"]).strip()  # Keep as string, remove whitespace
        email = str(response["studentEmail"]).strip()
        print(f"Response:{response}")
        
        # Fetch actual student_id from database
        student_query = f"SELECT student_id FROM student WHERE email='{email}'"
        student_data = db.runQuery(student_query)
        if student_data and len(student_data) > 0:
            s_id_candidate = student_data[0].get('student_id')
            try:
                s_id = int(s_id_candidate)
            except Exception as e:
                print(f"Warning: student_id from DB is not integer: {s_id_candidate} ({e})")
                s_id = None
        else:
            s_id = None # Fallback
            
        mcq_score = 0 
        final_score = 0
        generated = False
        answers = []
        integrity = response.get("integrity", random.randint(1, 100))
        tab_switch_data = response.get("tabSwitchData", []) 
        fullscreen_data = response.get("fullscreenData", []) 
        # No longer random - requires manual marking or automated model
        subjective_score = 0
        
        # Extract AI Monitoring Data
        cheat_score = float(response.get("cheatScore", 0))
        combined_score = float(response.get("combinedCheatScore", 0))
        anomaly_data = response.get("anomalyData", [])
        monitoring_stats = response.get("monitoringStats", {})
        monitoring_enabled = monitoring_stats.get("framesCaptured", 0) > 0 if monitoring_stats else False
        
        # Calculate risk level
        risk_level = calculate_risk_level(combined_score)
        
        qna = response["qna"]
        print("--- SCORING TRACE ---")
        for q in qna:
            student_ans = str(q.get("studentAnswer", "")).strip().lower()
            actual_ans = str(q.get("actualAnswer", "")).strip().lower()
            
            if student_ans == actual_ans:
                mcq_score += 1
                print(f"  Q{q['ind']}: MATCH (Student: '{student_ans}', Actual: '{actual_ans}')")
            else:
                print(f"  Q{q['ind']}: MISMATCH (Student: '{student_ans}', Actual: '{actual_ans}')")
                
            answers.append(q.get("studentAnswer", ""))

        final_score = mcq_score
        print(f"--- TOTALS: MCQ={mcq_score}, Final={final_score} ---")
        
        jsondata = {
                'student_id': int(s_id) if s_id and s_id != 0 else None,  # Can be NULL
                'email': email,
                'test_id': str(t_id),  # Explicitly ensure TEXT type
                'mcq_score': int(mcq_score),
                'final_score': int(final_score),
                'generated': bool(generated),
                'answers': answers,
                'integrity': int(integrity),
                'tab_switch_data': tab_switch_data,
                'fullscreen_data': fullscreen_data, 
                'action_logs': action_logs,
                'subjective_score': int(subjective_score),
                'monitoring_enabled': bool(monitoring_enabled),
                'cheat_score': float(cheat_score),
                'combined_score': float(combined_score),
                'risk_level': str(risk_level),
                'anomaly_data': anomaly_data if isinstance(anomaly_data, list) else [],
                'monitoring_stats': monitoring_stats if isinstance(monitoring_stats, dict) else {}
            }

        print(f"DEBUG: Inserting into result with test_id='{jsondata['test_id']}' (type: {type(jsondata['test_id']).__name__})")
        result = db.insertEntry("result", jsondata)
        print(result)
        
        print(f"[Suite] Test {t_id} - Student {email}")
        print(f"  Integrity: {integrity}, Cheat Score: {cheat_score}, Combined: {combined_score}")
        print(f"  Risk Level: {risk_level}, Monitoring: {monitoring_enabled}")

        # Update student's tests_given count
        try:
            student_data_query = f"SELECT tests_given FROM student WHERE email='{email}'"
            student_profile = db.runQuery(student_data_query)
            if student_profile:
                current_tests = student_profile[0].get('tests_given', {"TestAmt": 0})
                if isinstance(current_tests, str):
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
    db = dbManager()
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


