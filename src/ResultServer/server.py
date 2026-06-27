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
                'created_at': r.get('created_at', None),
                'total_marks': r.get('total_marks', 0),
                'mcq_total': r.get('mcq_total', 0),
                'mcq_obtained': r.get('mcq_obtained', 0),
                'subjective_total': r.get('subjective_total', 0),
                'subjective_obtained': r.get('subjective_obtained', 0),
                'percentage': r.get('percentage', 0),
                'pass_status': r.get('pass_status', 'FAIL'),
                'passing_marks': r.get('passing_marks', 0),
                'question_scores': r.get('question_scores', [])
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
                'anomaly_data': r.get('anomaly_data', []),
                'total_marks': r.get('total_marks', 0),
                'mcq_total': r.get('mcq_total', 0),
                'mcq_obtained': r.get('mcq_obtained', 0),
                'subjective_total': r.get('subjective_total', 0),
                'subjective_obtained': r.get('subjective_obtained', 0),
                'percentage': r.get('percentage', 0),
                'pass_status': r.get('pass_status', 'FAIL'),
                'passing_marks': r.get('passing_marks', 0),
                'question_scores': r.get('question_scores', [])
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
                'anomaly_data': r.get('anomaly_data', []),
                'total_marks': r.get('total_marks', 0),
                'mcq_total': r.get('mcq_total', 0),
                'mcq_obtained': r.get('mcq_obtained', 0),
                'subjective_total': r.get('subjective_total', 0),
                'subjective_obtained': r.get('subjective_obtained', 0),
                'percentage': r.get('percentage', 0),
                'pass_status': r.get('pass_status', 'FAIL'),
                'passing_marks': r.get('passing_marks', 0),
                'question_scores': r.get('question_scores', [])
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
            
        # ===== ACCURATE WEIGHTED SCORING ENGINE =====
        mcq_obtained = 0 
        mcq_total = 0
        subjective_total = 0
        subjective_obtained = 0
        answers = []
        question_scores = []
        passing_marks = int(response.get("passingMarks", 0))
        
        integrity = response.get("integrity", random.randint(1, 100))
        tab_switch_data = response.get("tabSwitchData", []) 
        fullscreen_data = response.get("fullscreenData", []) 
        action_logs = response.get("actionLogs", [])
        
        # Extract AI Monitoring Data
        cheat_score = float(response.get("cheatScore", 0))
        combined_score = float(response.get("combinedCheatScore", 0))
        anomaly_data = response.get("anomalyData", [])
        monitoring_stats = response.get("monitoringStats", {})
        monitoring_enabled = monitoring_stats.get("framesCaptured", 0) > 0 if monitoring_stats else False
        
        # Calculate risk level
        risk_level = calculate_risk_level(combined_score)
        
        qna = response["qna"]
        print("--- SCORING TRACE (Weighted) ---")
        for q in qna:
            student_ans = str(q.get("studentAnswer", "")).strip().lower()
            actual_ans = str(q.get("actualAnswer", "")).strip().lower()
            marks = int(q.get("marks", 1))
            has_options = q.get("hasOptions", True)
            
            if has_options:
                # MCQ Question - auto scored
                mcq_total += marks
                if student_ans == actual_ans:
                    mcq_obtained += marks
                    question_scores.append({
                        "ind": q['ind'],
                        "marks": marks,
                        "obtained": marks,
                        "correct": True
                    })
                    print(f"  Q{q['ind']}: CORRECT (+{marks} marks) (Student: '{student_ans}', Actual: '{actual_ans}')")
                else:
                    question_scores.append({
                        "ind": q['ind'],
                        "marks": marks,
                        "obtained": 0,
                        "correct": False
                    })
                    print(f"  Q{q['ind']}: INCORRECT (0/{marks} marks) (Student: '{student_ans}', Actual: '{actual_ans}')")
            else:
                # Subjective Question - not auto-scored, stored for manual grading
                subjective_total += marks
                question_scores.append({
                    "ind": q['ind'],
                    "marks": marks,
                    "obtained": 0,
                    "correct": None  # Not graded yet
                })
                print(f"  Q{q['ind']}: SUBJECTIVE ({marks} marks - pending manual grading)")
                
            answers.append(q.get("studentAnswer", ""))

        total_marks = mcq_total + subjective_total
        final_score = mcq_obtained + subjective_obtained
        percentage = round((final_score / total_marks) * 100, 2) if total_marks > 0 else 0
        
        # Pass/Fail determination based on teacher-set threshold
        pass_status = "PASS" if final_score >= passing_marks else "FAIL"
        
        print(f"--- TOTALS ---")
        print(f"  MCQ: {mcq_obtained}/{mcq_total}")
        print(f"  Subjective: {subjective_obtained}/{subjective_total}")
        print(f"  Total: {final_score}/{total_marks}")
        print(f"  Percentage: {percentage}%")
        print(f"  Passing Marks: {passing_marks}")
        print(f"  Status: {pass_status}")
        
        jsondata = {
                'student_id': int(s_id) if s_id and s_id != 0 else None,  # Can be NULL
                'email': email,
                'test_id': str(t_id),  # Explicitly ensure TEXT type
                'mcq_score': int(mcq_obtained),  # Legacy column - now same as mcq_obtained
                'final_score': int(final_score),
                'generated': False,
                'answers': answers,
                'integrity': int(integrity),
                'tab_switch_data': tab_switch_data,
                'fullscreen_data': fullscreen_data, 
                'action_logs': action_logs,
                'subjective_score': int(subjective_obtained),
                # New accurate scoring columns
                'total_marks': int(total_marks),
                'mcq_total': int(mcq_total),
                'mcq_obtained': int(mcq_obtained),
                'subjective_total': int(subjective_total),
                'subjective_obtained': int(subjective_obtained),
                'percentage': float(percentage),
                'pass_status': str(pass_status),
                'passing_marks': int(passing_marks),
                'question_scores': question_scores,
                # AI monitoring columns
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
        print(f"  Score: {final_score}/{total_marks} ({percentage}%) - {pass_status}")
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


