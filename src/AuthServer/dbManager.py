"""
Supabase Database Manager
Handles database operations using Supabase (Free Tier PostgreSQL)
"""
from supabase import create_client, Client
import os
from dotenv import load_dotenv

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
load_dotenv(dotenv_path=env_path)

class dbManager:
    """Database manager for Supabase"""

    def __init__(self):
        self.url = os.getenv('SUPABASE_URL', '')
        self.key = os.getenv('SUPABASE_KEY', '')
        self.client: Client = None

    def connect(self):
        """Establish connection to Supabase"""
        try:
            self.client = create_client(self.url, self.key)
            print(f"Connected to Supabase: {self.url}")
        except Exception as e:
            print(f"Error connecting to Supabase: {e}")
            raise

    def insertEntry(self, table, jsonObj):
        """Insert a record into a table"""
        try:
            # Remove any 'id' field if it's auto-generated
            if 'id' in jsonObj and jsonObj['id'] == 0:
                del jsonObj['id']
            
            result = self.client.table(table).insert(jsonObj).execute()
            print(f"Inserted into {table}: {jsonObj.get('email', 'record')}")
            return result
            
        except Exception as e:
            print(f"Error inserting into {table}: {e}")
            return None

    def getEntry(self, table, jsonKey):
        """Get a record by key"""
        try:
            key_name = list(jsonKey.keys())[0]
            key_value = jsonKey[key_name]
            
            result = self.client.table(table).select("*").eq(key_name, key_value).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            return None
            
        except Exception as e:
            print(f"Error getting from {table}: {e}")
            return None

    def runQuery(self, query):
        """
        Run a query - converts SQL-like syntax to Supabase query
        Example: "SELECT email,password FROM student WHERE email='test@email.com'"
        """
        try:
            # Parse the query
            query_lower = query.lower()
            
            # Extract table name
            table = None
            if 'from ' in query_lower:
                from_idx = query_lower.index('from ') + 5
                table_part = query_lower[from_idx:].split()[0]
                table = table_part.strip()
            
            if not table:
                print(f"Could not determine table from query: {query}")
                return []
            
            # Start building the query
            supabase_query = self.client.table(table).select("*")
            
            # Handle WHERE clause
            if 'where ' in query_lower:
                where_idx = query_lower.index('where ') + 6
                where_clause = query[where_idx:].strip()
                
                # Parse conditions (simple single condition for now)
                # Format: field='value' or field=value
                if '=' in where_clause:
                    parts = where_clause.split('=')
                    field = parts[0].strip()
                    value = parts[1].strip().strip("'").strip('"')
                    supabase_query = supabase_query.eq(field, value)
            
            result = supabase_query.execute()
            return result.data if result.data else []
            
        except Exception as e:
            print(f"Error running query: {e}")
            return []

    def deleteEntry(self, table, jsonKey):
        """Delete a record"""
        try:
            key_name = list(jsonKey.keys())[0]
            key_value = jsonKey[key_name]
            
            result = self.client.table(table).delete().eq(key_name, key_value).execute()
            return True
            
        except Exception as e:
            print(f"Error deleting from {table}: {e}")
            return False

    def updateEntry(self, table, jsonKey, updateData):
        """Update a record"""
        try:
            key_name = list(jsonKey.keys())[0]
            key_value = jsonKey[key_name]
            
            result = self.client.table(table).update(updateData).eq(key_name, key_value).execute()
            return result
            
        except Exception as e:
            print(f"Error updating {table}: {e}")
            return None

    def close(self):
        """Close the connection"""
        self.client = None


if __name__ == "__main__":
    # Test connection
    db = dbManager()
    db.connect()
    
    # Test insert
    test_data = {
        'name': "Test Student",
        'email': "test@email.com",
        'password': "hashed_password",
        'photo_url': "http://example.com/photo.jpg"
    }
    db.insertEntry('student', test_data)
    
    # Test query
    results = db.runQuery("SELECT * FROM student WHERE email='test@email.com'")
    print(f"Query results: {results}")
    
    db.close()
