import express from "express";
import cors from "cors";
import fs from 'fs';
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

// Lire le fichier JSON
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pokemonsList = JSON.parse(fs.readFileSync(path.join(__dirname, './data/pokemons.json'), 'utf8'));

const app = express();
const PORT = 3000;

// Middleware pour CORS
app.use(cors());

// Middleware pour parser le JSON
app.use(express.json());

// Middleware pour servir des fichiers statiques
app.use("/assets", express.static(path.join(__dirname, "../assets")));

app.get("/api/pokemons", (req, res) => {
    res.status(200).send({
        pokemons: pokemonsList,
    });
});

app.post("/api/pokemons", (req, res) => {
    // Extraire les données envoyées par le client dans la requête
    const newPokemon = req.body;

    // Ajouter le nouveau Pokémon à la liste
    pokemonsList.push(newPokemon);
    const filePath = path.join(__dirname, 'data', 'pokemons.json');
    fs.writeFileSync(filePath, JSON.stringify(pokemonsList, null, 2), 'utf-8');

    // Répondre au client avec un message de succès
    res.status(201).send({
        message: "Pokémon ajouté avec succès.",
        pokemon: newPokemon,
    });
});

app.get("/api/pokemons/:id", (req, res) => {
    const id = parseInt(req.params.id); // Convertit l'ID en entier

    // Trouver le Pokémon correspondant
    const pokemon = pokemonsList.find(p => p.id === id);

    if (!pokemon) {
        return res.status(404).send({ message: "Pokémon non trouvé." });
    }

    res.status(200).send(pokemon);
});

app.put("/api/pokemons/:id", (req, res) => {
    const id = parseInt(req.params.id); // Récupère l'ID du Pokémon à modifier
    const updatedPokemon = req.body; // Récupère les nouvelles données du Pokémon

    // Trouver l'index du Pokémon dans la liste
    const index = pokemonsList.findIndex(p => p.id == id);

    if (index === -1) {
        return res.status(404).send({ message: "Pokémon non trouvé." });
    }

    // Remplacer l'ancien Pokémon par le nouveau
    pokemonsList[index] = { ...pokemonsList[index], ...updatedPokemon };

    // Sauvegarde la liste mise à jour dans le fichier JSON
    const filePath = path.join(__dirname, 'data', 'pokemons.json');
    fs.writeFileSync(filePath, JSON.stringify(pokemonsList, null, 2), 'utf-8');

    res.status(200).send({
        message: "Pokémon mis à jour avec succès.",
        pokemon: pokemonsList[index],
    });
});

app.delete("/api/pokemons/:id", (req, res) => {
    const id = parseInt(req.params.id); // Convertit l'ID en entier

    // Trouver l'index du Pokémon à supprimer
    const index = pokemonsList.findIndex(p => p.id === id);

    if (index === -1) {
        return res.status(404).send({ message: "Pokémon non trouvé." });
    }

    // Supprimer le Pokémon de la liste
    const deletedPokemon = pokemonsList.splice(index, 1)[0];

    // Sauvegarde la liste mise à jour dans le fichier JSON
    const filePath = path.join(__dirname, 'data', 'pokemons.json');
    fs.writeFileSync(filePath, JSON.stringify(pokemonsList, null, 2), 'utf-8');

    res.status(200).send({
        message: "Pokémon supprimé avec succès.",
        pokemon: deletedPokemon,
    });
});

app.get("/", (req, res) => {
    res.send("bienvenue sur l'API Pokémon");
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
