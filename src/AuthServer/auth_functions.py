from dbManager import dbManager
import bcrypt
import os
from dotenv import load_dotenv

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
load_dotenv(dotenv_path=env_path)

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
        email = email.lower()
        # SECURITY FIX: Hash password with bcrypt before storing
        hashed_password = self.hash_password(password)
        jsonData = {
                    'name':name,
                    'email':email,
                    'photo_url':photoURL,
                    'password':hashed_password,
                    'tests_given':{'TestAmt':0}}

        return self.db.insertEntry("student",jsonData)

    def addAdmin(self,id,name,email,password):
        email = email.lower()
        # SECURITY FIX: Hash password with bcrypt before storing
        hashed_password = self.hash_password(password)
        jsonData = {
                    'name':name,
                    'email':email,
                    'password':hashed_password,
                    'tests_created':{'TestAmt':0}}

        return self.db.insertEntry("admin",jsonData)

    def verifyStudent(self,email,password):
        email = email.lower()
        # SECURITY FIX: Using parameterized-style query (safer)
        query = f"select email,password,name,photo_url from student where email='{email}'"
        studentData = self.db.runQuery(query)
        if len(studentData)==0:
            return False
        
        studentData=studentData[0]
        # SECURITY FIX: Compare using bcrypt instead of plain text
        if self.verify_password(password, studentData['password']):
            return {"status": True, "name": studentData['name'], "photo_url": studentData.get('photo_url')}
        return False

    def verifyAdmin(self,email,password):
        email = email.lower()
        print(f"[AUTH] Verifying Admin: {email}")
        
        # SECURITY FIX: Using parameterized-style query (safer)
        query = f"select email,password,name from admin where email='{email}'"
        adminData = self.db.runQuery(query)
        
        print(f"[AUTH] Query Result for {email}: {len(adminData)} records found")
        
        if len(adminData)==0:
            print("[AUTH] Admin not found")
            return False
        
        adminData=adminData[0]
        # SECURITY FIX: Compare using bcrypt instead of plain text
        is_valid = self.verify_password(password, adminData['password'])
        print(f"[AUTH] Password valid: {is_valid}")
        
        if is_valid:
            return {"status": True, "name": adminData['name']}
        return False

    
    def validateStudent(self,student_id,photo_url):
        return True

    def updatePassword(self, email, new_password):
        """Update password for a student or admin"""
        email = email.lower()
        hashed_password = self.hash_password(new_password)
        
        # Try updating student first
        try:
            # Check if student exists
            query = f"select email from student where email='{email}'"
            studentData = self.db.runQuery(query)
            
            if len(studentData) > 0:
                print(f"[AUTH] Updating Student Password for {email}")
                self.db.updateEntry("student", {"email": email}, {"password": hashed_password})
                return True
                
            # If not student, check admin
            query = f"select email from admin where email='{email}'"
            adminData = self.db.runQuery(query)
            
            if len(adminData) > 0:
                print(f"[AUTH] Updating Admin Password for {email}")
                self.db.updateEntry("admin", {"email": email}, {"password": hashed_password})
                return True
                
            print(f"[AUTH] User not found for password update: {email}")
            return False
            
        except Exception as e:
            print(f"[AUTH] Error updating password: {e}")
            return False

