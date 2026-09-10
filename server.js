const http = require("http");
const fs = require("fs");
const mime = require("mime");

const dir = "public/";
const port = 3000;

// Server-side tabular dataset.
// Each row has 4 original fields plus a derived field (scoreLevel).
let appdata = [
    {
        name: "Demo Player",
        score: 5,
        comment: "Example score",
        submittedAt: "2026-09-02T18:00:00.000Z",
        scoreLevel: "Beginner"
    }
];

const server = http.createServer((request, response) => {
    if (request.method === "GET") {
        handleGet(request, response);
    } else if (request.method === "POST") {
        handlePost(request, response);
    } else if (request.method === "PUT") {
        handlePut(request, response);
    } else if (request.method === "DELETE") {
        handleDelete(request, response);
    } else {
        response.writeHead(405, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "Method not allowed" }));
    }
});

function sendJSON(response, statusCode, data) {
    response.writeHead(statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify(data));
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.on("data", chunk => body += chunk);
        request.on("end", () => resolve(body));
        request.on("error", reject);
    });
}

// Required server-side derived field.
// It is computed only from the score already present in the incoming row.
function addDerivedField(item) {
    const score = Number(item.score) || 0;

    let scoreLevel = "Beginner";
    if (score >= 200) {
        scoreLevel = "Expert";
    } else if (score >= 100) {
        scoreLevel = "Advanced";
    }

    return {
        ...item,
        score,
        scoreLevel
    };
}

function cleanIncomingData(data) {
    return {
        name: String(data.name || "").trim().slice(0, 40),
        score: Number.isFinite(Number(data.score)) ? Math.max(0, Number(data.score)) : 0,
        comment: String(data.comment || "").trim().slice(0, 300),
        submittedAt: data.submittedAt || new Date().toISOString()
    };
}

async function handlePost(request, response) {
    try {
        const raw = await readBody(request);
        const incoming = JSON.parse(raw || "{}");

        if (!incoming.name) {
            return sendJSON(response, 400, { error: "Name is required." });
        }

        if (!incoming.comment && incoming.score === undefined) {
            return sendJSON(response, 400, { error: "A score or comment is required." });
        }

        const row = addDerivedField(cleanIncomingData(incoming));
        appdata.push(row);

        sendJSON(response, 201, appdata);
    } catch (error) {
        sendJSON(response, 400, { error: "Invalid JSON data." });
    }
}

async function handlePut(request, response) {
    try {
        const raw = await readBody(request);
        const incoming = JSON.parse(raw || "{}");
        const index = Number(incoming.index);

        if (!Number.isInteger(index) || index < 0 || index >= appdata.length) {
            return sendJSON(response, 404, { error: "Entry not found." });
        }

        const updated = addDerivedField(cleanIncomingData(incoming));
        appdata[index] = updated;

        sendJSON(response, 200, appdata);
    } catch (error) {
        sendJSON(response, 400, { error: "Invalid JSON data." });
    }
}

async function handleDelete(request, response) {
    try {
        const raw = await readBody(request);
        const incoming = JSON.parse(raw || "{}");
        const index = Number(incoming.index);

        if (!Number.isInteger(index) || index < 0 || index >= appdata.length) {
            return sendJSON(response, 404, { error: "Entry not found." });
        }

        appdata.splice(index, 1);
        sendJSON(response, 200, appdata);
    } catch (error) {
        sendJSON(response, 400, { error: "Invalid JSON data." });
    }
}

function handleGet(request, response) {
    if (request.url === "/api/data") {
        return sendJSON(response, 200, appdata);
    }

    const filename = request.url === "/" ? "public/index.html" : dir + request.url.slice(1);
    sendFile(response, filename);
}

function sendFile(response, filename) {
    const type = mime.getType(filename) || "text/plain";

    fs.readFile(filename, (error, content) => {
        if (error) {
            response.writeHead(404, { "Content-Type": "text/plain" });
            response.end("404 Error: File Not Found");
        } else {
            response.writeHead(200, { "Content-Type": type });
            response.end(content);
        }
    });
}

server.listen(process.env.PORT || port, () => {
    console.log(`Snake game server running on port ${process.env.PORT || port}`);
});
