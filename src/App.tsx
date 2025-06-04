import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";

// Config Firebase (ASSUREZ-VOUS QUE C'EST LA BONNE POUR VOTRE PROJET)
const firebaseConfig = {
  apiKey: "AIzaSyAKUPGvuXs-ewcUyCKVaVbU3sMXTzGK9xY",
  authDomain: "scrum-poker-e6a75.firebaseapp.com",
  projectId: "scrum-poker-e6a75",
  storageBucket: "scrum-poker-e6a75.appspot.com",
  messagingSenderId: "651145301518",
  appId: "1:651145301518:web:3ee004510ec2065f",
};

// Initialize Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const phases = [
  "Effort d'apprentissage",
  "QA > Prépa strat de Kalif + 1er comité",
  "Dévs > prépa cas de tests (dont cobunit...)",
  "Complexité des dévs",
  "Dévs > Exécution des TU et TI",
  "Qualif post dévs et 2nd comité",
  "Déploiement",
];

const fibonacciValues = [0, 0.5, 1, 2, 3, 5, 8, 13, 20];
const fibonacciLabels: Record<number, string> = {
  0: "peu d'effort, quasi nul",
  0.5: "très simple / trivial",
  1: "travail très rapide",
  2: "peu complexe",
  3: "complexité faible",
  5: "complexité modérée",
  8: "travail difficile",
  13: "très complexe, gros effort",
  20: "au-delà du raisonnable",
};

