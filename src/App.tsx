import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";

// Config Firebase (ASSUREZ-VOUS QUE C'EST LA BONNE POUR VOTRE PROJET)
const firebaseConfig = {
  apiKey: "AIzaSyAKUPGvuXs-ewcUyCKVaVbU3sMXTzGK9xY",
  authDomain: "scrum-poker-e6a75.firebaseapp.com",
  projectId: "scrum-poker-e6a75",
  storageBucket: "scrum-poker-e6a75.appspot.com",
  messagingSenderId: "651144070000", // Exemple, utilisez le vôtre
  appId: "1:651144070000:web:123456789abcdef", // Exemple, utilisez le vôme
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
// Tri des labels pour la légende
const sortedFibonacciLabels = Object.entries({
  0: "peu d'effort, quasi nul",
  0.5: "très simple / trivial",
  1: "travail très rapide",
  2: "peu complexe",
  3: "complexité faible",
  5: "complexité modérée",
  8: "travail difficile",
  13: "très complexe, gros effort",
  20: "au-delà du raisonnable",
}).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));


export default function PlanningPokerApp() {
  const [pseudo, setPseudo] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [admin, setAdmin] = useState(false);
  const [userValidated, setUserValidated] = useState(false);
  const [votes, setVotes] = useState<Record<string, Record<string, number>>>({});
  const [finishedVoting, setFinishedVoting] = useState<Record<string, boolean>>({});
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
        setModifiedVoting(data.modifiedVoting || {});
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
          modifiedVoting: {},
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
    newModified = modifiedVoting,
    newRevealed = revealed,
    newParticipants = participants
  ) => {
    const votesDoc = doc(db, "planningPoker", "votes");
    await setDoc(
      votesDoc,
      {
        votes: newVotes,
        finishedVoting: newFinished,
        modifiedVoting: newModified,
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
    if (revealed) return; // Ne pas permettre de voter si c'est révélé

    const newVotes = { ...votes };
    if (!newVotes[phase]) newVotes[phase] = {};

    const oldVote = newVotes[phase][pseudo];

    if (oldVote === value) {
      delete newVotes[phase][pseudo];
    } else {
      newVotes[phase][pseudo] = value;
    }

    setVotes(newVotes);

    if (finishedVoting[pseudo] && !revealed) {
        const newModified = { ...modifiedVoting, [pseudo]: true };
        setModifiedVoting(newModified);
        await saveVotes(newVotes, { ...finishedVoting, [pseudo]: false }, newModified, revealed, participants);
    } else {
        await saveVotes(newVotes, finishedVoting, modifiedVoting, revealed, participants);
    }
  };

  const handleFinishEstimation = async () => {
    if (!pseudo) return;
    const newFinished = { ...finishedVoting, [pseudo]: true };
    const newModified = { ...modifiedVoting, [pseudo]: false };
    setFinishedVoting(newFinished);
    setModifiedVoting(newModified);
    await saveVotes(votes, newFinished, newModified, revealed, participants);
  };

  const resetPhaseVotes = async (phaseToReset: string) => { // Renommé pour plus de clarté
    const newVotes = { ...votes };
    const newFinishedVoting = { ...finishedVoting };
    const newModifiedVoting = { ...modifiedVoting };

    // Efface uniquement les votes de la phase spécifiée
    if (newVotes[phaseToReset]) {
      delete newVotes[phaseToReset];
    }
    
    // Réinitialise les états "finished" et "modified" pour tous les participants si la phase est réinitialisée
    // Cela permet au bouton "J'ai terminé" de réapparaître chez les votants.
    participants.forEach(p => {
        newFinishedVoting[p] = false;
        newModifiedVoting[p] = false;
    });

    setVotes(newVotes);
    setFinishedVoting(newFinishedVoting);
    setModifiedVoting(newModifiedVoting);
    // Si les estimations étaient révélées, les cacher à nouveau pour cette phase
    setRevealed(false); 
    await saveVotes(newVotes, newFinishedVoting, newModifiedVoting, false, participants);
  };

  const resetAllVotesKeepParticipants = async () => {
    setVotes({});
    setFinishedVoting({});
    setModifiedVoting({});
    setRevealed(false);
    await saveVotes({}, {}, {}, false, participants);
  };

  const resetAll = async () => {
    setVotes({});
    setFinishedVoting({});
    setModifiedVoting({});
    setRevealed(false);
    setParticipants([]);
    await saveVotes({}, {}, {}, false, []);
  };

  const revealEstimations = async () => {
    setRevealed(true);
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

  // Calcule le total des votes du pseudo courant
  const calculatePersonalTotal = () => {
    if (!pseudo) return 0;
    let personalSum = 0;
    phases.forEach(phase => {
        const vote = votes[phase]?.[pseudo];
        if (vote !== undefined) {
            personalSum += vote;
        }
    });
    return personalSum.toFixed(2);
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
      {/* Zone de login et admin */}
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

              {/* Nouveau positionnement du bouton "Révéler les estimations" */}
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
                  marginTop: 16, // Ajout d'une marge supérieure
                  marginBottom: 8,
                }}
              >
                Révéler les estimations
              </button>

              {revealed && (
                <div style={{ fontWeight: "bold", fontSize: "1.2em", color: "#28a745", marginBottom: 16 }}>
                  Estimation totale (groupe) : {totalEstimate()}
                </div>
              )}
              {/* Boutons de réinitialisation pour l'admin */}
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
                    marginBottom: 10,
                  }}
              >
                  Réinitialiser tous les votes (conserver participants)
              </button>
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
        {/* Légende des valeurs Fibonacci pour les admins (gardée sur la gauche) */}
        {admin && (
          <div
            style={{
              border: "1px solid #eee",
              borderRadius: 8,
              padding: 12,
              backgroundColor: "#f9f9f9",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              marginTop: 24,
            }}
          >
            <h4 style={{ margin: "0", color: "#555", marginBottom: 10 }}>Légende des valeurs :</h4>
            {sortedFibonacciLabels.map(([value, description]) => (
              <div key={value} style={{ marginBottom: 5 }}>
                <span style={{ fontWeight: "bold", color: "#333" }}>{value} : </span>
                <span style={{ color: "#666", fontSize: "0.9em" }}>{description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zone des votes et affichages pour les votants */}
      {isLoggedIn && (
        <div
          style={{
            border: "1px solid #ddd",
            padding: 16,
            borderRadius: 8,
            flex: "2 1 0%",
            boxSizing: "border-box",
            display: "grid",
            // Ajustement des colonnes de grille : 2 pour l'admin, 'auto 1fr' pour les votants
            gridTemplateColumns: admin ? "1fr 1fr" : "auto 1fr", 
            gap: 24,
          }}
        >
          {/* Section affichage total votant / total groupe pour les votants */}
          {userValidated && (
            <div style={{ gridColumn: "span 2", borderBottom: "1px dashed #eee", paddingBottom: 15, marginBottom: 15 }}>
              {finishedVoting[pseudo] && ( // N'affiche le total personnel que si l'utilisateur a cliqué "J'ai terminé"
                <p style={{ fontWeight: "bold", fontSize: "1.1em", color: "#007bff", marginBottom: 8 }}>
                  Votre estimation totale : {calculatePersonalTotal()}
                </p>
              )}
              {revealed && ( // N'affiche le total groupe que si c'est révélé
                <p style={{ fontWeight: "bold", fontSize: "1.1em", color: "#28a745" }}>
                  Estimation totale du groupe : {totalEstimate()}
                </p>
              )}
            </div>
          )}

          {/* Légende des valeurs Fibonacci pour les VOTANTS (maintenant sur la gauche) */}
          {userValidated && !admin && ( // S'affiche pour les votants et non pour l'admin
            <div
              style={{
                gridColumn: "1", // Occupe la première colonne
                gridRow: "2 / span all", // S'étend sur toutes les lignes à partir de la 2ème (après le total)
                // Styles visuels
                border: "1px solid #eee",
                borderRadius: 8,
                padding: 12,
                backgroundColor: "#f9f9f9",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                marginTop: 0, // Pas de marge supérieure si en haut de la colonne
                alignSelf: "start", // Aligne la légende en haut de sa zone
                maxHeight: "fit-content", // Ajuste la hauteur au contenu
              }}
            >
              <h4 style={{ margin: "0", color: "#555", marginBottom: 10 }}>Légende des valeurs :</h4>
              {sortedFibonacciLabels.map(([value, description]) => (
                <div key={value} style={{ marginBottom: 5 }}>
                  <span style={{ fontWeight: "bold", color: "#333" }}>{value} : </span>
                  <span style={{ color: "#666", fontSize: "0.9em" }}>{description}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ gridColumn: admin ? "auto" : "2 / span 1" }}> {/* Les phases pour les votants sont dans la 2ème colonne si la légende est présente */}
            {phases.map((phase) => (
              <div key={phase} style={{ marginBottom: 24 }}>
                <h3>{phase}</h3>
                
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {
                    // Masque les boutons de vote Fibonacci si l'utilisateur est admin
                    !admin && fibonacciValues.map((val) => {
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
                          title={sortedFibonacciLabels.find(([v,d]) => parseFloat(v) === val)?.[1] || ""} // Utilise les labels triés
                        >
                          {val}
                        </button>
                      );
                    })
                  }
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

                {revealed && ( // Affichage des détails par phase pour tous (votants et admin)
                  <>
                    <p style={{ fontWeight: "bold", margin: "8px 0", color: "#0056b3" }}>
                      Moyenne du groupe : {calculateAverage(votes[phase]).toFixed(2)}
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
              </div>
            ))}
          </div>

          {/* Le bouton "J'ai terminé l'estimation" */}
          {userValidated && (!finishedVoting[pseudo] || modifiedVoting[pseudo]) && !revealed && (
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
                width: "auto",
                minWidth: "150px",
                gridColumn: admin ? "1 / span 1" : "2 / span 1", // Ajusté pour le positionnement votant
                justifySelf: "start",
                marginRight: "auto",
                marginBottom: 24, 
              }}
            >
              J'ai terminé l'estimation
            </button>
          )}

        </div>
      )}
    </div>
  );
}