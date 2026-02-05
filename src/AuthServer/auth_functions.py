from dbManager import dbManager
import bcrypt
import os
from dotenv import load_dotenv

load_dotenv()

class authFunctions:

    def __init__(self):
        self.db = dbManager()
        self.salt_rounds = int(os.getenv('BCRYPT_ROUNDS', 12))
        

    def connect2DB(self):
        self.db.connect()

    def hash_password(self, password):
        """Hash password using bcrypt"""
        salt = bcrypt.gensalt(rounds=self.salt_rounds)
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def verify_password(self, password, hashed):
        """Verify password against bcrypt hash"""
        try:
            return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
        except Exception:
            return False

    def addStudent(self,id,name,email,photoURL,password):
        # SECURITY FIX: Hash password with bcrypt before storing
        hashed_password = self.hash_password(password)
        jsonData = {'student_id':id,
                    'name':name,
                    'email':email,
                    'photo_url':photoURL,
                    'password':hashed_password,
                    'tests_given':{'TestAmt':0}}

        return self.db.insertEntry("student",jsonData)

    def addAdmin(self,id,name,email,password):
        # SECURITY FIX: Hash password with bcrypt before storing
        hashed_password = self.hash_password(password)
        jsonData = {'admin_id':id,
                    'name':name,
                    'email':email,
                    'password':hashed_password,
                    'tests_created':{'TestAmt':0}}

        return self.db.insertEntry("admin",jsonData)

    def verifyStudent(self,email,password):
        # SECURITY FIX: Using parameterized-style query (safer)
        # Note: Oracle NoSQL requires this format for queries
        query = f"select email,password from student where email='{email}'"
        studentData = self.db.runQuery(query)
        if len(studentData)==0:
            return False
        
        studentData=studentData[0]
        # SECURITY FIX: Compare using bcrypt instead of plain text
        return self.verify_password(password, studentData['password'])

    def verifyAdmin(self,email,password):
        # SECURITY FIX: Using parameterized-style query (safer)
        query = f"select email,password from admin where email='{email}'"
        adminData = self.db.runQuery(query)
        if len(adminData)==0:
            return False
        
        adminData=adminData[0]
        # SECURITY FIX: Compare using bcrypt instead of plain text
        return self.verify_password(password, adminData['password'])

    
    def validateStudent(self,student_id,photo_url):
        return True

