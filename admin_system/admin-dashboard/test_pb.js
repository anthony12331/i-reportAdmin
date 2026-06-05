import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');

async function test() {
  try {
    const records = await pb.collection('users').getList(1, 1, {
      filter: 'status = "pending"',
    });
    const user = records.items[0];
    await pb.collection('users').update(user.id, {
      status: 'verified',
      user_id: "12345678901"
    });
    console.log('Update succeeded!');
  } catch(e) {
    console.error('Data:', JSON.stringify(e.data, null, 2));
  }
}
test();