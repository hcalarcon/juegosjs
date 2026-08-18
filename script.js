const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const img = new Image();
img.src = "img/lancha.png";

// ----------------------
// CONFIGURACIÓN
// ----------------------

const bird = {
    x: 90,
    y: 250,
    width: 90,
    height: 60,
    velocity: 0
};

const gravity = 0.45;
const jump = -8;

const pipes = [];
let frame = 0;
let score = 0;
let gameOver = false;

// ----------------------
// HITBOX
// ----------------------
// Cambiá estos números hasta que quede perfecta.

const hitbox = {
    offsetX: 18,
    offsetY: 12,
    width: 40,
    height: 22
};

// ----------------------
function loseGame() {
    if (gameOver) return;

    gameOver = true;

    // Detener el movimiento
    bird.velocity = 0;

    // Mostrar Game Over
    setTimeout(() => {
        loseGame();
        return;
    }, 50);
}

function addPipe() {
    pipes.push({
        x: 480,
        h: 80 + Math.random() * 280,
        scored: false
    });
}

addPipe();

document.onkeydown = e => {
    if (e.code === "Space") {
        bird.velocity = jump;
    }
};

function gameLoop() {

    requestAnimationFrame(gameLoop);

    frame++;

    if (frame % 90 === 0)
        addPipe();

    bird.velocity += gravity;
    bird.y += bird.velocity;

    ctx.clearRect(0,0,480,640);

    ctx.fillStyle="#6cf";
    ctx.fillRect(0,0,480,640);

    // Dibujar lancha

    if(img.complete){
        ctx.drawImage(
            img,
            bird.x,
            bird.y,
            bird.width,
            bird.height
        );
    }

    // ----------------------
    // HITBOX REAL
    // ----------------------

    const hbLeft   = bird.x + hitbox.offsetX;
    const hbRight  = hbLeft + hitbox.width;

    const hbTop    = bird.y + hitbox.offsetY;
    const hbBottom = hbTop + hitbox.height;

    // Descomentar para verla

    /*
    ctx.strokeStyle = "red";
    ctx.strokeRect(
        hbLeft,
        hbTop,
        hitbox.width,
        hitbox.height
    );
    */

    // ----------------------

    for(let i=pipes.length-1;i>=0;i--){

        let pipe = pipes[i];

        pipe.x -= 2.5;

        ctx.fillStyle="green";

        ctx.fillRect(
            pipe.x,
            0,
            60,
            pipe.h
        );

        ctx.fillRect(
            pipe.x,
            pipe.h+170,
            60,
            640
        );

        // ----------------------
        // COLISIÓN
        // ----------------------

        if(
            hbRight > pipe.x &&
            hbLeft < pipe.x + 60 &&
            (
                hbTop < pipe.h ||
                hbBottom > pipe.h + 170
            )
        ){
            alert("Game Over! Score " + score);
            location.reload();
        }

        // ----------------------

        if(pipe.x+60<bird.x && !pipe.scored){
            pipe.scored=true;
            score++;

            document.getElementById("s").textContent=score;
        }

        if(pipe.x<-60){
            pipes.splice(i,1);
        }

    }

    if(bird.y < 0 || bird.y > 580){
        loseGame();
        return;
    }

}

gameLoop();
