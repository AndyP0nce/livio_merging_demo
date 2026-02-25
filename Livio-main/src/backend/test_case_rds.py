"""
Test script to check AWS RDS MySQL connection
"""

import socket
import sys

# Your RDS settings
HOST = "livio-rds.c3euemwmm60k.us-west-1.rds.amazonaws.com"
PORT = 3306
USER = "admin"
PASSWORD = "LivioMarketplaceApp2025$"
DATABASE = "LIVIO"

def test_dns():
    """Test if we can resolve the hostname"""
    print(f"1. Testing DNS resolution for {HOST}...")
    try:
        ip = socket.gethostbyname(HOST)
        print(f"   DNS resolved to: {ip}")
        return True
    except socket.gaierror as e:
        print(f"   DNS resolution failed: {e}")
        print("   → Check if the RDS instance exists in AWS Console")
        return False

def test_port():
    """Test if we can connect to the port"""
    print(f"\n2. Testing TCP connection to {HOST}:{PORT}...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10)
    try:
        result = sock.connect_ex((HOST, PORT))
        if result == 0:
            print(f"   Port {PORT} is open and reachable!")
            return True
        else:
            print(f"   Cannot connect to port {PORT}")
            print("   → Check RDS Security Group - your IP might not be allowed")
            print("   → Check if RDS instance is running (not stopped)")
            print("   → Check if 'Public accessibility' is set to Yes")
            return False
    except socket.timeout:
        print(f"   Connection timed out")
        print("   → Security Group is likely blocking your IP")
        return False
    except Exception as e:
        print(f"   Connection failed: {e}")
        return False
    finally:
        sock.close()

def test_mysql():
    """Test actual MySQL connection"""
    print(f"\n3. Testing MySQL authentication...")
    try:
        import pymysql
    except ImportError:
        print("    pymysql not installed. Run: pip install pymysql")
        return False
    
    try:
        connection = pymysql.connect(
            host=HOST,
            port=PORT,
            user=USER,
            password=PASSWORD,
            database=DATABASE,
            connect_timeout=10
        )
        print(f"   MySQL connection successful!")
        print(f"   Connected to database: {DATABASE}")
        
        # Test a simple query
        with connection.cursor() as cursor:
            cursor.execute("SELECT VERSION()")
            version = cursor.fetchone()
            if version:
                print(f"   MySQL version: {version[0]}")
            else:
                print("   MySQL version: Unable to retrieve")
        
        connection.close()
        return True
    except pymysql.err.OperationalError as e:
        error_code = e.args[0]
        if error_code == 1045:
            print(f"   Authentication failed - wrong username/password")
        elif error_code == 2003:
            print(f"   Can't connect to MySQL server")
            print("   → Check Security Group and Public accessibility")
        elif error_code == 1049:
            print(f"   Database '{DATABASE}' does not exist")
            print("   → You may need to create the database first")
        else:
            print(f"   MySQL error: {e}")
        return False
    except Exception as e:
        print(f"   Error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("AWS RDS Connection Test")
    print("=" * 60)
    print(f"Host: {HOST}")
    print(f"Port: {PORT}")
    print(f"User: {USER}")
    print(f"Database: {DATABASE}")
    print("=" * 60)
    
    dns_ok = test_dns()
    if not dns_ok:
        print("\nFAILED: Cannot resolve hostname. RDS instance may not exist.")
        sys.exit(1)
    
    port_ok = test_port()
    if not port_ok:
        print("\n" + "=" * 60)
        print("FAILED: Cannot reach the database server.")
        print("\nTO FIX THIS:")
        print("1. Go to AWS Console → RDS → Databases")
        print("2. Click on 'livio-rds'")
        print("3. Check Status is 'Available' (not 'Stopped')")
        print("4. Check 'Public accessibility' is 'Yes'")
        print("5. Click on Security Group → Edit inbound rules")
        print("6. Add rule: Type=MySQL/Aurora, Port=3306, Source=My IP")
        print("=" * 60)
        sys.exit(1)
    
    mysql_ok = test_mysql()
    if mysql_ok:
        print("\n" + "=" * 60)
        print("SUCCESS! Your RDS connection is working!")
        print("You can now run: python manage.py runserver")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("MySQL connection failed. Check credentials or database name.")
        print("=" * 60)
        sys.exit(1)