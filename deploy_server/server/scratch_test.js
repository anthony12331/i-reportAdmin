const POCKETBASE_URL = "http://127.0.0.1:8090";

async function getAdminToken() {
  const res = await fetch(`${POCKETBASE_URL}/api/collections/super_admins/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity: "j@gmail.com",
      password: "jokemaster"
    })
  });
  const data = await res.json();
  if(!res.ok) console.error("Login failed:", data);
  return data.token;
}

async function test() {
  try {
    const token = await getAdminToken();
    const res = await fetch(`${POCKETBASE_URL}/api/collections/admins/records`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log("Admins Response:", JSON.stringify(data, null, 2));
    
    const res2 = await fetch(`${POCKETBASE_URL}/api/collections/super_admins/records`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data2 = await res2.json();
    console.log("Super Admins Response:", JSON.stringify(data2, null, 2));
  } catch(e) {
    console.error(e);
  }
}

test();
