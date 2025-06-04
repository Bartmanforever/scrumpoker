import React, { useEffect, useState } from "react"
import { initializeApp } from "firebase/app"
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore"

// Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAKUPGvuXs-ewcUyCKVaVbU3sMXTzGK9xY",
  authDomain: "scrum-poker-e6a75.firebaseapp.com",
  projectId: "scrum-poker-e6a75",
  storageBucket: "scrum-poker-e6a75.appspot.com",
  messagingSenderId: "651145301518",
  appId: "1:651145301518:web:3ee004510ec2065f",
}

// Initialize Firebase & Firestore
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const phases = [
  "Effort d'apprentissage",
  "QA > Prépa strat de Kalif + 1er comité",
  "Dévs > prépa cas de tests (dont cobunit...)",
  "Complexité des dévs",
  "Dévs > Exécution des TU et TI",
  "Qualif post dévs et 2nd comité",
  "Déploiement",
]

const fibonacciValues = [0, 0.5, 1, 2, 3, 5, 8, 13, 20]
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
}

export default function PlanningPokerApp() {
  const [pseudo, setPseudo] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [admin, setAdmin] = useState(false)
  const [userValidated, setUserValidated] = useState(false)
  const [votes, setVotes] = useState<Record<string, Record<string, number>>>({})
  const [finishedVoting, setFinishedVoting] = useState<Record<string, boolean>>({})
  const [revealed, setRevealed] = useState(false)
  const [participants, setParticipants] = useState<string[]>([])

  useEffect(() => {
    const votesDoc = doc(db, "planningPoker", "votes")
    const unsubscribeVotes = onSnapshot(votesDoc, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        setVotes(data.votes || {})
        setFinishedVoting(data.finishedVoting || {})
        setRevealed(data.revealed || false)
        setParticipants(data.participants || [])
      }
    })
    return () => unsubscribeVotes()
  }, [])

  const saveVotes = async (
    newVotes: typeof votes,
    newFinished = finishedVoting,
    newRevealed = revealed,
    newParticipants = participants
  ) => {
    const votesDoc = doc(db, "planningPoker", "votes")
    await setDoc(
      votesDoc,
      {
        votes: newVotes,
        finishedVoting: newFinished,
        revealed: newRevealed,
        participants: newParticipants,
      },
      { merge: true }
    )
  }

  const handleUserValidation = async () => {
    if (!pseudo.trim()) return
    setUserValidated(true)
    if (!participants.includes(pseudo)) {
      const newParticipants = [...participants, pseudo]
      setParticipants(newParticipants)
      await saveVotes(votes, finishedVoting, revealed, newParticipants)
    }
  }

  const handleLogin = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && adminPassword === "adminpass") {
      setAdmin(true)
    }
  }

  // ✅ VERSION MODIFIÉE : bouton décochable
  const handleVote = async (phase: string, value: number) => {
    if (!pseudo) return
    const newVotes = { ...votes }
    if (!newVotes[phase]) newVotes[phase] = {}

    if (newVotes[phase][pseudo] === value) {
      delete newVotes[phase][pseudo]
    } else {
      newVotes[phase][pseudo] = value
    }

    setVotes(newVotes)
    await saveVotes(newVotes)
  }

  const handleFinishEstimation = async () => {
    if (!pseudo) return
    const newFinished = { ...finishedVoting, [pseudo]: true }
    setFinishedVoting(newFinished)
    await saveVotes(votes, newFinished)
  }

  const resetVotes = async (phase: string) => {
    const newVotes = { ...votes }
    delete newVotes[phase]
    setVotes(newVotes)
    await saveVotes(newVotes)
  }

  const resetAll = async () => {
    setVotes({})
    setFinishedVoting({})
    setRevealed(false)
    setParticipants([])
    await saveVotes({}, {}, false, [])
  }

  const calculateAverage = (phaseVotes: Record<string, number> | undefined) => {
    if (!phaseVotes) return 0
    const values = Object.values(phaseVotes)
    if (values.length === 0) return 0
    return values.reduce((acc, val) => acc + val, 0) / values.length
  }

  const totalEstimate = () => {
    return phases
      .reduce((acc, phase) => acc + calculateAverage(votes[phase]), 0)
      .toFixed(2)
  }

  const isLoggedIn = (userValidated && pseudo.trim() !== "") || admin

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        padding: 16,
        justifyContent: "center",
      }}
    >
      {/* Zone de login */}
      <div
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 8,
          maxWidth: "33%",
          flex: "1 1 33%",
          boxSizing: "border-box",
        }}
      >
        <p>Entrez votre pseudo pour voter :</p>
        <input
          placeholder="Pseudo"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          disabled={userValidated || admin}
          style={{ width: "100%", padding: 8, marginBottom: 8, boxSizing: "border-box" }}
        />
        <button
          onClick={handleUserValidation}
          disabled={!pseudo.trim() || userValidated || admin}
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
      </div>

      {/* Zone des votes */}
      {isLoggedIn && (
        <div
          style={{
            border: "1px solid #ddd",
            padding: 16,
            borderRadius: 8,
            maxWidth: "67%",
            flex: "2 1 67%",
            boxSizing: "border-box",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
        >
          {phases.map((phase) => (
            <div key={phase} style={{ marginBottom: 24 }}>
              <h3>{phase}</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {fibonacciValues.map((val) => {
                  const isSelected = votes[phase]?.[pseudo] === val
                  return (
                    <button
                      key={val}
                      onClick={() => handleVote(phase, val)}
                      disabled={finishedVoting[pseudo]}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 4,
                        border: isSelected ? "2px solid #007bff" : "1px solid #ccc",
                        backgroundColor: isSelected ? "#cce5ff" : "#fff",
                        cursor: finishedVoting[pseudo] ? "not-allowed" : "pointer",
                      }}
                      title={fibonacciLabels[val]}
                    >
                      {val}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {!finishedVoting[pseudo] && (
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
              Terminer l’estimation
            </button>
          )}

          {admin && (
            <div style={{ marginTop: 32, gridColumn: "span 2" }}>
              <h3>Gestion des phases</h3>
              {phases.map((phase) => (
                <div key={phase} style={{ marginBottom: 8 }}>
                  <button
                    onClick={() => resetVotes(phase)}
                    style={{
                      padding: "6px 10px",
                      cursor: "pointer",
                      backgroundColor: "#dc3545",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                    }}
                  >
                    Reset votes {phase}
                  </button>
                </div>
              ))}
            </div>
          )}

          {revealed && (
            <div style={{ marginTop: 24, fontWeight: "bold", gridColumn: "span 2" }}>
              Estimation totale : {totalEstimate()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
