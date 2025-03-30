const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDnFYbHg1Swv42Fl7HXwTYWPT58NoR6rK0",
  authDomain: "cbt-chat-b4012.firebaseapp.com",
  projectId: "cbt-chat-b4012",
  storageBucket: "cbt-chat-b4012.firebasestorage.app",
  messagingSenderId: "271732410751",
  appId: "1:271732410751:web:421221458852006d58b24a",
  measurementId: "G-ZERDV0HDQF"
};

// Initialiser Firebase
const appFirebase = initializeApp(firebaseConfig);
const db = getFirestore(appFirebase);

const app = express();
const port = 4000; // Nouveau port 4000 pour éviter le conflit avec React

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(bodyParser.json());

let conversationContext = [];  // Pour garder le contexte de la conversation
let questionCount = 0;  // Compteur de questions posées par le patient

// Route de chat
app.post('/chat', async (req, res) => {
  try {
    const { message, model, language } = req.body;
    console.log("Message reçu:", message);
    console.log("Modèle sélectionné:", model);
    console.log("Langue sélectionnée:", language);

    // Vérifier si le nombre de questions dépasse 6
    if (questionCount >= 6) {
      res.json({ reply: "Au revoir et prenez soin de vous. À bientôt !" });
      questionCount = 0;  // Réinitialiser le compteur après le message de fin
      conversationContext = [];  // Réinitialiser le contexte de la conversation
      return;
    }

    // Ajouter le message de l'utilisateur au contexte
    conversationContext.push({ role: "user", content: message });
    questionCount++;  // Incrémenter le compteur de questions

    // Déterminer la langue de réponse selon l'entrée
    let systemMessageContent = '';
    if (language === 'fr') {
      systemMessageContent = 'Tu es un psychologue bienveillant et attentionné chargé d’aider une personne à mieux comprendre ses pensées, ses émotions et ses comportements. Tu poses des questions ouvertes et profondes qui amènent l’utilisateur à réfléchir sur ses expériences et ses motivations.';
    } else if (language === 'en') {
      systemMessageContent = 'You are a kind and attentive psychologist tasked with helping a person better understand their thoughts, emotions, and behaviors. You ask open-ended and deep questions that lead the user to reflect on their experiences and motivations.';
    } else if (language === 'ar') {
      systemMessageContent = 'أنت أخصائي نفسي طيب ومهتم يساعد الشخص على فهم أفكاره وعواطفه وسلوكياته بشكل أفضل. تطرح أسئلة مفتوحة وعميقة تجعل المستخدم يفكر في تجاربه ودوافعه.';
    }

    // Utiliser GPT-3/4 ou autre modèle pour générer une réponse basée sur la question
    const response = await axios.post('http://127.0.0.1:11434/v1/chat/completions', {
      model: model,
      messages: [
        { role: "system", content: systemMessageContent },
        ...conversationContext,
      ]
    });

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      const chatbotReply = response.data.choices[0].message.content;

      // Ajouter la réponse du chatbot au contexte
      conversationContext.push({ role: "assistant", content: chatbotReply });

      // Sauvegarde dans Firebase
      await addDoc(collection(db, 'chats'), {
        message: message,
        reply: chatbotReply,
        model: model,
        language: language,
        timestamp: new Date()
      });

      res.json({ reply: chatbotReply });
    } else {
      res.status(500).json({ error: "Réponse invalide du chatbot." });
    }
  } catch (error) {
    console.error("Erreur de communication avec l'API:", error.message);
    res.status(500).json({ error: "Erreur lors de la communication avec le serveur." });
  }
});

// Route pour récupérer l'historique des chats
app.get('/history', async (req, res) => {
  try {
    const chatSnapshot = await getDocs(collection(db, 'chats'));
    const chatHistory = chatSnapshot.docs.map(doc => doc.data());
    res.json(chatHistory);
  } catch (error) {
    console.error("Erreur de récupération de l'historique:", error.message);
    res.status(500).json({ error: "Impossible de récupérer l'historique." });
  }
});

// Lancer le serveur
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
