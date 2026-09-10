const gameContainer = document.querySelector("#game-container");
const scoreText = document.querySelector("#score-text");
const resetButton = document.querySelector("#reset-button");
const timerText = document.querySelector("#timer-text");

const GAME_WIDTH = 800;
const GAME_HEIGHT = 500;

const SLING_X = 140;
const SLING_Y = 380;

let engine;
let render;
let runner;
let mouseConstraint;

let ball;
let sling;
let targets = [];

let score = 0;
let firing = false;
let roundResetTimer = null;

const NUM_TARGETS = 4;
const TARGET_MIN_Y = 130;
const TARGET_MAX_Y = 360;
const TARGET_RESPAWN_DELAY = 900;

let gameId = 0;

const ROUND_SECONDS = 60;
let timeRemaining = ROUND_SECONDS;
let timerInterval = null;
let roundOver = false;


function startTimer() {
    timeRemaining = ROUND_SECONDS;
    timerText.textContent = `Time: ${timeRemaining}`;
    roundOver = false;

    clearInterval(timerInterval);
    timerInterval = setInterval(function () {
        timeRemaining--;
        timerText.textContent = `Time: ${timeRemaining}`;

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            endRound();
        }
    }, 1000);
}

function endRound() {
    roundOver = true;

    if (mouseConstraint) {
        mouseConstraint.constraint.stiffness = 0;
    }
}

// -------------------------
// SCORE
// -------------------------

function updateScore(points) {
    score += points;
    scoreText.textContent = `Score: ${score}`;
}


// -------------------------
// CREATE BALL
// -------------------------

function makeBall() {
    return Matter.Bodies.circle(
        SLING_X,
        SLING_Y,
        20,
        {
            restitution: 0.5,
            friction: 0.01,
            density: 0.004
        }
    );
}


// -------------------------
// CREATE SLINGSHOT
// -------------------------

function makeSling(body) {
    return Matter.Constraint.create({
        pointA: {
            x: SLING_X,
            y: SLING_Y
        },
        bodyB: body,
        stiffness: 0.05,
        length: 0
    });
}


// -------------------------
// CREATE TARGETS
// -------------------------

// Each target is a kinematic (isStatic) body whose position we move by
// hand every tick, following a sine wave. isStatic keeps it unaffected
// by gravity/forces while still colliding correctly with the ball.
function makeTarget(slot) {

    const baseX = 560 + slot * 65;
    const baseY = (TARGET_MIN_Y + TARGET_MAX_Y) / 2;

    const body = Matter.Bodies.polygon(
        baseX,
        baseY,
        8,
        26,
        {
            isStatic: true,
            restitution: 0.2,
            friction: 0.8,
            render: {
                fillStyle: "#f39c12"
            }
        }
    );

    return {
        body: body,
        slot: slot,
        baseX: baseX,
        baseY: baseY,
        amplitude: (TARGET_MAX_Y - TARGET_MIN_Y) / 2 - 10,
        speed: 0.0012 + Math.random() * 0.0015,
        phase: Math.random() * Math.PI * 2
    };
}

function makeTargets() {
    const list = [];
    for (let slot = 0; slot < NUM_TARGETS; slot++) {
        list.push(makeTarget(slot));
    }
    return list;
}

function removeTarget(body) {

    const index = targets.findIndex(function (t) {
        return t.body === body;
    });

    if (index === -1) {
        return;
    }

    const slot = targets[index].slot;
    const thisGameId = gameId;

    targets.splice(index, 1);
    Matter.World.remove(engine.world, body);

    setTimeout(
        function () {

            // Only respawn if the game hasn't been reset in the meantime
            if (thisGameId !== gameId) {
                return;
            }

            const meta = makeTarget(slot);
            targets.push(meta);
            Matter.World.add(engine.world, meta.body);
        },
        TARGET_RESPAWN_DELAY
    );
}


// -------------------------
// CREATE GAME
// -------------------------

