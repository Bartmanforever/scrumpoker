import React, { useState } from "react";

function LoginPage() {
  const [pseudo, setPseudo] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Pseudo saisi : ${pseudo}`);
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
        Connexion
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4 flex flex-col items-center">
        <div style={{ width: 300 }}>
          <label className="block mb-1 text-gray-700" htmlFor="pseudo">
            Pseudo
          </label>
          <input
            id="pseudo"
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="Votre pseudo"
            className="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ width: "100%" }}
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
          style={{ width: 300 }}
        >
          Se connecter
        </button>
      </form>
    </div>
  );
}

export default LoginPage;
