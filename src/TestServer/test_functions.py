import os
from dotenv import load_dotenv

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
load_dotenv(dotenv_path=env_path)
from dbManager import dbManager

class testFunction:

    def __init__(self):
        self.db = dbManager()
        

    def connect2DB(self):
        self.db.connect()


    def createTest(self,test_id,testDetails):
        jsonData = {'test_id':test_id,
                    'test_details':testDetails}

        return self.db.upsertEntry("test",jsonData)

    def getTest(self,test_id):
        query = 'select test_details from test where test_id='+test_id
        result = self.db.runQuery(query)
        if len(result)==0:
            return {"Error":"test_id Not Found "}
        result=result[0];

        return result

    def getAllTest(self):
        query = 'select test_details from test'
        result = self.db.runQuery(query)
        return result

    def deleteTest(self, test_id):
        """Delete a test by test_id"""
        print(f"Attempting to delete test with ID: {test_id}")
        result = self.db.deleteEntry("test", {"test_id": test_id})
        print(f"Delete result: {result}")
        return result


