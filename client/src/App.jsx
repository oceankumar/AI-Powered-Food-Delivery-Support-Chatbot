import ChatBox from "./components/ChatBox";

function App() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 to-indigo-100 p-4">
      <div className="mx-auto flex max-w-3xl items-center justify-center py-8">
        <ChatBox />
      </div>
    </main>
  );
}

export default App;