function createGame() {

    gameId++;

    // Clear the old Matter.js canvas
    gameContainer.innerHTML = "";

    // Create Matter engine
    engine = Matter.Engine.create();

    engine.world.gravity.y = 1;

    // Create Matter renderer INSIDE game-container
    render = Matter.Render.create({
        element: gameContainer,
        engine: engine,
        options: {
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
            wireframes: false,
            background: "#bad7dd"
        }
    });

    // Create runner
    runner = Matter.Runner.create();


    // -------------------------
    // BOUNDARIES
    // -------------------------

    const ground = Matter.Bodies.rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 10,
        GAME_WIDTH,
        20,
        {
            isStatic: true,
            render: {
                fillStyle: "#555555"
            }
        }
    );

    const leftWall = Matter.Bodies.rectangle(
        0,
        GAME_HEIGHT / 2,
        20,
        GAME_HEIGHT,
        {
            isStatic: true
        }
    );

    const rightWall = Matter.Bodies.rectangle(
        GAME_WIDTH,
        GAME_HEIGHT / 2,
        20,
        GAME_HEIGHT,
        {
            isStatic: true
        }
    );


    // -------------------------
    // BALL
    // -------------------------

    ball = makeBall();

    ball.render.fillStyle = "#e74c3c";

    function spawnNewBall() {
        ball = makeBall();
        ball.render.fillStyle = "#e74c3c";
        sling = makeSling(ball);

        Matter.World.add(engine.world, [ball, sling]);
    }

    // -------------------------
    // SLING
    // -------------------------

    sling = makeSling(ball);


    // -------------------------
    // TARGETS
    // -------------------------

    targets = makeTargets();


    // -------------------------
    // MOUSE CONTROL
    // -------------------------

    const mouse = Matter.Mouse.create(render.canvas);

    mouseConstraint = Matter.MouseConstraint.create(
        engine,
        {
            mouse: mouse,
            constraint: {
                stiffness: 0.2,
                render: {
                    visible: false
                }
            }
        }
    );

    render.mouse = mouse;


    // -------------------------
    // DETECT WHEN BALL IS FIRED
    // -------------------------

    firing = false;

    Matter.Events.on(
        mouseConstraint,
        "enddrag",
        function (event) {

            if (event.body === ball) {
                firing = true;
            }
        }
    );


    // -------------------------
    // MOVE TARGETS
    // -------------------------

    Matter.Events.on(
        engine,
        "beforeUpdate",
        function (event) {

            const time = event.timestamp;

            targets.forEach(function (meta) {

                const y = meta.baseY + Math.sin(time * meta.speed + meta.phase) * meta.amplitude;

                Matter.Body.setPosition(
                    meta.body,
                    {
                        x: meta.baseX,
                        y: y
                    }
                );
            });
        }
    );


    // -------------------------
    // COLLISION DETECTION
    // -------------------------

    Matter.Events.on(
        engine,
        "collisionStart",
        function (event) {

            event.pairs.forEach(function (pair) {

                let bodyA = pair.bodyA;
                let bodyB = pair.bodyB;

                let hitTargetBody = null;

                if (bodyA === ball && targets.some(function (t) { return t.body === bodyB; })) {
                    hitTargetBody = bodyB;
                } else if (bodyB === ball && targets.some(function (t) { return t.body === bodyA; })) {
                    hitTargetBody = bodyA;
                }

                if (hitTargetBody) {
                    updateScore(10);
                    removeTarget(hitTargetBody);
                    
                    //Remove ball when hit
                    if (ball) {
                        Matter.World.remove(engine.world, ball);
                        ball = null;
                        firing = false;
                        clearTimeout(roundResetTimer);

                        roundResetTimer = setTimeout(spawnNewBall, 700);
                    }
                }
            });
        }
    );


    // -------------------------
    // AFTER ENGINE UPDATE
    // -------------------------

    Matter.Events.on(
        engine,
        "afterUpdate",
        function () {

            if (!firing || !ball) {
                return;
            }

            // Once the ball has been released and moved away
            // from the slingshot, remove the sling.
            const distanceFromSling = Math.sqrt(
                Math.pow(ball.position.x - SLING_X, 2) +
                Math.pow(ball.position.y - SLING_Y, 2)
            );

            if (distanceFromSling > 50) {

                if (sling) {
                    Matter.World.remove(
                        engine.world,
                        sling
                    );

                    sling = null;
                }

                firing = false;

                // Create another ball after a short delay
                clearTimeout(roundResetTimer);

                roundResetTimer = setTimeout(spawnNewBall, 700);
            }
        }
    );


    // -------------------------
    // ADD EVERYTHING TO WORLD
    // -------------------------

    Matter.World.add(
        engine.world,
        [
            ground,
            leftWall,
            rightWall,
            ball,
            sling,
            mouseConstraint
        ]
    );

    Matter.World.add(
        engine.world,
        targets.map(function (meta) {
            return meta.body;
        })
    );


    // -------------------------
    // START GAME
    // -------------------------

    Matter.Runner.run(
        runner,
        engine
    );

    Matter.Render.run(
        render
    );

    startTimer();
}


// -------------------------
// RESET GAME
// -------------------------

resetButton.addEventListener(
    "click",
    function () {

        // Stop old game
        if (runner) {
            Matter.Runner.stop(runner);
        }

        if (render) {
            Matter.Render.stop(render);
        }

        clearTimeout(roundResetTimer);
        clearInterval(timerInterval);

        // Reset score
        score = 0;
        scoreText.textContent = "Score: 0";

        // Create a completely new game
        createGame();
    }
);


// -------------------------
// START GAME WHEN PAGE LOADS
// -------------------------

createGame();