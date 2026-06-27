export default function Home() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
      <h1>School Report System</h1>
      <a href='/dashboard' style={{ padding: '10px 20px', backgroundColor: 'blue', color: 'white', borderRadius: '5px', textDecoration: 'none' }}>Go to Dashboard</a>
    </div>
  );
}