export default function PlanningPokerApp() {
  const [pseudo, setPseudo] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [admin, setAdmin] = useState(false);
  const [userValidated, setUserValidated] = useState(false);
  const [votes, setVotes] = useState<Record<string, Record<string, number>>>({});
  const [finishedVoting, setFinishedVoting] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);

  // Synchronisation avec Firebase au chargement du composant
  useEffect(() => {
    const votesDoc = doc(db, "planningPoker", "votes");
    const unsubscribeVotes = onSnapshot(votesDoc, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setVotes(data.votes || {});
        setFinishedVoting(data.finishedVoting || {});
        setRevealed(data.revealed || false);
        setParticipants(data.participants || []);
        // Si le pseudo actuel est dans les participants, marquez comme validé
        // Utile si l'utilisateur rafraîchit la page et que son pseudo était déjà enregistré
        if (pseudo && data.participants && data.participants.includes(pseudo)) {
            setUserValidated(true);
        }
      } else {
        // Le document n'existe pas encore, initialise un état vide
        setVotes({});
        setFinishedVoting({});
        setRevealed(false);
        setParticipants([]);
        // Initialise le document dans Firestore si ce n'est pas déjà fait
        // C'est une bonne pratique pour s'assurer que le document existe
        setDoc(votesDoc, {
          votes: {},
          finishedVoting: {},
          revealed: false,
          participants: []
        }, { merge: true });
      }
    });
    return () => unsubscribeVotes();
  }, [pseudo]); // Ajout de 'pseudo' dans les dépendances pour re-vérifier 'userValidated' si le pseudo change

  // Fonction pour sauvegarder les données dans Firebase
  const saveVotes = async (
    newVotes: typeof votes,
    newFinished = finishedVoting,
    newRevealed = revealed,
    newParticipants = participants
  ) => {
    const votesDoc = doc(db, "planningPoker", "votes");
    await setDoc(
      votesDoc,
      {
        votes: newVotes,
        finishedVoting: newFinished,
        revealed: newRevealed,
        participants: newParticipants,
      },
      { merge: true }
    );
  };

  // Gère la validation du pseudo utilisateur
  const handleUserValidation = async () => {
    if (!pseudo.trim()) return;
    setUserValidated(true);
    if (!participants.includes(pseudo)) {
      const newParticipants = [...participants, pseudo];
      setParticipants(newParticipants);
      await saveVotes(votes, finishedVoting, revealed, newParticipants);
    }
  };

  // Gère la connexion administrateur via le mot de passe
  const handleLogin = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && adminPassword === "adminpass") {
      setAdmin(true);
      setAdminPassword(""); // Efface le mot de passe après connexion
    }
  };

  // Gère le vote de l'utilisateur pour une phase donnée
  const handleVote = async (phase: string, value: number) => {
    if (!pseudo) return;
    const newVotes = { ...votes };
    if (!newVotes[phase]) newVotes[phase] = {};

    // Permet de désélectionner un vote en cliquant une deuxième fois
    if (newVotes[phase][pseudo] === value) {
      delete newVotes[phase][pseudo];
    } else {
      newVotes[phase][pseudo] = value;
    }

    setVotes(newVotes);
    await saveVotes(newVotes);
  };

  // Gère la fin d'estimation pour un utilisateur
  const handleFinishEstimation = async () => {
    if (!pseudo) return;
    const newFinished = { ...finishedVoting, [pseudo]: true };
    setFinishedVoting(newFinished);
    await saveVotes(votes, newFinished);
  };

  // Réinitialise les votes pour une phase spécifique (Admin)
  const resetVotes = async (phase: string) => {
    const newVotes = { ...votes };
    delete newVotes[phase];
    setVotes(newVotes);
    await saveVotes(newVotes);
  };

  // Réinitialise toutes les données de l'application (Admin)
  const resetAll = async () => {
    setVotes({});
    setFinishedVoting({});
    setRevealed(false);
    setParticipants([]);
    await saveVotes({}, {}, false, []);
  };

  // Révèle les estimations pour tous (Admin)
  const revealEstimations = async () => {
    setRevealed(true);
    await saveVotes(votes, finishedVoting, true, participants);
  };

  // Calcule la moyenne des votes pour une phase
  const calculateAverage = (phaseVotes: Record<string, number> | undefined) => {
    if (!phaseVotes) return 0;
    const values = Object.values(phaseVotes);
    if (values.length === 0) return 0;
    return values.reduce((acc, val) => acc + val, 0) / values.length;
  };

  // Calcule l'estimation totale (somme des moyennes par phase)
  const totalEstimate = () => {
    return phases
      .reduce((acc, phase) => acc + calculateAverage(votes[phase]), 0)
      .toFixed(2);
  };

  // Vérifie si l'utilisateur est connecté (validé ou admin)
  const isLoggedIn = (userValidated && pseudo.trim() !== "") || admin;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        padding: 16,
      }}
    >
      {/* Zone de login */}
      <div
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 8,
          flex: "1 1 0%",
          boxSizing: "border-box",
        }}
      >
        <p>Entrez votre pseudo pour voter :</p>
        <input
          placeholder="Pseudo"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          disabled={userValidated} // L'input est désactivé SEULEMENT si userValidated est true
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <button
          onClick={handleUserValidation}
          // Le bouton est désactivé SEULEMENT si pas de pseudo ou userValidated est true
          disabled={!pseudo.trim() || userValidated}
          style={{ width: "100%", padding: 8, marginBottom: 24, cursor: "pointer" }}
        >
          Valider
        </button>

        <p style={{ fontWeight: "bold" }}>Espace Admin :</p>
        <input
          type="password"
          placeholder="Mot de passe admin"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          onKeyDown={handleLogin}
          style={{ width: "100%", padding: 8 }}
        />
        {admin && (
          <p style={{ color: "green", marginTop: 8 }}>Connecté en tant qu'administrateur</p>
        )}

        {admin && (
            <div style={{ marginTop: 24 }}>
                <h3>Participants connectés</h3>
                {participants.length > 0 ? (
                    <ul style={{ listStyleType: "none", padding: 0 }}>
                        {participants.map((p) => (
                            <li key={p} style={{ marginBottom: 4 }}>
                                {p} {finishedVoting[p] && <span style={{ color: "grey", fontSize: "0.9em" }}>(a terminé)</span>}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>Aucun participant connecté pour le moment.</p>
                )}
            </div>
        )}
      </div>

      {/* Zone des votes */}
      {isLoggedIn && (
        <div
          style={{
            border: "1px solid #ddd",
            padding: 16,
            borderRadius: 8,
            flex: "2 1 0%",
            boxSizing: "border-box",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
        >
          {phases.map((phase) => (
            <div key={phase} style={{ marginBottom: 24 }}>
              <h3>{phase}</h3>
              {revealed && ( // Affichage de la moyenne par phase si révélée
                <p style={{ fontWeight: "bold", margin: "8px 0", color: "#0056b3" }}>
                  Moyenne : {calculateAverage(votes[phase]).toFixed(2)}
                </p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {fibonacciValues.map((val) => {
                  const isSelected = votes[phase]?.[pseudo] === val;
                  // Désactive les boutons si les votes sont terminés pour l'utilisateur
                  // ou si les estimations sont révélées (pour empêcher de nouveaux votes)
                  const isDisabled = finishedVoting[pseudo] || revealed;
                  return (
                    <button
                      key={val}
                      onClick={() => handleVote(phase, val)}
                      disabled={isDisabled}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 4,
                        border: isSelected ? "2px solid #007bff" : "1px solid #ccc",
                        backgroundColor: isSelected ? "#cce5ff" : "#fff",
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        opacity: isDisabled ? 0.7 : 1,
                      }}
                      title={fibonacciLabels[val]}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* MODIFIE ICI : Le bouton "J'ai terminé l'estimation" n'apparaît que si l'utilisateur est validé et n'a pas fini/révélé */}
          {userValidated && !finishedVoting[pseudo] && !revealed && (
            <button
              onClick={handleFinishEstimation}
              style={{
                marginTop: 16,
                padding: "8px 12px",
                cursor: "pointer",
                backgroundColor: "#28a745",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                gridColumn: "span 2",
              }}
            >
              J'ai terminé l'estimation
            </button>
          )}

          {admin && (
            <div style={{ marginTop: 32, gridColumn: "span 2" }}>
              <h3>Gestion des estimations (Admin)</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {phases.map((phase) => (
                  <button
                    key={`reset-${phase}`}
                    onClick={() => resetVotes(phase)}
                    style={{
                      padding: "6px 10px",
                      cursor: "pointer",
                      backgroundColor: "#ffc107", // Jaune pour reset de phase
                      color: "#333",
                      border: "none",
                      borderRadius: 4,
                    }}
                  >
                    Réinitialiser "{phase}"
                  </button>
                ))}
              </div>
              <button
                onClick={revealEstimations}
                disabled={revealed} // Désactive si déjà révélé
                style={{
                  marginTop: 16,
                  padding: "8px 12px",
                  cursor: "pointer",
                  backgroundColor: "#007bff",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  marginRight: 8,
                }}
              >
                Révéler les estimations
              </button>
              <button
                onClick={resetAll}
                style={{
                  marginTop: 16,
                  padding: "8px 12px",
                  cursor: "pointer",
                  backgroundColor: "#dc3545",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                }}
              >
                Réinitialiser tout
              </button>
            </div>
          )}

          {revealed && ( // Affichage de l'estimation totale si révélée
            <div style={{ marginTop: 24, fontWeight: "bold", gridColumn: "span 2", fontSize: "1.2em", color: "#28a745" }}>
              Estimation totale : {totalEstimate()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}