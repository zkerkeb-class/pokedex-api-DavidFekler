import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

dotenv.config();

// Configuration MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/pokedex";

// Schéma Utilisateur
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Le nom d\'utilisateur est obligatoire'],
    unique: true,
    trim: true,
    minlength: [3, 'Le nom d\'utilisateur doit contenir au moins 3 caractères']
  },
  email: {
    type: String,
    required: [true, 'L\'adresse email est obligatoire'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Veuillez fournir une adresse email valide']
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est obligatoire'],
    minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Schéma Pokémon
const pokemonSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    french: String,
    english: String,
    japanese: String,
    chinese: String
  },
  type: [String],
  base: {
    HP: Number,
    Attack: Number,
    Defense: Number,
    "Sp. Attack": Number,
    "Sp. Defense": Number,
    Speed: Number
  },
  image: String
});

const Pokemon = mongoose.model('Pokemon', pokemonSchema);
const User = mongoose.model('User', userSchema);

// Connexion à MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connecté');
    // Vérifier si la collection 'users' existe et la créer si nécessaire
    mongoose.connection.db.listCollections({ name: 'users' }).toArray()
      .then(collections => {
        if (collections.length === 0) {
          console.log('Collection "users" non trouvée, création en cours...');
          mongoose.connection.db.createCollection('users')
            .then(() => console.log('Collection "users" créée avec succès'))
            .catch(err => console.error('Erreur lors de la création de la collection users:', err));
        } else {
          console.log('Collection "users" déjà existante');
        }
      })
      .catch(err => console.error('Erreur lors de la vérification des collections:', err));
  })
  .catch(err => console.error('Erreur de connexion MongoDB:', err));

// Initialisation Express
const app = express();
const PORT = 3000;

// Middleware pour CORS
app.use(cors());

// Middleware pour parser le JSON
app.use(express.json());

// Chemin des assets
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware pour servir des fichiers statiques
app.use("/assets", express.static(path.join(__dirname, "../assets")));

// Route pour l'inscription
app.post("/auth/register", async (req, res) => {
  try {
    console.log('Tentative de création d\'un compte utilisateur:', req.body);
    const { username, email, password } = req.body;

    // Vérification des données
    if (!username || !email || !password) {
      console.log('Données manquantes:', { username: !!username, email: !!email, password: !!password });
      return res.status(400).json({ message: 'Tous les champs sont obligatoires' });
    }

    // Vérifier si l'email existe déjà
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      console.log('Email déjà utilisé:', email);
      return res.status(400).json({ message: 'Cette adresse email est déjà utilisée' });
    }

    // Vérifier si le nom d'utilisateur existe déjà
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      console.log('Nom d\'utilisateur déjà pris:', username);
      return res.status(400).json({ message: 'Ce nom d\'utilisateur est déjà pris' });
    }

    // Hacher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Créer un nouvel utilisateur
    const user = new User({
      username,
      email,
      password: hashedPassword
    });

    console.log('Utilisateur à créer:', {
      username: user.username,
      email: user.email,
      passwordLength: user.password ? user.password.length : 0
    });

    // Enregistrer l'utilisateur dans la base de données
    await user.save();
    console.log('Utilisateur créé avec succès:', user._id);

    // Supprimer le mot de passe de la réponse
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt
    };

    res.status(201).json({ 
      message: 'Compte créé avec succès',
      user: userResponse
    });
  } catch (error) {
    console.error('Erreur détaillée lors de l\'inscription:', error);
    
    if (error.name === 'ValidationError') {
      // Erreurs de validation Mongoose
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    if (error.code === 11000) {
      // Erreur de duplicate key (index unique)
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `Ce ${field} est déjà utilisé` 
      });
    }
    
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la création du compte', 
      error: error.message 
    });
  }
});

// Route pour la connexion
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Vérifier que tous les champs sont remplis
    if (!email || !password) {
      return res.status(400).json({ message: 'Tous les champs sont obligatoires' });
    }
    
    // Rechercher l'utilisateur par email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    // Vérifier le mot de passe
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    // Créer la réponse utilisateur sans le mot de passe
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt
    };
    
    // Renvoyer la réponse avec les informations de l'utilisateur
    res.status(200).json({
      message: 'Connexion réussie',
      user: userResponse
    });
    
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la connexion',
      error: error.message
    });
  }
});

// Routes API
app.get("/api/pokemons", async (req, res) => {
  try {
    const pokemons = await Pokemon.find({});
    res.status(200).send({
      pokemons: pokemons
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des pokémons:', error);
    res.status(500).send({ 
      error: "Erreur lors de la récupération des pokémons",
      details: error.message
    });
  }
});

app.post("/api/pokemons", async (req, res) => {
  try {
    // Extraire les données envoyées par le client
    const pokemonData = req.body;
    
    // Créer un nouveau Pokémon
    const newPokemon = new Pokemon(pokemonData);
    await newPokemon.save();
    
    res.status(201).send({
      message: "Pokémon ajouté avec succès.",
      pokemon: newPokemon
    });
  } catch (error) {
    console.error('Erreur lors de l\'ajout du pokémon:', error);
    res.status(500).send({ 
      error: "Erreur lors de l'ajout du pokémon",
      details: error.message
    });
  }
});

app.get("/api/pokemons/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pokemon = await Pokemon.findOne({ id: id });
    
    if (!pokemon) {
      return res.status(404).send({ message: "Pokémon non trouvé." });
    }
    
    res.status(200).send(pokemon);
  } catch (error) {
    console.error('Erreur lors de la récupération du pokémon:', error);
    res.status(500).send({ 
      error: "Erreur lors de la récupération du pokémon",
      details: error.message
    });
  }
});

app.put("/api/pokemons/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updatedData = req.body;
    
    const updatedPokemon = await Pokemon.findOneAndUpdate(
      { id: id },
      updatedData,
      { new: true }
    );
    
    if (!updatedPokemon) {
      return res.status(404).send({ message: "Pokémon non trouvé." });
    }
    
    res.status(200).send({
      message: "Pokémon mis à jour avec succès.",
      pokemon: updatedPokemon
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du pokémon:', error);
    res.status(500).send({ 
      error: "Erreur lors de la mise à jour du pokémon",
      details: error.message
    });
  }
});

app.delete("/api/pokemons/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deletedPokemon = await Pokemon.findOneAndDelete({ id: id });
    
    if (!deletedPokemon) {
      return res.status(404).send({ message: "Pokémon non trouvé." });
    }
    
    res.status(200).send({
      message: "Pokémon supprimé avec succès.",
      pokemon: deletedPokemon
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du pokémon:', error);
    res.status(500).send({ 
      error: "Erreur lors de la suppression du pokémon",
      details: error.message
    });
  }
});

app.get("/", (req, res) => {
  res.send("Bienvenue sur l'API Pokémon MongoDB");
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
