import React, { useEffect, useState } from "react"
import { initializeApp } from "firebase/app"
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore"

// Ta config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAKUPGvuXs-ewcUyCKVaVbU3sMXTzGK9xY",
  authDomain: "scrum-poker-e6a75.firebaseapp.com",
  projectId: "scrum-poker-e6a75",
  storageBucket: "scrum-poker-e6a75.firebasestorage.app",
  messagingSenderId: "651145301518",
  appId: "1:651145301518:web:3ee004510ec2065f"
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

  const saveVotes = async (newVotes: typeof votes, newFinished?: typeof finishedVoting, newRevealed?: boolean, newParticipants?: string[]) => {
    const votesDoc = doc(db, "planningPoker", "votes")
    await setDoc(
      votesDoc,
      {
        votes: newVotes,
        finishedVoting: newFinished ?? finishedVoting,
        revealed: newRevealed ?? revealed,
        participants: newParticipants ?? participants,
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

  const handleVote = async (phase: string, value: number) => {
    if (!pseudo) return
    const newVotes = { ...votes }
    if (!newVotes[phase]) newVotes[phase] = {}
    newVotes[phase][pseudo] = value
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
    await saveVotes(newVotes, finishedVoting)
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
    const sum = values.reduce((acc, val) => acc + val, 0)
    return sum / values.length
  }

  const totalEstimate = () => {
    return phases
      .reduce((acc, phase) => acc + calculateAverage(votes[phase]), 0)
      .toFixed(2)
  }

  const isLoggedIn = (userValidated && pseudo.trim() !== "") || admin

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      <div style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
        <p>Entrez votre pseudo pour voter :</p>
        <input
          placeholder="Pseudo"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          disabled={userValidated || admin}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />
        <button
          onClick={handleUserValidation}
          disabled={!pseudo.trim() || userValidated || admin}
          style={{ width: "100%", padding: 8 }}
        >
          Valider
        </button>

        <p style={{ marginTop: 24, fontWeight: "bold" }}>
          Espace Admin (réservé uniquement à l'admin) :
        </p>
        <input
          type="password"
          placeholder="Mot de passe admin"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          onKeyDown={handleLogin}
          disabled={admin}
          style={{ width: "100%", padding: 8, marginBottom: 4 }}
        />
        <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
          (Validez avec Entrée)
        </p>

        {admin && (
          <>
            <button
              onClick={() => setRevealed(true)}
              style={{ width: "100%", padding: 8, marginBottom: 8 }}
            >
              Révéler les estimations
            </button>
            <button
              onClick={resetAll}
              style={{ width: "100%", padding: 8, backgroundColor: "#eee" }}
            >
              Reset total
            </button>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: "bold" }}>Statut des votants :</div>
              {participants.length === 0 && <p>Aucun participant</p>}
              {participants.map((user) => (
                <div key={user} style={{ marginTop: 4 }}>
                  {finishedVoting[user] ? (
                    <span style={{ color: "green" }}>✅ {user} a terminé</span>
                  ) : (
                    <span style={{ color: "orange" }}>⏳ {user} n’a pas encore terminé</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {revealed && (
          <div style={{ marginTop: 16, fontWeight: "bold" }}>
            Estimation totale : {totalEstimate()}
          </div>
        )}
      </div>

      {isLoggedIn &&
        phases.map((phase) => (
          <div
            key={phase}
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h2>{phase}</h2>
              {admin && (
                <button onClick={() => resetVotes(phase)} style={{ fontSize: 12 }}>
                  Reset phase
                </button>
              )}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                marginTop: 12,
              }}
            >
              {fibonacciValues.map((val) => (
                <div
                  key={val}
                  style={{
                    border: "1px solid #ccc",
                    padding: 8,
                    borderRadius: 4,
                    cursor: "pointer",
                    backgroundColor:
                      votes[phase]?.[pseudo] === val ? "#1976d2" : "#fff",
                    color: votes[phase]?.[pseudo] === val ? "#fff" : "#000",
                  }}
                  title={fibonacciLabels[val]}
                  onClick={() => handleVote(phase, val)}
                >
                  {val}
                </div>
              ))}
            </div>

            {votes[phase] && revealed && (
              <div style={{ marginTop: 16 }}>
                <div>
                  <b>Moyenne :</b> {calculateAverage(votes[phase]).toFixed(2)}
                </div>
                <div style={{ marginTop: 8 }}>
                  {Object.entries(votes[phase]).map(([user, vote]) => (
                    <div
                      key={user}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: user === pseudo ? "#bbdefb" : "#eee",
                        borderRadius: 4,
                        marginTop: 4,
                      }}
                    >
                      {user}: {vote}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!finishedVoting[pseudo] && !admin && (
              <button
                onClick={handleFinishEstimation}
                style={{ marginTop: 12, width: "100%", padding: 8 }}
              >
                Terminer l'estimation
              </button>
            )}
          </div>
        ))}
    </div>
  )
}
