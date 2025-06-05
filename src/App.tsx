import React, { useEffect, useState, useCallback } from "react";
import { initializeApp, FirebaseApp } from "firebase/app"; // Import FirebaseApp type
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, Auth } from "firebase/auth"; // Import Auth type
import { getFirestore, doc, onSnapshot, setDoc, Firestore } from "firebase/firestore"; // Import Firestore type

// Déclarations pour les variables globales injectées par l'environnement Canvas.
// Ces déclarations permettent à TypeScript de reconnaître ces variables au moment de la compilation.
declare const __app_id: string | undefined;
declare const __firebase_config: string | undefined;
declare const __initial_auth_token: string | undefined;

// Les variables globales __app_id, __firebase_config, __initial_auth_token sont fournies par l'environnement Canvas.
// Il est CRUCIAL de les utiliser pour que votre application fonctionne correctement et soit sécurisée.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialisation de Firebase et Firestore
// Déclaration avec types explicites pour éviter les erreurs d'inférence 'any'.
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

// Chemins de données Firebase Firestore.
// Pour des données publiques partagées entre utilisateurs dans un même contexte d'application,
// on utilise le chemin '/artifacts/{appId}/public/data/'.
const PUBLIC_DATA_PATH = `/artifacts/${appId}/public/data/planningPoker`;

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
  // États de l'application
  const [pseudo, setPseudo] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [admin, setAdmin] = useState(false);
  const [userValidated, setUserValidated] = useState(false); // Indique si le pseudo est validé et fait partie des participants
  const [votes, setVotes] = useState<Record<string, Record<string, number>>>({});
  const [finishedVoting, setFinishedVoting] = useState<Record<string, boolean>>({});
  const [modifiedVoting, setModifiedVoting] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // ID de l'utilisateur Firebase
  const [isAuthReady, setIsAuthReady] = useState(false); // Indique si Firebase Auth est initialisé

  // 1. Initialisation de Firebase et gestion de l'authentification
  useEffect(() => {
    try {
      app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      auth = getAuth(app);

      // Écoute les changements d'état d'authentification
      const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setCurrentUserId(user.uid);
        } else {
          // Si l'utilisateur n'est pas connecté, tente de se connecter avec le token ou de manière anonyme
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(auth, initialAuthToken);
            } else {
              await signInAnonymously(auth);
            }
          } catch (error) {
            console.error("Erreur lors de l'authentification Firebase:", error);
          }
        }
        setIsAuthReady(true); // L'authentification est prête, on peut interagir avec Firestore
      });

      return () => unsubscribeAuth();
    } catch (error) {
      console.error("Erreur lors de l'initialisation de Firebase:", error);
    }
  }, []); // S'exécute une seule fois au montage

  // 2. Synchronisation avec Firebase Firestore (dépend de l'état d'authentification)
  useEffect(() => {
    // Ne s'abonne à Firestore que lorsque l'authentification est prête
    if (!isAuthReady || !db) {
      console.log("Firebase Auth non prêt ou db non initialisé.");
      return;
    }

    const votesDocRef = doc(db, PUBLIC_DATA_PATH, "votes");
    const unsubscribeVotes = onSnapshot(votesDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setVotes(data.votes || {});
        setFinishedVoting(data.finishedVoting || {});
        setModifiedVoting(data.modifiedVoting || {});
        setRevealed(data.revealed || false);
        setParticipants(data.participants || []);

        // *************** CORRECTION DU BUG ICI ***************
        // L'état `userValidated` doit être dérivé de la liste des participants de Firestore,
        // et non pas géré localement par `handleUserValidation`.
        if (pseudo && data.participants && data.participants.includes(pseudo)) {
            setUserValidated(true);
        } else {
            // Si le pseudo n'est plus dans la liste des participants (ex: retiré par l'admin),
            // l'utilisateur n'est plus validé.
            setUserValidated(false);
        }
        // ****************************************************

      } else {
        // Si le document n'existe pas, initialise-le
        console.log("Document planningPoker/votes n'existe pas, création...");
        setDoc(votesDocRef, {
          votes: {},
          finishedVoting: {},
          modifiedVoting: {},
          revealed: false,
          participants: []
        }, { merge: true }).catch(e => console.error("Erreur lors de la création du document initial:", e));
      }
    }, (error) => {
      console.error("Erreur lors de la récupération des données Firestore:", error);
    });

    return () => unsubscribeVotes();
  }, [isAuthReady, db, pseudo]); // Dépend de l'état de préparation de l'authentification et de l'instance db

  // Fonction pour sauvegarder les données dans Firebase Firestore
  // Utilisation de useCallback pour éviter la recréation de la fonction à chaque rendu
  const saveVotes = useCallback(async (
    newVotes: typeof votes,
    newFinished: Record<string, boolean> = finishedVoting,
    newModified: Record<string, boolean> = modifiedVoting,
    newRevealed: boolean = revealed,
    newParticipants: string[] = participants
  ) => {
    if (!db || !isAuthReady) {
      console.warn("Impossible de sauvegarder : Firestore non prêt ou authentification non terminée.");
      return;
    }
    const votesDocRef = doc(db, PUBLIC_DATA_PATH, "votes");
    try {
      await setDoc(
        votesDocRef,
        {
          votes: newVotes,
          finishedVoting: newFinished,
          modifiedVoting: newModified,
          revealed: newRevealed,
          participants: newParticipants,
        },
        { merge: true } // Utilise merge pour ne pas écraser les autres champs du document
      );
    } catch (e) {
      console.error("Erreur lors de la sauvegarde des votes:", e);
    }
  }, [db, isAuthReady, finishedVoting, modifiedVoting, revealed, participants]); // Dépendances pour useCallback

  const handleUserValidation = async () => {
    if (!pseudo.trim() || !db || !isAuthReady) return; // S'assurer que Firebase est prêt

    // *************** CORRECTION DU BUG ICI ***************
    // On ne met plus à jour `userValidated` ici.
    // Il sera mis à jour par le listener `onSnapshot` une fois que le pseudo est dans les `participants` de Firestore.
    // setUserValidated(true); // Supprimé
    // ****************************************************

    if (!participants.includes(pseudo)) {
      const newParticipants = [...participants, pseudo];
      setParticipants(newParticipants); // Mise à jour locale, mais la source de vérité est Firestore via saveVotes
      await saveVotes(votes, finishedVoting, modifiedVoting, revealed, newParticipants);
    }
  };

  const handleLogin = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && adminPassword === "adminpass") { // Mot de passe simple pour l'exemple
      setAdmin(true);
      setAdminPassword("");
    }
  };

  const handleVote = async (phase: string, value: number) => {
    if (!pseudo || !db || !isAuthReady || revealed) return; // Ne pas permettre de voter si c'est révélé

    const newVotes = { ...votes };
    if (!newVotes[phase]) newVotes[phase] = {};

    const oldVote = newVotes[phase][pseudo];

    if (oldVote === value) {
      delete newVotes[phase][pseudo]; // Dé-sélectionner si le même bouton est cliqué
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
    if (!pseudo || !db || !isAuthReady) return;
    const newFinished = { ...finishedVoting, [pseudo]: true };
    const newModified = { ...modifiedVoting, [pseudo]: false };
    setFinishedVoting(newFinished);
    setModifiedVoting(newModified);
    await saveVotes(votes, newFinished, newModified, revealed, participants);
  };

  const resetPhaseVotes = async (phaseToReset: string) => {
    if (!db || !isAuthReady) return;
    const newVotes = { ...votes };
    const newFinishedVoting = { ...finishedVoting };
    const newModifiedVoting = { ...modifiedVoting };

    // Efface uniquement les votes de la phase spécifiée
    if (newVotes[phaseToReset]) {
      delete newVotes[phaseToReset];
    }

    // Réinitialise les états "finished" et "modified" pour tous les participants si la phase est réinitialisée
    participants.forEach(p => {
        newFinishedVoting[p] = false;
        newModifiedVoting[p] = false;
    });

    setVotes(newVotes);
    setFinishedVoting(newFinishedVoting);
    setModifiedVoting(newModifiedVoting);
    setRevealed(false); // Cacher les estimations après un reset de phase
    await saveVotes(newVotes, newFinishedVoting, newModifiedVoting, false, participants);
  };

  const resetAllVotesKeepParticipants = async () => {
    if (!db || !isAuthReady) return;
    setVotes({});
    setFinishedVoting({});
    setModifiedVoting({});
    setRevealed(false);
    await saveVotes({}, {}, {}, false, participants);
  };

  const resetAll = async () => {
    if (!db || !isAuthReady) return;
    setVotes({});
    setFinishedVoting({});
    setModifiedVoting({});
    setRevealed(false);
    setParticipants([]);
    await saveVotes({}, {}, {}, false, []);
  };

  const revealEstimations = async () => {
    if (!db || !isAuthReady) return;
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
    if (!pseudo) return "0.00"; // Retourne une chaîne si pseudo est vide
    let personalSum = 0;
    phases.forEach(phase => {
        const vote = votes[phase]?.[pseudo];
        if (vote !== undefined) {
            personalSum += vote;
        }
    });
    return personalSum.toFixed(2);
  };

  // L'utilisateur est considéré "loggé" s'il a validé son pseudo OU s'il est admin
  const isLoggedIn = (userValidated && pseudo.trim() !== "") || admin;

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans antialiased">
      <div className="flex flex-col md:flex-row gap-6 w-full max-w-6xl">
        {/* Zone de login et admin */}
        <div className="border border-gray-200 p-6 rounded-lg flex flex-col items-center flex-1 max-w-full md:max-w-sm shadow-lg bg-white">
          <p className="text-gray-700 mb-4 text-lg font-medium">Entrez votre pseudo pour voter :</p>
          <input
            placeholder="Pseudo"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            disabled={userValidated}
            className="w-4/5 p-2 mb-4 rounded-md border border-gray-300 text-center shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
          />
          <button
            onClick={handleUserValidation}
            disabled={!pseudo.trim() || userValidated}
            className="w-4/5 p-2 mb-8 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 ease-in-out"
          >
            Valider
          </button>

          <p className="font-bold text-gray-800 mb-4 text-xl">Espace Admin :</p>
          <input
            type="password"
            placeholder="Mot de passe admin"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            onKeyDown={handleLogin}
            className="w-4/5 p-2 border border-gray-300 rounded-md text-center shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
          />
          {admin && (
            <p className="text-green-600 mt-3 font-medium">Connecté en tant qu'administrateur</p>
          )}

          {admin && (
              <div className="mt-8 w-full text-center">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Participants connectés</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Votre identifiant unique: <span className="font-mono text-gray-600 break-all text-xs">{currentUserId || 'N/A'}</span>
                </p>
                {participants.length > 0 ? (
                    <ul className="list-none p-0">
                        {participants.map((p) => (
                            <li key={p} className="mb-2 text-gray-700 flex items-center justify-between px-2 py-1 bg-gray-50 rounded-md shadow-sm">
                                {p}{" "}
                                {/* Affichage des icônes de statut */}
                                {modifiedVoting[p] ? (
                                    <span title="A modifié son estimation" className="ml-2 text-lg">🔄</span>
                                ) : finishedVoting[p] ? (
                                    <span title="A terminé son estimation" className="ml-2 text-lg">✅</span>
                                ) : (
                                    <span title="N'a pas encore terminé son estimation" className="ml-2 text-lg">⏳</span>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500 italic">Aucun participant connecté pour le moment.</p>
                )}

                <button
                  onClick={revealEstimations}
                  className="w-full p-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 mt-6 shadow-md transition duration-200 ease-in-out"
                >
                  Révéler les estimations
                </button>

                {revealed && (
                  <div className="font-bold text-2xl text-green-600 mt-5">
                    Estimation totale (groupe) : {totalEstimate()}
                  </div>
                )}
                {/* Boutons de réinitialisation pour l'admin */}
                <button
                    onClick={resetAllVotesKeepParticipants}
                    className="mt-6 p-2.5 bg-yellow-500 text-gray-800 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50 w-full shadow-md transition duration-200 ease-in-out"
                >
                    Réinitialiser tous les votes (conserver participants)
                </button>
                <button
                  onClick={resetAll}
                  className="p-2.5 mt-3 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 w-full shadow-md transition duration-200 ease-in-out"
                >
                  Réinitialiser tout (y compris participants)
                </button>
              </div>
          )}
          {/* Légende des valeurs Fibonacci pour les admins (gardée sur la gauche) */}
          {admin && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 shadow-sm mt-8 w-full">
              <h4 className="m-0 text-gray-700 mb-3 font-semibold text-lg">Légende des valeurs :</h4>
              {sortedFibonacciLabels.map(([value, description]) => (
                <div key={value} className="mb-1.5 flex items-baseline">
                  <span className="font-bold text-gray-800 text-base min-w-[30px]">{value} : </span>
                  <span className="text-gray-600 text-sm ml-2">{description}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zone des votes et affichages pour les votants */}
        {isLoggedIn && (
          <div className="border border-gray-200 p-6 rounded-lg flex-grow shadow-lg bg-white grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Section affichage total votant / total groupe pour les votants */}
            {userValidated && (
              <div className="col-span-full border-b border-dashed border-gray-200 pb-5 mb-6">
                {finishedVoting[pseudo] && ( // N'affiche le total personnel que si l'utilisateur a cliqué "J'ai terminé"
                  <p className="font-bold text-xl text-blue-600 mb-3">
                    Votre estimation totale : {calculatePersonalTotal()}
                  </p>
                )}
                {revealed && ( // N'affiche le total groupe que si c'est révélé
                  <p className="font-bold text-xl text-green-600">
                    Estimation totale du groupe : {totalEstimate()}
                  </p>
                )}
              </div>
            )}

            {/* Légende des valeurs Fibonacci pour les VOTANTS (maintenant sur la gauche) */}
            {userValidated && !admin && ( // S'affiche pour les votants et non pour l'admin
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 shadow-sm self-start h-min lg:col-span-1">
                <h4 className="m-0 text-gray-700 mb-3 font-semibold text-lg">Légende des valeurs :</h4>
                {sortedFibonacciLabels.map(([value, description]) => (
                  <div key={value} className="mb-1.5 flex items-baseline">
                    <span className="font-bold text-gray-800 text-base min-w-[30px]">{value} : </span>
                    <span className="text-gray-600 text-sm ml-2">{description}</span>
                  </div>
                ))}
              </div>
            )}

            <div className={`${userValidated && !admin ? "lg:col-span-1" : "col-span-full"}`}>
              {phases.map((phase, index) => (
                <React.Fragment key={phase}>
                  <div className={`mb-8 p-5 rounded-lg bg-gray-50 shadow-md ${admin ? "border border-gray-200" : ""}`}>
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">{phase}</h3>

                    <div className="flex flex-wrap gap-2 items-center mb-5">
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
                              className={`px-4 py-2 rounded-full text-base font-medium transition-all duration-200 shadow-sm
                                ${isSelected ? "border-2 border-blue-600 bg-blue-200 text-blue-800" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"}
                                ${isDisabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer hover:shadow-md"}
                              `}
                              title={sortedFibonacciLabels.find(([v,d]) => parseFloat(v) === val)?.[1] || ""}
                            >
                              {val}
                            </button>
                          );
                        })
                      }
                      {admin && (
                        <button
                          onClick={() => resetPhaseVotes(phase)}
                          className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50 text-sm ml-auto shadow-md transition duration-200 ease-in-out"
                          title="Réinitialiser les votes pour cette phase uniquement"
                        >
                          Reset Phase
                        </button>
                      )}
                    </div>

                    {revealed && ( // Affichage des détails par phase pour tous (votants et admin)
                      <div className="mt-5 border-t border-dashed border-gray-200 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <p className="font-bold text-blue-700 mb-3 text-lg">
                            Moyenne du groupe : {calculateAverage(votes[phase]).toFixed(2)}
                          </p>
                          <h4 className="font-semibold text-gray-700 mb-3 text-base">Votes par valeur :</h4>
                          <ul className="list-none p-0">
                            {fibonacciValues.map((val) => {
                              const currentPhaseVotes: Record<string, number> = votes[phase] || {};
                              const count = Object.values(currentPhaseVotes).filter(
                                (v) => v === val
                              ).length;

                              return (
                                count > 0 && (
                                  <li key={`${phase}-count-${val}`} className="mb-1.5 text-gray-700">
                                    <span className="font-normal">{val} : </span>
                                    <span className="font-bold text-purple-700">
                                      {count} vote{count > 1 ? "s" : ""}
                                    </span>
                                  </li>
                                )
                              );
                            })}
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-semibold text-gray-700 mb-3 text-base">Détails des votes :</h4>
                          <ul className="list-none p-0">
                            {participants.map((participantName) => {
                              const voteValue = votes[phase]?.[participantName];
                              return (
                                <li key={`${phase}-${participantName}`} className="mb-1.5 text-gray-700">
                                  <span className="font-normal">{participantName} : </span>
                                  <span className={`font-bold ${voteValue !== undefined ? 'text-gray-800' : 'text-red-500'}`}>
                                    {voteValue !== undefined ? voteValue : "N'a pas voté"}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>{/* Fin de la div de la phase */}
                  {/* Barre de séparation pour l'admin, sauf après la dernière phase */}
                  {admin && index < phases.length - 1 && (
                    <hr className="border-none border-t border-dashed border-gray-300 my-6" />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Le bouton "J'ai terminé l'estimation" */}
            {userValidated && (!finishedVoting[pseudo] || modifiedVoting[pseudo]) && !revealed && (
              <button
                onClick={handleFinishEstimation}
                className="mt-6 p-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 w-full md:w-auto col-span-full justify-self-start shadow-lg transition duration-200 ease-in-out"
              >
                J'ai terminé l'estimation
              </button>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
