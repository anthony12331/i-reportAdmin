
const login = async (email, password) => {
  const r = await fetch('https://api.ireportsystem.com/api/collections/users/auth-with-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password })
  });
  return await r.json();
};

const submit = async (token, userId) => {
  return await fetch('https://api.ireportsystem.com/api/collections/incident_reports/records', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      latitude: 8.749954,
      longitude: 124.788297,
      type: 'fire',
      users: userId,
      status: 'pending'
    })
  });
};

const run = async () => {
  console.log('Logging in...');
  const userA = await login('reynantenaong847@gmail.com', '87654321');
  const userB = await login('romelbriones567@gmail.com', '12345678');

  console.log('Firing both requests at the same time...');
  const results = await Promise.all([
    submit(userA.token, userA.record.id),
    submit(userB.token, userB.record.id)
  ]);
  
  console.log('Status A:', results[0].status);
  console.log('Status B:', results[1].status);

  console.log('Waiting 2 seconds for server to process...');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Checking database...');
  const r = await fetch('https://api.ireportsystem.com/api/collections/incident_reports/records?perPage=2&sort=-created', {
    headers: { 'Authorization': 'Bearer ' + userA.token }
  });
  const data = await r.json();
  console.log('Top 2 newest incidents:');
  data.items.forEach(i => {
    console.log('- ID: ' + i.id + ', Created: ' + i.created + ', Reporters Count: ' + i.reporters_count);
  });
};

run().catch(console.error);

