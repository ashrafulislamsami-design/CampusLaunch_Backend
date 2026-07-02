const http = require('http');

const runTests = async () => {
  console.log('--- Starting Auth Tests ---');
  
  const testUser = {
    name: 'Test Student',
    email: `test_student_${Date.now()}@example.com`,
    password: 'password123',
    role: 'Student',
    university: 'State University',
    department: 'Computer Science',
    graduationYear: 2026,
    skills: ['JavaScript', 'React'],
    lookingFor: ['Web Development', 'Team Projects'],
    hoursPerWeek: 15,
    workStyle: 'remote'
  };

  const requestOptions = (path, method, body) => ({
    hostname: 'localhost',
    port: 5000,
    path: path,
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(body))
    }
  });

  const makeRequest = (options, body) => {
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.write(JSON.stringify(body));
      req.end();
    });
  };

  try {
    // Test 1: Register User
    console.log(`\n1. Registering user ${testUser.email}...`);
    const regOptions = requestOptions('/api/auth/register', 'POST', testUser);
    const regResult = await makeRequest(regOptions, testUser);
    
    if (regResult.statusCode === 201 && regResult.data.token) {
      console.log('✅ Registration successful!');
      console.log('Token received:', regResult.data.token.substring(0, 20) + '...');
    } else {
      console.error('❌ Registration failed:', regResult);
      throw new Error('Registration test failed');
    }

    // Test 2: Login User
    console.log(`\n2. Logging in as ${testUser.email}...`);
    const loginPayload = { email: testUser.email, password: testUser.password };
    const loginOptions = requestOptions('/api/auth/login', 'POST', loginPayload);
    const loginResult = await makeRequest(loginOptions, loginPayload);

    if (loginResult.statusCode === 200 && loginResult.data.token) {
      console.log('✅ Login successful!');
      console.log('Token received:', loginResult.data.token.substring(0, 20) + '...');
    } else {
      console.error('❌ Login failed:', loginResult);
      throw new Error('Login test failed');
    }

    console.log('\n✅ All tests passed seamlessly!');
  } catch (error) {
    console.error('\n❌ Tests encountered an error:', error.message);
  }
};

// Wait a bit to ensure the server is ready if newly started
setTimeout(runTests, 2000);
