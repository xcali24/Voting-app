const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = {};
let votes = {};
let votingOpen = false;

// NEU: Reveal-Status
let revealOrder = [];
let revealIndex = 0;

io.on("connection", (socket) => {
    console.log("Ein Benutzer ist verbunden");

    socket.emit("playerList", Object.keys(players));

    socket.on("requestPlayerList", () => {
        socket.emit("playerList", Object.keys(players));
    });

    socket.on("addPlayer", (name) => {
        if (!players[name]) {
            players[name] = { hearts: 3, votedFor: null };
            votes[name] = 0;
            io.emit("playerList", Object.keys(players));
            sendDetailedResults();
        }
    });

    socket.on("removePlayer", (name) => {
        delete players[name];
        delete votes[name];
        io.emit("playerList", Object.keys(players));
        sendDetailedResults();
    });

    socket.on("identify", (name) => {
        socket.playerName = name;
    });

   socket.on("vote", (target) => {
    console.log("Vote erhalten:", socket.playerName, "->", target);

    if (!votingOpen) {
        console.log("Vote blockiert: Voting nicht offen");
        return;
    }

    const voter = socket.playerName;
    if (!voter || !players[voter]) {
        console.log("Vote blockiert: Spieler nicht erkannt");
        return;
    }

    const oldTarget = players[voter].votedFor;

    // alten Vote entfernen
    if (oldTarget && votes[oldTarget]) {
        votes[oldTarget]--;
    }

    // neuen Vote setzen
    players[voter].votedFor = target;
    votes[target] = (votes[target] || 0) + 1;

    socket.emit("yourVote", target);

    console.log("Vote gespeichert:", voter, "->", target);

    sendDetailedResults();
});



   socket.on("startVoting", () => {
    votingOpen = true;

    // Votes zurücksetzen
    for (let p in players) {
        players[p].votedFor = null;
        votes[p] = 0;
    }

    revealOrder = Object.keys(players);
    revealIndex = 0;

    sendDetailedResults();

    // NEU: allen Spielern sagen, dass ihr Vote zurückgesetzt wurde
    io.emit("resetVotes");
});

    socket.on("stopVoting", () => {
        votingOpen = false;
    });

    socket.on("revealVotes", () => {
        revealOrder = Object.keys(players);
        revealIndex = revealOrder.length;
        io.emit("revealAllVotes", players);
    });

    socket.on("revealNextVote", () => {
        if (revealOrder.length === 0) {
            revealOrder = Object.keys(players);
            revealIndex = 0;
        }

        if (revealIndex >= revealOrder.length) return;

        const name = revealOrder[revealIndex];
        const data = players[name];

        io.emit("revealSingleVote", { name, data });

        revealIndex++;
    });

    socket.on("hideVotes", () => {
        revealOrder = [];
        revealIndex = 0;
        io.emit("hideVotes");
    });

    socket.on("changeHearts", ({ player, amount }) => {
        if (!players[player]) return;

        players[player].hearts += amount;
        if (players[player].hearts < 0) players[player].hearts = 0;
        if (players[player].hearts > 3) players[player].hearts = 3;

        sendDetailedResults();
    });

    socket.on("disconnect", () => {
        console.log("Ein Benutzer hat die Verbindung getrennt");
    });
});

function sendDetailedResults() {
    const result = {};

    for (let name in players) {
        result[name] = {
            votedFor: players[name].votedFor,
            votes: votes[name] || 0,
            hearts: players[name].hearts
        };
    }

    io.emit("detailedResults", result);
}

server.listen(3000, () => {
    console.log("Server läuft auf http://localhost:3000");
});
