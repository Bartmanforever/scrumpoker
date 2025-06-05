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
  // État pour savoir si un utilisateur a "terminé" son vote
  const [finishedVoting, setFinishedVoting] = useState<Record<string, boolean>>({});
  // État pour savoir si un utilisateur a modifié son vote après l'avoir "terminé"
  const [modifiedVoting, setModifiedVoting] = useState<Record<string, boolean>>({});
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
        setModifiedVoting(data.modifiedVoting || {}); // Charger l'état de modification
        setRevealed(data.revealed || false);
        setParticipants(data.participants || []);
        if (pseudo && data.participants && data.participants.includes(pseudo)) {
            setUserValidated(true);
        }
      } else {
        setVotes({});
        setFinishedVoting({});
        setModifiedVoting({});
        setRevealed(false);
        setParticipants([]);
        setDoc(votesDoc, {
          votes: {},
          finishedVoting: {},
          modifiedVoting: {}, // Initialiser le champ
          revealed: false,
          participants: []
        }, { merge: true });
      }
    });
    return () => unsubscribeVotes();
  }, [pseudo]);

  // Fonction pour sauvegarder les données dans Firebase
  const saveVotes = async (
    newVotes: typeof votes,
    newFinished = finishedVoting,
    newModified = modifiedVoting, // Ajout de newModified
    newRevealed = revealed,
    newParticipants = participants
  ) => {
    const votesDoc = doc(db, "planningPoker", "votes");
    await setDoc(
      votesDoc,
      {
        votes: newVotes,
        finishedVoting: newFinished,
        modifiedVoting: newModified, // Sauvegarder l'état de modification
        revealed: newRevealed,
        participants: newParticipants,
      },
      { merge: true }
    );
  };

  const handleUserValidation = async () => {
    if (!pseudo.trim()) return;
    setUserValidated(true);
    if (!participants.includes(pseudo)) {
      const newParticipants = [...participants, pseudo];
      setParticipants(newParticipants);
      await saveVotes(votes, finishedVoting, modifiedVoting, revealed, newParticipants);
    }
  };

  const handleLogin = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && adminPassword === "adminpass") {
      setAdmin(true);
      setAdminPassword("");
    }
  };

  const handleVote = async (phase: string, value: number) => {
    if (!pseudo) return;
    const newVotes = { ...votes };
    if (!newVotes[phase]) newVotes[phase] = {};

    const oldVote = newVotes[phase][pseudo];

    // Permet de désélectionner un vote en cliquant une deuxième fois
    if (oldVote === value) {
      delete newVotes[phase][pseudo];
    } else {
      newVotes[phase][pseudo] = value;
    }

    setVotes(newVotes);

    // Si l'utilisateur avait déjà "terminé" son vote et qu'il le modifie AVANT révélation
    if (finishedVoting[pseudo] && !revealed) {
        const newModified = { ...modifiedVoting, [pseudo]: true };
        setModifiedVoting(newModified);
        await saveVotes(newVotes, { ...finishedVoting, [pseudo]: false }, newModified, revealed, participants); // Revert finished state to false
    } else {
        await saveVotes(newVotes, finishedVoting, modifiedVoting, revealed, participants);
    }
  };

  const handleFinishEstimation = async () => {
    if (!pseudo) return;
    const newFinished = { ...finishedVoting, [pseudo]: true };
    const newModified = { ...modifiedVoting, [pseudo]: false }; // Réinitialise l'état "modifié" quand l'utilisateur re-valide
    setFinishedVoting(newFinished);
    setModifiedVoting(newModified);
    await saveVotes(votes, newFinished, newModified, revealed, participants);
  };

  const resetPhaseVotes = async (phase: string) => {
    const newVotes = { ...votes };
    delete newVotes[phase];
    // Réinitialise l'état "finishedVoting" et "modifiedVoting" pour cette phase
    const newFinished = { ...finishedVoting };
    const newModified = { ...modifiedVoting };
    
    // Pour chaque participant, si le vote pour cette phase est réinitialisé, on le marque comme non-terminé ou non-modifié
    participants.forEach(p => {
        // Si le participant avait voté pour cette phase, son état "terminé" pourrait être remis à false
        // pour cette phase, mais il faut gérer l'ensemble des phases pour l'état global finishedVoting[p]
        // Pour l'instant, on se contente de réinitialiser le vote et de ne pas toucher à finishedVoting[p]
        // à moins qu'on veuille une gestion par phase du "terminé"
        // Simplification : si on reset une phase, les participants peuvent revoter dessus sans perdre leur "terminé" global
        // Le plus simple est de ne pas toucher à finishedVoting[p] ici.
        // C'est le clic sur "J'ai terminé" qui valide l'état global.
    });

    setVotes(newVotes);
    await saveVotes(newVotes, finishedVoting, modifiedVoting, revealed, participants);
  };

  const resetAllVotesKeepParticipants = async () => {
    setVotes({});
    setFinishedVoting({});
    setModifiedVoting({}); // Réinitialise aussi l'état modifié
    setRevealed(false);
    await saveVotes({}, {}, {}, false, participants); // Les participants restent
  };

  const resetAll = async () => {
    setVotes({});
    setFinishedVoting({});
    setModifiedVoting({}); // Réinitialise aussi l'état modifié
    setRevealed(false);
    setParticipants([]);
    await saveVotes({}, {}, {}, false, []);
  };

  const revealEstimations = async () => {
    setRevealed(true);
    // Le simple fait de définir setRevealed(true) et de sauvegarder déclenchera
    // la re-rendu et les calculs seront basés sur les votes actuels dans Firebase.
    await saveVotes(votes, finishedVoting, modifiedVoting, true, participants);
  };

  const calculateAverage = (phaseVotes: Record<string, number> | undefined) => {
    if (!phaseVotes) return 0;
    const values = Object.values(phaseVotes);
    if (values.length === 0) return 0;
    return values.reduce((acc, val) => acc + val, 0) / values.length;
  };

  const totalEstimate = () => {
    return phases
      .reduce((acc, phase) => acc + calculateAverage(votes[phase]), 0)
      .toFixed(2);
  };

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
          disabled={userValidated}
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <button
          onClick={handleUserValidation}
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
          style={{ width: "100%", padding: 8, boxSizing: "border-box", marginBottom: 8 }}
        />
        {admin && (
          <p style={{ color: "green", marginTop: 8 }}>Connecté en tant qu'administrateur</p>
        )}

        {admin && (
          <div style={{ marginTop: 24 }}>
            <button
              onClick={revealEstimations}
              style={{
                width: "100%",
                padding: "8px 12px",
                cursor: "pointer",
                backgroundColor: "#007bff",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                marginBottom: 8,
              }}
            >
              Révéler les estimations
            </button>
            {revealed && (
              <div style={{ fontWeight: "bold", fontSize: "1.2em", color: "#28a745", marginBottom: 16 }}>
                Estimation totale : {totalEstimate()}
              </div>
            )}
          </div>
        )}

        {admin && (
            <div style={{ marginTop: revealed ? 10 : 24 }}>
                <h3>Participants connectés</h3>
                {participants.length > 0 ? (
                    <ul style={{ listStyleType: "none", padding: 0 }}>
                        {participants.map((p) => (
                            <li key={p} style={{ marginBottom: 4 }}>
                                {p}{" "}
                                {/* Affichage des icônes de statut */}
                                {modifiedVoting[p] ? (
                                    <span title="A modifié son estimation">🔄</span>
                                ) : finishedVoting[p] ? (
                                    <span title="A terminé son estimation">✅</span>
                                ) : (
                                    <span title="N'a pas encore terminé son estimation">⏳</span>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>Aucun participant connecté pour le moment.</p>
                )}
                {/* NOUVEAU EMPLACEMENT : Bouton Réinitialiser tous les votes mais conserver les participants */}
                <button
                    onClick={resetAllVotesKeepParticipants}
                    style={{
                      marginTop: 16,
                      padding: "8px 12px",
                      cursor: "pointer",
                      backgroundColor: "#ffc107",
                      color: "#333",
                      border: "none",
                      borderRadius: 4,
                      width: "100%",
                      boxSizing: "border-box",
                      marginBottom: 10, // Espace sous ce bouton
                    }}
                >
                    Réinitialiser tous les votes (conserver participants)
                </button>
                {/* NOUVEL EMPLACEMENT : Bouton Réinitialiser tout (y compris participants) */}
                <button
                  onClick={resetAll}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    backgroundColor: "#dc3545",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  Réinitialiser tout (y compris participants)
                </button>
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
              {revealed && (
                <>
                  <p style={{ fontWeight: "bold", margin: "8px 0", color: "#0056b3" }}>
                    Moyenne : {calculateAverage(votes[phase]).toFixed(2)}
                  </p>
                  <div style={{ display: "flex", gap: 15, marginTop: 10, borderTop: "1px dashed #eee", paddingTop: 10 }}>
                    <div style={{ flex: 1, minWidth: "120px" }}>
                      <p style={{ fontWeight: "bold", marginBottom: 5 }}>Votes par valeur :</p>
                      <ul style={{ listStyleType: "none", padding: 0 }}>
                        {fibonacciValues.map((val) => {
                          const currentPhaseVotes: Record<string, number> = votes[phase] || {};
                          const count = Object.values(currentPhaseVotes).filter(
                            (v) => v === val
                          ).length;

                          return (
                            count > 0 && (
                              <li key={`${phase}-count-${val}`} style={{ marginBottom: 3 }}>
                                <span style={{ fontWeight: "normal" }}>{val} : </span>
                                <span style={{ fontWeight: "bold", color: "#6a0dad" }}>
                                  {count} vote{count > 1 ? "s" : ""}
                                </span>
                              </li>
                            )
                          );
                        })}
                      </ul>
                    </div>

                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: "bold", marginBottom: 5 }}>Détails des votes :</p>
                      <ul style={{ listStyleType: "none", padding: 0 }}>
                        {participants.map((participantName) => {
                          const voteValue = votes[phase]?.[participantName];
                          return (
                            <li key={`${phase}-${participantName}`} style={{ marginBottom: 3 }}>
                              <span style={{ fontWeight: "normal" }}>{participantName} : </span>
                              <span style={{ color: voteValue !== undefined ? '#333' : 'red', fontWeight: 'bold' }}>
                                {voteValue !== undefined ? voteValue : "N'a pas voté"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: revealed ? 15 : 0, alignItems: "center" }}>
                {fibonacciValues.map((val) => {
                  const isSelected = votes[phase]?.[pseudo] === val;
                  // Les boutons sont désactivés SEULEMENT si les estimations sont révélées
                  const isDisabled = revealed;
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
                {admin && (
                  <button
                    onClick={() => resetPhaseVotes(phase)}
                    style={{
                      padding: "6px 10px",
                      cursor: "pointer",
                      backgroundColor: "#f0ad4e",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      marginLeft: 10,
                      fontSize: "0.8em",
                    }}
                    title="Réinitialiser les votes pour cette phase uniquement"
                  >
                    Reset Phase
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Le bouton "J'ai terminé l'estimation" n'apparaît que si l'utilisateur est validé et n'a pas terminé
          ET que les estimations ne sont pas révélées */}
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

          {/* Section "Gestion globale (Admin)" - actions globales seulement */}
          {admin && (
            <div style={{ marginTop: 32, gridColumn: "span 2" }}>
              {/* Le bouton "Réinitialiser tout (y compris participants)" a été déplacé à gauche */}
            </div>
          )}
        </div>
      )}
    </div>
  );
}